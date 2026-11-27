# CineVerify AI — AI/ML Developer Guide (One Step at a Time)

- **Branch:** `feat/ai-pipeline` (created from `dev`)
- **Primary Files:**
  - [`backend/app/core/models_config.py`](../backend/app/core/models_config.py)
  - [`backend/app/core/prompts.py`](../backend/app/core/prompts.py)
  - [`backend/app/services/claim_extractor.py`](../backend/app/services/claim_extractor.py)
  - [`backend/app/services/nli_verifier.py`](../backend/app/services/nli_verifier.py)
  - [`backend/app/services/verdict_engine.py`](../backend/app/services/verdict_engine.py)
  - [`backend/app/services/explanation_gen.py`](../backend/app/services/explanation_gen.py)
- **API Contract Reference:** [`docs/api-contract.md`](./api-contract.md)
- **Do NOT Edit Without Team Agreement:** `backend/app/schemas/`, `backend/app/routes/`, `backend/app/database/`, `frontend/`

> **How to work:** Complete **one step at a time**. Test each service module standalone with sample inputs before moving to the next step so you never have to debug all 4 AI stages at once.

---

## Step 1: Set Up Branch, Python Env & Verify Dependencies

### What to do
1. Clone from `dev` and create your feature branch:
   ```bash
   git clone -b dev https://github.com/amit-kumar-mandal-198/CineVerify.git
   cd CineVerify
   git checkout -b feat/ai-pipeline
   ```
2. Create a Python virtual environment and install dependencies:
   > **Important:** Python `3.11` or `3.12` is strongly recommended for `torch`, `transformers`, and `sentence-transformers`.
   ```bash
   cd backend
   python -m venv venv
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   # macOS / Linux:
   # source venv/bin/activate

   pip install -r requirements.txt
   cp .env.example .env
   ```
3. Add your `GEMINI_API_KEY` (from Google AI Studio) to `backend/.env`.

### Verify before moving on
- Run a quick Python check inside `backend/`:
  ```python
  from google import genai
  from sentence_transformers import CrossEncoder
  print("AI dependencies ready")
  ```
- Confirm `settings.GEMINI_API_KEY` is non-empty when loaded from `.env`.

---

## Step 2: Implement Claim Extraction (`services/claim_extractor.py`)

### What to build
Edit **`backend/app/services/claim_extractor.py`** (and refine `CLAIM_EXTRACTION_PROMPT` in `core/prompts.py` if needed):
1. **If `input_type == InputType.URL`:**
   - Fetch the webpage via `trafilatura.fetch_url(raw_input)` and extract title + main text (or first ~1,500 chars) before passing to the LLM.
   - If URL fetch fails, raise a clear `ValueError` so the route can return a helpful `400` error.
2. **Call Gemini (`google-genai`):**
   - Initialize `client = genai.Client(api_key=settings.GEMINI_API_KEY)`.
   - Use `GEMINI_MODEL_NAME` (`"gemini-2.5-flash"`) with `response_mime_type="application/json"` (structured JSON output).
3. **Parse & Validate into `ClaimResult`:**
   - Map `core_claim`, `category` (must match `ClaimCategory` enum), and `entities` (`ExtractedEntities`).
   - Always keep `submitted_claim=raw_input`.
   - Include a safe fallback if JSON parsing fails (never crash silently).

### Verify before moving on
Test `extract_claim()` on 4 headlines covering all 4 categories:
1. `"Red Chillies announces Shah Rukh Khan's next action film"` → `movie_announcement`
2. `"Deepika Padukone joins Spirit opposite Prabhas"` → `casting`
3. `"Pushpa 3 releasing on Christmas 2027"` → `release_update`
4. `"Kalki 2898 AD crosses 1000 crore worldwide"` → `box_office`

Confirm `core_claim`, `category`, and `entities` are populated cleanly.

---

## Step 3: Implement NLI Verification (`services/nli_verifier.py`)

### What to build
Edit **`backend/app/services/nli_verifier.py`**:
1. **Lazy-load & cache the model once:**
   - Load `CrossEncoder(NLI_MODEL_NAME)` (`"cross-encoder/nli-deberta-v3-base"`) via a module-level singleton or `@lru_cache` so it downloads/loads only once, not per request.
