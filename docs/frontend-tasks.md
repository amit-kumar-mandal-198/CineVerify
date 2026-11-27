# CineVerify AI — Frontend Developer Guide (One Step at a Time)

- **Branch:** `feat/frontend` (created from `dev`)
- **Primary Folder:** `frontend/`
- **API Contract Reference:** [`docs/api-contract.md`](./api-contract.md)
- **Shared TypeScript Types:** [`frontend/src/types/api.ts`](../frontend/src/types/api.ts)
- **Do NOT Edit:** `backend/`, `dataset/`, `docs/api-contract.md`

> **How to work:** Complete **one step at a time**, run the verification check at the end of that step, and commit cleanly before moving to the next step. While Backend and AI are still being built, keep `NEXT_PUBLIC_USE_MOCK=true` so you are 100% unblocked.

---

## Step 1: Set Up Branch & Verify Local App

### What to do
1. Clone from `dev` and create your feature branch:
   ```bash
   git clone -b dev https://github.com/amit-kumar-mandal-198/CineVerify.git
   cd CineVerify
   git checkout -b feat/frontend
   ```
2. Install dependencies and add `lucide-react` for icons:
   ```bash
   cd frontend
   npm install
   npm install lucide-react
   cp .env.example .env.local
   ```
3. Confirm `.env.local` has:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_USE_MOCK=true
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

### Verify before moving on
- Open `http://localhost:3000` and confirm the **"CineVerify AI"** starter page renders without console errors.

---

## Step 2: Build the App Shell (`Navbar`, `Footer`, `layout.tsx`)

### What to build
1. **`frontend/src/components/Navbar.tsx`**
   - Brand logo/title: **CineVerify AI**
   - Navigation links:
     - `/` — Home
     - `/verify` — Verify Claim
     - `/history` — History
     - `/about` — About
   - Highlight active route and ensure mobile-friendly layout.
2. **`frontend/src/components/Footer.tsx`**
   - Display project name (`CineVerify AI`), event (`OVERCLOCK 26 · Track SW-OI-1`), and scope disclaimer (*"Focused on Indian cinema news verification — outputs are evidence-backed, not absolute truth."*).
3. **`frontend/src/app/layout.tsx`**
   - Wrap `{children}` with `<Navbar />` at top and `<Footer />` at bottom inside a clean flex layout.

### Verify before moving on
- Run `npm run dev`, click every nav link (even if `/verify`, `/history`, `/about` are placeholders first), and check mobile + desktop widths.

---

## Step 3: Build the Claim Submission Component (`ClaimInput.tsx`)

### What to build
Create **`frontend/src/components/ClaimInput.tsx`**:
- Toggle between `"text"` (**Headline / Claim**) and `"url"` (**Article URL**) matching `InputType` in `src/types/api.ts`.
- Textarea (for `text`) or URL input (for `url`) with helpful Indian-cinema placeholder examples.
- Quick-try example chips (optional, clicks populate the input).
- Submit button (`Verify Claim`) disabled when empty or while `isLoading === true`.
- Inline validation message if input is under 3 characters or invalid URL when `type === "url"`.

### Props interface
```ts
interface ClaimInputProps {
  onSubmit: (claim: string, type: InputType) => Promise<void>;
  isLoading: boolean;
}
```

### Verify before moving on
- Render `<ClaimInput />` temporarily or on `/verify`, test empty submit validation, text/URL toggle, and disabled state while loading.

---

## Step 4: Build Verification Report Display Components

Create these focused components in `frontend/src/components/` matching `VerificationResponse` in `src/types/api.ts`:

1. **`VerdictBadge.tsx`**
   - Props: `verdict: VerdictLabel`
   - Color + icon mapping:
     - `VERIFIED` → Green badge + `CheckCircle2`
     - `FALSE` → Red badge + `XCircle`
     - `MISLEADING` → Amber badge + `AlertTriangle`
     - `UNVERIFIED` → Slate/Grey badge + `HelpCircle`
2. **`ConfidenceMeter.tsx`**
   - Props: `confidence: number` (`0.0` to `1.0`)
   - Renders percentage (`Math.round(confidence * 100)%`) and progress bar labeled **"Evidence Strength"**.
