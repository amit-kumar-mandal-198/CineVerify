# CineVerify AI — Backend Developer Guide (One Step at a Time)

- **Branch:** `feat/api-backend` (created from `dev`)
- **Primary Files:**
  - [`backend/app/main.py`](../backend/app/main.py)
  - [`backend/app/config.py`](../backend/app/config.py)
  - [`backend/app/routes/verify.py`](../backend/app/routes/verify.py)
  - [`backend/app/routes/history.py`](../backend/app/routes/history.py)
  - [`backend/app/database/connection.py`](../backend/app/database/connection.py)
  - [`backend/app/database/crud.py`](../backend/app/database/crud.py)
  - [`backend/app/services/evidence_retriever.py`](../backend/app/services/evidence_retriever.py)
- **API Contract Reference:** [`docs/api-contract.md`](./api-contract.md)
- **Do NOT Edit Without Team Agreement:** `backend/app/schemas/` or AI service internals (`claim_extractor.py`, `nli_verifier.py`, `verdict_engine.py`, `explanation_gen.py`)

> **How to work:** Complete **one step at a time**, test the specific module you just wrote, and commit cleanly before moving to the next step.

---

## Step 1: Set Up Branch, Environment & Verify Stub Server

### What to do
1. Clone from `dev` and create your feature branch:
   ```bash
   git clone -b dev https://github.com/amit-kumar-mandal-198/CineVerify.git
   cd CineVerify
   git checkout -b feat/api-backend
   ```
2. Create a Python virtual environment and install backend/retrieval packages:
   ```bash
   cd backend
   python -m venv venv
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   # macOS / Linux:
   # source venv/bin/activate

   pip install fastapi "uvicorn[standard]" pydantic python-dotenv httpx boto3 google-search-results trafilatura htmldate beautifulsoup4
   cp .env.example .env
   ```
   *(Note: If you later integrate the AI branch locally, Python `3.11` or `3.12` is recommended for PyTorch/Transformers wheel compatibility.)*
