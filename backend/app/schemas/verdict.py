"""Pydantic schemas for NLI output, verdicts, and verification reports."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Literal

from pydantic import BaseModel, Field

from app.schemas.claim import ClaimCategory, ExtractedEntities
from app.schemas.evidence import EvidenceItem, StanceLabel


class VerdictLabel(str, Enum):
    VERIFIED = "VERIFIED"
    FALSE = "FALSE"
    MISLEADING = "MISLEADING"
    UNVERIFIED = "UNVERIFIED"


class ComparisonStatus(str, Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    UNCLEAR = "unclear"


class ClaimComparison(BaseModel):
    aspect: str
    claimed: str
    reported: str
    status: ComparisonStatus = ComparisonStatus.UNCLEAR


class NLIResult(BaseModel):
    passage_index: int
    stance: StanceLabel
    confidence: float = Field(ge=0.0, le=1.0)


class VerdictOutput(BaseModel):
    verdict: VerdictLabel
    confidence: float = Field(ge=0.0, le=1.0)


class VerificationResponse(BaseModel):
    id: str
    submitted_claim: str
    core_claim: str
    verdict: VerdictLabel
    confidence: float = Field(ge=0.0, le=1.0)
    category: ClaimCategory
    explanation: str
    entities: ExtractedEntities
    evidence: List[EvidenceItem] = Field(default_factory=list)
    claim_comparisons: List[ClaimComparison] = Field(default_factory=list)
    verified_at: datetime


class HistoryItem(BaseModel):
    id: str
    submitted_claim: str
    verdict: VerdictLabel
    confidence: float = Field(ge=0.0, le=1.0)
    category: ClaimCategory
    verified_at: datetime


class FollowUpTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class FollowUpRequest(BaseModel):
    claim: str
    core_claim: str
    verdict: VerdictLabel
    explanation: str
    evidence: List[EvidenceItem] = Field(default_factory=list)
    question: str = Field(..., min_length=2)
    history: List[FollowUpTurn] = Field(default_factory=list)


class FollowUpResponse(BaseModel):
    answer: str
    cited_sources: List[str] = Field(default_factory=list)
