import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clapperboard,
  Cpu,
  FileCheck2,
  Globe,
  SearchCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { SmokeGlowBeam } from "@/components/ui/SmokeGlowBeam";

const SUPPORTED_CATEGORIES = [
  {
    title: "Movie Announcements",
    description:
      "Verify official project announcements, director-actor collaborations, and studio slates.",
    icon: Clapperboard,
  },
  {
    title: "Casting",
    description:
      "Check viral casting rumours, cameo speculations, and replacement reports against trade outlets.",
    icon: Users,
  },
  {
    title: "Release Updates",
    description:
      "Confirm theatrical release dates, postponements, and OTT streaming premiere schedules.",
    icon: CalendarClock,
  },
  {
    title: "Box-Office",
    description:
      "Cross-check gross collection milestones and record claims against credible trade trackers.",
    icon: TrendingUp,
  },
] as const;

const PIPELINE_STEPS = [
  {
    step: "01",
    title: "Claim Extraction",
    description:
      "Normalizes headlines or article URLs into a concise core claim and extracts cinema entities.",
    icon: SearchCheck,
  },
  {
    step: "02",
    title: "Evidence Retrieval",
    description:
      "Searches trusted Indian entertainment trade sources for corroborating or refuting articles.",
    icon: Globe,
  },
  {
    step: "03",
    title: "NLI Verification",
    description:
      "Evaluates each source's stance (supports, contradicts, neutral) alongside source credibility.",
    icon: Cpu,
  },
  {
    step: "04",
    title: "Grounded Report",
    description:
      "Produces an explainable verdict with confidence meter and linked source snippets.",
    icon: FileCheck2,
  },
] as const;

export default function Home() {
  return (
    <main className="text-zinc-900 dark:text-zinc-50">
      {/* Hero section */}
      <section className="relative flex flex-col items-center justify-center pb-14 pt-16 text-center sm:pt-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center space-y-4 px-4 sm:px-6">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Evidence-Backed Indian Cinema Fact-Checking
          </h1>
        </div>

        {/* Aceternity-style glowing beam — full viewport width, same height */}
        <SmokeGlowBeam className="-mt-2 mb-1" particleColor="#ffffff" />

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center space-y-4 px-4 sm:px-6">
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
            CineVerify AI verifies Indian film rumours, viral headlines, and
            entertainment news links by retrieving real trade coverage and
            running Natural Language Inference before issuing a verdict.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
            >
              <span>Verify a Claim</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              View Recent Checks
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Supported Categories */}
      <section className="border-t border-zinc-200/80 bg-white/40 py-14 backdrop-blur-xs dark:border-zinc-800/80 dark:bg-zinc-950/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 space-y-1">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              4 Supported Categories
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Focused coverage tailored to Indian cinema news across Bollywood
              and regional industries.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SUPPORTED_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.title}
                  className="rounded-xl border border-zinc-200/80 bg-white/70 p-5 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/60"
                >
                  <Icon
                    className="h-5 w-5 text-amber-500"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {category.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {category.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How Verification Works */}
      <section className="border-t border-zinc-200/80 bg-zinc-50/30 py-14 backdrop-blur-xs dark:border-zinc-800/80 dark:bg-zinc-950/20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 space-y-1">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              How Verification Works
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every verdict is grounded in retrieved evidence — when credible
              sources are missing, the claim stays Unverified.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="rounded-xl border border-zinc-200/80 bg-white/70 p-5 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                      STEP {item.step}
                    </span>
                    <Icon
                      className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
