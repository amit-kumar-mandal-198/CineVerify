import { Info, Sparkles } from "lucide-react";
import type { VerdictLabel } from "@/types/api";

interface ExplanationBoxProps {
  explanation: string;
  verdict: VerdictLabel;
}

const VERDICT_CARD_STYLES: Record<VerdictLabel, string> = {
  VERIFIED:
    "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20",
  FALSE:
    "border-red-200/80 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/20",
  MISLEADING:
    "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20",
  UNVERIFIED:
    "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50",
};

export default function ExplanationBox({
  explanation,
  verdict,
}: ExplanationBoxProps) {
  return (
    <section
      aria-label="AI Explanation"
      className={`rounded-xl border p-4 sm:p-5 ${VERDICT_CARD_STYLES[verdict]}`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <h2>Verification Explanation</h2>
      </div>
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {explanation}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          This verdict is derived directly from the retrieved evidence sources listed below.
        </span>
      </p>
    </section>
  );
}
