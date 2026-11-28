"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, FileSearch, Tag } from "lucide-react";
import ClaimDiffCard from "@/components/ClaimDiffCard";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import EvidenceCard from "@/components/EvidenceCard";
import ExplanationBox from "@/components/ExplanationBox";
import VerdictBadge from "@/components/VerdictBadge";
import {
  CATEGORY_LABELS,
  ENTITY_LABELS,
  formatVerificationDate,
} from "@/lib/formatters";
import type {
  ExtractedEntities,
  StanceLabel,
  VerificationResponse,
} from "@/types/api";

interface VerificationReportProps {
  report: VerificationResponse;
}

type StanceFilter = "all" | StanceLabel;

export default function VerificationReport({
  report,
}: VerificationReportProps) {
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>("all");
  const [copied, setCopied] = useState(false);

  const detectedEntities = (
    Object.entries(report.entities) as Array<
      [keyof ExtractedEntities, string | null]
    >
  ).filter(([, value]) => value !== null && value.trim() !== "");

  const stanceCounts = useMemo(() => {
    const counts = { supports: 0, contradicts: 0, neutral: 0 };
    for (const item of report.evidence) {
      counts[item.stance] += 1;
    }
    return counts;
  }, [report.evidence]);

  const filteredEvidence = useMemo(() => {
    if (stanceFilter === "all") return report.evidence;
    return report.evidence.filter((item) => item.stance === stanceFilter);
  }, [report.evidence, stanceFilter]);

  async function handleCopySummary() {
    const confidencePct = Math.round(
      Math.max(0, Math.min(1, report.confidence)) * 100,
    );
    const sources = report.evidence
      .slice(0, 3)
      .map((e) => `- [${e.stance.toUpperCase()}] ${e.source_name}: ${e.url}`)
      .join("\n");

    const summary = [
      `CineVerify AI Report`,
      `Claim: ${report.submitted_claim}`,
      `Verdict: ${report.verdict} (${confidencePct}% confidence)`,
      `Category: ${CATEGORY_LABELS[report.category]}`,
      ``,
      `Explanation: ${report.explanation}`,
      sources ? `\nTop Sources:\n${sources}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write errors in restricted contexts
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Verdict summary header */}
      <section className="glass-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <VerdictBadge verdict={report.verdict} />
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-tint)] px-2.5 py-1 text-xs font-medium text-[var(--ink-900)]">
              <Tag className="h-3 w-3" aria-hidden="true" />
              <span>{CATEGORY_LABELS[report.category]}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--ink-500)]">
              Verified: {formatVerificationDate(report.verified_at)}
            </span>
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/70 px-2.5 py-1 text-xs font-medium text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-500)]">
              Submitted Claim
            </p>
            <p className="mt-0.5 text-base font-semibold text-[var(--ink-900)]">
              {report.submitted_claim}
            </p>
          </div>

          {report.core_claim !== report.submitted_claim && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-500)]">
                Extracted Core Claim
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink-900)]">
                {report.core_claim}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5">
          <ConfidenceMeter
            confidence={report.confidence}
            verdict={report.verdict}
          />
        </div>

        {detectedEntities.length > 0 && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--ink-500)]">
              Detected Entities
            </p>
            <div className="flex flex-wrap gap-2">
              {detectedEntities.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-tint)]/75 px-2.5 py-1 text-xs text-[var(--ink-900)]"
                >
                  <span className="font-medium text-[var(--ink-500)]">
                    {ENTITY_LABELS[key]}:
                  </span>
                  <span className="font-semibold text-[var(--ink-900)]">
                    {value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Claim vs. Evidence Diff Card */}
      <ClaimDiffCard report={report} />

      {/* AI Explanation */}
      <ExplanationBox explanation={report.explanation} verdict={report.verdict} />

      {/* Retrieved Evidence */}
      <section aria-label="Retrieved Evidence" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--ink-900)]">
            Retrieved Evidence ({report.evidence.length})
          </h2>

          {report.evidence.length > 0 && (
            <div
              role="group"
              aria-label="Filter evidence by stance"
              className="flex flex-wrap items-center gap-1.5"
            >
              {(
                [
                  { key: "all", label: `All (${report.evidence.length})` },
                  { key: "supports", label: `Supports (${stanceCounts.supports})` },
                  { key: "contradicts", label: `Contradicts (${stanceCounts.contradicts})` },
                  { key: "neutral", label: `Neutral (${stanceCounts.neutral})` },
                ] as const
              )
                .filter((tab) => tab.key === "all" || stanceCounts[tab.key] > 0)
                .map((tab) => {
                  const active = stanceFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStanceFilter(tab.key)}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
                          : "border-[var(--border)] bg-white/65 text-[var(--ink-500)] hover:border-[var(--border-strong)] hover:text-[var(--ink-900)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {report.evidence.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center px-6 py-8 text-center">
            <FileSearch
              className="h-8 w-8 text-[var(--ink-500)]"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-medium text-[var(--ink-900)]">
              No corroborating or refuting sources found
            </p>
            <p className="mt-1 max-w-md text-xs text-[var(--ink-500)]">
              CineVerify AI does not fabricate certainty when independent evidence is unavailable.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvidence.map((item, idx) => (
              <motion.div
                key={`${item.url}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.05, 0.25) }}
              >
                <EvidenceCard item={item} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
