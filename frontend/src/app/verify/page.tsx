"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Clock,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  PanelLeftOpen,
  RotateCcw,
  Sparkles,
  SquarePen,
} from "lucide-react";
import VerdictBadge from "@/components/VerdictBadge";
import VerificationReport from "@/components/VerificationReport";
import VerifyHistorySidebar from "@/components/VerifyHistorySidebar";
import VerifyPipelineStrip, {
  PIPELINE_STAGES,
} from "@/components/VerifyPipelineStrip";
import VerifySearchBar, {
  type ComposerMode,
} from "@/components/VerifySearchBar";
import {
  askFollowUp,
  deleteVerificationById,
  getHistory,
  getVerificationById,
  verifyClaimStream,
} from "@/lib/api";
import { CATEGORY_LABELS, formatVerificationDate } from "@/lib/formatters";
import { MOCK_VERIFICATIONS } from "@/lib/mockData";
import type {
  FollowUpTurn,
  HistoryItem,
  InputType,
  VerdictLabel,
  VerificationResponse,
  VerifyStreamEvent,
} from "@/types/api";

type VerifyStatus = "idle" | "loading" | "success" | "error";

interface FollowUpMessage extends FollowUpTurn {
  id: string;
  citedSources?: string[];
}

const STARTER_PROMPTS: ReadonlyArray<{
  label: string;
  claim: string;
  type: InputType;
}> = [
  {
    label: "Pushpa 3 release rumour",
    claim: "Pushpa 3 releasing on Christmas 2027",
    type: "text",
  },
  {
    label: "Rajamouli × Mahesh Babu",
    claim:
      "SS Rajamouli's next film with Mahesh Babu begins shooting in Hyderabad",
    type: "text",
  },
  {
    label: "Kalki 2898 AD box office",
    claim: "Kalki 2898 AD crossed 1000 crore worldwide at the box office",
    type: "text",
  },
];

const FOLLOWUP_SUGGESTIONS = [
  "Which retrieved source is the most credible?",
  "Summarize why this verdict was reached.",
  "Are there any contradictions across reports?",
] as const;

const IS_MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const MOCK_VERDICT_KEYS: ReadonlyArray<VerdictLabel> = [
  "VERIFIED",
  "FALSE",
  "MISLEADING",
  "UNVERIFIED",
];

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const initialClaim = searchParams.get("claim") ?? "";
  const rawType = searchParams.get("type");
  const initialType: InputType = rawType === "url" ? "url" : "text";
  const initialId = searchParams.get("id");
  const autorun = searchParams.get("autorun") === "1";

  return (
    <VerifyWorkspace
      key={`${initialType}:${initialClaim}:${initialId ?? ""}:${autorun ? "1" : "0"}`}
      initialClaim={initialClaim}
      initialType={initialType}
      initialId={initialId}
      autorun={autorun}
    />
  );
}

