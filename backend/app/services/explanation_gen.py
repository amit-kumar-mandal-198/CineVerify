"""Evidence-grounded natural-language explanation, diff comparisons, and follow-up Q&A."""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Tuple

from app.schemas.claim import ClaimCategory, ClaimResult
from app.schemas.evidence import EvidenceItem, EvidencePassage, StanceLabel
from app.schemas.verdict import (
    ClaimComparison,
    ComparisonStatus,
    FollowUpRequest,
    FollowUpResponse,
    NLIResult,
    VerdictLabel,
    VerdictOutput,
)
from app.services.cineverify_slm import (
    answer_followup_with_slm,
    generate_local_investigative_report,
)

logger = logging.getLogger(__name__)

_MAX_EVIDENCE_ITEMS = 6
_MAX_SNIPPET_CHARS = 300


def _pair_evidence(
    passages: List[EvidencePassage],
    nli_results: List[NLIResult],
) -> List[Tuple[EvidencePassage, StanceLabel, float]]:
    """Join passages with NLI stances and select the top most informative passages."""
    nli_by_index: Dict[int, NLIResult] = {item.passage_index: item for item in nli_results}
    combined: List[Tuple[EvidencePassage, StanceLabel, float]] = []
    for idx, passage in enumerate(passages):
        nli = nli_by_index.get(idx)
        stance = nli.stance if nli else StanceLabel.NEUTRAL
        conf = nli.confidence if nli else 0.0
        combined.append((passage, stance, conf))

    combined.sort(
        key=lambda entry: (entry[1] != StanceLabel.NEUTRAL, entry[0].credibility_score, entry[2]),
        reverse=True,
    )
    return combined[:_MAX_EVIDENCE_ITEMS]


def _format_evidence_summary(top_items: List[Tuple[EvidencePassage, StanceLabel, float]]) -> str:
    """Format evidence passages into indexed lines for grounded LLM explanation."""
    lines: List[str] = []
    for idx, (passage, stance, _) in enumerate(top_items, start=1):
        pub_date = passage.published_date or "Date unknown"
        snippet = " ".join(passage.text.split())[:_MAX_SNIPPET_CHARS]
        lines.append(f"[{idx}] {passage.source_name} | {pub_date} | {stance.value} | {snippet}")
    return "\n".join(lines)


def _build_fallback_explanation(
    claim_result: ClaimResult,
    verdict: VerdictOutput,
    top_items: List[Tuple[EvidencePassage, StanceLabel, float]],
) -> str:
    """Generate a deterministic, strictly grounded summary when SLM report generation is unavailable."""
    supporting = [p.source_name for p, stance, _ in top_items if stance == StanceLabel.SUPPORTS]
    contradicting = [p.source_name for p, stance, _ in top_items if stance == StanceLabel.CONTRADICTS]
    all_sources = list(dict.fromkeys(p.source_name for p, _, _ in top_items))
    source_list = ", ".join(all_sources[:4]) if all_sources else "retrieved outlets"

    if verdict.verdict == VerdictLabel.VERIFIED:
        support_str = ", ".join(dict.fromkeys(supporting)) or source_list
        return (
            f"The claim '{claim_result.core_claim}' is marked VERIFIED based on consistent reporting "
            f"from {support_str}. Multiple credible entertainment sources corroborate the core details "
            f"without direct contradictions."
        )
    if verdict.verdict == VerdictLabel.FALSE:
        contra_str = ", ".join(dict.fromkeys(contradicting)) or source_list
        return (
            f"The claim '{claim_result.core_claim}' is marked FALSE because credible reporting from "
            f"{contra_str} directly contradicts it. No equally credible retrieved evidence supports the assertion."
        )
    if verdict.verdict == VerdictLabel.MISLEADING:
        return (
            f"The claim '{claim_result.core_claim}' is marked MISLEADING based on evidence reviewed from "
            f"{source_list}. Either credible sources conflict on the facts or the supporting reports are "
            f"outdated relative to the claim's timeline."
        )
    return (
        f"The claim '{claim_result.core_claim}' remains UNVERIFIED after checking {source_list}. "
        f"The retrieved passages do not provide enough consistent, credible confirmation or refutation "
        f"to reach a definitive verdict."
    )


