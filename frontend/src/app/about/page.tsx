import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
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
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>
      {/* Project overview */}
      <section className="space-y-3">
        <div className="glass-card inline-flex items-center gap-2 !rounded-full px-3.5 py-1 text-xs font-medium text-[var(--ink-900)]">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--ink-900)]" aria-hidden="true" />
          <span className="font-semibold tracking-wide">CineVerify AI</span>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="text-[var(--ink-500)]">Overclock &apos;26 (Track SW-OI-1)</span>
        </div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--ink-900)] sm:text-3xl">
          About CineVerify AI
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-500)] sm:text-base">
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
        <h2 className="font-serif text-lg font-semibold text-[var(--ink-900)]">
          Verdict Definitions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {VERDICT_DEFINITIONS.map((item) => (
            <div
              key={item.verdict}
              className="glass-card p-5"
            >
              <VerdictBadge verdict={item.verdict} />
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-500)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Scope & Limitations */}
      <section className="glass-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink-900)]"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <h2 className="font-serif text-base font-semibold text-[var(--ink-900)]">
              Scope &amp; Limitations
            </h2>
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-[var(--ink-500)]">
              <li>
                Scoped specifically to Indian cinema news (Movie Announcements,
                Casting, Release Updates, and Box-Office).
              </li>
              <li>
                CineVerify AI does not fabricate certainty when evidence is
                missing — claims without sufficient corroboration or refutation
                are labeled <strong className="text-[var(--ink-900)]">UNVERIFIED</strong>.
              </li>
              <li>
                Outputs are evidence-backed assessments based on retrieved
                public reporting, not absolute truth.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/verify"
          className="cta-lime inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          <span>Try Claim Verification</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/benchmarks"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/75 px-4 py-2.5 text-sm font-semibold text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
        >
          <span>View Live Benchmarks &amp; Telemetry</span>
        </Link>
      </div>
    </main>
  );
}
