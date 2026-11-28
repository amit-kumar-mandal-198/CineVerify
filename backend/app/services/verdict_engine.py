"""Multi-signal verdict decision engine (owned by Member 1)."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import List, Optional, Tuple

from app.core.models_config import (
    MIN_CONTRADICTION_CONFIDENCE,
    MIN_CREDIBILITY_FOR_VERIFIED,
    MIN_VERIFIED_SUPPORT_COUNT,
    OUTDATED_GAP_DAYS,
)
from app.schemas.claim import ClaimCategory, ClaimResult
from app.schemas.evidence import EvidencePassage, StanceLabel
from app.schemas.verdict import NLIResult, VerdictLabel, VerdictOutput

_STRONG_STANCE_CONFIDENCE = 0.65
_EVERGREEN_PAST_MILESTONE_RE = re.compile(
    r"\b(crossed|grossed|earned|collected|became|won|completed)\b",
    re.IGNORECASE,
)
_RECENCY_CUE_RE = re.compile(
    r"\b(today|now|currently|latest|this week|this month|recently|just|releasing|slated|set to|upcoming|walks out|joins)\b",
    re.IGNORECASE,
)
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%b %d %Y",
    "%B %d %Y",
)


def _parse_date(raw_date: Optional[str]) -> Optional[date]:
    """Parse ISO strings, common news date formats, or fallback year strings into a date."""
    if not raw_date:
        return None

    text = raw_date.strip()
    if not text:
        return None

    # Handle ISO 8601 timestamps such as 2026-11-27T10:00:00Z
    iso_candidate = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        return datetime.fromisoformat(iso_candidate).date()
    except ValueError:
        pass

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    # Fall back to extracting a 4-digit year (e.g., "Christmas 2027" -> 2027-07-01)
    year_match = re.search(r"\b((?:19|20)\d{2})\b", text)
    if year_match:
        return date(int(year_match.group(1)), 7, 1)

    return None


def _is_evergreen_historical_claim(claim_result: ClaimResult) -> bool:
    """Return True for historical past-tense milestone claims that do not expire after 180 days."""
    text = f"{claim_result.submitted_claim} {claim_result.core_claim}"
    if _RECENCY_CUE_RE.search(text):
        return False
    if claim_result.category == ClaimCategory.BOX_OFFICE:
        return True
    return bool(_EVERGREEN_PAST_MILESTONE_RE.search(text))


def _has_outdated_evidence(
    claim_result: ClaimResult,
    claim_date: Optional[date],
    supporting_passages: List[EvidencePassage],
    reference_today: date,
) -> bool:
    """Detect when supporting evidence is temporally stale relative to claim_date or today."""
    parsed_evidence_dates = [
        parsed
        for passage in supporting_passages
        if (parsed := _parse_date(passage.published_date)) is not None
    ]
    if not parsed_evidence_dates:
        return False

    if claim_date is None and _is_evergreen_historical_claim(claim_result):
        return False

    # If at least one credible supporting article is recent/aligned, do not penalize older background articles.
    for ev_date in parsed_evidence_dates:
        if claim_date is None or claim_date > reference_today:
            if (reference_today - ev_date).days <= OUTDATED_GAP_DAYS:
                return False
        else:
            if abs((claim_date - ev_date).days) <= OUTDATED_GAP_DAYS:
                return False

    return True


def _clamp_confidence(value: float, low: float = 0.0, high: float = 1.0) -> float:
    """Round and clamp confidence cleanly within [low, high]."""
    return round(max(low, min(high, value)), 4)


def generate_verdict(
    claim_result: ClaimResult,
    nli_results: List[NLIResult],
    passages: List[EvidencePassage],
) -> VerdictOutput:
    """Aggregate NLI stances, source credibility, temporal checks, and cross-source agreement."""
    if not passages or not nli_results:
        return VerdictOutput(verdict=VerdictLabel.UNVERIFIED, confidence=0.2)

    paired: List[Tuple[NLIResult, EvidencePassage]] = [
        (nli, passages[nli.passage_index])
        for nli in nli_results
        if 0 <= nli.passage_index < len(passages)
    ]
    if not paired:
        return VerdictOutput(verdict=VerdictLabel.UNVERIFIED, confidence=0.2)

    support_score = 0.0
    contradict_score = 0.0
    strong_supports: List[Tuple[NLIResult, EvidencePassage]] = []
    strong_contradicts: List[Tuple[NLIResult, EvidencePassage]] = []
    credible_strong_supports: List[Tuple[NLIResult, EvidencePassage]] = []
    credible_strong_contradicts: List[Tuple[NLIResult, EvidencePassage]] = []

    for nli, passage in paired:
        weighted = passage.credibility_score * nli.confidence
        if nli.stance == StanceLabel.SUPPORTS:
            support_score += weighted
            if nli.confidence >= _STRONG_STANCE_CONFIDENCE:
                strong_supports.append((nli, passage))
                if passage.credibility_score >= MIN_CREDIBILITY_FOR_VERIFIED:
                    credible_strong_supports.append((nli, passage))
        elif nli.stance == StanceLabel.CONTRADICTS:
            contradict_score += weighted
            if nli.confidence >= _STRONG_STANCE_CONFIDENCE:
                strong_contradicts.append((nli, passage))
                if passage.credibility_score >= MIN_CREDIBILITY_FOR_VERIFIED:
                    credible_strong_contradicts.append((nli, passage))

    has_credible_support = len(credible_strong_supports) > 0
    has_credible_contradict = len(credible_strong_contradicts) > 0

    # 1. Direct credible refutation dominates -> FALSE
    if has_credible_contradict and not has_credible_support:
        max_contradict_conf = max(nli.confidence for nli, _ in credible_strong_contradicts)
        if max_contradict_conf >= MIN_CONTRADICTION_CONFIDENCE and contradict_score > support_score:
            avg_conf = sum(nli.confidence for nli, _ in credible_strong_contradicts) / len(credible_strong_contradicts)
            avg_cred = sum(p.credibility_score for _, p in credible_strong_contradicts) / len(credible_strong_contradicts)
            return VerdictOutput(
                verdict=VerdictLabel.FALSE,
                confidence=_clamp_confidence(0.65 * avg_conf + 0.35 * avg_cred, low=0.55, high=0.98),
            )

    # 2. Conflicting credible sources OR outdated/stale supporting evidence -> MISLEADING
    claim_date = _parse_date(claim_result.entities.date)
    supporting_passages = [p for _, p in strong_supports]
    outdated_support = bool(supporting_passages) and _has_outdated_evidence(
        claim_result=claim_result,
        claim_date=claim_date,
        supporting_passages=supporting_passages,
        reference_today=date.today(),
    )
    if (has_credible_support and has_credible_contradict) or outdated_support:
        relevant_confs = [nli.confidence for nli, _ in (credible_strong_supports + credible_strong_contradicts)]
        base_conf = (sum(relevant_confs) / len(relevant_confs)) if relevant_confs else 0.7
        return VerdictOutput(
            verdict=VerdictLabel.MISLEADING,
            confidence=_clamp_confidence(base_conf * 0.9, low=0.55, high=0.9),
        )

    # 3. Multiple credible supporting passages -> VERIFIED
    if len(strong_supports) >= MIN_VERIFIED_SUPPORT_COUNT:
        avg_support_credibility = sum(p.credibility_score for _, p in strong_supports) / len(strong_supports)
        if avg_support_credibility >= MIN_CREDIBILITY_FOR_VERIFIED:
            avg_support_conf = sum(nli.confidence for nli, _ in strong_supports) / len(strong_supports)
            return VerdictOutput(
                verdict=VerdictLabel.VERIFIED,
                confidence=_clamp_confidence(0.65 * avg_support_conf + 0.35 * avg_support_credibility, low=0.6, high=0.98),
            )

    # 4. Weak, single-source, or mostly neutral evidence -> UNVERIFIED
    max_nli_conf = max((nli.confidence for nli, _ in paired), default=0.3)
    return VerdictOutput(
        verdict=VerdictLabel.UNVERIFIED,
        confidence=_clamp_confidence(0.25 + 0.25 * max_nli_conf, low=0.2, high=0.55),
    )
