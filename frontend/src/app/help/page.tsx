import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  HelpCircle,
  Link2,
  SearchCheck,
  Sparkles,
} from "lucide-react";

const QUICK_STEPS = [
  {
    step: "01",
    title: "Paste a Claim or News Link",
    description:
      "Click the search bar on the home page (or go to Verify Claim) and enter either a cinema rumour/headline or paste an entertainment article URL.",
    icon: FileText,
  },
  {
    step: "02",
    title: "Live Trade Source Retrieval",
    description:
      "CineVerify AI extracts the core claim and entities, then retrieves live coverage from reputable Indian cinema trade and news outlets.",
    icon: SearchCheck,
  },
  {
    step: "03",
    title: "Natural Language Inference & Verdict",
    description:
      "Retrieved evidence is evaluated for corroboration or contradiction before issuing a grounded verdict (Verified, False, Misleading, or Unverified).",
    icon: CheckCircle2,
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "What types of claims can I check?",
    answer:
      "CineVerify AI is tuned for Indian cinema news across four beats: Movie Announcements, Casting, Release Updates, and Box Office figures.",
  },
  {
    question: "Can I submit a full news article link instead of text?",
    answer:
      "Yes. On the Verify Claim page, switch the input toggle to Article URL and paste any http:// or https:// entertainment news link.",
  },
  {
    question: "Why do some claims return UNVERIFIED?",
    answer:
      "CineVerify AI never guesses when proof is missing. If independent trade outlets neither confirm nor refute the claim, it returns UNVERIFIED.",
  },
  {
    question: "Where can I find claims I already checked?",
    answer:
      "Recent verifications appear at the bottom of the home page and in the full History archive, where you can filter by verdict or category.",
  },
] as const;

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>
      {/* Header */}
      <section className="space-y-3">
        <div className="glass-card inline-flex items-center gap-2 !rounded-full px-3.5 py-1 text-xs font-medium text-[var(--ink-900)]">
          <HelpCircle className="h-3.5 w-3.5 text-[var(--ink-900)]" aria-hidden="true" />
          <span className="font-semibold tracking-wide">Help &amp; Guide</span>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="text-[var(--ink-500)]">CineVerify AI</span>
        </div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--ink-900)] sm:text-3xl">
          How to Use CineVerify AI
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-500)] sm:text-base">
          Verify viral Indian cinema rumours, casting news, box-office milestones,
          and entertainment articles in seconds using live evidence retrieval.
        </p>
      </section>

      {/* 3-Step Walkthrough */}
      <section className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-[var(--ink-900)]">
          Quick Start Guide
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {QUICK_STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="glass-card space-y-2.5 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-[var(--ink-900)] p-2 text-[var(--lime)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs font-bold text-[var(--ink-400)]">
                    STEP {item.step}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--ink-900)]">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--ink-500)]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tips for Best Results */}
      <section className="glass-card space-y-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--ink-900)]" aria-hidden="true" />
          <h2 className="font-serif text-base font-semibold text-[var(--ink-900)]">
            Tips for Better Results
          </h2>
        </div>
        <ul className="grid gap-2.5 text-sm text-[var(--ink-500)] sm:grid-cols-2">
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-900)]" aria-hidden="true" />
            <span>
              Include the <strong className="text-[var(--ink-900)]">movie title or actor name</strong> clearly when checking short rumours.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-900)]" aria-hidden="true" />
            <span>
              Use <strong className="text-[var(--ink-900)]">Article URL mode</strong> when checking full entertainment news posts or viral links.
            </span>
          </li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-[var(--ink-900)]">
          Frequently Asked Questions
        </h2>
        <div className="grid gap-3">
          {FAQ_ITEMS.map((faq) => (
            <div key={faq.question} className="glass-card space-y-1.5 p-5">
              <h3 className="text-sm font-semibold text-[var(--ink-900)]">
                {faq.question}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--ink-500)]">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/verify"
          className="cta-lime inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          <span>Start Verifying</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/about"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/75 px-4 py-2.5 text-sm font-semibold text-[var(--ink-900)] transition-colors hover:border-[var(--border-strong)] hover:bg-white"
        >
          <span>Learn About CineVerify AI</span>
        </Link>
      </div>
    </main>
  );
}
