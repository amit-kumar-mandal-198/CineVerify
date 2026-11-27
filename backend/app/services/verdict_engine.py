"""Multi-signal verdict decision engine (owned by Member 1)."""

from __future__ import annotations

from typing import List

from app.schemas.claim import ClaimResult
from app.schemas.evidence import EvidencePassage
from app.schemas.verdict import NLIResult, VerdictLabel, VerdictOutput


def generate_verdict(
    claim_result: ClaimResult,
    nli_results: List[NLIResult],
    passages: List[EvidencePassage],
) -> VerdictOutput:
    """Aggregate NLI stances, source credibility, temporal checks, and cross-source agreement.

    TODO(Member 1):
    - Evaluate support/contradiction counts weighted by passage credibility_score.
    - Detect outdated-news reuse via claim date vs evidence published_date.
    - Return VerdictLabel.UNVERIFIED whenever evidence is missing or inconclusive.
    """
    return VerdictOutput(verdict=VerdictLabel.UNVERIFIED, confidence=0.0)
