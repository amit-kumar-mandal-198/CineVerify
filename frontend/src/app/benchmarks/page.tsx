"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Database,
  Loader2,
  Play,
  ShieldCheck,
  Timer,
} from "lucide-react";
import VerdictBadge from "@/components/VerdictBadge";
import { getBackendHealth, getHistory, verifyClaim } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/formatters";
import type {
  ClaimCategory,
  HealthResponse,
  HistoryItem,
  VerdictLabel,
} from "@/types/api";

interface BenchmarkSample {
  id: string;
  claim: string;
  expectedCategory: ClaimCategory;
}

interface BenchmarkRunResult {
  id: string;
  claim: string;
  expectedCategory: ClaimCategory;
  actualCategory: ClaimCategory;
  categoryMatched: boolean;
  verdict: VerdictLabel;
  confidence: number;
  evidenceCount: number;
  latencyMs: number;
}

const BENCHMARK_SAMPLES: ReadonlyArray<BenchmarkSample> = [
  {
    id: "bench-announcement",
    claim: "Shah Rukh Khan and Sujoy Ghosh announce action thriller King",
    expectedCategory: "movie_announcement",
  },
  {
    id: "bench-casting",
    claim:
      "SS Rajamouli's next film with Mahesh Babu begins shooting in Hyderabad",
    expectedCategory: "casting",
  },
  {
    id: "bench-release",
    claim: "Pushpa 3 releasing on Christmas 2027",
    expectedCategory: "release_update",
  },
  {
    id: "bench-boxoffice",
    claim: "Kalki 2898 AD crossed 1000 crore worldwide at the box office",
    expectedCategory: "box_office",
  },
];

const PIPELINE_ARCHITECTURE = [
  {
    component: "Claim Extraction & Entities",
    model: "Gemini Flash-Lite + Heuristic Fallback",
    role: "Normalizes headlines/URLs into core assertions & 6 entity slots",
  },
  {
    component: "Semantic Chunk Ranking",
    model: "sentence-transformers/all-MiniLM-L6-v2",
    role: "Ranks article paragraphs by claim similarity before NLI",
  },
  {
    component: "Stance Verification (NLI)",
    model: "cross-encoder/nli-deberta-v3-base",
    role: "Scores Supports / Contradicts / Neutral with headline & date context",
  },
  {
    component: "History Storage",
    model: "AWS DynamoDB (GSI + Scan Fallback)",
    role: "Persists verification reports sorted newest-first",
  },
] as const;

