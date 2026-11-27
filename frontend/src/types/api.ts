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
