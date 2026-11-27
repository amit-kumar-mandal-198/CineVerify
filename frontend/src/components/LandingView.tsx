"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileText,
  Flame,
  Link2,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import VerdictBadge from "@/components/VerdictBadge";
import { getHistory } from "@/lib/api";
import { CATEGORY_LABELS, formatVerificationDate } from "@/lib/formatters";
import type { ClaimCategory, HistoryItem, VerdictLabel } from "@/types/api";

/* ─── Static Data ───────────────────────────────────────────────────── */

interface HotTopic {
  id: string;
  claim: string;
  category: ClaimCategory;
}

const LATEST_HOT_TOPICS: ReadonlyArray<HotTopic> = [
  {
    id: "hot-1",
    claim: "Kalki 2898 AD crossed 1000 crore worldwide at the box office",
    category: "box_office",
  },
  {
    id: "hot-2",
    claim: "Pushpa 3 releasing on Christmas 2027",
    category: "release_update",
  },
  {
    id: "hot-3",
    claim:
      "SS Rajamouli's next film with Mahesh Babu begins shooting in Hyderabad",
    category: "casting",
  },
  {
    id: "hot-4",
    claim: "Shah Rukh Khan and Sujoy Ghosh announce action thriller King",
    category: "movie_announcement",
  },
  {
    id: "hot-5",
    claim: "Deepika Padukone joins Spirit opposite Prabhas",
    category: "casting",
  },
];

const SUPPORTED_BEATS: ReadonlyArray<ClaimCategory> = [
  "movie_announcement",
  "casting",
  "release_update",
  "box_office",
];

const VERDICT_DOT_COLORS: Record<VerdictLabel, string> = {
  VERIFIED: "bg-emerald-500",
  FALSE: "bg-red-500",
  MISLEADING: "bg-amber-500",
  UNVERIFIED: "bg-slate-400",
};

/* ─── Component ─────────────────────────────────────────────────────── */

