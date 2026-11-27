import Link from "next/link";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import VerdictBadge from "@/components/VerdictBadge";
import type { VerdictLabel } from "@/types/api";

const VERDICT_DEFINITIONS: ReadonlyArray<{
  verdict: VerdictLabel;
  description: string;
}> = [
  {
    verdict: "VERIFIED",
    description:
      "Multiple credible entertainment trade outlets or official announcements confirm the core claim.",
  },
  {
    verdict: "FALSE",
    description:
      "Credible reports, studio statements, or trade clarifications directly contradict the claim.",
  },
  {
    verdict: "MISLEADING",
    description:
      "Parts of the claim are true or based on past announcements, but dates, numbers, or context are distorted.",
  },
  {
    verdict: "UNVERIFIED",
    description:
      "Insufficient independent evidence is available to confirm or refute the claim.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      {/* Project overview */}
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.15)] backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
          <span className="font-semibold tracking-wide">CineVerify AI</span>
          <span className="text-zinc-400 dark:text-zinc-600">·</span>
          <span className="text-zinc-600 dark:text-zinc-400">Overclock &apos;26 (Track SW-OI-1)</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          About CineVerify AI
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
          CineVerify AI is an evidence-backed verification platform built to
          combat misinformation and unverified rumours in Indian cinema news.
          Instead of relying on model memory alone, it extracts core claims,
          retrieves live articles from entertainment trade outlets, compares
          stances using Natural Language Inference (NLI), and presents the
          underlying sources alongside each verdict.
        </p>
      </section>

      {/* 4 Verdict Definitions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Verdict Definitions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {VERDICT_DEFINITIONS.map((item) => (
            <div
              key={item.verdict}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <VerdictBadge verdict={item.verdict} />
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Scope & Limitations */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Scope &amp; Limitations
            </h2>
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                Scoped specifically to Indian cinema news (Movie Announcements,
                Casting, Release Updates, and Box-Office).
              </li>
              <li>
                CineVerify AI does not fabricate certainty when evidence is
                missing — claims without sufficient corroboration or refutation
                are labeled <strong>UNVERIFIED</strong>.
              </li>
              <li>
                Outputs are evidence-backed assessments based on retrieved
                public reporting, not absolute truth.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div>
        <Link
          href="/verify"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
        >
          <span>Try Claim Verification</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
