"""Pydantic schemas for web search and retrieved evidence."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class StanceLabel(str, Enum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    NEUTRAL = "neutral"


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str = ""
    displayed_date: Optional[str] = None


class EvidencePassage(BaseModel):
    """Chunked passage passed from Member 2's retriever to Member 1's NLI verifier."""

    source_name: str
    url: str
    title: str
    published_date: Optional[str] = None
    text: str
    credibility_score: float = Field(default=0.40, ge=0.0, le=1.0)


class EvidenceItem(BaseModel):
    """Evidence item returned in the public /api/verify response."""

    source_name: str
    url: str
    title: str
    published_date: Optional[str] = None
    stance: StanceLabel
    snippet: str
    credibility_score: float = Field(default=0.40, ge=0.0, le=1.0)
