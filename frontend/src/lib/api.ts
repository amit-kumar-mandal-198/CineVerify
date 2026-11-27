import { MOCK_HISTORY, MOCK_VERIFICATIONS } from "@/lib/mockData";
import type {
  ClaimRequest,
  HistoryItem,
  InputType,
  VerificationResponse,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export async function verifyClaim(
  claim: string,
  type: InputType = "text",
): Promise<VerificationResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      ...MOCK_VERIFICATIONS.UNVERIFIED,
      submitted_claim: claim,
      core_claim: claim,
    };
  }

  const payload: ClaimRequest = { claim, type };
  const response = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Verification failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as VerificationResponse;
}

export async function getHistory(limit = 20): Promise<HistoryItem[]> {
  if (USE_MOCK) {
    return MOCK_HISTORY.slice(0, limit);
  }

  const response = await fetch(`${API_BASE}/api/history?limit=${limit}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch verification history (${response.status})`);
  }

  return (await response.json()) as HistoryItem[];
}
