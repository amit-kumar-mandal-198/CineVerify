"use client";

import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import SmokeBackground from "@/components/SmokeBackground";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Full-screen layout shell without outer boxed frames.
 * Renders the full-page pink/sky-blue/white smoke backdrop and floating
 * top-right navigation across the application.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <SmokeBackground />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
