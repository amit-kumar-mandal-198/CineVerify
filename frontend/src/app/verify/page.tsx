"use client";

import { useEffect, useState } from "react";
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

export default function VerifyPage() {
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
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Verify Cinema Claim
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Submit an Indian cinema headline, rumour, or news article URL to
          evaluate it against retrieved entertainment sources.
        </p>
      </div>

      {status === "idle" && (
        <div className="space-y-6">
          <ClaimInput onSubmit={handleVerify} isLoading={false} />

          {IS_MOCK_MODE && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Mock mode active (<code className="font-mono">NEXT_PUBLIC_USE_MOCK=true</code>) — preview all 4 verdict fixtures:
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {MOCK_VERDICT_KEYS.map((verdict) => (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() => handleMockPreset(verdict)}
                    className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:border-amber-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-amber-500"
                  >
                    Preview {verdict}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === "loading" && (
        <section
          aria-live="polite"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <Loader2
              className="h-5 w-5 animate-spin text-amber-500"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Verifying claim against sources...
              </h2>
              {lastRequest && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
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
                  className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                    isCurrent
                      ? "border-amber-300 bg-amber-50/70 font-medium text-zinc-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-zinc-50"
                      : isCompleted
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-500"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span>{step}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {status === "error" && (
        <section
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
        </section>
      )}

      {status === "success" && result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Verify Another Claim</span>
            </button>
          </div>

          <VerificationReport report={result} />
        </div>
      )}
    </main>
  );
}
