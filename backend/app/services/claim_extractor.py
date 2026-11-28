"""Claim extraction, entity recognition, and category classification powered by local SLM."""

from __future__ import annotations

import ipaddress
import json
import logging
import re
import socket
from typing import Any, Optional
from urllib.parse import urlparse

import trafilatura

from app.schemas.claim import ClaimCategory, ClaimResult, ExtractedEntities, InputType
from app.services.cineverify_slm import _heuristic_entities, extract_claim_with_slm

logger = logging.getLogger(__name__)

_MAX_URL_TEXT_CHARS = 1500
_BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
}
_SOCIAL_DOMAINS = (
    "x.com",
    "twitter.com",
    "instagram.com",
    "facebook.com",
    "threads.net",
    "youtube.com",
    "youtu.be",
)


def _is_disallowed_ip(ip_str: str) -> bool:
    """Return True if an IP literal is private, loopback, link-local, or reserved."""
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def _validate_public_url(url: str) -> str:
    """Ensure URL uses http(s), has a resolvable host, and does not point to internal resources."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must use http or https.")

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise ValueError("URL must include a valid host.")

    if hostname in _BLOCKED_HOSTNAMES or hostname.endswith(".localhost"):
        raise ValueError("Access to local addresses is prohibited.")

    if any(hostname == domain or hostname.endswith(f".{domain}") for domain in _SOCIAL_DOMAINS):
        raise ValueError(
            f"Social media URLs ({hostname}) cannot be scraped directly. "
            "Please paste the text or headline of the post instead."
        )

    try:
        addr_info = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host '{hostname}': check the URL or your network connection.") from exc

    resolved_ips = {item[4][0] for item in addr_info if item[4]}
    if not resolved_ips:
        raise ValueError(f"Could not resolve an IP address for host '{hostname}'.")

    for ip_str in resolved_ips:
        if _is_disallowed_ip(ip_str):
            raise ValueError(f"URL resolves to a disallowed private address ({ip_str}).")

    return parsed.geturl()


def _extract_url_content(url: str) -> str:
    """Fetch a public webpage and extract readable article text."""
    safe_url = _validate_public_url(url)
    downloaded = trafilatura.fetch_url(safe_url)
    if not downloaded:
        raise ValueError(f"Failed to fetch content from URL: {safe_url}")

    extracted_text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
    )
    metadata = trafilatura.extract_metadata(downloaded)
    title = (metadata.title or "").strip() if metadata and metadata.title else ""
    body = (extracted_text or "").strip()

    if not title and not body:
        raise ValueError(f"Could not extract readable article text from URL: {safe_url}")

    combined = f"{title}\n\n{body}".strip() if title and body else (title or body)
    return combined[:_MAX_URL_TEXT_CHARS]


def _coerce_optional_str(value: Any) -> Optional[str]:
    """Convert non-empty entity values to stripped strings, otherwise None."""
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _coerce_category(raw_category: Optional[str], fallback_text: str = "") -> ClaimCategory:
    """Map string values or heuristics to ClaimCategory enum members."""
    if raw_category:
        normalized = raw_category.strip().lower().replace(" ", "_")
        for candidate in ClaimCategory:
            if candidate.value == normalized:
                return candidate

    lowered = fallback_text.lower()
    if any(kw in lowered for kw in ("box office", "crore", "collection", "gross", "net", "b/o", "record")):
        return ClaimCategory.BOX_OFFICE
    if any(kw in lowered for kw in ("release", "releasing", "postponed", "ott", "netflix", "prime video")):
        return ClaimCategory.RELEASE_UPDATE
    if any(kw in lowered for kw in ("joins", "cast", "casting", "opposite", "starring", "replaces", "walked out")):
        return ClaimCategory.CASTING
    return ClaimCategory.MOVIE_ANNOUNCEMENT


def _build_heuristic_result(submitted_claim: str, input_text: str) -> ClaimResult:
    """Construct a safe entity-preserving ClaimResult when Ollama is offline."""
    first_line = next((line.strip() for line in input_text.splitlines() if line.strip()), submitted_claim.strip())
    core_claim = first_line[:240]
    heur = _heuristic_entities(core_claim)
    return ClaimResult(
        submitted_claim=submitted_claim,
        core_claim=core_claim,
        category=_coerce_category(None, input_text),
        entities=ExtractedEntities(**heur),
    )


def extract_claim(raw_input: str, input_type: InputType = InputType.TEXT) -> ClaimResult:
    """Extract factual claim, entities, and category using 100% local CineVerify SLM."""
    cleaned_input = (raw_input or "").strip()
    if not cleaned_input:
        raise ValueError("Claim input cannot be empty.")

    analysis_text = _extract_url_content(cleaned_input) if input_type == InputType.URL else cleaned_input

    # 1. Query Local Fine-Tuned CineVerify SLM (Ollama)
    try:
        slm_result = extract_claim_with_slm(analysis_text)
        if slm_result and isinstance(slm_result, dict):
            core_claim = _coerce_optional_str(slm_result.get("core_claim")) or analysis_text
            category = _coerce_category(slm_result.get("category"), f"{core_claim} {analysis_text}")

            raw_entities = slm_result.get("entities", {})
            entities = ExtractedEntities(
                movie=_coerce_optional_str(raw_entities.get("movie")),
                person=_coerce_optional_str(raw_entities.get("person")),
                production_house=_coerce_optional_str(raw_entities.get("production_house")),
                date=_coerce_optional_str(raw_entities.get("date")),
                platform=_coerce_optional_str(raw_entities.get("platform")),
                amount=_coerce_optional_str(raw_entities.get("amount")),
            )
            logger.info("Successfully extracted claim and entities using local CineVerify SLM.")
            return ClaimResult(
                submitted_claim=cleaned_input,
                core_claim=core_claim,
                category=category,
                entities=entities,
                slm_data=slm_result,
            )
    except Exception as exc:
        logger.warning("Local SLM extraction encountered an error: %s", exc)

    # 2. Heuristic fallback
    return _build_heuristic_result(raw_input, analysis_text)
