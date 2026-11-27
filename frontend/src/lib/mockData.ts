import type { HistoryItem, VerificationResponse } from "@/types/api";

/**
 * UI development mock fixtures matching docs/api-contract.md.
 * Replace with real API calls via NEXT_PUBLIC_USE_MOCK=false once backend pipeline is connected.
 * NOTE: These are synthetic UI layout fixtures, not verified real-world demo claims.
 */
export const MOCK_VERIFICATIONS: Record<
  VerificationResponse["verdict"],
  VerificationResponse
> = {
  VERIFIED: {
    id: "mock-verified-001",
    submitted_claim: "Sample Verified Claim Placeholder (UI Dev Fixture)",
    core_claim: "Sample core factual assertion supported by credible sources.",
    verdict: "VERIFIED",
    confidence: 0.88,
    category: "movie_announcement",
    explanation:
      "Synthetic UI fixture: Multiple reputable sources match the submitted claim and confirm the details.",
    entities: {
      movie: "Sample Film",
      person: "Sample Actor",
      production_house: "Sample Studio",
      date: "2026-10-15",
      platform: null,
      amount: null,
    },
    evidence: [
      {
        source_name: "Bollywood Hungama",
        url: "https://example.com/source-1",
        title: "Sample Official Announcement Article",
        published_date: "2026-10-15",
        stance: "supports",
        snippet: "Sample evidence excerpt confirming the announcement.",
        credibility_score: 0.9,
      },
    ],
    verified_at: "2026-11-27T10:00:00Z",
  },
  FALSE: {
    id: "mock-false-001",
    submitted_claim: "Sample False Claim Placeholder (UI Dev Fixture)",
    core_claim: "Sample core factual assertion contradicted by credible sources.",
    verdict: "FALSE",
    confidence: 0.84,
    category: "casting",
    explanation:
      "Synthetic UI fixture: Credible trade reports directly refute this casting claim.",
    entities: {
      movie: "Sample Film 2",
      person: "Sample Director",
      production_house: null,
      date: null,
      platform: null,
      amount: null,
    },
    evidence: [
      {
        source_name: "Film Companion",
        url: "https://example.com/source-2",
        title: "Sample Clarification Report",
        published_date: "2026-11-10",
        stance: "contradicts",
        snippet: "Sample evidence excerpt stating the claim is inaccurate.",
        credibility_score: 0.95,
      },
    ],
    verified_at: "2026-11-27T10:00:00Z",
  },
  MISLEADING: {
    id: "mock-misleading-001",
    submitted_claim: "Sample Misleading Claim Placeholder (UI Dev Fixture)",
    core_claim: "Sample old announcement recirculated with outdated dates.",
    verdict: "MISLEADING",
    confidence: 0.72,
    category: "release_update",
    explanation:
      "Synthetic UI fixture: The core announcement occurred previously, but dates/context are misrepresented as breaking news.",
    entities: {
      movie: "Sample Film 3",
      person: null,
      production_house: null,
      date: "2024-05-01",
      platform: "OTT Platform",
      amount: null,
    },
    evidence: [
      {
        source_name: "Indian Express Entertainment",
        url: "https://example.com/source-3",
        title: "Sample Older Announcement Article",
        published_date: "2024-05-01",
        stance: "neutral",
        snippet: "Sample evidence excerpt from an earlier publication date.",
        credibility_score: 0.85,
      },
    ],
    verified_at: "2026-11-27T10:00:00Z",
  },
  UNVERIFIED: {
    id: "mock-unverified-001",
    submitted_claim: "Sample Unverified Rumour Placeholder (UI Dev Fixture)",
    core_claim: "Sample unconfirmed industry rumour lacking official confirmation.",
    verdict: "UNVERIFIED",
    confidence: 0.35,
    category: "box_office",
    explanation:
      "Synthetic UI fixture: Insufficient independent evidence is currently available to confirm or refute this claim.",
    entities: {
      movie: "Sample Film 4",
      person: null,
      production_house: null,
      date: null,
      platform: null,
      amount: "100 Crore",
    },
    evidence: [],
    verified_at: "2026-11-27T10:00:00Z",
  },
};

export const MOCK_HISTORY: HistoryItem[] = Object.values(MOCK_VERIFICATIONS).map(
  (item) => ({
    id: item.id,
    submitted_claim: item.submitted_claim,
    verdict: item.verdict,
    confidence: item.confidence,
    category: item.category,
    verified_at: item.verified_at,
  }),
);
