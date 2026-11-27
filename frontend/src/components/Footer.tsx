export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-white/35 px-4 py-7 text-sm text-[var(--ink-500)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <p className="font-serif text-sm font-semibold text-[var(--ink-900)]">
          CineVerify AI · OVERCLOCK 26 · Track SW-OI-1
        </p>
        <p className="text-xs text-[var(--ink-500)]">
          Focused on Indian cinema news verification — outputs are
          evidence-backed, not absolute truth.
        </p>
      </div>
    </footer>
  );
}
