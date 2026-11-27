"""Model identifiers, verification thresholds, and Gemini client helpers (owned by Member 1)."""

from __future__ import annotations

from google import genai
from google.genai import types

from app.config import settings

# Fast, high-quota Flash-Lite model with fallback for structured extraction & explanation
GEMINI_MODEL_NAME: str = "gemini-3.5-flash-lite"
GEMINI_FALLBACK_MODELS: tuple[str, ...] = (
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
)
_PLACEHOLDER_GEMINI_KEY: str = "your_gemini_api_key_here"

# Pretrained NLI cross-encoder for claim-evidence stance classification
NLI_MODEL_NAME: str = "cross-encoder/nli-deberta-v3-base"

# Bi-encoder for optional passage similarity filtering / deduplication
EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

# Verdict decision thresholds (tune during Phase 5 evaluation)
MIN_VERIFIED_SUPPORT_COUNT: int = 2
MIN_CREDIBILITY_FOR_VERIFIED: float = 0.60
MIN_CONTRADICTION_CONFIDENCE: float = 0.75
OUTDATED_GAP_DAYS: int = 180


def has_valid_gemini_key() -> bool:
    """Return True when GEMINI_API_KEY is configured and not the template placeholder."""
    key = (settings.GEMINI_API_KEY or "").strip()
    return bool(key and key != _PLACEHOLDER_GEMINI_KEY)


def create_gemini_client() -> genai.Client:
    """Initialize a Google GenAI client without multi-second 429 retry stalls."""
    return genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )
