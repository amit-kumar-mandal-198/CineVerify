# CineVerify AI

**AI-Powered Indian Cinema News & Rumour Verification System**  
Hackathon: **OVERCLOCK 26** · Track: **SW-OI-1 (Open Innovation: Next-Gen AI & ML)**

---

## Overview

CineVerify AI verifies Indian film and entertainment news claims by extracting structured assertions, retrieving multi-source evidence from reputable entertainment outlets and trade trackers, applying Natural Language Inference (NLI) + temporal and source-credibility checks, and generating an explainable verification report with traceable URLs.

### Initial Scope (4 Categories)
- `movie_announcement` — New movie announcements, sequels, cancellations
- `casting` — Actor, director, and crew announcements or rumoured changes
- `release_update` — Release dates, postponements, OTT announcements
- `box_office` — Domestic/worldwide collections, opening-day and lifetime claims

### Supported Verdicts
- `VERIFIED` — Credible evidence supports the claim
- `FALSE` — Credible evidence directly contradicts the claim
- `MISLEADING` — Contains truth but misrepresents dates, context, or figures
- `UNVERIFIED` — Insufficient or inconclusive evidence (no forced verdicts)

---

## Repository Structure

```text
CineVerify/
├── backend/                  # FastAPI server, evidence retrieval, AI/ML pipeline
│   ├── app/
│   │   ├── main.py           # FastAPI entry point & health check
│   │   ├── config.py         # Settings & source credibility tiers
│   │   ├── core/             # LLM prompts & ML model configuration (AI/ML)
│   │   ├── schemas/          # Shared Pydantic models matching API contract
│   │   ├── routes/           # /api/verify and /api/history endpoints (Backend)
│   │   ├── services/         # Modular pipeline services (AI/ML + Retrieval)
│   │   └── database/         # MongoDB connection & CRUD (Backend)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # Next.js + Tailwind CSS + TypeScript UI (Frontend)
├── dataset/                  # Labelled Indian cinema claims & evaluation results
├── docs/
│   └── api-contract.md       # Single source of truth for API & module interfaces
└── README.md
```

---

## Team Ownership & Branch Workflow

Never commit directly to `main`. Work on your assigned feature branch and open a Pull Request into `dev` (then `main` when verified):

| Role | Branch | Primary Ownership |
|---|---|---|
| **AI/ML Lead (Member 1)** | `feat/ai-pipeline` | `backend/app/core/`, `backend/app/services/{claim_extractor,nli_verifier,verdict_engine,explanation_gen}.py` |
| **Backend Engineer (Member 2)** | `feat/api-backend` | `backend/app/routes/`, `backend/app/database/`, `backend/app/services/evidence_retriever.py` |
| **Frontend Engineer (Member 3)** | `feat/frontend` | `frontend/` |
| **Dataset & QA (Member 4)** | `feat/dataset` | `dataset/`, end-to-end testing & demo validation |

---

## Quickstart

### 1. Clone & Switch to Your Branch
```bash
git clone https://github.com/amit-kumar-mandal-198/CineVerify.git
cd CineVerify
git checkout -b <your-branch-name>
```

### 2. Backend Setup
See [backend/README.md](backend/README.md) for Python environment setup and API keys.

### 3. Frontend Setup
See [frontend/README.md](frontend/README.md) for running the Next.js app locally.

### 4. API Contract
All frontend, backend, and AI/ML integration MUST follow [docs/api-contract.md](docs/api-contract.md).
