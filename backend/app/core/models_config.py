"""Model identifiers and verification thresholds (owned by Member 1)."""

# LLM model for structured claim extraction & grounded explanation
GEMINI_MODEL_NAME: str = "gemini-2.5-flash"

# Pretrained NLI cross-encoder for claim-evidence stance classification
NLI_MODEL_NAME: str = "cross-encoder/nli-deberta-v3-base"

# Bi-encoder for optional passage similarity filtering / deduplication
EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

# Verdict decision thresholds (tune during Phase 5 evaluation)
MIN_VERIFIED_SUPPORT_COUNT: int = 2
MIN_CREDIBILITY_FOR_VERIFIED: float = 0.60
MIN_CONTRADICTION_CONFIDENCE: float = 0.75
OUTDATED_GAP_DAYS: int = 180
