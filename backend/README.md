# CineVerify AI — Backend

FastAPI backend, evidence retrieval engine, and AI/ML verification pipeline.

## Setup

> **Python Note:** Python `3.11` or `3.12` is recommended if heavy ML dependencies (`torch`, `transformers`, `sentence-transformers`) lack prebuilt wheels on newer Python versions (`3.14`/`3.15`). For running the FastAPI skeleton and API stubs, any Python 3.10+ works.

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env` with your `GEMINI_API_KEY`, `SERPAPI_KEY`, and `MONGODB_URI`.

## Run Development Server

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs will be available at: `http://localhost:8000/docs`

## Module Ownership

- **Member 1 (AI/ML Lead):** `app/core/`, `app/services/claim_extractor.py`, `nli_verifier.py`, `verdict_engine.py`, `explanation_gen.py`
- **Member 2 (Backend):** `app/routes/`, `app/database/`, `app/services/evidence_retriever.py`, `app/config.py`, `app/main.py`
- **Shared Contract:** `app/schemas/` (do not modify without team agreement)
