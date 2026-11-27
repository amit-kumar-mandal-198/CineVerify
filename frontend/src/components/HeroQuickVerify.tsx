"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

const QUICK_EXAMPLES = [
  "Pushpa 3 releasing on Christmas 2027",
  "Kalki 2898 AD crossed 1000 crore worldwide",
] as const;

export default function HeroQuickVerify() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function navigateToVerify(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      router.push("/verify");
      return;
    }
    const isUrl = /^https?:\/\//i.test(trimmed);
    const params = new URLSearchParams({
      claim: trimmed,
      type: isUrl ? "url" : "text",
    });
    router.push(`/verify?${params.toString()}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateToVerify(query);
  }

  return (
    <div className="w-full max-w-xl space-y-2.5">
      <form
        onSubmit={handleSubmit}
        className="glass-card flex items-center gap-2 !rounded-2xl p-1.5 focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--lime-500)]/50"
      >
        <Search
          className="ml-2.5 h-4 w-4 shrink-0 text-[var(--ink-500)]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste a cinema rumour, headline, or article URL..."
          aria-label="Quick verify cinema claim or URL"
          className="w-full bg-transparent px-1.5 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:outline-none"
        />
        <button
          type="submit"
          className="cta-lime inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
        >
          <span>Check</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium text-[var(--ink-500)]">Try:</span>
        {QUICK_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => navigateToVerify(example)}
            className="rounded-full border border-[var(--border)] bg-white/60 px-2.5 py-0.5 text-[11px] font-medium text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
