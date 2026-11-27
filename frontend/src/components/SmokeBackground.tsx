"use client";

import { useEffect, useRef } from "react";

type SmokeHue = "pink" | "pinkSoft" | "sky" | "skySoft" | "white";

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  growthRate: number;
  aspectX: number;
  aspectY: number;
  alpha: number;
  maxAlpha: number;
  fadeInRate: number;
  fadeOutRate: number;
  state: "fadeIn" | "fadeOut";
  rotation: number;
  rotationSpeed: number;
  hue: SmokeHue;
}

interface SmokeRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  bandWidth: number;
  alpha: number;
  maxAlpha: number;
  hue: SmokeHue;
}

const SMOKE_PALETTES: Record<SmokeHue, { r: number; g: number; b: number }> = {
  pink: { r: 244, g: 114, b: 182 }, // soft rose pink
  pinkSoft: { r: 251, g: 182, b: 206 }, // pastel pink mist
  sky: { r: 56, g: 189, b: 248 }, // airy sky blue
  skySoft: { r: 125, g: 211, b: 252 }, // soft sky mist
  white: { r: 255, g: 255, b: 255 }, // luminous white mist
};

const HUE_WEIGHTS: ReadonlyArray<SmokeHue> = [
  "pink",
  "pinkSoft",
  "pinkSoft",
  "sky",
  "skySoft",
  "skySoft",
  "white",
  "white",
  "white",
];

const RIPPLE_HUES: ReadonlyArray<SmokeHue> = ["skySoft", "pinkSoft", "white"];

/**
 * Full-viewport ambient smoke backdrop in pink, sky blue, and white.
 * Combines slow atmospheric plumes, rising wisps, a silky damped cursor
 * glow veil, and feathered interactive smoke ripples that displace mist.
 */
