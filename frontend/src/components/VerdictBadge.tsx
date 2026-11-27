import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { VerdictLabel } from "@/types/api";

interface VerdictBadgeProps {
  verdict: VerdictLabel;
}

const VERDICT_CONFIG: Record<
  VerdictLabel,
  { label: string; icon: LucideIcon; classes: string }
> = {
  VERIFIED: {
    label: "VERIFIED",
    icon: CheckCircle2,
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  FALSE: {
    label: "FALSE",
    icon: XCircle,
    classes:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300",
  },
  MISLEADING: {
    label: "MISLEADING",
    icon: AlertTriangle,
    classes:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300",
  },
  UNVERIFIED: {
    label: "UNVERIFIED",
    icon: HelpCircle,
    classes:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300",
  },
};

export default function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const config = VERDICT_CONFIG[verdict];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${config.classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
