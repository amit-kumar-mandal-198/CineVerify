import { FileSearch, Tag } from "lucide-react";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import EvidenceCard from "@/components/EvidenceCard";
import ExplanationBox from "@/components/ExplanationBox";
import VerdictBadge from "@/components/VerdictBadge";
import {
  CATEGORY_LABELS,
  ENTITY_LABELS,
  formatVerificationDate,
} from "@/lib/formatters";
import type { ExtractedEntities, VerificationResponse } from "@/types/api";

interface VerificationReportProps {
  report: VerificationResponse;
}

export default function VerificationReport({
  report,
}: VerificationReportProps) {
  const detectedEntities = (
    Object.entries(report.entities) as Array<
      [keyof ExtractedEntities, string | null]
    >
  ).filter(([, value]) => value !== null && value.trim() !== "");

  return (
    <div className="space-y-6">
      {/* Verdict summary header */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <VerdictBadge verdict={report.verdict} />
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <Tag className="h-3 w-3" aria-hidden="true" />
              <span>{CATEGORY_LABELS[report.category]}</span>
            </span>
          </div>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Verified: {formatVerificationDate(report.verified_at)}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Submitted Claim
            </p>
            <p className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {report.submitted_claim}
            </p>
          </div>

          {report.core_claim !== report.submitted_claim && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Extracted Core Claim
              </p>
              <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                {report.core_claim}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5">
          <ConfidenceMeter confidence={report.confidence} />
        </div>

        {detectedEntities.length > 0 && (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Detected Entities
            </p>
            <div className="flex flex-wrap gap-2">
              {detectedEntities.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <span className="font-medium text-zinc-500 dark:text-zinc-400">
                    {ENTITY_LABELS[key]}:
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* AI Explanation */}
      <ExplanationBox explanation={report.explanation} verdict={report.verdict} />

      {/* Retrieved Evidence */}
      <section aria-label="Retrieved Evidence" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Retrieved Evidence ({report.evidence.length})
          </h2>
        </div>

        {report.evidence.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <FileSearch
              className="h-8 w-8 text-zinc-400 dark:text-zinc-500"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              No corroborating or refuting sources found
            </p>
            <p className="mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
              CineVerify AI does not fabricate certainty when independent evidence is unavailable.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {report.evidence.map((item, idx) => (
              <EvidenceCard key={`${item.url}-${idx}`} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
