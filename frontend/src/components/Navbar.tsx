"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Film, Menu, Sparkles, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/verify", label: "Verify Claim" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 w-full px-3 py-3 sm:px-6 lg:px-8">
      <header className="w-full rounded-2xl border border-zinc-200/80 bg-white/75 p-2 shadow-lg shadow-zinc-950/5 backdrop-blur-xl transition-all dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:shadow-black/30">
        <nav
          aria-label="Primary navigation"
          className="flex items-center justify-between px-3 sm:px-6"
        >
          {/* Modern Brand Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-zinc-950 shadow-md shadow-amber-500/20">
              <Film className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-amber-500 dark:text-zinc-50">
                CineVerify
              </span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                AI
              </span>
            </div>
          </Link>

          {/* Desktop Floating Pill Navigation */}
          <div className="hidden items-center gap-1 rounded-full border border-zinc-200/60 bg-zinc-100/60 p-1 md:flex dark:border-zinc-800/60 dark:bg-zinc-900/60">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Action CTA & Mobile Toggle */}
          <div className="flex items-center gap-2">
            <Link
              href="/verify"
              className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm shadow-amber-500/25 transition-all hover:brightness-110 sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Verify Claim</span>
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-2 text-zinc-600 transition-colors hover:bg-zinc-200 md:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div className="mt-2 space-y-1 rounded-xl border border-zinc-200/60 bg-zinc-50/90 p-2 backdrop-blur-md md:hidden dark:border-zinc-800/60 dark:bg-zinc-900/90">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-amber-500 text-zinc-950"
                      : "text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>
    </div>
  );
}
