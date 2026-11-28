"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MINIMAL_LINKS = [
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
] as const;

const FULL_LINKS = [
  { href: "/verify", label: "Verify" },
  { href: "/history", label: "History" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const isMinimalSurface = pathname === "/" || pathname === "/verify";
  const links = isMinimalSurface ? MINIMAL_LINKS : FULL_LINKS;

  return (
    <header className="pointer-events-none sticky top-2.5 z-50 flex w-full justify-end pl-5 pr-8 pt-2 sm:pl-8 sm:pr-12">
      <nav
        aria-label="Primary navigation"
        className="pointer-events-auto inline-flex items-center gap-5 rounded-2xl border border-white/60 bg-white/30 px-5 py-2.5 shadow-[0_8px_24px_-8px_rgba(15,15,26,0.12)] backdrop-blur-md sm:gap-7 sm:px-6"
      >
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`text-sm font-medium tracking-tight transition-opacity ${
                isActive
                  ? "text-[var(--ink-900)] underline decoration-[var(--lime)] decoration-2 underline-offset-4"
                  : "text-[var(--ink-900)] hover:opacity-75"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
