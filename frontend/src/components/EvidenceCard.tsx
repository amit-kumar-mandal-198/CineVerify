import { Calendar, ExternalLink, Globe, Shield } from "lucide-react";
import type { EvidenceItem, StanceLabel } from "@/types/api";

interface EvidenceCardProps {
  item: EvidenceItem;
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const STANCE_CONFIG: Record<StanceLabel, { label: string; classes: string }> = {
  supports: {
    label: "Supports",
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  contradicts: {
    label: "Contradicts",
    classes:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300",
  },
  neutral: {
    label: "Neutral",
    classes:
      "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export default function EvidenceCard({ item }: EvidenceCardProps) {
  const stance = STANCE_CONFIG[item.stance];
  const credibilityPercent = Math.round(
    Math.max(0, Math.min(1, item.credibility_score)) * 100,
  );
  const filledBars = Math.max(1, Math.round((credibilityPercent / 100) * 4));
  const domain = getDomain(item.url);

  return (
    <article className="glass-card p-4 transition-all hover:border-[var(--border-strong)] hover:bg-white/75 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-semibold ${stance.classes}`}
          >
            {stance.label}
          </span>
          <span className="font-semibold text-[var(--ink-900)]">
            {item.source_name}
          </span>
          {domain && (
            <span className="hidden items-center gap-1 rounded bg-[var(--surface-tint)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-500)] sm:inline-flex">
              <Globe className="h-3 w-3" aria-hidden="true" />
              <span>{domain}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[var(--ink-500)]">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{item.published_date ?? "Date unknown"}</span>
          </span>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-tint)] px-2.5 py-1 text-xs font-medium text-[var(--ink-900)]"
          title={`Source credibility score: ${credibilityPercent}%`}
        >
          <Shield className="h-3 w-3 text-[var(--ink-900)]" aria-hidden="true" />
          <span className="tabular-nums">Credibility: {credibilityPercent}%</span>
          <span className="inline-flex items-end gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`w-1 rounded-xs ${
                  bar <= filledBars
                    ? "bg-[var(--ink-900)]"
                    : "bg-[var(--border-strong)]"
                }`}
                style={{ height: `${bar * 2 + 4}px` }}
              />
            ))}
          </span>
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[var(--ink-900)]">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:underline"
        >
          <span>{item.title}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-500)]">
        {item.snippet}
      </p>
    </article>
  );
}
