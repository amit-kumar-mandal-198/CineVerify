"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  AlertCircle,
  ClipboardPaste,
  FileText,
  Link2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import type { InputType } from "@/types/api";

export interface ClaimInputProps {
  onSubmit: (claim: string, type: InputType) => Promise<void>;
  isLoading: boolean;
  initialClaim?: string;
  initialType?: InputType;
  autoFocus?: boolean;
}

const EXAMPLE_CLAIMS: ReadonlyArray<{ label: string; claim: string; type: InputType }> = [
  {
    label: "Pushpa 3 release rumour",
    claim: "Pushpa 3 releasing on Christmas 2027",
    type: "text",
  },
  {
    label: "Casting update",
    claim: "SS Rajamouli's next film with Mahesh Babu begins shooting in Hyderabad",
    type: "text",
  },
  {
    label: "Box office claim",
    claim: "Kalki 2898 AD crossed 1000 crore worldwide at the box office",
    type: "text",
  },
];

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ClaimInput({
  onSubmit,
  isLoading,
  initialClaim = "",
  initialType = "text",
  autoFocus = false,
}: ClaimInputProps) {
  const [inputType, setInputType] = useState<InputType>(initialType);
  const [claim, setClaim] = useState(initialClaim);
  const [error, setError] = useState<string | null>(null);

  const trimmedClaim = claim.trim();
  const isSubmitDisabled = isLoading || trimmedClaim.length === 0;

  function handleTypeChange(nextType: InputType) {
    setInputType(nextType);
    setError(null);
  }

  function handleExampleClick(example: (typeof EXAMPLE_CLAIMS)[number]) {
    setInputType(example.type);
    setClaim(example.claim);
    setError(null);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setClaim(text);
        setError(null);
      }
    } catch {
      // Clipboard read may be denied by browser permissions
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !isSubmitDisabled) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trimmedClaim.length < 3) {
      setError("Please enter at least 3 characters to verify a claim.");
      return;
    }

    if (inputType === "url" && !isValidHttpUrl(trimmedClaim)) {
      setError("Please enter a valid article URL starting with http:// or https://.");
      return;
    }

    setError(null);
    await onSubmit(trimmedClaim, inputType);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="glass-card space-y-4 p-5 sm:p-6"
    >
      {/* Input mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Claim input type"
          className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-tint)]/75 p-1"
        >
          <button
            type="button"
            disabled={isLoading}
            aria-pressed={inputType === "text"}
            onClick={() => handleTypeChange("text")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              inputType === "text"
                ? "bg-white text-[var(--ink-900)] shadow-xs"
                : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>Headline / Claim</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            aria-pressed={inputType === "url"}
            onClick={() => handleTypeChange("url")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              inputType === "url"
                ? "bg-white text-[var(--ink-900)] shadow-xs"
                : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            <span>Article URL</span>
          </button>
        </div>

        <span className="text-xs text-[var(--ink-500)]">
          {inputType === "text" ? "Paste a rumour, tweet, or headline" : "Paste an entertainment news link"}
        </span>
      </div>

      {/* Claim input field */}
      <div>
        <label htmlFor="claim-input" className="sr-only">
          {inputType === "text" ? "Indian cinema claim or headline" : "Article URL"}
        </label>

        {inputType === "text" ? (
          <div className="relative">
            <textarea
              id="claim-input"
              rows={4}
              autoFocus={autoFocus}
              value={claim}
              disabled={isLoading}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setClaim(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Pushpa 3 releasing on Christmas 2027"
              aria-invalid={error !== null}
              aria-describedby={error ? "claim-input-error" : undefined}
              className="w-full rounded-xl border border-[var(--border)] bg-white/75 px-3.5 py-2.5 pr-9 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--border-strong)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--lime-500)]/50 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {claim.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => {
                  setClaim("");
                  setError(null);
                }}
                aria-label="Clear claim"
                title="Clear claim"
                className="absolute right-2.5 top-2.5 rounded-md p-1 text-[var(--ink-500)] transition-colors hover:bg-[var(--surface-tint)] hover:text-[var(--ink-900)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative flex items-center">
            <input
              id="claim-input"
              type="url"
              autoFocus={autoFocus}
              value={claim}
              disabled={isLoading}
              onChange={(e) => {
                setClaim(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://www.bollywoodhungama.com/news/..."
              aria-invalid={error !== null}
              aria-describedby={error ? "claim-input-error" : undefined}
              className="w-full rounded-xl border border-[var(--border)] bg-white/75 px-3.5 py-2.5 pr-20 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--border-strong)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--lime-500)]/50 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {claim.length > 0 && !isLoading ? (
                <button
                  type="button"
                  onClick={() => {
                    setClaim("");
                    setError(null);
                  }}
                  aria-label="Clear URL"
                  title="Clear URL"
                  className="rounded-md p-1 text-[var(--ink-500)] transition-colors hover:bg-[var(--surface-tint)] hover:text-[var(--ink-900)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
                !isLoading && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)]"
                  >
                    <ClipboardPaste className="h-3 w-3" aria-hidden="true" />
                    <span>Paste</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {error && (
          <p
            id="claim-input-error"
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>

      {/* Quick-try example chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--ink-500)]">
          Try example:
        </span>
        {EXAMPLE_CLAIMS.map((example) => (
          <button
            key={example.label}
            type="button"
            disabled={isLoading}
            onClick={() => handleExampleClick(example)}
            className="rounded-full border border-[var(--border)] bg-white/65 px-2.5 py-1 text-xs text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {example.label}
          </button>
        ))}
      </div>

      {/* Submit button */}
      <div className="flex items-center justify-between gap-3">
        <span className="hidden text-[11px] text-[var(--ink-500)] sm:inline">
          {inputType === "text" ? "Press Ctrl/⌘ + Enter to submit" : ""}
        </span>
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="cta-lime inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Verify Claim</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
