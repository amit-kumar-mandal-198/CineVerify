"""Pydantic schemas for claim input and extraction."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class InputType(str, Enum):
    TEXT = "text"
    URL = "url"


class ClaimCategory(str, Enum):
    MOVIE_ANNOUNCEMENT = "movie_announcement"
    CASTING = "casting"
    RELEASE_UPDATE = "release_update"
    BOX_OFFICE = "box_office"


class ClaimRequest(BaseModel):
    claim: str = Field(..., min_length=3, description="Headline, claim text, or article URL.")
    type: InputType = Field(default=InputType.TEXT, description="Submission input type.")


class ExtractedEntities(BaseModel):
    movie: Optional[str] = None
    person: Optional[str] = None
    production_house: Optional[str] = None
    date: Optional[str] = None
    platform: Optional[str] = None
    amount: Optional[str] = None


class ClaimResult(BaseModel):
    submitted_claim: str
    core_claim: str
    category: ClaimCategory
    entities: ExtractedEntities = Field(default_factory=ExtractedEntities)
