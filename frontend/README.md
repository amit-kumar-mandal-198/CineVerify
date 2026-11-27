# CineVerify AI — Frontend

Next.js (App Router) + TypeScript + Tailwind CSS frontend (owned by Member 3).

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

## Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Integration Notes

- API TypeScript contracts are defined in `src/types/api.ts` (matching `docs/api-contract.md`).
- API client is in `src/lib/api.ts`. Keep `NEXT_PUBLIC_USE_MOCK=true` while developing UI independently, then switch to `false` to hit the FastAPI backend.
