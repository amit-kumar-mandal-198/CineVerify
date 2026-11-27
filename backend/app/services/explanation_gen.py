"""Evidence-grounded natural-language explanation generator (owned by Member 1)."""

from __future__ import annotations

from typing import List

from app.schemas.claim import ClaimResult
from app.schemas.evidence import EvidencePassage
from app.schemas.verdict import NLIResult, VerdictOutput


def generate_explanation(
    claim_result: ClaimResult,
    verdict: VerdictOutput,
    passages: List[EvidencePassage],
    nli_results: List[NLIResult],
) -> str:
    """Generate a concise explanation strictly grounded in the retrieved passages.

    TODO(Member 1):
    - Format retrieved passages with source names and publication dates.
    - Call Gemini (google-genai) with EXPLANATION_GENERATION_PROMPT.
    - Enforce fallback messaging when no evidence is available.
    """
    return (
        "Verification pipeline stub is active. Connect evidence retrieval and AI "
        "verification services to generate an evidence-backed report."
    )