def generate_explanation(
    claim_result: ClaimResult,
    verdict: VerdictOutput,
    passages: List[EvidencePassage],
    nli_results: List[NLIResult],
) -> str:
    """Generate a comprehensive structured investigative report powered by local CineVerify SLM."""
    try:
        report = generate_local_investigative_report(
            core_claim=claim_result.core_claim,
            verdict=verdict.verdict.value,
            confidence=verdict.confidence,
            evidence_passages=passages,
            slm_data=claim_result.slm_data,
            nli_results=nli_results,
        )
        if report and len(report.strip()) > 50:
            return report
    except Exception as exc:
        logger.warning("Local SLM report generation failed (%s); falling back to grounded explanation.", exc)

    top_items = _pair_evidence(passages, nli_results)
    return _build_fallback_explanation(claim_result, verdict, top_items)


def _snippet_preview(passage: EvidencePassage, limit: int = 160) -> str:
    cleaned = " ".join(passage.text.split())
    if len(cleaned) <= limit:
        return f"{passage.source_name}: {cleaned}"
    return f"{passage.source_name}: {cleaned[: limit - 3].rstrip()}..."


def build_claim_comparisons(
    claim_result: ClaimResult,
    verdict: VerdictOutput,
    passages: List[EvidencePassage],
    nli_results: List[NLIResult],
) -> List[ClaimComparison]:
    """Build structured Claim vs. Retrieved Evidence comparison rows for the UI diff card."""
    paired = _pair_evidence(passages, nli_results)
    supporting = [entry for entry in paired if entry[1] == StanceLabel.SUPPORTS]
    contradicting = [entry for entry in paired if entry[1] == StanceLabel.CONTRADICTS]

    if not paired:
        return [
            ClaimComparison(
                aspect="Trade Coverage",
                claimed=claim_result.core_claim,
                reported="No corroborating or refuting Indian cinema trade reports found.",
                status=ComparisonStatus.UNCLEAR,
            )
        ]

    comparisons: List[ClaimComparison] = []
    entities = claim_result.entities

    if contradicting and not supporting:
        lead_status = ComparisonStatus.MISMATCH
        lead_reported = _snippet_preview(contradicting[0][0])
    elif supporting and contradicting:
        lead_status = ComparisonStatus.MISMATCH
        lead_reported = (
            f"{supporting[0][0].source_name} supports vs. "
            f"{contradicting[0][0].source_name} refutes: {_snippet_preview(contradicting[0][0], 110)}"
        )
    elif supporting and verdict.verdict == VerdictLabel.VERIFIED:
        lead_status = ComparisonStatus.MATCH
        lead_reported = _snippet_preview(supporting[0][0])
    elif supporting and verdict.verdict == VerdictLabel.MISLEADING:
        lead_status = ComparisonStatus.MISMATCH
        pub = supporting[0][0].published_date or "earlier date"
        lead_reported = f"Dated coverage ({pub}) — {_snippet_preview(supporting[0][0], 125)}"
    else:
        lead_status = ComparisonStatus.UNCLEAR
        lead_reported = _snippet_preview(paired[0][0])

    aspect_by_category = {
        ClaimCategory.BOX_OFFICE: "Box-Office Claim",
        ClaimCategory.RELEASE_UPDATE: "Release Schedule",
        ClaimCategory.CASTING: "Casting / Crew",
        ClaimCategory.MOVIE_ANNOUNCEMENT: "Project Announcement",
    }
    comparisons.append(
        ClaimComparison(
            aspect=aspect_by_category.get(claim_result.category, "Core Assertion"),
            claimed=claim_result.core_claim,
            reported=lead_reported,
            status=lead_status,
        )
    )

    if entities.amount:
        num_match = None
        for p, stance, _ in paired:
            found = re.findall(r"(?:₹|rs\.?|inr)?\s*\d[\d,.]*\s*(?:crore|cr|lakh)?", p.text, re.IGNORECASE)
            meaningful = [m.strip() for m in found if any(c.isdigit() for c in m)]
            if meaningful:
                num_match = f"{p.source_name} cites {', '.join(dict.fromkeys(meaningful[:2]))}"
                break
        comparisons.append(
            ClaimComparison(
                aspect="Reported Figure",
                claimed=entities.amount,
                reported=num_match or "No matching collection figure confirmed across retrieved sources.",
                status=(
                    ComparisonStatus.MATCH
                    if verdict.verdict == VerdictLabel.VERIFIED and num_match
                    else ComparisonStatus.MISMATCH
                    if contradicting
                    else ComparisonStatus.UNCLEAR
                ),
            )
        )

    if entities.date:
        date_source = contradicting[0][0] if contradicting else (supporting[0][0] if supporting else paired[0][0])
        comparisons.append(
            ClaimComparison(
                aspect="Timeline / Date",
                claimed=entities.date,
                reported=(
                    f"{date_source.source_name} (published {date_source.published_date or 'unknown date'}): "
                    f"{date_source.title}"
                ),
                status=(
                    ComparisonStatus.MATCH
                    if verdict.verdict == VerdictLabel.VERIFIED
                    else ComparisonStatus.MISMATCH
                    if verdict.verdict in {VerdictLabel.FALSE, VerdictLabel.MISLEADING}
                    else ComparisonStatus.UNCLEAR
                ),
            )
        )

    if entities.platform:
        comparisons.append(
            ClaimComparison(
                aspect="OTT / Platform",
                claimed=entities.platform,
                reported=(
                    f"{supporting[0][0].source_name} references {entities.platform}"
                    if supporting and entities.platform.lower() in supporting[0][0].text.lower()
                    else f"Unconfirmed across top retrieved trade coverage ({paired[0][0].source_name})"
                ),
                status=(
                    ComparisonStatus.MATCH
                    if supporting and entities.platform.lower() in supporting[0][0].text.lower()
                    else ComparisonStatus.UNCLEAR
                ),
            )
        )

    return comparisons[:3]


