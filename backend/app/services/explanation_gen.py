"""Evidence-grounded natural-language explanation generator (owned by Member 1)."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from google.genai import types

from app.core.models_config import (
    GEMINI_FALLBACK_MODELS,
    GEMINI_MODEL_NAME,
    create_gemini_client,
    has_valid_gemini_key,
)
from app.core.prompts import EXPLANATION_GENERATION_PROMPT
from app.schemas.claim import ClaimResult
from app.schemas.evidence import EvidencePassage, StanceLabel
from app.schemas.verdict import NLIResult, VerdictLabel, VerdictOutput

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
