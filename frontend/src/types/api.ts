/**
 * Shared TypeScript contracts matching docs/api-contract.md.
 * Owned jointly by Frontend (Member 3) & Backend (Member 2).
 */

export type InputType = "text" | "url";

export type ClaimCategory =
  | "movie_announcement"
  | "casting"
  | "release_update"
  | "box_office";

export type VerdictLabel = "VERIFIED" | "FALSE" | "MISLEADING" | "UNVERIFIED";

export type StanceLabel = "supports" | "contradicts" | "neutral";

export type ComparisonStatus = "match" | "mismatch" | "unclear";

export interface ClaimComparison {
  aspect: string;
  claimed: string;
  reported: string;
  status: ComparisonStatus;
}

export interface ClaimRequest {
  claim: string;
  type: InputType;
}

export interface ExtractedEntities {
  movie: string | null;
  person: string | null;
  production_house: string | null;
  date: string | null;
  platform: string | null;
  amount: string | null;
}

export interface EvidenceItem {
  source_name: string;
  url: string;
  title: string;
  published_date: string | null;
  stance: StanceLabel;
  snippet: string;
  credibility_score: number;
}

export interface VerificationResponse {
  id: string;
  submitted_claim: string;
  core_claim: string;
  verdict: VerdictLabel;
  confidence: number;
  category: ClaimCategory;
  explanation: string;
  entities: ExtractedEntities;
  evidence: EvidenceItem[];
  claim_comparisons?: ClaimComparison[];
  verified_at: string;
}

export interface HistoryItem {
  id: string;
  submitted_claim: string;
  verdict: VerdictLabel;
  confidence: number;
  category: ClaimCategory;
  verified_at: string;
}

export interface FollowUpTurn {
  role: "user" | "assistant";
  content: string;
}

export interface FollowUpRequest {
  claim: string;
  core_claim: string;
  verdict: VerdictLabel;
  explanation: string;
  evidence: EvidenceItem[];
  question: string;
  history: FollowUpTurn[];
}

export interface FollowUpResponse {
  answer: string;
  cited_sources: string[];
}

export interface VerifyStreamEvent {
  stage:
    | "extracting_claim"
    | "searching_sources"
    | "nli_comparison"
    | "generating_report"
    | "complete"
    | "error";
  status?: "running" | "done";
  step?: number;
  detail?: string;
  report?: VerificationResponse;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}
