import { AlertTriangle, CheckCircle2, HelpCircle, Scale } from "lucide-react";
import type {
  ClaimComparison,
  ComparisonStatus,
  VerificationResponse,
} from "@/types/api";

interface ClaimDiffCardProps {
  report: VerificationResponse;
}

const STATUS_BADGE: Record<
  ComparisonStatus,
  { label: string; classes: string; icon: typeof CheckCircle2 }
> = {
  match: {
    label: "Matches",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  mismatch: {
    label: "Mismatch",
    classes: "border-red-200 bg-red-50 text-red-700",
    icon: AlertTriangle,
  },
  unclear: {
    label: "Unconfirmed",
    classes: "border-slate-200 bg-slate-100 text-slate-700",
    icon: HelpCircle,
  },
};

function deriveFallbackComparisons(
  report: VerificationResponse,
): ClaimComparison[] {
  const topEvidence = report.evidence[0];
  if (!topEvidence) {
    return [
      {
        aspect: "Trade Coverage",
        claimed: report.core_claim,
        reported: "No corroborating or refuting trade reports were retrieved.",
        status: "unclear",
      },
    ];
  }

  const status: ComparisonStatus =
    report.verdict === "VERIFIED"
      ? "match"
      : report.verdict === "FALSE" || report.verdict === "MISLEADING"
        ? "mismatch"
        : "unclear";

  return [
    {
      aspect: "Core Claim vs. Lead Source",
      claimed: report.core_claim,
      reported: `${topEvidence.source_name}: ${topEvidence.snippet}`,
      status,
    },
  ];
}

export default function ClaimDiffCard({ report }: ClaimDiffCardProps) {
  const rows =
    report.claim_comparisons && report.claim_comparisons.length > 0
      ? report.claim_comparisons
      : deriveFallbackComparisons(report);

  return (
    <section
      aria-label="Claim versus evidence comparison"
      className="glass-card p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-900)]">
          <Scale className="h-4 w-4 text-[var(--ink-900)]" aria-hidden="true" />
          <h2>Claim vs. Evidence Check</h2>
        </div>
        <span className="text-[11px] font-medium text-[var(--ink-500)]">
          Side-by-side audit
        </span>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
          const badge = STATUS_BADGE[row.status];
          const Icon = badge.icon;

          return (
            <div
              key={`${row.aspect}-${row.claimed}`}
              className="rounded-xl border border-[var(--border)] bg-white/70 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                  {row.aspect}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.classes}`}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  <span>{badge.label}</span>
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-400)]">
                    Claimed
                  </p>
                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-[var(--ink-900)]">
                    {row.claimed}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-400)]">
                    Retrieved Sources
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-700)]">
                    {row.reported}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
