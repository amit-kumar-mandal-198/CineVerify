"""Model identifiers, verification thresholds, and client helpers."""

from __future__ import annotations

from typing import Any

from app.config import settings

# Local fine-tuned CineVerify SLM (Ollama)
SLM_MODEL_NAME: str = "cineverify"
OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"

# Legacy cloud model identifiers (retained for backward compatibility)
GEMINI_MODEL_NAME: str = "gemini-3.5-flash-lite"
GEMINI_FALLBACK_MODELS: tuple[str, ...] = (
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
)
_PLACEHOLDER_GEMINI_KEY: str = "your_gemini_api_key_here"

# NLI stance verification identifier
NLI_MODEL_NAME: str = "cineverify-slm-local"

# Bi-encoder for passage similarity filtering / ranking
EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

# Verdict decision thresholds (tune during Phase 5 evaluation)
MIN_VERIFIED_SUPPORT_COUNT: int = 2
MIN_CREDIBILITY_FOR_VERIFIED: float = 0.60
MIN_CONTRADICTION_CONFIDENCE: float = 0.75
OUTDATED_GAP_DAYS: int = 180


def has_valid_gemini_key() -> bool:
    """Return False because CineVerify now runs 100% locally on CineVerify SLM."""
    return False


def create_gemini_client() -> Any:
    """Stub client - CineVerify operates 100% self-hosted with local CineVerify SLM."""
    raise RuntimeError("CineVerify operates 100% self-hosted with local CineVerify SLM.")
