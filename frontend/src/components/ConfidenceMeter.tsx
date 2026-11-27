interface ConfidenceMeterProps {
  confidence: number;
}

export default function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const percentage = Math.round(clamped * 100);

  const barColor =
    percentage >= 75
      ? "bg-emerald-500"
      : percentage >= 50
        ? "bg-amber-500"
        : "bg-slate-400 dark:bg-slate-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-zinc-600 dark:text-zinc-400">
          Evidence Strength
        </span>
        <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {percentage}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Evidence Strength"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
