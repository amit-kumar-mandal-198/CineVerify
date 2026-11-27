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
    <div className="w-full max-w-xl space-y-2.5 pt-2">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/85 p-1.5 shadow-md shadow-zinc-950/5 backdrop-blur-md focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/30"
      >
        <Search
          className="ml-2.5 h-4 w-4 shrink-0 text-zinc-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste a cinema rumour, headline, or article URL..."
          aria-label="Quick verify cinema claim or URL"
          className="w-full bg-transparent px-1.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
        >
          <span>Check</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">Try:</span>
        {QUICK_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => navigateToVerify(example)}
            className="rounded-full border border-zinc-200/80 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 transition-colors hover:border-amber-400 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-amber-500 dark:hover:text-zinc-100"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
