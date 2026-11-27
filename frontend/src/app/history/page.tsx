"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, History, Loader2, RotateCcw } from "lucide-react";
import VerdictBadge from "@/components/VerdictBadge";
import { getHistory } from "@/lib/api";
import { CATEGORY_LABELS, formatVerificationDate } from "@/lib/formatters";
import type { HistoryItem, VerdictLabel } from "@/types/api";

type VerdictFilter = "ALL" | VerdictLabel;

const FILTER_OPTIONS: ReadonlyArray<VerdictFilter> = [
  "ALL",
  "VERIFIED",
  "FALSE",
  "MISLEADING",
  "UNVERIFIED",
];

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<VerdictFilter>("ALL");
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
    if (filter === "ALL") return items;
    return items.filter((item) => item.verdict === filter);
  }, [filter, items]);

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
        <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-12 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          <span>Loading verification history...</span>
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
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 sm:px-6">Submitted Claim</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3 sm:px-6">Verified At</th>
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
                      <td className="max-w-md px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100 sm:px-6">
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
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400 sm:px-6">
                        {formatVerificationDate(item.verified_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
