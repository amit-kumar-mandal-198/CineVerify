"""Pydantic schemas for NLI output, verdicts, and verification reports."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List

from pydantic import BaseModel, Field

from app.schemas.claim import ClaimCategory, ExtractedEntities
from app.schemas.evidence import EvidenceItem, StanceLabel


class VerdictLabel(str, Enum):
    VERIFIED = "VERIFIED"
    FALSE = "FALSE"
    MISLEADING = "MISLEADING"
    UNVERIFIED = "UNVERIFIED"


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
    verified_at: datetime


class HistoryItem(BaseModel):
    id: str
    submitted_claim: str
    verdict: VerdictLabel
    confidence: float = Field(ge=0.0, le=1.0)
    category: ClaimCategory
    verified_at: datetime
