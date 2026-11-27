"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  History,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import VerdictBadge from "@/components/VerdictBadge";
import { getHistory } from "@/lib/api";
import { CATEGORY_LABELS, formatVerificationDate } from "@/lib/formatters";
import type { ClaimCategory, HistoryItem, VerdictLabel } from "@/types/api";

type VerdictFilter = "ALL" | VerdictLabel;
type CategoryFilter = "ALL" | ClaimCategory;

const FILTER_OPTIONS: ReadonlyArray<VerdictFilter> = [
  "ALL",
  "VERIFIED",
  "FALSE",
  "MISLEADING",
  "UNVERIFIED",
];

const CATEGORY_OPTIONS: ReadonlyArray<CategoryFilter> = [
  "ALL",
  "movie_announcement",
  "casting",
  "release_update",
  "box_office",
];

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<VerdictFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getHistory()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load verification history.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function handleRetry() {
    setIsLoading(true);
    setError(null);
    setReloadCount((prev) => prev + 1);
  }

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "ALL" && item.verdict !== filter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (q && !item.submitted_claim.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categoryFilter, filter, items, searchQuery]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--ink-900)] sm:text-3xl">
            Verification History
          </h1>
          <p className="text-sm text-[var(--ink-500)]">
            Recent Indian cinema claims evaluated by CineVerify AI, newest first.
          </p>
        </div>

        <Link
          href="/verify"
          className="cta-lime rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Verify New Claim
        </Link>
      </div>

      {/* Search & Category Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-500)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claims..."
            aria-label="Search verification history"
            className="w-full rounded-xl border border-[var(--border)] bg-white/75 py-2 pl-9 pr-8 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--border-strong)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--lime-500)]/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          aria-label="Filter history by category"
          className="rounded-xl border border-[var(--border)] bg-white/75 px-3 py-2 text-xs font-medium text-[var(--ink-900)] focus:border-[var(--border-strong)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--lime-500)]/50"
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "ALL" ? "All Categories" : CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Verdict filter tabs */}
      <div
        role="group"
        aria-label="Filter history by verdict"
        className="mb-6 flex flex-wrap gap-2"
      >
        {FILTER_OPTIONS.map((option) => {
          const isSelected = filter === option;
          const count =
            option === "ALL"
              ? items.length
              : items.filter((item) => item.verdict === option).length;

          return (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={isSelected}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isSelected
                  ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
                  : "border-[var(--border)] bg-white/65 text-[var(--ink-500)] hover:border-[var(--border-strong)] hover:text-[var(--ink-900)]"
              }`}
            >
              {option} ({count})
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div
          aria-label="Loading verification history"
          className="glass-card space-y-3 p-4 sm:p-6"
        >
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex animate-pulse items-center justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="h-4 w-3/5 rounded bg-[var(--surface-tint)]" />
              <div className="h-5 w-20 rounded-full bg-[var(--surface-tint)]" />
              <div className="hidden h-4 w-12 rounded bg-[var(--surface-tint)] sm:block" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/90 p-5 text-sm text-red-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {!isLoading && !error && filteredItems.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center px-6 py-12 text-center">
          <History
            className="h-8 w-8 text-[var(--ink-500)]"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-medium text-[var(--ink-900)]">
            No verification records found
          </p>
          <p className="mt-1 text-xs text-[var(--ink-500)]">
            {filter === "ALL"
              ? "Verified claims will appear here once submitted."
              : `No claims with verdict "${filter}" in the current history.`}
          </p>
        </div>
      )}

      {!isLoading && !error && filteredItems.length > 0 && (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {filteredItems.map((item) => {
              const confidencePercent = Math.round(
                Math.max(0, Math.min(1, item.confidence)) * 100,
              );
              return (
                <article
                  key={item.id}
                  className="glass-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <VerdictBadge verdict={item.verdict} />
                    <span className="text-xs font-semibold tabular-nums text-[var(--ink-900)]">
                      {confidencePercent}% confidence
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-[var(--ink-900)]">
                    {item.submitted_claim}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--ink-500)]">
                    <span>
                      {CATEGORY_LABELS[item.category]} ·{" "}
                      {formatVerificationDate(item.verified_at)}
                    </span>
                    <Link
                      href={`/verify?claim=${encodeURIComponent(item.submitted_claim)}&type=text`}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--ink-900)] hover:underline"
                    >
                      <span>Re-verify</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="glass-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-tint)]/75 text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                  <tr>
                    <th className="px-6 py-3">Submitted Claim</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Verified At</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredItems.map((item) => {
                    const confidencePercent = Math.round(
                      Math.max(0, Math.min(1, item.confidence)) * 100,
                    );
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-white/50"
                      >
                        <td className="max-w-md px-6 py-3.5 font-medium text-[var(--ink-900)]">
                          {item.submitted_claim}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <VerdictBadge verdict={item.verdict} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[var(--ink-500)]">
                          {CATEGORY_LABELS[item.category]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 font-semibold tabular-nums text-[var(--ink-900)]">
                          {confidencePercent}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[var(--ink-500)]">
                          {formatVerificationDate(item.verified_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3.5 text-right">
                          <Link
                            href={`/verify?claim=${encodeURIComponent(item.submitted_claim)}&type=text`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white/75 px-2.5 py-1 text-xs font-medium text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
                          >
                            <span>Re-verify</span>
                            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
