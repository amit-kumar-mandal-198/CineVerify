"use client";

import { motion } from "framer-motion";
import type { VerdictLabel } from "@/types/api";

interface ConfidenceMeterProps {
  confidence: number;
  verdict?: VerdictLabel;
}

const VERDICT_METER_STYLES: Record<
  VerdictLabel,
  { bar: string; text: string }
> = {
  VERIFIED: {
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  FALSE: {
    bar: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  MISLEADING: {
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  UNVERIFIED: {
    bar: "bg-slate-400 dark:bg-slate-500",
    text: "text-zinc-700 dark:text-zinc-300",
  },
};

export default function ConfidenceMeter({
  confidence,
  verdict = "UNVERIFIED",
}: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const percentage = Math.round(clamped * 100);
  const style = VERDICT_METER_STYLES[verdict];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-[var(--ink-500)]">Verdict Confidence</span>
        <span className={`font-semibold tabular-nums ${style.text}`}>
          {percentage}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Verdict Confidence"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-tint)]"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${style.bar}`}
        />
      </div>
    </div>
  );
}
