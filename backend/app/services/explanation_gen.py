"""Evidence-grounded natural-language explanation, diff comparisons, and follow-up Q&A."""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Tuple

from google.genai import types

from app.core.models_config import (
    GEMINI_FALLBACK_MODELS,
    create_gemini_client,
    has_valid_gemini_key,
)
from app.core.prompts import EXPLANATION_GENERATION_PROMPT
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
    """Generate a deterministic, strictly grounded summary when Gemini is unavailable."""
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
    """Generate a concise explanation strictly grounded in the retrieved passages."""
    if not passages:
        return (
            f"No credible Indian cinema or entertainment sources were retrieved to verify "
            f"the claim '{claim_result.core_claim}'. As a result, the claim is marked UNVERIFIED "
            f"until reliable reporting becomes available."
        )

    top_items = _pair_evidence(passages, nli_results)
    evidence_summary = _format_evidence_summary(top_items)

    if not has_valid_gemini_key():
        logger.warning("GEMINI_API_KEY is not configured; using grounded fallback explanation.")
        return _build_fallback_explanation(claim_result, verdict, top_items)

    prompt = EXPLANATION_GENERATION_PROMPT.format(
        claim=claim_result.core_claim,
        verdict=verdict.verdict.value,
        evidence_summary=evidence_summary,
    )
    try:
        client = create_gemini_client()
        last_exc: Optional[Exception] = None
        for model_name in GEMINI_FALLBACK_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.2),
                )
                explanation = (response.text or "").strip()
                if not explanation:
                    raise ValueError(f"Empty explanation returned by {model_name}.")
                return explanation
            except Exception as model_exc:
                last_exc = model_exc
                logger.warning("Gemini explanation failed on %s (%s); trying next.", model_name, model_exc)
        if last_exc is not None:
            raise last_exc
    except Exception as exc:
        logger.warning("Gemini explanation generation failed (%s); using fallback.", exc)
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
    """Grounded deterministic answer when Gemini is unavailable."""
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
    """Answer a user follow-up question strictly grounded in the current report's evidence."""
    cited_candidates = list(dict.fromkeys(item.source_name for item in request.evidence[:4]))

    if not has_valid_gemini_key():
        return _build_followup_fallback(request)

    evidence_lines = "\n".join(
        f"[{idx}] {item.source_name} ({item.published_date or 'Date unknown'}, stance={item.stance.value}, "
        f"credibility={int(round(item.credibility_score * 100))}%): {item.title} — {item.snippet}"
        for idx, item in enumerate(request.evidence[:6], start=1)
    ) or "No external evidence passages retrieved."

    history_lines = "\n".join(
        f"{turn.role.upper()}: {turn.content}" for turn in request.history[-6:]
    )

    prompt = (
        "You are CineVerify AI's fact-check assistant answering a follow-up question about a verification report.\n"
        "STRICT RULES:\n"
        "- Answer in 2-4 concise, factual sentences.\n"
        "- ONLY use facts explicitly present in the Verdict Summary and Retrieved Evidence below.\n"
        "- If the retrieved evidence does not contain the requested detail, say clearly that the retrieved sources do not mention it.\n"
        "- Cite source names inline when referencing specific claims.\n\n"
        f"Submitted Claim: {request.claim}\n"
        f"Core Claim: {request.core_claim}\n"
        f"Verdict: {request.verdict.value}\n"
        f"Report Explanation: {request.explanation}\n\n"
        f"Retrieved Evidence:\n{evidence_lines}\n\n"
        + (f"Recent Conversation:\n{history_lines}\n\n" if history_lines else "")
        + f"User Question: {request.question}\n"
    )

    try:
        client = create_gemini_client()
        for model_name in GEMINI_FALLBACK_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.2),
                )
                answer_text = (response.text or "").strip()
                if answer_text:
                    cited = [
                        name for name in cited_candidates
                        if name.lower() in answer_text.lower()
                    ] or cited_candidates[:2]
                    return FollowUpResponse(answer=answer_text, cited_sources=cited)
            except Exception as model_exc:
                logger.warning("Gemini follow-up failed on %s (%s); trying next.", model_name, model_exc)
    except Exception as exc:
        logger.warning("Gemini follow-up failed (%s); using fallback.", exc)

    return _build_followup_fallback(request)
