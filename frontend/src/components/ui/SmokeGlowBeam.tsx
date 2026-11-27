"use client";
import React from "react";
import { SparklesCore } from "@/components/ui/sparkles";

interface SmokeGlowBeamProps {
  particleColor?: string;
  className?: string;
}

export function SmokeGlowBeam({
  particleColor = "#ffffff",
  className = "",
}: SmokeGlowBeamProps) {
  return (
    <div
      className={`relative w-full h-32 pointer-events-none ${className}`}
    >
      {/* Soft ambient glow — no lines */}
      <div className="absolute inset-x-0 mx-auto w-3/5 top-0 h-16 bg-amber-500/10 blur-3xl rounded-full pointer-events-none dark:bg-amber-500/8" />

      {/* Particles only — soft elliptical fade, no box, no lines */}
      <SparklesCore
        background="transparent"
        minSize={0.6}
        maxSize={2.2}
        particleDensity={550}
        className="w-full h-full [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,white_30%,transparent_80%)]"
        particleColor={particleColor}
        speed={1.8}
      />
    </div>
  );
}

export default SmokeGlowBeam;
