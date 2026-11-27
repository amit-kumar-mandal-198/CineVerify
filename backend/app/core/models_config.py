"""Model identifiers, verification thresholds, and Gemini client helpers (owned by Member 1)."""

from __future__ import annotations

from google import genai

from app.config import settings

# LLM model for structured claim extraction & grounded explanation
GEMINI_MODEL_NAME: str = "gemini-3.5-flash"
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
    """Initialize a Google GenAI client using the configured GEMINI_API_KEY."""
    return genai.Client(api_key=settings.GEMINI_API_KEY)

