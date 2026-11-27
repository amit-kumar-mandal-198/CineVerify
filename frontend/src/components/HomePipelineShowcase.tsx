"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    step: "01",
    emoji: "🔍",
    title: "Paste Claim or Link",
    description: "Drop any cinema headline, rumour, or news URL.",
  },
  {
    step: "02",
    emoji: "📰",
    title: "Scan Trade Sources",
    description: "Searches trusted Indian film & box-office outlets.",
  },
  {
    step: "03",
    emoji: "⚖️",
    title: "Weigh the Evidence",
    description: "Checks if credible reports confirm or refute it.",
  },
  {
    step: "04",
    emoji: "✅",
    title: "Get Clear Verdict",
    description: "Returns a sourced verdict — never a forced guess.",
  },
] as const;

const VERDICTS = [
  {
    emoji: "✅",
    label: "Verified",
    meaning: "Confirmed by trusted trade sources",
    classes: "border-emerald-200/90 bg-emerald-50/75 text-emerald-800",
  },
  {
    emoji: "❌",
    label: "False",
    meaning: "Directly refuted by official reports",
    classes: "border-red-200/90 bg-red-50/75 text-red-800",
  },
  {
    emoji: "⚠️",
    label: "Misleading",
    meaning: "Outdated news or twisted figures",
    classes: "border-amber-200/90 bg-amber-50/75 text-amber-800",
  },
  {
    emoji: "🤷",
    label: "Unverified",
    meaning: "Not enough credible proof yet",
    classes: "border-slate-200/90 bg-slate-100/80 text-slate-700",
  },
] as const;

export default function HomePipelineShowcase() {
  return (
    <div className="space-y-6">
      {/* 4 Clean Visual Steps */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ perspective: "1000px" }}
      >
        {STEPS.map((item, index) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: index * 0.06 }}
            whileHover={{
              y: -5,
              rotateX: 2,
              transition: { type: "spring", stiffness: 320, damping: 22 },
            }}
            className="glass-card flex flex-col justify-between p-5 transition-shadow duration-200 hover:border-[var(--border-strong)] hover:bg-white/90 hover:shadow-[0_16px_32px_-14px_rgba(40,40,110,0.18)]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/90 text-xl shadow-[0_6px_14px_-4px_rgba(26,26,51,0.1)]"
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
                <span className="rounded-full bg-[var(--surface-tint)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--ink-500)]">
                  {item.step}
                </span>
              </div>

              <h3 className="mt-4 font-serif text-base font-bold text-[var(--ink-900)]">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-500)]">
                {item.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Compact 4-Verdict Legend Strip */}
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
            4 Possible Verdicts
          </span>
          <span className="text-xs text-[var(--ink-500)]">
            Every result links directly to the source articles
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {VERDICTS.map((v) => (
            <div
              key={v.label}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${v.classes}`}
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {v.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold">{v.label}</p>
                <p className="truncate text-[11px] opacity-85">{v.meaning}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