export default function LandingView() {
  const router = useRouter();
  const pathname = usePathname();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const hasVisitedOtherRouteRef = useRef(false);

  /* Refresh verification history when returning to "/" from another route */
  useEffect(() => {
    let rafId: number | null = null;
    if (pathname === "/") {
      if (hasVisitedOtherRouteRef.current) {
        hasVisitedOtherRouteRef.current = false;
        rafId = requestAnimationFrame(() => {
          setReloadCount((prev) => prev + 1);
        });
      }
    } else {
      hasVisitedOtherRouteRef.current = true;
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [pathname]);

  /* Prefetch verification workspace for smooth instant navigation */
  useEffect(() => {
    router.prefetch("/verify");
  }, [router]);

  /* Load verification history */
  useEffect(() => {
    let cancelled = false;

    getHistory(15)
      .then((data) => {
        if (!cancelled) setHistoryItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : "Unable to load verification history right now.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function handleRetryHistory() {
    setIsLoadingHistory(true);
    setHistoryError(null);
    setReloadCount((prev) => prev + 1);
  }

  function navigateToVerify(targetHref: string) {
    hasVisitedOtherRouteRef.current = true;
    router.push(targetHref);
  }

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter((item) =>
      item.submitted_claim.toLowerCase().includes(q),
    );
  }, [historyItems, historyQuery]);

  return (
    <div className="dot-canvas flex flex-1 w-full flex-col items-center px-5 py-10 sm:px-10 lg:px-14 lg:py-12">
      {/* ── Main Content (1. Logo → 2. Name → 3. AI Info → 4. Search Bar → 5. 5 Hot Topics → 6. History) ── */}
      <main className="flex w-full max-w-5xl flex-col items-center">
        {/* 1. Transparent Black Brand Logo (no box) */}
        <h1 className="sr-only">
          CineVerify AI — Indian Cinema Fact-Checking Engine
        </h1>
        <div className="flex items-center justify-center">
          <Image
            src="/cineverify-logo.png"
            alt="CineVerifAI logo"
            width={185}
            height={173}
            priority
            unoptimized
            className="h-28 w-auto object-contain sm:h-32"
          />
        </div>

        {/* 2. About Our AI (Open editorial typography — no heavy box) */}
        <section
          aria-label="About CineVerify AI"
          className="mt-6 flex max-w-2xl flex-col items-center text-center"
        >
          <p className="text-[15px] font-medium leading-relaxed text-[var(--ink-700)] sm:text-base">
            Verifies Indian cinema rumours, viral headlines, and film news links
            by retrieving live trade reporting and evaluating source stances with{" "}
            <span className="font-semibold text-[var(--ink-900)]">
              Natural Language Inference (NLI)
            </span>
            —issuing evidence-backed verdicts without guesswork.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs font-medium text-[var(--ink-500)]">
            {SUPPORTED_BEATS.map((beat, index) => (
              <span key={beat} className="inline-flex items-center gap-2">
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-[var(--border-strong)]"
                  >
                    /
                  </span>
                )}
                <span className="text-[var(--ink-700)]">
                  {CATEGORY_LABELS[beat]}
                </span>
              </span>
            ))}
          </div>
        </section>

        {/* 4. Stitch-Inspired Prompt / Search Composer (Transitions to /verify on click) */}
        <div className="mt-8 w-full max-w-3xl">
          <motion.button
            type="button"
            onClick={() => navigateToVerify("/verify")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            aria-label="Open claim verification workspace"
            className="group flex w-full cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-[var(--border-strong)] bg-white/88 p-4 text-left shadow-[0_8px_28px_-10px_rgba(15,15,26,0.09)] backdrop-blur-md transition-all duration-150 hover:border-[var(--ink-900)]/40 hover:bg-white/95 hover:shadow-[0_14px_34px_-10px_rgba(15,15,26,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)] sm:p-5"
          >
            <div className="flex items-start gap-3">
              <Search
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink-500)] transition-colors group-hover:text-[var(--ink-900)]"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-[var(--ink-500)] transition-colors group-hover:text-[var(--ink-700)] sm:text-base">
                Paste a cinema rumour, viral headline, or entertainment article
                URL to verify…
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-3 text-xs font-medium text-[var(--ink-500)]">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Headline</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Article URL</span>
                </span>
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Live Source Check</span>
                </span>
              </div>

              <span className="cta-lime inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold sm:text-sm">
                <span>Verify Claim</span>
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </motion.button>
        </div>

        {/* 5. 5 Latest Hot Topics */}
        <section aria-label="5 Latest Hot Topics" className="mt-11 w-full">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame
                className="h-4 w-4 text-[var(--ink-900)]"
                aria-hidden="true"
              />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-900)]">
                5 Latest Hot Topics
              </h2>
            </div>
            <span className="text-xs font-medium text-[var(--ink-500)]">
              Select any topic to fact-check
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {LATEST_HOT_TOPICS.map((topic, index) => (
              <button
                key={topic.id}
                type="button"
                onClick={() =>
                  navigateToVerify(
                    `/verify?claim=${encodeURIComponent(topic.claim)}&type=text`,
                  )
                }
                className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white/85 px-4 py-3 text-left backdrop-blur-sm transition-all duration-150 hover:border-[var(--ink-900)]/30 hover:bg-white/95 hover:shadow-sm ${
                  index === 0 ? "md:col-span-2" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] font-mono text-xs font-bold text-[var(--ink-700)] transition-colors group-hover:bg-[var(--lime)] group-hover:text-[var(--ink-900)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-[var(--ink-900)]">
                      {topic.claim}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--ink-500)]">
                      {CATEGORY_LABELS[topic.category]}
                    </p>
                  </div>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-[var(--ink-400)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ink-900)]"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </section>

        {/* 6. Verification History (Bottom section) */}
        <section
          aria-label="Verification History"
          className="mt-12 w-full border-t border-[var(--border)] pt-8"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clock
                className="h-4 w-4 text-[var(--ink-900)]"
                aria-hidden="true"
              />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-900)]">
                Verification History
              </h2>
              {!isLoadingHistory && !historyError && (
                <span className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ink-700)]">
                  {historyItems.length}
                </span>
              )}
            </div>

            {/* History filter input */}
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-500)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Filter recent checks…"
                aria-label="Filter recent verification checks"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-8 pr-7 text-xs font-medium text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--lime)]"
              />
              {historyQuery && (
                <button
                  type="button"
                  onClick={() => setHistoryQuery("")}
                  aria-label="Clear history filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {isLoadingHistory && (
            <div
              aria-label="Loading verification history"
              className="grid grid-cols-1 gap-2.5 md:grid-cols-2"
            >
              {[1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="h-3.5 w-4/5 rounded bg-[var(--surface-muted)]" />
                  <div className="mt-2.5 h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>
          )}

          {!isLoadingHistory && historyError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-xs font-medium text-red-700"
            >
              <div className="flex items-center gap-2">
                <AlertCircle
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{historyError}</span>
              </div>
              <button
                type="button"
                onClick={handleRetryHistory}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!isLoadingHistory &&
            !historyError &&
            filteredHistory.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-8 text-center">
                <p className="text-xs font-semibold text-[var(--ink-700)]">
                  {historyItems.length === 0
                    ? "No checks recorded yet"
                    : "No matching checks"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ink-500)]">
                  {historyItems.length === 0
                    ? "Your verified claims will appear here."
                    : "Try a different search term."}
                </p>
              </div>
            )}

          {!isLoadingHistory && !historyError && filteredHistory.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {filteredHistory.map((item) => {
                const confidencePercent = Math.round(
                  Math.max(0, Math.min(1, item.confidence)) * 100,
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigateToVerify(
                        `/verify?claim=${encodeURIComponent(item.submitted_claim)}&type=text`,
                      )
                    }
                    className="group flex cursor-pointer flex-col justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-white/85 px-4 py-3.5 text-left backdrop-blur-sm transition-all duration-150 hover:border-[var(--ink-900)]/30 hover:bg-white/95 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${VERDICT_DOT_COLORS[item.verdict]}`}
                        />
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--ink-900)]">
                          {item.submitted_claim}
                        </p>
                      </div>
                      <ArrowUpRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-400)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ink-900)]"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pl-4.5">
                      <span className="text-xs font-medium text-[var(--ink-500)]">
                        {CATEGORY_LABELS[item.category]} · {confidencePercent}%
                        · {formatVerificationDate(item.verified_at)}
                      </span>
                      <VerdictBadge verdict={item.verdict} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
