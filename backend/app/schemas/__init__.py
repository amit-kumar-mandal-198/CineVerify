"""Shared Pydantic schemas matching docs/api-contract.md."""

from app.schemas.claim import (
    ClaimCategory,
    ClaimRequest,
    ClaimResult,
    ExtractedEntities,
    InputType,
)
from app.schemas.evidence import (
    EvidenceItem,
    EvidencePassage,
    SearchResult,
    StanceLabel,
)
from app.schemas.verdict import (
    HistoryItem,
    NLIResult,
    VerificationResponse,
    VerdictLabel,
    VerdictOutput,
)

__all__ = [
    "ClaimCategory",
    "ClaimRequest",
    "ClaimResult",
    "EvidenceItem",
    "EvidencePassage",
    "ExtractedEntities",
    "HistoryItem",
    "InputType",
    "NLIResult",
    "SearchResult",
    "StanceLabel",
    "VerdictLabel",
    "VerdictOutput",
    "VerificationResponse",
]
