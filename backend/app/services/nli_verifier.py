"""Natural Language Inference (NLI) claim-evidence verification powered by unified local CineVerify SLM."""

from __future__ import annotations

import logging
from typing import List, Optional, Tuple

from app.schemas.claim import ClaimResult
from app.schemas.evidence import EvidencePassage
from app.schemas.verdict import NLIResult, VerdictLabel
from app.services.cineverify_slm import (
    verify_claim_unified_with_slm,
    verify_passages_with_slm,
)

logger = logging.getLogger(__name__)


def _get_nli_model():
    """Stub retained for compatibility - verification runs natively via local CineVerify SLM."""
    return None


def verify_claim(core_claim: str, passages: List[EvidencePassage], movie_name: Optional[str] = None) -> List[NLIResult]:
    """
    Classify each evidence passage as supports, contradicts, or neutral vs. core_claim.
    Powered by entity-aware local CineVerify SLM logic (replaces DeBERTa CrossEncoder).
    """
    if not passages or not (core_claim or "").strip():
        return []

    return verify_passages_with_slm(core_claim, passages, movie_name=movie_name)


def verify_claim_unified(
    claim_result: ClaimResult,
    passages: List[EvidencePassage],
) -> Tuple[List[NLIResult], VerdictLabel, float]:
    """
    Run the unified local CineVerify SLM grounded on ClaimResult + Retrieved Live Evidence,
    returning aligned NLI stances, coherent verdict, and calibrated confidence.
    """
    return verify_claim_unified_with_slm(claim_result, passages)
