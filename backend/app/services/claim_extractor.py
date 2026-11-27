"""Claim extraction, entity recognition, and category classification (owned by Member 1)."""

from __future__ import annotations

from app.schemas.claim import ClaimCategory, ClaimResult, ExtractedEntities, InputType


def extract_claim(raw_input: str, input_type: InputType = InputType.TEXT) -> ClaimResult:
    """Extract the central factual claim, entities, and category from user input.

    TODO(Member 1):
    - If input_type == InputType.URL, extract headline/main text first.
    - Call Gemini (google-genai) with CLAIM_EXTRACTION_PROMPT.
    - Parse structured JSON into ClaimResult.
    """
    return ClaimResult(
        submitted_claim=raw_input,
        core_claim=raw_input.strip(),
        category=ClaimCategory.MOVIE_ANNOUNCEMENT,
        entities=ExtractedEntities(),
    )
