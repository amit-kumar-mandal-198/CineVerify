"""Natural Language Inference (NLI) claim-evidence verification (owned by Member 1)."""

from __future__ import annotations

from typing import List

from app.schemas.evidence import EvidencePassage
from app.schemas.verdict import NLIResult


def verify_claim(core_claim: str, passages: List[EvidencePassage]) -> List[NLIResult]:
    """Classify each evidence passage as supports, contradicts, or neutral vs. core_claim.

    TODO(Member 1):
    - Lazy-load CrossEncoder(NLI_MODEL_NAME) once and reuse across requests.
    - Score (passage.text, core_claim) pairs.
    - Map logits to StanceLabel and normalized confidence.
    """
    return []
