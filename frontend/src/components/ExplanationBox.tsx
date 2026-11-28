"use client";

import type { ReactNode } from "react";
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

function renderInlineFormatting(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="mx-0.5 rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-amber-950 dark:bg-amber-900/40 dark:text-amber-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--ink-900)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function renderFormattedExplanation(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***") {
      blocks.push(<hr key={`hr-${i}`} className="my-2 border-[var(--border)]" />);
      i += 1;
      continue;
    }

    // Section Headings (### or ####)
    if (trimmed.startsWith("#### ")) {
      blocks.push(
        <h3
          key={`h4-${i}`}
          className="pt-2 text-xs font-bold uppercase tracking-wider text-[var(--ink-700)]"
        >
          {renderInlineFormatting(trimmed.slice(5))}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="text-sm font-bold leading-snug text-[var(--ink-900)]"
        >
          {renderInlineFormatting(trimmed.slice(4))}
        </h3>,
      );
      i += 1;
      continue;
    }

    // Markdown table block (supports optional blank lines between rows)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.startsWith("|") && cur.endsWith("|")) {
          tableLines.push(cur);
          i += 1;
        } else if (cur === "" && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
          i += 1;
        } else {
          break;
        }
      }
      const parseCells = (row: string) =>
        row
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim());

      const nonSepLines = tableLines.filter(
        (row) => !/^[:\-\s|]+$/.test(row),
      );
      const headers = nonSepLines.length > 0 ? parseCells(nonSepLines[0]) : [];
      const bodyRows = nonSepLines.slice(1).map(parseCells);

      blocks.push(
        <div
          key={`tbl-${i}`}
          className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white/80"
        >
          <table className="w-full text-left text-xs">
            {headers.length > 0 && (
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/70 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-[var(--border)]">
              {bodyRows.map((cells, rIdx) => (
                <tr key={rIdx} className="align-top">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-[var(--ink-700)]">
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Bullet list block (- item or * item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        listItems.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc space-y-1 pl-5 text-sm text-[var(--ink-700)]">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Regular paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed text-[var(--ink-900)]">
        {renderInlineFormatting(trimmed)}
      </p>,
    );
    i += 1;
  }

  return blocks;
}

export default function ExplanationBox({
  explanation,
  verdict,
}: ExplanationBoxProps) {
  return (
    <section
      aria-label="AI Explanation"
      className={`glass-card p-4 sm:p-5 ${VERDICT_CARD_STYLES[verdict]}`}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink-900)]">
        <Sparkles className="h-4 w-4 text-[var(--ink-900)]" aria-hidden="true" />
        <h2>Verification Explanation</h2>
      </div>
      <div className="space-y-2.5">
        {renderFormattedExplanation(explanation)}
      </div>
      <p className="mt-4 flex items-center gap-1.5 border-t border-[var(--border)]/60 pt-3 text-xs text-[var(--ink-500)]">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Generated by local CineVerify SLM using retrieved Indian cinema trade evidence and chronological verification.
        </span>
      </p>
    </section>
  );
}
