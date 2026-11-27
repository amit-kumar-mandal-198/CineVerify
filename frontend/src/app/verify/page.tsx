"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  RotateCcw,
} from "lucide-react";
import ClaimInput from "@/components/ClaimInput";
import VerificationReport from "@/components/VerificationReport";
import { verifyClaim } from "@/lib/api";
import { MOCK_VERIFICATIONS } from "@/lib/mockData";
import type {
  InputType,
  VerdictLabel,
  VerificationResponse,
} from "@/types/api";

type VerifyStatus = "idle" | "loading" | "success" | "error";

const PIPELINE_STEPS = [
  "Extracting claim",
  "Searching entertainment sources",
  "Running NLI comparison",
  "Generating grounded report",
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

  return (
    <VerifyWorkspace
      key={`${initialType}:${initialClaim}`}
      initialClaim={initialClaim}
      initialType={initialType}
    />
  );
}

function VerifyWorkspace({
  initialClaim,
  initialType,
}: {
  initialClaim: string;
  initialType: InputType;
}) {
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    claim: string;
    type: InputType;
  } | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    const timer = setInterval(() => {
      setActiveStep((prev) =>
        prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 900);

    return () => clearInterval(timer);
  }, [status]);

  async function handleVerify(claim: string, type: InputType) {
    setLastRequest({ claim, type });
    setErrorMessage(null);
    setActiveStep(0);
    setStatus("loading");

    try {
      const response = await verifyClaim(claim, type);
      setResult(response);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while verifying the claim.";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  function handleRetry() {
    if (lastRequest) {
      void handleVerify(lastRequest.claim, lastRequest.type);
    } else {
      setStatus("idle");
    }
  }

  function handleReset() {
    setStatus("idle");
    setResult(null);
    setErrorMessage(null);
  }

  function handleMockPreset(verdict: VerdictLabel) {
    setErrorMessage(null);
    setResult(MOCK_VERIFICATIONS[verdict]);
    setStatus("success");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>
      <div className="mb-6 space-y-1">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--ink-900)] sm:text-3xl">
          Verify Cinema Claim
        </h1>
        <p className="text-sm text-[var(--ink-500)]">
          Submit an Indian cinema headline, rumour, or news article URL to
          evaluate it against retrieved entertainment sources.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <ClaimInput
              key={`${initialType}:${initialClaim}`}
              onSubmit={handleVerify}
              isLoading={false}
              initialClaim={initialClaim}
              initialType={initialType}
              autoFocus={initialClaim === ""}
            />

          {IS_MOCK_MODE && (
            <div className="glass-card p-4">
              <p className="text-xs font-medium text-[var(--ink-500)]">
                Mock mode active (<code className="font-mono text-[var(--ink-900)]">NEXT_PUBLIC_USE_MOCK=true</code>) — preview all 4 verdict fixtures:
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {MOCK_VERDICT_KEYS.map((verdict) => (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() => handleMockPreset(verdict)}
                    className="rounded-md border border-[var(--border)] bg-white/75 px-2.5 py-1 text-xs font-semibold text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
                  >
                    Preview {verdict}
                  </button>
                ))}
              </div>
            </div>
          )}
          </motion.div>
        )}

        {status === "loading" && (
          <motion.section
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            aria-live="polite"
            className="glass-card p-6 sm:p-8"
          >
          <div className="flex items-center gap-3">
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--ink-900)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[var(--ink-900)]">
                Verifying claim against sources...
              </h2>
              {lastRequest && (
                <p className="mt-0.5 text-xs text-[var(--ink-500)]">
                  “{lastRequest.claim}”
                </p>
              )}
            </div>
          </div>

          <ol className="mt-6 space-y-3">
            {PIPELINE_STEPS.map((step, index) => {
              const isCompleted = index < activeStep;
              const isCurrent = index === activeStep;
              return (
                <li
                  key={step}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    isCurrent
                      ? "border-[var(--border-strong)] bg-[var(--surface-tint)] font-medium text-[var(--ink-900)]"
                      : isCompleted
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
                        : "border-[var(--border)] bg-white/50 text-[var(--ink-500)]"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-900)]" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span>{step}</span>
                </li>
              );
            })}
          </ol>
        </motion.section>
      )}

      {status === "error" && (
        <motion.section
          key="error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/70 dark:bg-red-950/30"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-red-900 dark:text-red-200">
                Verification Failed
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300">
                {errorMessage ?? "Unable to complete verification right now."}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit Claim</span>
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {status === "success" && result && (
        <motion.div
          key="success"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white/75 px-3.5 py-2 text-xs font-semibold text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Verify Another Claim</span>
            </button>
          </div>

          <VerificationReport report={result} />
        </motion.div>
      )}
      </AnimatePresence>
    </main>
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