3. Add your `SERPAPI_KEY` and AWS DynamoDB settings (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DYNAMODB_TABLE_NAME`) to `backend/.env`.
4. Run the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Verify before moving on
- Open `http://localhost:8000/health` → should return `{"status": "ok", ...}`.
- Open `http://localhost:8000/docs` → test `POST /api/verify` and confirm the stub returns `200 OK` matching `docs/api-contract.md`.

---

## Step 2: Implement AWS DynamoDB Connection (`database/connection.py`)

### What to build
Edit **`backend/app/database/connection.py`**:
1. Initialize `boto3` DynamoDB client/resource using `settings.AWS_REGION` and optional IAM credentials (falling back to IAM role / `~/.aws/credentials` on EC2/Lambda).
2. Add `ensure_table_exists_sync()` using **Provisioned Capacity** (`5 RCU / 5 WCU`) so it stays inside the **AWS Always Free** tier (`≤ 25 RCU / 25 WCU`, `25 GB` storage).
3. Wire FastAPI shutdown/lifespan in `backend/app/main.py` so `close_database()` runs cleanly on exit.

### Verify before moving on
- Run `await ping_database()` and confirm it returns `True` against your AWS DynamoDB table `cineverify_verifications`.

---

## Step 3: Implement Persistence CRUD (`database/crud.py`)

### What to build
Edit **`backend/app/database/crud.py`**:
1. **`save_verification(report: VerificationResponse) -> str`**
   - Convert Python `float` values to `Decimal` (required by DynamoDB) and call `put_item`.
   - Return `report.id`.
2. **`get_history(limit: int = 20) -> List[HistoryItem]`**
   - Scan lightweight projection fields from DynamoDB, convert `Decimal` back to `float`, sort by `verified_at` descending, and slice `[:limit]`.
3. Also add `get_verification_by_id(report_id: str)` via `get_item(Key={"id": report_id})`.

### Verify before moving on
- Save a dummy `VerificationResponse` via `save_verification()`, call `get_history()`, and confirm it returns the saved `HistoryItem` from AWS DynamoDB.

---

## Step 4: Build Domain-Targeted Search Query Generator

### What to build
Inside **`backend/app/services/evidence_retriever.py`**, implement `generate_search_queries(claim_result: ClaimResult) -> List[str]`:
- Extract `movie`, `person`, `production_house`, `date`, `platform` from `claim_result.entities`.
- Generate **2–3 focused Indian cinema queries**, for example:
  1. Direct core claim + movie name (`"{movie} {core_claim}"` or `claim_result.core_claim`).
  2. Category-specific query:
     - `movie_announcement` → `"{movie} {production_house} official announcement"`
     - `casting` → `"{movie} {person} cast confirmed"`
     - `release_update` → `"{movie} release date official update"`
     - `box_office` → `"{movie} box office collection Sacnilk Bollywood Hungama"`
  3. Clean out `None` values and deduplicate identical queries.

### Verify before moving on
- Run `generate_search_queries()` on 4 sample `ClaimResult` objects (one per category) and inspect the printed queries.

---

## Step 5: Integrate SerpAPI with Local Dev Cache

### What to build
Inside **`backend/app/services/evidence_retriever.py`**, implement `search_web(query: str, num_results: int = 6) -> List[SearchResult]`:
1. Use `google-search-results` (`GoogleSearch`) with `settings.SERPAPI_KEY`, `gl="in"`, `hl="en"` (India-focused English results).
2. Parse `organic_results` into `SearchResult(title, url, snippet, displayed_date)`.
3. **Important — Add a local dev file cache** (e.g., `.cache/serpapi_cache.json`, already gitignored via `.cache/`):
   - Hash/normalize the query string; if cached, return cached results instead of spending your 250/month free SerpAPI credits during repeated testing.

### Verify before moving on
- Run `search_web("Pushpa 2 box office collection Sacnilk")` once (hits SerpAPI), then run it a second time (must hit local cache) and confirm both return `List[SearchResult]`.

---

## Step 6: Article Extraction, Chunking & Credibility Scoring

### What to build
Inside **`backend/app/services/evidence_retriever.py`**:
1. **Deduplicate URLs** across all query results (normalize trailing slashes / tracking params) and keep top 5–6 unique URLs.
2. **Extract article text & date** per URL (async/threadpool or `httpx` + `trafilatura.extract` + `htmldate.find_date`):
   - Set short request timeouts (e.g., 8 seconds) so one slow site never hangs `/api/verify`.
   - If extraction fails or returns empty text, gracefully fall back to the search `snippet` (marked clearly) or skip.
3. **Chunk long articles** into focused passages (~200–300 words, paragraph-aware, max ~3 passages per article so NLI stays fast on CPU).
4. **Attach source metadata & credibility:**
   - Call `get_source_credibility(url)` from `app/config.py`.
   - Build and return `List[EvidencePassage]`.
5. Expose everything through `async def retrieve_evidence(claim_result: ClaimResult) -> List[EvidencePassage]`.

### Verify before moving on
- Call `await retrieve_evidence(sample_claim)` and verify:
  - Returns non-empty `List[EvidencePassage]`
  - Every passage has `source_name`, `url`, `text` (<= ~350 words), and `credibility_score` in `[0.0, 1.0]`.

---

## Step 7: Wire Full Pipeline in Routes & Handle Errors

### What to build
Edit **`backend/app/routes/verify.py`**:
1. Build `List[EvidenceItem]` from `passages` + `nli_results` (mapping `nli_result.stance` and truncating `snippet` cleanly to ~300 chars).
2. Sort evidence items by credibility / relevance (deduplicating repeated passages from the same URL if needed for display).
3. Persist the final `VerificationResponse` via `await crud.save_verification(response)` (log and continue or handle DB failure cleanly).
4. Add error handling:
   - Missing/empty claim → `400`
   - Retrieval or external API failure → safe fallback or clear `502`/`500` error detail without leaking API keys.
5. Check CORS in `backend/app/main.py` allows `http://localhost:3000` (and deployed Vercel URL later).

### Verify before moving on
- Test `POST /api/verify` via `http://localhost:8000/docs` and confirm `GET /api/history` returns the newly saved verification.
- Once AI (`feat/ai-pipeline`) is merged into `dev`, test the full end-to-end pipeline together and open a PR into `dev`.