2. **Score `(premise, hypothesis)` pairs in a single batch:**
   - For NLI, **premise = `passage.text`**, **hypothesis = `core_claim`**.
   - Check the model's `id2label` mapping carefully (for `cross-encoder/nli-deberta-v3-base`, label order is typically `0: contradiction`, `1: entailment`, `2: neutral` — verify `model.model.config.id2label` in code rather than guessing!).
   - Apply softmax over logits to get probabilities in `[0.0, 1.0]`.
3. **Return `List[NLIResult]`:**
   - Map `entailment` → `StanceLabel.SUPPORTS`, `contradiction` → `StanceLabel.CONTRADICTS`, `neutral` → `StanceLabel.NEUTRAL`.
   - Handle empty `passages` cleanly (return `[]`).

### Verify before moving on
Run `verify_claim()` on 3 hardcoded `EvidencePassage` pairs:
- A passage directly confirming the claim → `supports`
- A passage directly refuting the claim → `contradicts`
- An unrelated passage mentioning the same actor → `neutral`

---

## Step 4: Implement Multi-Signal Verdict Engine (`services/verdict_engine.py`)

### What to build
Edit **`backend/app/services/verdict_engine.py`**:
Combine **4 signals** instead of blindly trusting a single NLI score:
1. **Empty / insufficient evidence guard:**
   - If `passages` or `nli_results` is empty → return `VerdictOutput(verdict=VerdictLabel.UNVERIFIED, confidence=0.2)`.
2. **Credibility-weighted stance scoring:**
   - Weight each `NLIResult` by `passage.credibility_score`.
   - Count strong `supports` and strong `contradicts` (e.g., `nli.confidence >= 0.65`).
3. **Temporal / Outdated-news check (`MISLEADING`):**
   - Compare `claim_result.entities.date` (if present and parseable) or current year against `passage.published_date` using `OUTDATED_GAP_DAYS` (`180` days).
   - Also flag `MISLEADING` when both credible `supports` AND credible `contradicts` exist (partial truth / exaggeration / conflicting context).
4. **Decision priority:**
   - If credible `contradicts` dominates with `confidence >= MIN_CONTRADICTION_CONFIDENCE` → `FALSE`.
   - Else if temporal mismatch or mixed/conflicting credible evidence → `MISLEADING`.
   - Else if `support_count >= MIN_VERIFIED_SUPPORT_COUNT` and average supporting credibility `>= MIN_CREDIBILITY_FOR_VERIFIED` → `VERIFIED`.
   - Else → `UNVERIFIED` *(never force a verdict when evidence is weak or neutral)*.
5. Compute calibrated `confidence` in `[0.0, 1.0]`.

### Verify before moving on
Unit-test `generate_verdict()` with synthetic `NLIResult` + `EvidencePassage` inputs for all 4 outcomes (`VERIFIED`, `FALSE`, `MISLEADING`, `UNVERIFIED`).

---

## Step 5: Implement Grounded Explanation Generator (`services/explanation_gen.py`)

### What to build
Edit **`backend/app/services/explanation_gen.py`**:
1. **No-evidence fast path:**
   - If `passages` is empty, return a clear, deterministic message explaining no credible Indian entertainment sources were retrieved to verify the claim (do not waste an LLM call).
2. **Format retrieved evidence:**
   - Include only top relevant passages (e.g., up to 6) with `[Index] Source Name | Date | Stance | Snippet`.
3. **Call Gemini (`google-genai`) with `EXPLANATION_GENERATION_PROMPT`:**
   - Instruct strict grounding: cite only sources, dates, and facts present in the evidence list.
   - Return a concise 3–5 sentence explanation.
4. **Safe fallback:**
   - If the Gemini call fails (rate limit/network), generate a clean template summary from the top stances and source names so the endpoint never fails.

### Verify before moving on
Run `generate_explanation()` on all 4 mock scenarios and read the output to confirm **zero hallucinated sources or unprovided facts**.

---

## Step 6: Standalone End-to-End AI Test & Open PR

### What to do
1. Write a small test script (e.g., `backend/tests/test_ai_pipeline.py`) that chains:
   `extract_claim` → mock `EvidencePassage`s → `verify_claim` → `generate_verdict` → `generate_explanation`.
2. Confirm all 4 verdict types (`VERIFIED`, `FALSE`, `MISLEADING`, `UNVERIFIED`) produce clean outputs matching `docs/api-contract.md`.
3. Coordinate with Backend (`feat/api-backend`) to test against real `retrieve_evidence()` passages.
4. Commit and push `feat/ai-pipeline`, then open a Pull Request into `dev`.
