"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AlertCircle,
  ArrowUp,
  ClipboardPaste,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import type { InputType } from "@/types/api";

export type ComposerMode = "verify" | "followup";

interface VerifySearchBarProps {
  claim: string;
  inputType: InputType;
  isLoading: boolean;
  isFollowUpLoading?: boolean;
  hasActiveReport?: boolean;
  composerMode?: ComposerMode;
  autoFocus?: boolean;
  onClaimChange: (value: string) => void;
  onTypeChange: (nextType: InputType) => void;
  onComposerModeChange?: (mode: ComposerMode) => void;
  onSubmit: (claim: string, type: InputType) => Promise<void>;
  onSubmitFollowUp?: (question: string) => Promise<void>;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function VerifySearchBar({
  claim,
  inputType,
  isLoading,
  isFollowUpLoading = false,
  hasActiveReport = false,
  composerMode = "verify",
  autoFocus = false,
  onClaimChange,
  onTypeChange,
  onComposerModeChange,
  onSubmit,
  onSubmitFollowUp,
}: VerifySearchBarProps) {
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isFollowUp = hasActiveReport && composerMode === "followup";
  const busy = isLoading || isFollowUpLoading;
  const trimmed = claim.trim();
  const isDisabled = busy || trimmed.length === 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [claim]);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onClaimChange(text);
        setError(null);
      }
    } catch {
      // Clipboard read may be blocked by browser permissions
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isDisabled) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isFollowUp && onSubmitFollowUp) {
      if (trimmed.length < 2) {
        setError("Please enter a follow-up question about this report.");
        return;
      }
      setError(null);
      await onSubmitFollowUp(trimmed);
      return;
    }

    if (trimmed.length < 3) {
      setError("Please enter at least 3 characters to verify a claim.");
      return;
    }

    if (inputType === "url" && !isValidHttpUrl(trimmed)) {
      setError("Please enter a valid URL starting with http:// or https://.");
      return;
    }

    setError(null);
    await onSubmit(trimmed, inputType);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[24px] border border-[var(--border-strong)] bg-white/92 p-3 shadow-[0_14px_38px_-14px_rgba(15,15,26,0.16)] backdrop-blur-xl transition-shadow focus-within:border-[var(--ink-900)]/40 focus-within:ring-2 focus-within:ring-[var(--lime)]/60"
    >
      <label htmlFor="verify-composer-input" className="sr-only">
        {isFollowUp
          ? "Ask a follow-up question about this report"
          : inputType === "text"
            ? "Indian cinema claim or headline"
            : "Entertainment article URL"}
      </label>

      <div className="relative flex items-start gap-2 px-1.5 pt-0.5">
        <textarea
          ref={textareaRef}
          id="verify-composer-input"
          rows={1}
          autoFocus={autoFocus}
          value={claim}
          disabled={busy}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            onClaimChange(e.target.value);
            if (error) setError(null);
          }}
          placeholder={
            isFollowUp
              ? "Ask a follow-up about this report (e.g. What figure did Sacnilk report?)..."
              : inputType === "text"
                ? "Paste an Indian cinema rumour, headline, or claim to verify..."
                : "https://www.bollywoodhungama.com/news/..."
          }
          aria-invalid={error !== null}
          aria-describedby={error ? "verify-composer-error" : undefined}
          className="max-h-[132px] min-h-[28px] w-full resize-none bg-transparent py-1 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        {claim.length > 0 && !busy && (
          <button
            type="button"
            onClick={() => {
              onClaimChange("");
              setError(null);
              textareaRef.current?.focus();
            }}
            aria-label="Clear input"
            title="Clear input"
            className="mt-0.5 shrink-0 rounded-full p-1 text-[var(--ink-400)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--ink-900)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <p
          id="verify-composer-error"
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 px-2 text-xs font-medium text-red-600"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Bottom toolbar inside search bar */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {hasActiveReport && onComposerModeChange && (
            <div
              role="group"
              aria-label="Composer action"
              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-0.5"
            >
              <button
                type="button"
                disabled={busy}
                aria-pressed={composerMode === "followup"}
                onClick={() => {
                  onComposerModeChange("followup");
                  setError(null);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  composerMode === "followup"
                    ? "bg-[var(--ink-900)] text-white shadow-xs"
                    : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                }`}
              >
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                <span>Ask Follow-up</span>
              </button>

              <button
                type="button"
                disabled={busy}
                aria-pressed={composerMode === "verify"}
                onClick={() => {
                  onComposerModeChange("verify");
                  setError(null);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  composerMode === "verify"
                    ? "bg-[var(--ink-900)] text-white shadow-xs"
                    : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                }`}
              >
                <Search className="h-3 w-3" aria-hidden="true" />
                <span>New Claim</span>
              </button>
            </div>
          )}

          {!isFollowUp && (
            <div
              role="group"
              aria-label="Claim input mode"
              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-0.5"
            >
              <button
                type="button"
                disabled={busy}
                aria-pressed={inputType === "text"}
                onClick={() => {
                  onTypeChange("text");
                  setError(null);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  inputType === "text"
                    ? "bg-white text-[var(--ink-900)] shadow-xs"
                    : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                }`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Headline</span>
              </button>

              <button
                type="button"
                disabled={busy}
                aria-pressed={inputType === "url"}
                onClick={() => {
                  onTypeChange("url");
                  setError(null);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  inputType === "url"
                    ? "bg-white text-[var(--ink-900)] shadow-xs"
                    : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Article URL</span>
              </button>
            </div>
          )}

          {!isFollowUp && inputType === "url" && claim.length === 0 && !busy && (
            <button
              type="button"
              onClick={handlePaste}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-700)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--ink-900)]"
            >
              <ClipboardPaste className="h-3 w-3" aria-hidden="true" />
              <span>Paste</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden text-[11px] text-[var(--ink-400)] sm:inline">
            {isFollowUp ? "Enter to ask" : "Enter to verify"}
          </span>
          <button
            type="submit"
            disabled={isDisabled}
            className="cta-lime inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>{isFollowUp ? "Thinking" : "Verifying"}</span>
              </>
            ) : (
              <>
                <span>{isFollowUp ? "Ask" : "Verify"}</span>
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