export default function BenchmarksPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [suiteResults, setSuiteResults] = useState<BenchmarkRunResult[]>([]);
  const [suiteError, setSuiteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBackendHealth(), getHistory(100).catch(() => [])])
      .then(([healthData, historyData]) => {
        if (cancelled) return;
        setHealth(healthData);
        setHistoryItems(historyData);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const historyStats = useMemo(() => {
    const verdictCounts: Record<VerdictLabel, number> = {
      VERIFIED: 0,
      FALSE: 0,
      MISLEADING: 0,
      UNVERIFIED: 0,
    };
    const categoryCounts: Record<ClaimCategory, number> = {
      movie_announcement: 0,
      casting: 0,
      release_update: 0,
      box_office: 0,
    };
    let confidenceSum = 0;

    for (const item of historyItems) {
      verdictCounts[item.verdict] += 1;
      categoryCounts[item.category] += 1;
      confidenceSum += item.confidence;
    }

    const avgConfidence =
      historyItems.length > 0
        ? Math.round((confidenceSum / historyItems.length) * 100)
        : null;

    return {
      total: historyItems.length,
      avgConfidence,
      verdictCounts,
      categoryCounts,
    };
  }, [historyItems]);

  async function handleRunSuite() {
    setIsRunningSuite(true);
    setSuiteError(null);
    setSuiteResults([]);

    const results: BenchmarkRunResult[] = [];
    try {
      for (const sample of BENCHMARK_SAMPLES) {
        const started = performance.now();
        const report = await verifyClaim(sample.claim, "text");
        const latencyMs = Math.round(performance.now() - started);

        results.push({
          id: sample.id,
          claim: sample.claim,
          expectedCategory: sample.expectedCategory,
          actualCategory: report.category,
          categoryMatched: report.category === sample.expectedCategory,
          verdict: report.verdict,
          confidence: report.confidence,
          evidenceCount: report.evidence.length,
          latencyMs,
        });
        setSuiteResults([...results]);
      }
    } catch (err) {
      setSuiteError(
        err instanceof Error
          ? err.message
          : "Live benchmark run failed while contacting backend.",
      );
    } finally {
      setIsRunningSuite(false);
    }
  }

  const suiteSummary = useMemo(() => {
    if (suiteResults.length === 0) return null;
    const matched = suiteResults.filter((r) => r.categoryMatched).length;
    const avgLatency = Math.round(
      suiteResults.reduce((sum, r) => sum + r.latencyMs, 0) /
        suiteResults.length,
    );
    return { matched, total: suiteResults.length, avgLatency };
  }, [suiteResults]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="glass-card inline-flex items-center gap-2 !rounded-full px-3.5 py-1 text-xs font-medium text-[var(--ink-900)]">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold">Live Diagnostics &amp; Benchmarks</span>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--ink-900)] sm:text-3xl">
            System Telemetry &amp; Pipeline Benchmark
          </h1>
          <p className="max-w-2xl text-sm text-[var(--ink-500)]">
            Real-time health metrics, recorded verification analytics from
            history, and an on-demand 4-category live evaluation suite.
          </p>
        </div>

        <button
          type="button"
          disabled={isRunningSuite}
          onClick={() => void handleRunSuite()}
          className="cta-lime inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunningSuite ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Running 4-Beat Suite...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>Run Live Benchmark Suite</span>
            </>
          )}
        </button>
      </section>

      {/* Top Live Metrics Strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--ink-500)]">
            <span>Backend Service</span>
            <ShieldCheck className="h-4 w-4 text-[var(--ink-900)]" aria-hidden="true" />
          </div>
          {isLoadingMeta ? (
            <div className="mt-3 h-6 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          ) : health ? (
            <div className="mt-2">
              <p className="text-lg font-bold capitalize text-emerald-700">
                {health.status}
              </p>
              <p className="text-xs text-[var(--ink-500)]">
                {health.service} · v{health.version}
              </p>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-lg font-bold text-red-700">Offline</p>
              <p className="text-xs text-[var(--ink-500)]">
                Unable to reach FastAPI /health
              </p>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--ink-500)]">
            <span>Recorded Checks</span>
            <Database className="h-4 w-4 text-[var(--ink-900)]" aria-hidden="true" />
          </div>
          {isLoadingMeta ? (
            <div className="mt-3 h-6 w-16 animate-pulse rounded bg-[var(--surface-muted)]" />
          ) : (
            <div className="mt-2">
              <p className="text-lg font-bold tabular-nums text-[var(--ink-900)]">
                {historyStats.total}
              </p>
              <p className="text-xs text-[var(--ink-500)]">
                {historyStats.avgConfidence !== null
                  ? `Avg confidence: ${historyStats.avgConfidence}%`
                  : "No history records yet"}
              </p>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--ink-500)]">
            <span>Live Suite Result</span>
            <Timer className="h-4 w-4 text-[var(--ink-900)]" aria-hidden="true" />
          </div>
          <div className="mt-2">
            {suiteSummary ? (
              <>
                <p className="text-lg font-bold tabular-nums text-[var(--ink-900)]">
                  {suiteSummary.matched}/{suiteSummary.total} Category Match
                </p>
                <p className="text-xs text-[var(--ink-500)]">
                  Avg latency: {suiteSummary.avgLatency} ms
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-[var(--ink-900)]">Ready</p>
                <p className="text-xs text-[var(--ink-500)]">
                  4 sample claims across all cinema beats
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Live Suite Output */}
      {(suiteResults.length > 0 || suiteError) && (
        <section className="glass-card space-y-4 p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-[var(--ink-900)]">
            Live Evaluation Results
          </h2>

          {suiteError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {suiteError}
            </p>
          )}

          {suiteResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--ink-500)] uppercase">
                  <tr>
                    <th className="py-2 pr-4">Sample Claim</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Verdict</th>
                    <th className="px-3 py-2">Evidence</th>
                    <th className="py-2 pl-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {suiteResults.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 pr-4 font-medium text-[var(--ink-900)]">
                        {row.claim}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 font-medium text-[var(--ink-900)]">
                          {row.categoryMatched && (
                            <CheckCircle2
                              className="h-3 w-3 text-emerald-600"
                              aria-hidden="true"
                            />
                          )}
                          <span>{CATEGORY_LABELS[row.actualCategory]}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <VerdictBadge verdict={row.verdict} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[var(--ink-500)]">
                        {row.evidenceCount} sources ·{" "}
                        {Math.round(row.confidence * 100)}%
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono font-semibold text-[var(--ink-900)]">
                        {row.latencyMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Recorded History Breakdown */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="glass-card space-y-3 p-5">
          <h2 className="font-serif text-base font-semibold text-[var(--ink-900)]">
            Verdict Distribution (History)
          </h2>
          <div className="space-y-2.5">
            {(
              ["VERIFIED", "FALSE", "MISLEADING", "UNVERIFIED"] as const
            ).map((verdict) => {
              const count = historyStats.verdictCounts[verdict];
              const pct =
                historyStats.total > 0
                  ? Math.round((count / historyStats.total) * 100)
                  : 0;
              return (
                <div key={verdict} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <VerdictBadge verdict={verdict} />
                    <span className="font-mono font-semibold text-[var(--ink-700)]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--ink-900)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card space-y-3 p-5">
          <h2 className="font-serif text-base font-semibold text-[var(--ink-900)]">
            Active Model &amp; Retrieval Stack
          </h2>
          <div className="space-y-2.5">
            {PIPELINE_ARCHITECTURE.map((layer) => (
              <div
                key={layer.component}
                className="rounded-xl border border-[var(--border)] bg-white/75 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-900)]">
                    <Cpu className="h-3.5 w-3.5 text-[var(--ink-500)]" aria-hidden="true" />
                    <span>{layer.component}</span>
                  </span>
                  <span className="rounded bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--ink-700)]">
                    {layer.model}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--ink-500)]">
                  {layer.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
