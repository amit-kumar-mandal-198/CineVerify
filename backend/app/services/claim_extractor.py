"""Claim extraction, entity recognition, and category classification (owned by Member 1)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

import trafilatura
from google.genai import types

from app.core.models_config import (
    GEMINI_FALLBACK_MODELS,
    GEMINI_MODEL_NAME,
    create_gemini_client,
    has_valid_gemini_key,
)
from app.core.prompts import CLAIM_EXTRACTION_PROMPT
from app.schemas.claim import ClaimCategory, ClaimResult, ExtractedEntities, InputType

logger = logging.getLogger(__name__)

_MAX_URL_TEXT_CHARS = 1500


def _extract_url_content(url: str) -> str:
    """Fetch a webpage and extract its title and main body text for claim analysis."""
    target_url = url.strip()
    downloaded = trafilatura.fetch_url(target_url)
    if not downloaded:
        raise ValueError(f"Failed to fetch content from URL: {target_url}")

    extracted_text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
    )
    metadata = trafilatura.extract_metadata(downloaded)
    title = (metadata.title or "").strip() if metadata and metadata.title else ""
    body = (extracted_text or "").strip()

    if not title and not body:
        raise ValueError(f"Could not extract readable article text from URL: {target_url}")

    combined = f"{title}\n\n{body}".strip() if title and body else (title or body)
    return combined[:_MAX_URL_TEXT_CHARS]


def _strip_json_fences(raw_text: str) -> str:
    """Remove optional markdown code fences surrounding a JSON response."""
    cleaned = raw_text.strip()
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fence_match:
        return fence_match.group(1).strip()
    return cleaned


def _coerce_optional_str(value: Any) -> Optional[str]:
    """Convert non-empty entity values to stripped strings, otherwise None."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "n/a"}:
        return None
    return text


def _coerce_category(raw_category: Any, fallback_text: str) -> ClaimCategory:
    """Map LLM category output into ClaimCategory with keyword-based fallback."""
    if isinstance(raw_category, str):
        normalized = raw_category.strip().lower().replace(" ", "_")
        for member in ClaimCategory:
            if member.value == normalized:
                return member

    lowered = fallback_text.lower()
    if any(kw in lowered for kw in ("crore", "box office", "collection", "gross", "nett")):
        return ClaimCategory.BOX_OFFICE
    if any(kw in lowered for kw in ("release", "releasing", "postponed", "ott", "netflix", "prime video")):
        return ClaimCategory.RELEASE_UPDATE
    if any(kw in lowered for kw in ("joins", "cast", "casting", "opposite", "starring", "replaces", "walked out")):
        return ClaimCategory.CASTING
    return ClaimCategory.MOVIE_ANNOUNCEMENT


def _build_fallback_result(submitted_claim: str, input_text: str) -> ClaimResult:
    """Construct a safe fallback ClaimResult when Gemini is unavailable or returns invalid JSON."""
    first_line = next((line.strip() for line in input_text.splitlines() if line.strip()), submitted_claim.strip())
    core_claim = first_line[:240]
    return ClaimResult(
        submitted_claim=submitted_claim,
        core_claim=core_claim,
        category=_coerce_category(None, input_text),
        entities=ExtractedEntities(),
    )


def _parse_gemini_response(raw_json_text: str, submitted_claim: str, input_text: str) -> ClaimResult:
    """Parse and validate Gemini JSON output into a ClaimResult schema."""
    payload = json.loads(_strip_json_fences(raw_json_text))
    if not isinstance(payload, dict):
        raise ValueError("Claim extraction JSON payload is not an object.")

    core_claim = _coerce_optional_str(payload.get("core_claim")) or _build_fallback_result(
        submitted_claim, input_text
    ).core_claim
    category = _coerce_category(payload.get("category"), f"{core_claim} {input_text}")

    raw_entities = payload.get("entities")
    entities_dict = raw_entities if isinstance(raw_entities, dict) else {}
    entities = ExtractedEntities(
        movie=_coerce_optional_str(entities_dict.get("movie")),
        person=_coerce_optional_str(entities_dict.get("person")),
        production_house=_coerce_optional_str(entities_dict.get("production_house")),
        date=_coerce_optional_str(entities_dict.get("date")),
        platform=_coerce_optional_str(entities_dict.get("platform")),
        amount=_coerce_optional_str(entities_dict.get("amount")),
    )

    return ClaimResult(
        submitted_claim=submitted_claim,
        core_claim=core_claim,
        category=category,
        entities=entities,
    )


def extract_claim(raw_input: str, input_type: InputType = InputType.TEXT) -> ClaimResult:
    """Extract the central factual claim, entities, and category from user input."""
    cleaned_input = (raw_input or "").strip()
    if not cleaned_input:
        raise ValueError("Claim input cannot be empty.")

    analysis_text = _extract_url_content(cleaned_input) if input_type == InputType.URL else cleaned_input

    if not has_valid_gemini_key():
        logger.warning("GEMINI_API_KEY is not configured; returning heuristic fallback ClaimResult.")
        return _build_fallback_result(raw_input, analysis_text)

    prompt = CLAIM_EXTRACTION_PROMPT.format(input_text=analysis_text)
    try:
        client = create_gemini_client()
        last_exc: Optional[Exception] = None
        for model_name in GEMINI_FALLBACK_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                response_text = (response.text or "").strip()
                if not response_text:
                    raise ValueError(f"Empty response returned by {model_name}.")
                return _parse_gemini_response(response_text, raw_input, analysis_text)
            except Exception as model_exc:
                last_exc = model_exc
                logger.warning("Gemini extraction failed on %s (%s); trying next.", model_name, model_exc)
        if last_exc is not None:
            raise last_exc
    except Exception as exc:
        logger.warning("Gemini claim extraction failed (%s); using fallback.", exc)
        return _build_fallback_result(raw_input, analysis_text)