def _build_followup_fallback(request: FollowUpRequest) -> FollowUpResponse:
    """Grounded deterministic answer when SLM is unavailable."""
    q_tokens = set(re.findall(r"[a-z0-9]+", request.question.lower()))
    ranked = sorted(
        request.evidence,
        key=lambda item: (
            len(q_tokens & set(re.findall(r"[a-z0-9]+", f"{item.title} {item.snippet} {item.source_name}".lower()))),
            item.credibility_score,
        ),
        reverse=True,
    )
    top = ranked[:2]
    if not top:
        return FollowUpResponse(
            answer=(
                f"No retrieved source passages are attached to this {request.verdict.value} report "
                f"for '{request.core_claim}'. {request.explanation}"
            ),
            cited_sources=[],
        )

    lines = [
        f"Based on the retrieved report for '{request.core_claim}' ({request.verdict.value}):"
    ]
    cited: List[str] = []
    for item in top:
        cited.append(item.source_name)
        lines.append(f"- {item.source_name} ({item.stance.value}): {item.snippet}")
    return FollowUpResponse(answer="\n".join(lines), cited_sources=list(dict.fromkeys(cited)))


def answer_followup_question(request: FollowUpRequest) -> FollowUpResponse:
    """Answer a user follow-up question strictly grounded using the local CineVerify SLM."""
    cited_candidates = list(dict.fromkeys(item.source_name for item in request.evidence[:4]))
    evidence_summary = "\n".join(
        f"[{idx}] {item.source_name} ({item.published_date or 'Date unknown'}, stance={item.stance.value}): {item.title} — {item.snippet}"
        for idx, item in enumerate(request.evidence[:6], start=1)
    )

    try:
        answer_text = answer_followup_with_slm(
            claim=request.core_claim or request.claim,
            explanation=request.explanation,
            question=request.question,
            evidence_summary=evidence_summary,
        )
        if answer_text:
            cited = [
                name for name in cited_candidates
                if name.lower() in answer_text.lower()
            ] or cited_candidates[:2]
            return FollowUpResponse(answer=answer_text, cited_sources=cited)
    except Exception as exc:
        logger.warning("Local SLM follow-up QA failed (%s); using fallback.", exc)

    return _build_followup_fallback(request)