3. **`ExplanationBox.tsx`**
   - Props: `explanation: string`, `verdict: VerdictLabel`
   - Clean card displaying the AI-generated explanation and a short reminder that the verdict is derived from the retrieved sources below.
4. **`EvidenceCard.tsx`**
   - Props: `item: EvidenceItem`
   - Shows:
     - `stance` pill (`supports` green, `contradicts` red, `neutral` grey)
     - `source_name` + `published_date` (fallback `"Date unknown"` if `null`)
     - `title` + `snippet`
     - `credibility_score` indicator
     - Clickable external link (`url`, `target="_blank" rel="noopener noreferrer"`)
5. **`VerificationReport.tsx`**
   - Props: `report: VerificationResponse`
   - Combines: Submitted claim & extracted `core_claim`, `category` tag, detected `entities` pills (ignore `null` fields), `VerdictBadge` + `ConfidenceMeter`, `ExplanationBox`, and the list of `EvidenceCard`s (with an empty-state notice when `evidence.length === 0`).

### Verify before moving on
- Pass all 4 fixtures from `MOCK_VERIFICATIONS` (`VERIFIED`, `FALSE`, `MISLEADING`, `UNVERIFIED`) in `src/lib/mockData.ts` into `<VerificationReport />` and inspect each state visually.

---

## Step 5: Build the Verify Page (`frontend/src/app/verify/page.tsx`)

### What to build
1. Manage 4 explicit UI states:
   - **Idle:** Show `<ClaimInput />` + brief instructions.
   - **Loading:** Show progress steps (*Extracting claim → Searching entertainment sources → Running NLI comparison → Generating grounded report*).
   - **Success:** Show `<VerificationReport report={result} />`.
   - **Error:** Show clean alert banner with retry action.
2. Call `verifyClaim(claim, type)` from `src/lib/api.ts`.
3. *(Dev helper while `USE_MOCK=true`)*: Check `src/lib/mockData.ts` — you can also add a tiny dev-only preset switcher or test all 4 mock verdicts before integrating.

### Verify before moving on
- Submit a sample claim on `/verify`, confirm loading state transitions smoothly into `<VerificationReport />`, and confirm error handling works if `verifyClaim` throws.

---

## Step 6: Build History, Home, and About Pages

1. **`frontend/src/app/history/page.tsx`**
   - Fetch items via `getHistory()` from `src/lib/api.ts`.
   - Display a clean table/list (`submitted_claim`, `VerdictBadge`, `category`, `confidence`, formatted `verified_at`).
   - Add client-side filter by verdict (`ALL`, `VERIFIED`, `FALSE`, `MISLEADING`, `UNVERIFIED`).
2. **`frontend/src/app/page.tsx`**
   - Hero section explaining CineVerify AI + primary CTA button linking to `/verify`.
   - "4 Supported Categories" grid (Movie Announcements, Casting, Release Updates, Box-Office).
   - "How Verification Works" 4-step visual pipeline.
3. **`frontend/src/app/about/page.tsx`**
   - Project overview, 4 verdict definitions, explicit scope & limitations (*does not fabricate certainty when evidence is missing*).

### Verify before moving on
- Run static checks and production build:
  ```bash
  npx tsc --noEmit
  npm run lint
  npm run build
  ```
- Confirm all 3 commands exit with `0` errors.

---

## Step 7: Connect to Real Backend & Open PR

### What to do
1. Once Backend (`feat/api-backend`) + AI (`feat/ai-pipeline`) are running locally on `http://localhost:8000` (or deployed):
   - Update `frontend/.env.local`:
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:8000
     NEXT_PUBLIC_USE_MOCK=false
     ```
2. Test `POST /api/verify` and `GET /api/history` end-to-end from the UI.
3. Verify slow-request UX (10–30s real pipeline latency) and empty/error responses.
4. Re-run `npx tsc --noEmit && npm run lint && npm run build`.
5. Commit and push `feat/frontend`, then open a Pull Request into `dev`.
