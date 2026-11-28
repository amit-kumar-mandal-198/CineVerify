# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface \
    PORT=8000

WORKDIR /app

# System dependencies for lxml / trafilatura / htmldate
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libxml2-dev \
    libxslt1-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first to avoid downloading ~2.5 GB of CUDA wheels
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch>=2.4.0

# Install application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Hugging Face NLI & embedding models into the image for fast startup
RUN python -c "\
from sentence_transformers import CrossEncoder, SentenceTransformer; \
CrossEncoder('cross-encoder/nli-deberta-v3-base', max_length=256); \
SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy backend source code
COPY app ./app

# Create non-root user and ensure cache directory is readable
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/.cache \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
