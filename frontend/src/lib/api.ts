import { MOCK_HISTORY, MOCK_VERIFICATIONS } from "@/lib/mockData";
import type {
  ClaimRequest,
  FollowUpRequest,
  FollowUpResponse,
  HealthResponse,
  HistoryItem,
  InputType,
  VerificationResponse,
  VerifyStreamEvent,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const REPORT_CACHE_PREFIX = "cineverify_report:";
const reportMemoryCache = new Map<string, VerificationResponse>();

export function cacheVerificationReport(report: VerificationResponse): void {
  reportMemoryCache.set(report.id, report);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${REPORT_CACHE_PREFIX}${report.id}`,
      JSON.stringify(report),
    );
  } catch {
    // Ignore sessionStorage quota or privacy mode restrictions
  }
}

export function getCachedVerificationReport(
  id: string,
): VerificationResponse | null {
  const inMemory = reportMemoryCache.get(id);
  if (inMemory) return inMemory;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${REPORT_CACHE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VerificationResponse;
    reportMemoryCache.set(id, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearCachedVerificationReport(id: string): void {
  reportMemoryCache.delete(id);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${REPORT_CACHE_PREFIX}${id}`);
  } catch {
    // Ignore storage cleanup restrictions
  }
}

export async function verifyClaim(
  claim: string,
  type: InputType = "text",
): Promise<VerificationResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const mockReport: VerificationResponse = {
      ...MOCK_VERIFICATIONS.UNVERIFIED,
      id: `mock-${Date.now()}`,
      submitted_claim: claim,
      core_claim: claim,
      verified_at: new Date().toISOString(),
    };
    cacheVerificationReport(mockReport);
    return mockReport;
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

  const report = (await response.json()) as VerificationResponse;
  cacheVerificationReport(report);
  return report;
}

export async function verifyClaimStream(
  claim: string,
  type: InputType,
  onEvent: (event: VerifyStreamEvent) => void,
): Promise<VerificationResponse> {
  if (USE_MOCK) {
    const mockSteps: VerifyStreamEvent[] = [
      { stage: "extracting_claim", status: "running", step: 0 },
      { stage: "extracting_claim", status: "done", step: 0, detail: "Mock Mode" },
      { stage: "searching_sources", status: "running", step: 1 },
      { stage: "searching_sources", status: "done", step: 1, detail: "Fixture sources" },
      { stage: "nli_comparison", status: "running", step: 2 },
      { stage: "nli_comparison", status: "done", step: 2, detail: "UNVERIFIED" },
      { stage: "generating_report", status: "running", step: 3 },
    ];
    for (const evt of mockSteps) {
      onEvent(evt);
      await new Promise((resolve) => setTimeout(resolve, 260));
    }
    const report = await verifyClaim(claim, type);
    onEvent({ stage: "complete", status: "done", step: 3, report });
    return report;
  }

  const payload: ClaimRequest = { claim, type };
  const response = await fetch(`${API_BASE}/api/verify/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 404 || !response.body) {
    return verifyClaim(claim, type);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Verification failed (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalReport: VerificationResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) continue;

      const parsed = JSON.parse(dataLines.join("\n")) as VerifyStreamEvent;
      onEvent(parsed);

      if (parsed.stage === "error") {
        throw new Error(parsed.detail || "Verification failed.");
      }
      if (parsed.stage === "complete" && parsed.report) {
        finalReport = parsed.report;
      }
    }
  }

  if (!finalReport) {
    throw new Error("Verification stream ended without returning a report.");
  }

  cacheVerificationReport(finalReport);
  return finalReport;
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

export async function getVerificationById(
  id: string,
): Promise<VerificationResponse | null> {
  const cached = getCachedVerificationReport(id);
  if (cached) return cached;

  if (USE_MOCK) {
    const mockMatch = Object.values(MOCK_VERIFICATIONS).find(
      (item) => item.id === id,
    );
    return mockMatch ?? null;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/history/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return null;
    }
    const report = (await response.json()) as VerificationResponse;
    cacheVerificationReport(report);
    return report;
  } catch {
    return null;
  }
}

export async function deleteVerificationById(id: string): Promise<void> {
  clearCachedVerificationReport(id);

  if (USE_MOCK) {
    return;
  }

  const response = await fetch(
    `${API_BASE}/api/history/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete verification (${response.status})`);
  }
}

export async function askFollowUp(
  payload: FollowUpRequest,
): Promise<FollowUpResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const topSource = payload.evidence[0];
    return {
      answer: topSource
        ? `Based on ${topSource.source_name} (${topSource.stance}): ${topSource.snippet}`
        : `This report is marked ${payload.verdict} because no supporting or refuting trade evidence was attached.`,
      cited_sources: topSource ? [topSource.source_name] : [],
    };
  }

  const response = await fetch(`${API_BASE}/api/verify/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Follow-up failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as FollowUpResponse;
}

export async function getBackendHealth(): Promise<HealthResponse | null> {
  if (USE_MOCK) {
    return { status: "mock", service: "cineverify-mock", version: "0.1.0" };
  }

  try {
    const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as HealthResponse;
  } catch {
    return null;
  }
}