function VerifyWorkspace({
  initialClaim,
  initialType,
  initialId,
  autorun,
}: {
  initialClaim: string;
  initialType: InputType;
  initialId: string | null;
  autorun: boolean;
}) {
  /* Sidebar & layout state */
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  /* History state */
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyReloadCount, setHistoryReloadCount] = useState(0);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(
    initialId,
  );
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(
    null,
  );

  /* Verification & composer state */
  const [claimInput, setClaimInput] = useState(initialClaim);
  const [inputType, setInputType] = useState<InputType>(initialType);
  const [composerMode, setComposerMode] = useState<ComposerMode>("verify");
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [fallbackSummary, setFallbackSummary] = useState<HistoryItem | null>(
    null,
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(Boolean(initialId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    claim: string;
    type: InputType;
  } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [stageDetails, setStageDetails] = useState<Partial<Record<number, string>>>({});
  const [showPipelineStrip, setShowPipelineStrip] = useState(false);

  /* Follow-up conversation state */
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const centerScrollRef = useRef<HTMLDivElement | null>(null);
  const autorunTriggeredRef = useRef(false);
  const followUpSeqRef = useRef(0);

  /* Load verification history for left sidebar */
  useEffect(() => {
    let cancelled = false;

    getHistory(30)
      .then((data) => {
        if (!cancelled) {
          setHistoryItems(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : "Failed to load verification history.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [historyReloadCount]);

  /* Load initial report if ?id=... is provided */
  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;

    getVerificationById(initialId)
      .then((report) => {
        if (cancelled) return;
        if (report) {
          setResult(report);
          setFallbackSummary(null);
          setLastRequest({ claim: report.submitted_claim, type: "text" });
          setComposerMode("followup");
          setStatus("success");
        } else if (initialClaim) {
          setFallbackSummary({
            id: initialId,
            submitted_claim: initialClaim,
            verdict: "UNVERIFIED",
            confidence: 0,
            category: "movie_announcement",
            verified_at: new Date().toISOString(),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialClaim, initialId]);

  const scrollCenterToTop = useCallback(() => {
    centerScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollCenterToBottom = useCallback(() => {
    const el = centerScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const handleStreamEvent = useCallback((event: VerifyStreamEvent) => {
    if (typeof event.step === "number") {
      setActiveStep(event.step);
      if (event.status === "done" && event.detail) {
        setStageDetails((prev) => ({
          ...prev,
          [event.step as number]: event.detail,
        }));
      }
    }
  }, []);

  const handleVerify = useCallback(
    async (claim: string, type: InputType) => {
      setLastRequest({ claim, type });
      setActiveHistoryId(null);
      setFallbackSummary(null);
      setResult(null);
      setErrorMessage(null);
      setFollowUpMessages([]);
      setFollowUpError(null);
      setComposerMode("verify");
      setActiveStep(0);
      setStageDetails({});
      setShowPipelineStrip(true);
      setStatus("loading");
      scrollCenterToTop();

      try {
        const response = await verifyClaimStream(claim, type, handleStreamEvent);
        setResult(response);
        setActiveHistoryId(response.id);
        setStatus("success");
        setComposerMode("followup");
        setClaimInput("");

        const newHistoryItem: HistoryItem = {
          id: response.id,
          submitted_claim: response.submitted_claim,
          verdict: response.verdict,
          confidence: response.confidence,
          category: response.category,
          verified_at: response.verified_at,
        };
        setHistoryItems((prev) => [
          newHistoryItem,
          ...prev.filter((item) => item.id !== newHistoryItem.id),
        ]);
        scrollCenterToTop();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong while verifying the claim.";
        setErrorMessage(message);
        setStatus("error");
      }
    },
    [handleStreamEvent, scrollCenterToTop],
  );

  /* Auto-trigger verification once when navigated with ?autorun=1&claim=... */
  useEffect(() => {
    if (!autorun || !initialClaim.trim() || initialId || autorunTriggeredRef.current) {
      return;
    }
    autorunTriggeredRef.current = true;
    const rafId = requestAnimationFrame(() => {
      void handleVerify(initialClaim.trim(), initialType);
    });
    return () => cancelAnimationFrame(rafId);
  }, [autorun, handleVerify, initialClaim, initialId, initialType]);

  async function handleSelectHistory(item: HistoryItem) {
    setActiveHistoryId(item.id);
    setErrorMessage(null);
    setFollowUpMessages([]);
    setFollowUpError(null);
    setShowPipelineStrip(false);
    setLastRequest({ claim: item.submitted_claim, type: "text" });
    setFallbackSummary(null);
    setResult(null);
    setIsLoadingDetail(true);
    setStatus("idle");
    scrollCenterToTop();

    const fullReport = await getVerificationById(item.id);
    setIsLoadingDetail(false);

    if (fullReport) {
      setResult(fullReport);
      setFallbackSummary(null);
      setComposerMode("followup");
      setStatus("success");
    } else {
      setFallbackSummary(item);
      setComposerMode("verify");
      setStatus("idle");
    }
  }

  async function handleDeleteHistory(item: HistoryItem) {
    setDeletingHistoryId(item.id);
    try {
      await deleteVerificationById(item.id);
      setHistoryItems((prev) => prev.filter((entry) => entry.id !== item.id));
      if (activeHistoryId === item.id) {
        handleNewCheck();
      }
    } catch {
      // Ignore silent failure; item remains in list
    } finally {
      setDeletingHistoryId(null);
    }
  }

  async function handleFollowUpSubmit(question: string) {
    if (!result) return;
    followUpSeqRef.current += 1;
    const seq = followUpSeqRef.current;
    const userMsg: FollowUpMessage = {
      id: `user-${seq}`,
      role: "user",
      content: question,
    };
    const nextHistory: FollowUpTurn[] = [
      ...followUpMessages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: question },
    ];

    setFollowUpMessages((prev) => [...prev, userMsg]);
    setFollowUpError(null);
    setClaimInput("");
    setIsFollowUpLoading(true);
    scrollCenterToBottom();

    try {
      const reply = await askFollowUp({
        claim: result.submitted_claim,
        core_claim: result.core_claim,
        verdict: result.verdict,
        explanation: result.explanation,
        evidence: result.evidence,
        question,
        history: nextHistory.slice(0, -1),
      });
      setFollowUpMessages((prev) => [
        ...prev,
        {
          id: `assistant-${seq}`,
          role: "assistant",
          content: reply.answer,
          citedSources: reply.cited_sources,
        },
      ]);
      scrollCenterToBottom();
    } catch (err) {
      setFollowUpError(
        err instanceof Error
          ? err.message
          : "Unable to answer follow-up question right now.",
      );
    } finally {
      setIsFollowUpLoading(false);
    }
  }

  function handleRetry() {
    if (lastRequest) {
      void handleVerify(lastRequest.claim, lastRequest.type);
    } else {
      setStatus("idle");
      setShowPipelineStrip(false);
    }
  }

  function handleNewCheck() {
    setActiveHistoryId(null);
    setStatus("idle");
    setResult(null);
    setFallbackSummary(null);
    setErrorMessage(null);
    setLastRequest(null);
    setFollowUpMessages([]);
    setFollowUpError(null);
    setComposerMode("verify");
    setShowPipelineStrip(false);
    setClaimInput("");
  }

  function handleMockPreset(verdict: VerdictLabel) {
    const fixture = MOCK_VERIFICATIONS[verdict];
    setErrorMessage(null);
    setFallbackSummary(null);
    setFollowUpMessages([]);
    setFollowUpError(null);
    setActiveHistoryId(fixture.id);
    setLastRequest({ claim: fixture.submitted_claim, type: "text" });
    setResult(fixture);
    setComposerMode("followup");
    setShowPipelineStrip(true);
    setStatus("success");
    scrollCenterToTop();
  }

  const hasActiveReport = status === "success" && result !== null;
  const hasActiveThread =
    status !== "idle" || fallbackSummary !== null || isLoadingDetail;

  return (
    <div className="relative flex h-[calc(100dvh-52px)] w-full overflow-hidden">
      {/* 1. Left Gemini-style History Sidebar */}
      <VerifyHistorySidebar
        items={historyItems}
        activeId={activeHistoryId}
        deletingId={deletingHistoryId}
        isLoading={isHistoryLoading}
        error={historyError}
        isOpen={isSidebarOpen}
        isMobileOpen={isMobileSidebarOpen}
        onToggleDesktop={() => setIsSidebarOpen((prev) => !prev)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectHistory={(item) => void handleSelectHistory(item)}
        onDeleteHistory={(item) => void handleDeleteHistory(item)}
        onNewCheck={handleNewCheck}
        onRetryHistory={() => {
          setIsHistoryLoading(true);
          setHistoryError(null);
          setHistoryReloadCount((prev) => prev + 1);
        }}
      />

      {/* Top-left floating toggle when desktop sidebar is collapsed or on mobile */}
      <div
        className={`fixed left-4 top-2.5 z-40 flex items-center gap-1.5 rounded-2xl border border-white/60 bg-white/35 p-1.5 shadow-[0_8px_24px_-8px_rgba(15,15,26,0.12)] backdrop-blur-md ${
          isSidebarOpen ? "lg:hidden" : "flex"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth < 1024) {
              setIsMobileSidebarOpen(true);
            } else {
              setIsSidebarOpen(true);
            }
          }}
          aria-label="Open history sidebar"
          title="Open history sidebar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--ink-900)] transition-colors hover:bg-white/75"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        </button>

        {hasActiveThread && (
          <button
            type="button"
            onClick={handleNewCheck}
            aria-label="New verification"
            title="New verification"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white/80 px-2.5 text-xs font-semibold text-[var(--ink-900)] transition-colors hover:bg-white"
          >
            <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </button>
        )}
      </div>

      {/* Main Column (Center Workspace 5 + Pipeline Strip 4 + Bottom Search Bar 3) */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ${
          isSidebarOpen ? "lg:pl-[272px]" : "lg:pl-0"
        }`}
      >
        {/* 5. Center Scrollable Processing / Report Area */}
        <div
          ref={centerScrollRef}
          className="flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-8 sm:pt-6 [scrollbar-width:thin]"
        >
          <div className="mx-auto flex min-h-full max-w-3xl flex-col">
            <AnimatePresence mode="wait">
              {/* Empty / Idle Greeting */}
              {!hasActiveThread && (
                <motion.div
                  key="workspace-idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="my-auto flex flex-col items-center py-8 text-center"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-700)] shadow-xs backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-[var(--lime)] ring-2 ring-[var(--ink-900)]/15" />
                    <span>CineVerify AI · Verification Studio</span>
                  </div>

                  <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[var(--ink-900)] sm:text-4xl">
                    Verify Cinema Claim
                  </h1>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--ink-500)]">
                    Paste any Indian cinema headline, rumour, or news URL below
                    to cross-check it against trusted entertainment trade
                    sources.
                  </p>

                  {/* Starter prompt pills */}
                  <div className="mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() => void handleVerify(prompt.claim, prompt.type)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/80 px-3.5 py-2 text-xs font-medium text-[var(--ink-900)] shadow-xs backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-white hover:shadow-sm"
                      >
                        <Sparkles
                          className="h-3.5 w-3.5 text-[var(--ink-500)]"
                          aria-hidden="true"
                        />
                        <span>{prompt.label}</span>
                      </button>
                    ))}
                  </div>

                  {IS_MOCK_MODE && (
                    <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 backdrop-blur-md">
                      <p className="text-[11px] font-medium text-[var(--ink-500)]">
                        Mock mode active — preview verdict fixtures:
                      </p>
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                        {MOCK_VERDICT_KEYS.map((verdict) => (
                          <button
                            key={verdict}
                            type="button"
                            onClick={() => handleMockPreset(verdict)}
                            className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)]"
                          >
                            {verdict}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Loading detail from history */}
              {isLoadingDetail && (
                <motion.div
                  key="loading-detail"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 py-4"
                >
                  {lastRequest && (
                    <div className="flex justify-end">
                      <div className="max-w-xl rounded-2xl rounded-br-sm border border-[var(--border)] bg-white/85 px-4 py-2.5 text-sm font-medium text-[var(--ink-900)] shadow-xs backdrop-blur-md">
                        {lastRequest.claim}
                      </div>
                    </div>
                  )}
                  <div className="glass-card flex items-center gap-3 p-6">
                    <Loader2
                      className="h-5 w-5 animate-spin text-[var(--ink-900)]"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-[var(--ink-700)]">
                      Loading saved verification report...
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Active live verification in center */}
              {status === "loading" && !isLoadingDetail && (
                <motion.section
                  key="workspace-loading"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  aria-live="polite"
                  className="space-y-5 py-2"
                >
                  {lastRequest && (
                    <div className="flex justify-end">
                      <div className="max-w-xl rounded-2xl rounded-br-sm border border-[var(--border)] bg-white/90 px-4 py-3 shadow-xs backdrop-blur-md">
                        <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-400)]">
                          {lastRequest.type === "url" ? (
                            <Link2 className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <FileText className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>
                            {lastRequest.type === "url"
                              ? "Article URL"
                              : "Submitted Claim"}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[var(--ink-900)]">
                          {lastRequest.claim}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="glass-card space-y-5 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ink-900)] text-[var(--lime)]">
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <h2 className="font-serif text-base font-bold text-[var(--ink-900)]">
                          {PIPELINE_STAGES[activeStep]}...
                        </h2>
                        <p className="text-xs text-[var(--ink-500)]">
                          Evaluating claim against reputable Indian cinema
                          sources
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-[var(--border)] pt-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                        <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                      </div>
                      <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-muted)]" />
                      <div className="grid gap-3 pt-2 sm:grid-cols-2">
                        <div className="h-20 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                        <div className="h-20 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* Verification Error */}
              {status === "error" && !isLoadingDetail && (
                <motion.section
                  key="workspace-error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  role="alert"
                  className="space-y-4 py-2"
                >
                  {lastRequest && (
                    <div className="flex justify-end">
                      <div className="max-w-xl rounded-2xl rounded-br-sm border border-[var(--border)] bg-white/90 px-4 py-2.5 text-sm font-medium text-[var(--ink-900)] shadow-xs">
                        {lastRequest.claim}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-red-200 bg-red-50/90 p-6 backdrop-blur-md">
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                      <div className="space-y-2">
                        <h2 className="text-base font-semibold text-red-900">
                          Verification Failed
                        </h2>
                        <p className="text-sm text-red-700">
                          {errorMessage ??
                            "Unable to complete verification right now."}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Retry Check</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleNewCheck}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                          >
                            <span>Start Fresh</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* Success Report + Conversational Follow-up Thread */}
              {hasActiveReport && !isLoadingDetail && (
                <motion.div
                  key={`workspace-report-${result.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleNewCheck}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--ink-900)] backdrop-blur-sm transition-colors hover:border-[var(--border-strong)] hover:bg-white"
                    >
                      <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>New Check</span>
                    </button>

                    <div className="max-w-xl rounded-2xl rounded-br-sm border border-[var(--border)] bg-white/85 px-4 py-2 text-xs font-medium text-[var(--ink-900)] shadow-xs backdrop-blur-md">
                      {result.submitted_claim}
                    </div>
                  </div>

                  <VerificationReport report={result} />

                  {/* Conversational Follow-up Q&A section */}
                  <section
                    aria-label="Follow-up questions on report"
                    className="space-y-3 border-t border-[var(--border)] pt-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ask Follow-Up Questions</span>
                      </span>
                      <span className="text-[11px] text-[var(--ink-400)]">
                        Answers grounded strictly in retrieved sources
                      </span>
                    </div>

                    {followUpMessages.length === 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {FOLLOWUP_SUGGESTIONS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            disabled={isFollowUpLoading}
                            onClick={() => void handleFollowUpSubmit(q)}
                            className="rounded-full border border-[var(--border)] bg-white/75 px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors hover:border-[var(--border-strong)] hover:bg-white hover:text-[var(--ink-900)] disabled:opacity-50"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {followUpMessages.length > 0 && (
                      <div className="space-y-3">
                        {followUpMessages.map((msg) =>
                          msg.role === "user" ? (
                            <div key={msg.id} className="flex justify-end">
                              <div className="max-w-xl rounded-2xl rounded-br-sm border border-[var(--border)] bg-white/90 px-4 py-2.5 text-sm font-medium text-[var(--ink-900)] shadow-xs">
                                {msg.content}
                              </div>
                            </div>
                          ) : (
                            <div key={msg.id} className="glass-card p-4">
                              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-900)]">
                                {msg.content}
                              </p>
                              {msg.citedSources && msg.citedSources.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-400)]">
                                    Cited:
                                  </span>
                                  {msg.citedSources.map((src) => (
                                    <span
                                      key={src}
                                      className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-700)]"
                                    >
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {isFollowUpLoading && (
                      <div className="glass-card flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-[var(--ink-600)]">
                        <Loader2
                          className="h-4 w-4 animate-spin text-[var(--ink-900)]"
                          aria-hidden="true"
                        />
                        <span>Checking retrieved passages for your answer...</span>
                      </div>
                    )}

                    {followUpError && (
                      <p role="alert" className="text-xs font-medium text-red-600">
                        {followUpError}
                      </p>
                    )}
                  </section>
                </motion.div>
              )}

              {/* Fallback Summary Card if full report wasn't available by ID */}
              {status === "idle" && fallbackSummary && !isLoadingDetail && (
                <motion.div
                  key={`workspace-summary-${fallbackSummary.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 py-4"
                >
                  <div className="glass-card p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <VerdictBadge verdict={fallbackSummary.verdict} />
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-500)]">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {formatVerificationDate(fallbackSummary.verified_at)}
                        </span>
                      </span>
                    </div>

                    <h2 className="mt-4 font-serif text-xl font-bold text-[var(--ink-900)]">
                      {fallbackSummary.submitted_claim}
                    </h2>
                    <p className="mt-2 text-xs text-[var(--ink-500)]">
                      {CATEGORY_LABELS[fallbackSummary.category]} ·{" "}
                      {Math.round(fallbackSummary.confidence * 100)}% confidence
                    </p>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                      <p className="text-xs text-[var(--ink-500)]">
                        Full evidence breakdown wasn&apos;t cached for this past
                        entry. Run a live check to view updated sources.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void handleVerify(
                            fallbackSummary.submitted_claim,
                            "text",
                          )
                        }
                        className="cta-lime inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Re-run Live Check</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Docked Area: Zone 4 (Single-line Processing Phase Bar) + Zone 3 (Search Bar) */}
        <div className="shrink-0 px-4 pb-4 pt-2 sm:px-8 sm:pb-5">
          <div className="mx-auto w-full max-w-3xl">
            <VerifyPipelineStrip
              status={status}
              activeStep={activeStep}
              stageDetails={stageDetails}
              visible={showPipelineStrip}
              onDismiss={() => setShowPipelineStrip(false)}
            />

            <VerifySearchBar
              claim={claimInput}
              inputType={inputType}
              isLoading={status === "loading"}
              isFollowUpLoading={isFollowUpLoading}
              hasActiveReport={hasActiveReport}
              composerMode={composerMode}
              autoFocus={initialClaim === "" && !initialId}
              onClaimChange={setClaimInput}
              onTypeChange={setInputType}
              onComposerModeChange={setComposerMode}
              onSubmit={handleVerify}
              onSubmitFollowUp={handleFollowUpSubmit}
            />

            <p className="mt-2 text-center text-[11px] text-[var(--ink-400)]">
              CineVerify AI checks reputable Indian cinema trade outlets —
              claims without sufficient evidence stay Unverified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="glass-card h-64 animate-pulse" />
        </main>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}
