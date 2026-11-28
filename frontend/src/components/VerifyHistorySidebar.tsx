"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Clock,
  Home,
  Loader2,
  PanelLeftClose,
  RotateCcw,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/formatters";
import type { HistoryItem, VerdictLabel } from "@/types/api";

interface VerifyHistorySidebarProps {
  items: HistoryItem[];
  activeId: string | null;
  deletingId?: string | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  isMobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory?: (item: HistoryItem) => void;
  onNewCheck: () => void;
  onRetryHistory: () => void;
}

const VERDICT_DOT_COLORS: Record<VerdictLabel, string> = {
  VERIFIED: "bg-emerald-500",
  FALSE: "bg-red-500",
  MISLEADING: "bg-amber-500",
  UNVERIFIED: "bg-slate-400",
};

const VERDICT_SHORT_LABELS: Record<VerdictLabel, string> = {
  VERIFIED: "Verified",
  FALSE: "False",
  MISLEADING: "Misleading",
  UNVERIFIED: "Unverified",
};

function SidebarContent({
  items,
  activeId,
  deletingId,
  isLoading,
  error,
  onSelectHistory,
  onDeleteHistory,
  onNewCheck,
  onRetryHistory,
  onCloseAction,
  closeLabel,
  isMobile,
}: {
  items: HistoryItem[];
  activeId: string | null;
  deletingId?: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory?: (item: HistoryItem) => void;
  onNewCheck: () => void;
  onRetryHistory: () => void;
  onCloseAction: () => void;
  closeLabel: string;
  isMobile?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.submitted_claim.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="flex h-full flex-col">
      {/* Top header: Brand + Collapse toggle */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-1.5 py-1 transition-opacity hover:opacity-80"
          title="Back to Home"
        >
          <Image
            src="/cineverify-logo.png"
            alt="CineVerify AI"
            width={28}
            height={26}
            unoptimized
            className="h-6 w-auto object-contain"
          />
          <span className="font-serif text-sm font-bold tracking-tight text-[var(--ink-900)]">
            CineVerify
          </span>
        </Link>

        <button
          type="button"
          onClick={onCloseAction}
          aria-label={closeLabel}
          title={closeLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--ink-500)] transition-colors hover:bg-white/80 hover:text-[var(--ink-900)]"
        >
          {isMobile ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* New Check button (Gemini-style) */}
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => {
            onNewCheck();
            if (isMobile) onCloseAction();
          }}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-white/85 px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--ink-900)] shadow-xs transition-all hover:border-[var(--border-strong)] hover:bg-white hover:shadow-sm"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--lime)] text-[var(--ink-900)]">
            <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span>New Verification</span>
        </button>
      </div>

      {/* Search past checks */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-400)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history..."
            aria-label="Search past verifications"
            className="w-full rounded-xl border border-[var(--border)] bg-white/60 py-1.5 pl-8 pr-7 text-xs text-[var(--ink-900)] placeholder:text-[var(--ink-400)] focus:border-[var(--border-strong)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--lime)]/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear history search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--ink-400)] hover:text-[var(--ink-900)]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      <div className="flex items-center justify-between px-4 pb-1.5 pt-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          Recent Checks
        </span>
        {!isLoading && !error && (
          <span className="font-mono text-[10px] text-[var(--ink-400)]">
            {filteredItems.length}
          </span>
        )}
      </div>

      {/* Scrollable conversation / verification history list */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 [scrollbar-width:thin]">
        {isLoading && (
          <div className="space-y-2 px-1 py-1" aria-label="Loading history">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-xl bg-white/50 px-3 py-2.5"
              >
                <div className="h-3 w-4/5 rounded bg-[var(--surface-muted)]" />
                <div className="mt-1.5 h-2.5 w-2/5 rounded bg-[var(--surface-muted)]" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div
            role="alert"
            className="mx-1 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-700"
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <p className="leading-snug">{error}</p>
            </div>
            <button
              type="button"
              onClick={onRetryHistory}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!isLoading && !error && filteredItems.length === 0 && (
          <div className="px-3 py-8 text-center">
            <Clock
              className="mx-auto h-5 w-5 text-[var(--ink-400)]"
              aria-hidden="true"
            />
            <p className="mt-2 text-xs font-medium text-[var(--ink-700)]">
              {items.length === 0
                ? "No verifications yet"
                : "No matching checks"}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-500)]">
              {items.length === 0
                ? "Submitted claims appear here."
                : "Try another keyword."}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredItems.length > 0 && (
          <ul className="space-y-1" aria-label="Verification history list">
            {filteredItems.map((item) => {
              const isSelected = item.id === activeId;
              const isDeleting = item.id === deletingId;
              const confidencePct = Math.round(
                Math.max(0, Math.min(1, item.confidence)) * 100,
              );

              return (
                <li
                  key={item.id}
                  className={`group flex items-stretch gap-1 rounded-xl transition-all ${
                    isSelected
                      ? "border border-[var(--border-strong)] bg-white shadow-xs"
                      : "border border-transparent hover:bg-white/65"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectHistory(item);
                      if (isMobile) onCloseAction();
                    }}
                    aria-current={isSelected ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${VERDICT_DOT_COLORS[item.verdict]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`line-clamp-2 text-xs leading-snug ${
                          isSelected
                            ? "font-semibold text-[var(--ink-900)]"
                            : "font-medium text-[var(--ink-700)] group-hover:text-[var(--ink-900)]"
                        }`}
                      >
                        {item.submitted_claim}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--ink-400)]">
                        {VERDICT_SHORT_LABELS[item.verdict]} · {confidencePct}% ·{" "}
                        {CATEGORY_LABELS[item.category]}
                      </p>
                    </div>
                  </button>

                  {onDeleteHistory && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => onDeleteHistory(item)}
                      aria-label={`Delete "${item.submitted_claim}" from history`}
                      title="Delete check"
                      className="mr-1.5 self-center rounded-lg p-1.5 text-[var(--ink-400)] opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-60"
                    >
                      {isDeleting ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bottom footer links */}
      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2.5 text-[11px] font-medium text-[var(--ink-500)]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/75 hover:text-[var(--ink-900)]"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/75 hover:text-[var(--ink-900)]"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Full Archive</span>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyHistorySidebar({
  items,
  activeId,
  deletingId,
  isLoading,
  error,
  isOpen,
  isMobileOpen,
  onToggleDesktop,
  onCloseMobile,
  onSelectHistory,
  onDeleteHistory,
  onNewCheck,
  onRetryHistory,
}: VerifyHistorySidebarProps) {
  return (
    <>
      {/* Desktop full-height left sidebar */}
      <aside
        aria-label="Verification history sidebar"
        className={`fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-white/70 bg-white/72 shadow-[4px_0_28px_-14px_rgba(15,15,26,0.12)] backdrop-blur-xl transition-transform duration-200 lg:flex ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          items={items}
          activeId={activeId}
          deletingId={deletingId}
          isLoading={isLoading}
          error={error}
          onSelectHistory={onSelectHistory}
          onDeleteHistory={onDeleteHistory}
          onNewCheck={onNewCheck}
          onRetryHistory={onRetryHistory}
          onCloseAction={onToggleDesktop}
          closeLabel="Collapse history sidebar"
        />
      </aside>

      {/* Mobile slide-over drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-[var(--ink-900)]/20 backdrop-blur-xs"
            />
            <motion.aside
              aria-label="Verification history drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 left-0 z-10 w-[280px] max-w-[85vw] border-r border-white/80 bg-white/92 shadow-2xl backdrop-blur-xl"
            >
              <SidebarContent
                items={items}
                activeId={activeId}
                deletingId={deletingId}
                isLoading={isLoading}
                error={error}
                onSelectHistory={onSelectHistory}
                onDeleteHistory={onDeleteHistory}
                onNewCheck={onNewCheck}
                onRetryHistory={onRetryHistory}
                onCloseAction={onCloseMobile}
                closeLabel="Close history drawer"
                isMobile
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
