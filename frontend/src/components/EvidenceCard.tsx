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
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-semibold ${stance.classes}`}
          >
            {stance.label}
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {item.source_name}
          </span>
          {domain && (
            <span className="hidden items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 sm:inline-flex dark:bg-zinc-800/80 dark:text-zinc-400">
              <Globe className="h-3 w-3" aria-hidden="true" />
              <span>{domain}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{item.published_date ?? "Date unknown"}</span>
          </span>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          title={`Source credibility score: ${credibilityPercent}%`}
        >
          <Shield className="h-3 w-3 text-amber-500" aria-hidden="true" />
          <span className="tabular-nums">Credibility: {credibilityPercent}%</span>
          <span className="inline-flex items-end gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`w-1 rounded-xs ${
                  bar <= filledBars
                    ? "bg-amber-500"
                    : "bg-zinc-300 dark:bg-zinc-600"
                }`}
                style={{ height: `${bar * 2 + 4}px` }}
              />
            ))}
          </span>
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-amber-600 hover:underline dark:hover:text-amber-400"
        >
          <span>{item.title}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {item.snippet}
      </p>
    </article>
  );
}
