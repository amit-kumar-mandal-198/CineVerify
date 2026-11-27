"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Verification History
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Recent Indian cinema claims evaluated by CineVerify AI, newest first.
          </p>
        </div>

        <Link
          href="/verify"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
        >
          Verify New Claim
        </Link>
      </div>

      {/* Search & Category Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claims..."
            aria-label="Search verification history"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-8 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          aria-label="Filter history by category"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
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
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
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
          className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
        >
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex animate-pulse items-center justify-between gap-4 border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800"
            >
              <div className="h-4 w-3/5 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="hidden h-4 w-12 rounded bg-zinc-200 sm:block dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <History
            className="h-8 w-8 text-zinc-400 dark:text-zinc-500"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            No verification records found
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
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
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <VerdictBadge verdict={item.verdict} />
                    <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                      {confidencePercent}% confidence
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.submitted_claim}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <span>
                      {CATEGORY_LABELS[item.category]} ·{" "}
                      {formatVerificationDate(item.verified_at)}
                    </span>
                    <Link
                      href={`/verify?claim=${encodeURIComponent(item.submitted_claim)}&type=text`}
                      className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:underline dark:text-amber-400"
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
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm md:block dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-3">Submitted Claim</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Verified At</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredItems.map((item) => {
                    const confidencePercent = Math.round(
                      Math.max(0, Math.min(1, item.confidence)) * 100,
                    );
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                      >
                        <td className="max-w-md px-6 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                          {item.submitted_claim}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <VerdictBadge verdict={item.verdict} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400">
                          {CATEGORY_LABELS[item.category]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                          {confidencePercent}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatVerificationDate(item.verified_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3.5 text-right">
                          <Link
                            href={`/verify?claim=${encodeURIComponent(item.submitted_claim)}&type=text`}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-amber-400 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-amber-500 dark:hover:text-zinc-100"
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
