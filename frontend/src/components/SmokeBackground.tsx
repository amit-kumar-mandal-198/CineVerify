"use client";

import { useEffect, useRef } from "react";

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  growthRate: number;
  alpha: number;
  maxAlpha: number;
  fadeInRate: number;
  fadeOutRate: number;
  state: "fadeIn" | "fadeOut";
  rotation: number;
  rotationSpeed: number;
  hue: "silver" | "amber" | "slate";
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
}

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
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Mouse tracking for realistic smoke interaction
    const mouse = {
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      active: false,
    };
    let lastMouseX = mouse.x;
    let lastMouseY = mouse.y;

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.vx = (mouse.x - lastMouseX) * 0.15;
      mouse.vy = (mouse.y - lastMouseY) * 0.15;
      lastMouseX = mouse.x;
      lastMouseY = mouse.y;
      mouse.active = true;

      // Spawn an extra puff at mouse cursor on movement
      if (Math.hypot(mouse.vx, mouse.vy) > 1.5 && Math.random() < 0.4) {
        spawnParticle(mouse.x + (Math.random() - 0.5) * 40, mouse.y + (Math.random() - 0.5) * 40);
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    // Smoke particles pool
    const MAX_SMOKE_PARTICLES = 55;
    const smokeParticles: SmokeParticle[] = [];

    // Ambient floating embers/sparkles
    const MAX_SPARKLES = 40;
    const sparkles: SparkleParticle[] = [];

    const HUE_PALETTES = {
      silver: { r: 190, g: 200, b: 220 },
      amber: { r: 245, g: 175, b: 65 },
      slate: { r: 130, g: 150, b: 180 },
    };

    function createParticle(x?: number, y?: number): SmokeParticle {
      const hues: Array<"silver" | "amber" | "slate"> = ["silver", "silver", "amber", "slate"];
      const hue = hues[Math.floor(Math.random() * hues.length)];
      const startX = x ?? Math.random() * width;
      const startY = y ?? height + 40 - Math.random() * (height * 0.85);

      return {
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 0.65,
        vy: -0.35 - Math.random() * 0.6,
        radius: 60 + Math.random() * 80,
        maxRadius: 180 + Math.random() * 160,
        growthRate: 0.25 + Math.random() * 0.35,
        alpha: 0,
        maxAlpha: 0.16 + Math.random() * 0.18, // Clearly visible on dark & light
        fadeInRate: 0.003 + Math.random() * 0.004,
        fadeOutRate: 0.0018 + Math.random() * 0.0028,
        state: "fadeIn",
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.004,
        hue,
      };
    }

    function spawnParticle(x?: number, y?: number) {
      if (smokeParticles.length < MAX_SMOKE_PARTICLES) {
        smokeParticles.push(createParticle(x, y));
      }
    }

    // Pre-populate screen with mature particles so screen is immediately filled with smoke
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
      const p = createParticle(Math.random() * width, Math.random() * height);
      p.alpha = Math.random() * p.maxAlpha;
      p.radius += Math.random() * (p.maxRadius - p.radius) * 0.5;
      p.state = Math.random() > 0.4 ? "fadeOut" : "fadeIn";
      smokeParticles.push(p);
    }

    // Pre-populate sparkles
    for (let i = 0; i < MAX_SPARKLES; i++) {
      sparkles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.4,
        size: 0.8 + Math.random() * 1.8,
        alpha: Math.random() * 0.8,
        alphaSpeed: 0.01 + Math.random() * 0.02,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse decay
      mouse.vx *= 0.92;
      mouse.vy *= 0.92;

      // Draw and update smoke particles
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];

        // Organic wind turbulence
        const windX = Math.sin(time + p.y * 0.005) * 0.4;
        const windY = Math.cos(time + p.x * 0.005) * 0.15;

        // Mouse disturbance
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        let pushX = 0;
        let pushY = 0;
        if (dist < 180 && dist > 1) {
          const force = (1 - dist / 180) * 1.5;
          pushX = (dx / dist) * force + mouse.vx * 0.2;
          pushY = (dy / dist) * force + mouse.vy * 0.2;
        }

        p.x += p.vx + windX + pushX;
        p.y += p.vy + windY + pushY;
        p.rotation += p.rotationSpeed;

        if (p.radius < p.maxRadius) {
          p.radius += p.growthRate;
        }

        // Alpha lifecycle
        if (p.state === "fadeIn") {
          p.alpha += p.fadeInRate;
          if (p.alpha >= p.maxAlpha) {
            p.alpha = p.maxAlpha;
            p.state = "fadeOut";
          }
        } else {
          p.alpha -= p.fadeOutRate;
        }

        // Remove dead particle or replace
        if (p.alpha <= 0 || p.y < -p.maxRadius || p.x < -p.maxRadius || p.x > width + p.maxRadius) {
          smokeParticles.splice(i, 1);
          spawnParticle(Math.random() * width, height + 40);
          continue;
        }

        // Draw radial smoke puff
        const color = HUE_PALETTES[p.hue];
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.85})`);
        gradient.addColorStop(0.35, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.55})`);
        gradient.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.18})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Ensure constant smoke count
      while (smokeParticles.length < MAX_SMOKE_PARTICLES) {
        spawnParticle();
      }

      // Draw floating sparkles / cinema embers through smoke
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < sparkles.length; i++) {
        const s = sparkles[i];
        s.x += s.vx + Math.sin(time + s.y * 0.01) * 0.2;
        s.y += s.vy;
        s.alpha += s.alphaSpeed;

        if (s.alpha > 0.95) {
          s.alpha = 0.95;
          s.alphaSpeed = -Math.abs(s.alphaSpeed);
        } else if (s.alpha < 0.1) {
          s.alpha = 0.1;
          s.alphaSpeed = Math.abs(s.alphaSpeed);
        }

        if (s.y < -10 || s.x < -10 || s.x > width + 10) {
          s.x = Math.random() * width;
          s.y = height + 10;
        }

        ctx.fillStyle = `rgba(245, 200, 100, ${s.alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (!prefersReducedMotion && !document.hidden) {
        animationFrameId = requestAnimationFrame(render);
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
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen overflow-hidden select-none"
    >
      {/* Dynamic 60fps Volumetric Smoke Canvas covering entire viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />

      {/* Atmospheric deep haze layers */}
      <div
        className="animate-smoke-1 absolute -left-1/4 -top-1/4 h-[150%] w-[150%] rounded-full opacity-30 dark:opacity-25 pointer-events-none blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, rgba(245, 158, 11, 0.18), rgba(148, 163, 184, 0.12) 40%, transparent 68%)",
        }}
      />
      <div
        className="animate-smoke-2 absolute -right-1/4 -bottom-1/4 h-[150%] w-[150%] rounded-full opacity-25 dark:opacity-20 pointer-events-none blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 65% 65%, rgba(100, 116, 139, 0.22), rgba(217, 119, 6, 0.08) 45%, transparent 70%)",
        }}
      />

      {/* Cinematic theater vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.18)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
