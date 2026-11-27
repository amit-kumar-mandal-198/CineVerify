export default function Footer() {
  return (
    <footer className="border-t border-zinc-200/80 bg-zinc-50/75 px-4 py-6 text-sm text-zinc-600 backdrop-blur-xs dark:border-zinc-800/80 dark:bg-zinc-950/75 dark:text-zinc-400">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          CineVerify AI · OVERCLOCK 26 · Track SW-OI-1
        </p>
        <p className="text-xs">
          Focused on Indian cinema news verification — outputs are
          evidence-backed, not absolute truth.
        </p>
      </div>
    </footer>
  );
}