export default function SmokeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let animationFrameId: number | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const syncCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncCanvasSize();

    // Spring-damped cursor state for the silky ambient veil
    const pointer = {
      targetX: width / 2,
      targetY: height / 2,
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      presence: 0,
      active: false,
    };

    const MAX_PARTICLES = 50;
    const MAX_RIPPLES = 18;
    const particles: SmokeParticle[] = [];
    const ripples: SmokeRipple[] = [];
    let rippleHueIndex = 0;

    function createParticle(x?: number, y?: number): SmokeParticle {
      const hue = HUE_WEIGHTS[Math.floor(Math.random() * HUE_WEIGHTS.length)];
      const isWhite = hue === "white";

      return {
        x: x ?? Math.random() * width,
        y: y ?? height + 80 - Math.random() * (height * 0.95),
        vx: (Math.random() - 0.5) * 0.38,
        vy: -0.16 - Math.random() * 0.3,
        radius: 115 + Math.random() * 110,
        maxRadius: 255 + Math.random() * 200,
        growthRate: 0.18 + Math.random() * 0.22,
        aspectX: 1.3 + Math.random() * 0.5,
        aspectY: 0.78 + Math.random() * 0.25,
        alpha: 0,
        maxAlpha: isWhite
          ? 0.42 + Math.random() * 0.2
          : 0.2 + Math.random() * 0.13,
        fadeInRate: 0.0024 + Math.random() * 0.0028,
        fadeOutRate: 0.0011 + Math.random() * 0.0017,
        state: "fadeIn",
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.0024,
        hue,
      };
    }

    function spawnParticle(x?: number, y?: number) {
      if (particles.length < MAX_PARTICLES) {
        particles.push(createParticle(x, y));
      }
    }

    function spawnRipple(x: number, y: number, strong: boolean, hueOverride?: SmokeHue) {
      if (ripples.length >= MAX_RIPPLES) {
        ripples.shift();
      }
      const hue =
        hueOverride ?? RIPPLE_HUES[rippleHueIndex++ % RIPPLE_HUES.length];

      ripples.push({
        x,
        y,
        radius: strong ? 18 : 22,
        maxRadius: strong ? 240 : 155,
        speed: strong ? 3.8 : 2.6,
        bandWidth: strong ? 140 : 110,
        alpha: strong ? 0.28 : 0.16,
        maxAlpha: strong ? 0.28 : 0.16,
        hue,
      });
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = createParticle(Math.random() * width, Math.random() * height);
      p.alpha = (0.35 + Math.random() * 0.65) * p.maxAlpha;
      p.radius += Math.random() * (p.maxRadius - p.radius) * 0.55;
      p.state = Math.random() > 0.45 ? "fadeOut" : "fadeIn";
      particles.push(p);
    }

    let lastRippleX = -9999;
    let lastRippleY = -9999;
    let lastRippleTime = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (!pointer.active) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }
      pointer.targetX = e.clientX;
      pointer.targetY = e.clientY;
      pointer.active = true;

      const now = performance.now();
      const dist = Math.hypot(e.clientX - lastRippleX, e.clientY - lastRippleY);
      if (dist >= 85 && now - lastRippleTime >= 110) {
        lastRippleX = e.clientX;
        lastRippleY = e.clientY;
        lastRippleTime = now;
        spawnRipple(e.clientX, e.clientY, false);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      lastRippleX = e.clientX;
      lastRippleY = e.clientY;
      lastRippleTime = performance.now();

      const primaryHue = RIPPLE_HUES[rippleHueIndex++ % RIPPLE_HUES.length];
      spawnRipple(e.clientX, e.clientY, true, primaryHue);
      // Ultra-soft inner white echo wave that melts into the mist
      if (ripples.length >= MAX_RIPPLES) {
        ripples.shift();
      }
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 8,
        maxRadius: 185,
        speed: 3.0,
        bandWidth: 115,
        alpha: 0.24,
        maxAlpha: 0.24,
        hue: "white",
      });
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    window.addEventListener("resize", syncCanvasSize);
    if (!prefersReducedMotion) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerdown", handlePointerDown, { passive: true });
      document.addEventListener("pointerleave", handlePointerLeave);
    }

    let time = 0;

    const drawFrame = () => {
      time += 0.0075;
      ctx.clearRect(0, 0, width, height);

      // Silky low-pass glide so cursor veil follows smoothly
      const prevX = pointer.x;
      const prevY = pointer.y;
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;
      pointer.vx = pointer.x - prevX;
      pointer.vy = pointer.y - prevY;

      const targetPresence = pointer.active ? 1 : 0;
      pointer.presence += (targetPresence - pointer.presence) * 0.045;

      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      // Advance active smoke ripples first so ambient wisps react to the waves
      if (!prefersReducedMotion) {
        for (let r = ripples.length - 1; r >= 0; r--) {
          const wave = ripples[r];
          wave.radius += wave.speed;
          wave.bandWidth += 0.9; // diffuse outward as it blends into background
          wave.speed *= 0.985;
          const progress = wave.radius / wave.maxRadius;
          wave.alpha = wave.maxAlpha * Math.pow(Math.max(0, 1 - progress), 2.1);

          if (wave.radius >= wave.maxRadius || wave.alpha <= 0.003) {
            ripples.splice(r, 1);
          }
        }
      }

      // 1. Ambient full-page pink, sky blue, and white smoke wisps
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          const windX = Math.sin(time + p.y * 0.0035) * 0.26;
          const windY = Math.cos(time * 0.8 + p.x * 0.0035) * 0.11;

          // Feather-light sway from damped cursor
          let swayX = 0;
          let swayY = 0;
          if (pointer.presence > 0.02) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 260 && dist > 1) {
              const factor = (1 - dist / 260) * pointer.presence;
              swayX = (dx / dist) * factor * 0.3 + pointer.vx * factor * 0.09;
              swayY = (dy / dist) * factor * 0.3 + pointer.vy * factor * 0.09;
            }
          }

          // Smooth radial push from expanding smoke ripples
          for (let r = 0; r < ripples.length; r++) {
            const wave = ripples[r];
            const dx = p.x - wave.x;
            const dy = p.y - wave.y;
            const dist = Math.hypot(dx, dy);
            const delta = Math.abs(dist - wave.radius);
            if (delta < wave.bandWidth && dist > 1) {
              const strength = (1 - delta / wave.bandWidth) * (wave.alpha * 2.2);
              swayX += (dx / dist) * strength;
              swayY += (dy / dist) * strength;
            }
          }

          p.x += p.vx + windX + swayX;
          p.y += p.vy + windY + swayY;
          p.rotation += p.rotationSpeed;

          if (p.radius < p.maxRadius) {
            p.radius += p.growthRate;
          }

          if (p.state === "fadeIn") {
            p.alpha += p.fadeInRate;
            if (p.alpha >= p.maxAlpha) {
              p.alpha = p.maxAlpha;
              p.state = "fadeOut";
            }
          } else {
            p.alpha -= p.fadeOutRate;
          }

          if (
            p.alpha <= 0.004 ||
            p.y < -p.maxRadius * 1.2 ||
            p.x < -p.maxRadius * 1.2 ||
            p.x > width + p.maxRadius * 1.2
          ) {
            particles.splice(i, 1);
            spawnParticle(Math.random() * width, height + 80);
            continue;
          }
        }

        const color = SMOKE_PALETTES[p.hue];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.aspectX, p.aspectY);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius);
        gradient.addColorStop(
          0,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.82})`,
        );
        gradient.addColorStop(
          0.45,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.44})`,
        );
        gradient.addColorStop(
          0.78,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.13})`,
        );
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Heavily blurred, wide-feathered smoke ripples that melt into the backdrop
      if (!prefersReducedMotion && ripples.length > 0) {
        ctx.save();
        ctx.filter = "blur(16px)";
        for (let r = 0; r < ripples.length; r++) {
          const wave = ripples[r];
          const outerRadius = wave.radius + wave.bandWidth * 0.5;
          const innerRadius = Math.max(0, wave.radius - wave.bandWidth * 0.5);
          if (outerRadius <= 1) continue;

          const peakStop = Math.min(
            0.78,
            Math.max(
              0.22,
              (wave.radius - innerRadius) /
                Math.max(1, outerRadius - innerRadius),
            ),
          );
          const color = SMOKE_PALETTES[wave.hue];

          const ringGrad = ctx.createRadialGradient(
            wave.x,
            wave.y,
            innerRadius,
            wave.x,
            wave.y,
            outerRadius,
          );
          ringGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
          ringGrad.addColorStop(
            peakStop * 0.5,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${wave.alpha * 0.45})`,
          );
          ringGrad.addColorStop(
            peakStop,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${wave.alpha})`,
          );
          ringGrad.addColorStop(
            (peakStop + 1) * 0.5,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${wave.alpha * 0.42})`,
          );
          ringGrad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

          ctx.fillStyle = ringGrad;
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, outerRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 3. Silky spring-damped cursor glow veil (white -> sky blue -> pink)
      if (!prefersReducedMotion && pointer.presence > 0.01) {
        const mistRadius = 350;
        const glowAlpha = 0.22 * pointer.presence;

        const cursorGlow = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          mistRadius,
        );
        cursorGlow.addColorStop(0, `rgba(255, 255, 255, ${glowAlpha * 1.5})`);
        cursorGlow.addColorStop(
          0.35,
          `rgba(125, 211, 252, ${glowAlpha * 0.78})`,
        );
        cursorGlow.addColorStop(
          0.68,
          `rgba(249, 168, 212, ${glowAlpha * 0.6})`,
        );
        cursorGlow.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = cursorGlow;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, mistRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      while (particles.length < MAX_PARTICLES) {
        spawnParticle();
      }

      if (!prefersReducedMotion && !document.hidden) {
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    const handleVisibilityChange = () => {
      if (prefersReducedMotion) return;
      if (document.hidden) {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      } else if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    drawFrame();

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", syncCanvasSize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      style={{
        background:
          "linear-gradient(135deg, #ECF5FF 0%, #FCECF6 48%, #EFF7FF 100%)",
      }}
    >
      {/* Slow-drifting Pink smoke plume */}
      <div
        className="animate-smoke-1 pointer-events-none absolute -left-[16%] -top-[18%] h-[95vh] w-[95vw] rounded-full opacity-85 blur-[88px]"
        style={{
          background:
            "radial-gradient(circle at 42% 45%, rgba(244, 114, 182, 0.42) 0%, rgba(251, 182, 206, 0.32) 38%, transparent 72%)",
        }}
      />

      {/* Slow-drifting Sky Blue smoke plume */}
      <div
        className="animate-smoke-2 pointer-events-none absolute -right-[16%] -bottom-[16%] h-[95vh] w-[95vw] rounded-full opacity-90 blur-[88px]"
        style={{
          background:
            "radial-gradient(circle at 58% 55%, rgba(56, 189, 248, 0.40) 0%, rgba(125, 211, 252, 0.34) 40%, transparent 74%)",
        }}
      />

      {/* Luminous White + soft Pink/Sky cross-veil */}
      <div
        className="animate-smoke-3 pointer-events-none absolute left-[8%] top-[8%] h-[88vh] w-[88vw] rounded-full opacity-95 blur-[76px]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(255, 255, 255, 0.88) 0%, rgba(186, 230, 253, 0.35) 38%, rgba(251, 207, 232, 0.30) 64%, transparent 82%)",
        }}
      />

      {/* Gentle Pink, Sky Blue & White smoke wisps, ripples & silky cursor glow */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
