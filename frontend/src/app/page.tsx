export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="max-w-xl text-center space-y-4">
        <span className="inline-block rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          OVERCLOCK 26 · Track SW-OI-1
        </span>
        <h1 className="text-4xl font-bold tracking-tight">CineVerify AI</h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          AI-Powered Indian Cinema News &amp; Rumour Verification System.
          Frontend skeleton ready — see{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            docs/api-contract.md
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            src/types/api.ts
          </code>
          .
        </p>
      </div>
    </main>
  );
}
