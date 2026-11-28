"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, ChevronRight, Loader2, X } from "lucide-react";

export const PIPELINE_STAGES = [
  "Extracting claim",
  "Searching entertainment sources",
  "Running NLI comparison",
  "Generating grounded report",
] as const;

interface VerifyPipelineStripProps {
  status: "idle" | "loading" | "success" | "error";
  activeStep: number;
  stageDetails?: Partial<Record<number, string>>;
  visible: boolean;
  onDismiss?: () => void;
}

/**
 * Single-line sequential 4-stage pipeline status bar positioned directly above
 * the search bar. Reveals each stage one after another as previous stages finish.
 */
export default function VerifyPipelineStrip({
  status,
  activeStep,
  stageDetails = {},
  visible,
  onDismiss,
}: VerifyPipelineStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const visibleCount =
    status === "success"
      ? PIPELINE_STAGES.length
      : Math.min(PIPELINE_STAGES.length, Math.max(1, activeStep + 1));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [activeStep, status]);

  if (!visible || status === "idle") {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18 }}
        aria-live="polite"
        className="mb-2.5 flex items-center justify-between gap-2 rounded-2xl border border-white/75 bg-white/80 px-3 py-1.5 shadow-[0_6px_20px_-8px_rgba(15,15,26,0.12)] backdrop-blur-md"
      >
        <div
          ref={scrollRef}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PIPELINE_STAGES.slice(0, visibleCount).map((label, index) => {
            const isCompleted =
              status === "success" || index < activeStep;
            const isCurrent =
              status === "loading" && index === activeStep;
            const isFailed =
              status === "error" && index === activeStep;
            const detail = stageDetails[index];

            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex shrink-0 items-center gap-1"
              >
                {index > 0 && (
                  <ChevronRight
                    className="h-3 w-3 shrink-0 text-[var(--ink-400)]"
                    aria-hidden="true"
                  />
                )}

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    isCompleted
                      ? "bg-emerald-50 text-emerald-700"
                      : isCurrent
                        ? "bg-[var(--ink-900)] text-white"
                        : isFailed
                          ? "bg-red-50 text-red-700"
                          : "bg-[var(--surface-muted)] text-[var(--ink-500)]"
                  }`}
                >
                  {isCompleted ? (
                    <Check
                      className="h-3 w-3 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : isCurrent ? (
                    <Loader2
                      className="h-3 w-3 shrink-0 animate-spin text-[var(--lime)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertCircle
                      className="h-3 w-3 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                  )}
                  <span>{label}</span>
                  {detail && isCompleted && (
                    <span className="font-mono text-[10px] opacity-80">
                      · {detail}
                    </span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {status === "loading" && (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--ink-500)]">
              {activeStep + 1}/{PIPELINE_STAGES.length}
            </span>
          )}
          {status !== "loading" && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Hide pipeline status"
              className="rounded-full p-1 text-[var(--ink-400)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--ink-900)]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
