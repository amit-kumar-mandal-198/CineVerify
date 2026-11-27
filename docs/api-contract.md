# CineVerify AI — API & Internal Interface Contract

> **Single Source of Truth** for Frontend, Backend, and AI/ML integration.  
> Any breaking change to these schemas must be agreed upon by the team before merging.

---

## 1. Enumerations

| Field | Allowed Values |
|---|---|
| `type` | `"text"`, `"url"` |
| `category` | `"movie_announcement"`, `"casting"`, `"release_update"`, `"box_office"` |
| `verdict` | `"VERIFIED"`, `"FALSE"`, `"MISLEADING"`, `"UNVERIFIED"` |
| `stance` | `"supports"`, `"contradicts"`, `"neutral"` |

---

## 2. REST API Endpoints

### `GET /health`
Health check endpoint for deployment monitoring.

**Response (`200 OK`)**
```json
{
  "status": "ok",
  "service": "cineverify-backend",
  "version": "0.1.0"
}
```

---

### `POST /api/verify`
Analyzes a submitted Indian cinema claim (headline, text, or URL), retrieves evidence, runs NLI + multi-signal verification, and returns an explainable report.

**Request Body**
```json
{
  "claim": "Pushpa 3 releasing on Christmas 2027",
  "type": "text"
}
```

**Response (`200 OK`)**
```json
{
  "id": "string",
  "submitted_claim": "string",
  "core_claim": "string",
  "verdict": "VERIFIED | FALSE | MISLEADING | UNVERIFIED",
  "confidence": 0.0,
  "category": "movie_announcement | casting | release_update | box_office",
  "explanation": "string",
  "entities": {
    "movie": "string | null",
    "person": "string | null",
    "production_house": "string | null",
    "date": "string | null",
    "platform": "string | null",
    "amount": "string | null"
  },
  "evidence": [
    {
      "source_name": "string",
      "url": "string",
      "title": "string",
      "published_date": "string | null",
      "stance": "supports | contradicts | neutral",
      "snippet": "string",
      "credibility_score": 0.0
    }
  ],
  "verified_at": "2026-11-27T10:00:00Z"
}
```

**Validation & Error Responses**
- `400 Bad Request` — Empty claim or invalid `type`
- `422 Unprocessable Entity` — Schema validation failure
- `500 Internal Server Error` — Unexpected pipeline failure (returns `{ "detail": "string" }`)

---

### `GET /api/history`
Returns previously verified claims stored in MongoDB, sorted newest first.

**Query Parameters**
- `limit` (optional, integer, default `20`, max `100`)

**Response (`200 OK`)**
```json
[
  {
    "id": "string",
    "submitted_claim": "string",
    "verdict": "VERIFIED | FALSE | MISLEADING | UNVERIFIED",
    "confidence": 0.0,
    "category": "movie_announcement | casting | release_update | box_office",
    "verified_at": "2026-11-27T10:00:00Z"
  }
]
```

---

## 3. Internal Python Service Contracts (Backend <-> AI/ML)

Defined via shared Pydantic models in `backend/app/schemas/`:

1. **Member 1 (`claim_extractor.py`)**
   ```python
   def extract_claim(raw_input: str, input_type: InputType = InputType.TEXT) -> ClaimResult
   ```
2. **Member 2 (`evidence_retriever.py`)**
   ```python
   async def retrieve_evidence(claim_result: ClaimResult) -> list[EvidencePassage]
   ```
3. **Member 1 (`nli_verifier.py`)**
   ```python
   def verify_claim(core_claim: str, passages: list[EvidencePassage]) -> list[NLIResult]
   ```
4. **Member 1 (`verdict_engine.py`)**
   ```python
   def generate_verdict(
       claim_result: ClaimResult,
       nli_results: list[NLIResult],
       passages: list[EvidencePassage],
   ) -> VerdictOutput
   ```
5. **Member 1 (`explanation_gen.py`)**
   ```python
   def generate_explanation(
       claim_result: ClaimResult,
       verdict: VerdictOutput,
       passages: list[EvidencePassage],
       nli_results: list[NLIResult],
   ) -> str
   ```
