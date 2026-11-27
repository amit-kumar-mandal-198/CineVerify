"use client";
import React, { useId, useEffect } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import type { Container, Engine } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { motion, useAnimation } from "framer-motion";

type ParticlesProps = {
  id?: string;
  className?: string;
  background?: string;
  particleSize?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
};

export const SparklesCore = (props: ParticlesProps) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    speed,
    particleColor,
    particleDensity,
  } = props;

  const controls = useAnimation();
  const generatedId = useId();

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      void controls.start({
        opacity: 1,
        transition: { duration: 0.8 },
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void controls.start({
        opacity: 1,
        transition: { duration: 0.8 },
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [controls]);

  return (
    <ParticlesProvider
      init={async (engine: Engine) => {
        await loadSlim(engine);
      }}
    >
      <motion.div
        animate={controls}
        initial={{ opacity: 0 }}
        className={`h-full w-full ${className || ""}`}
      >
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={{
            background: {
              color: { value: background || "transparent" },
            },
            fullScreen: { enable: false, zIndex: 1 },
            fpsLimit: 120,
            interactivity: {
              events: {
                onClick: { enable: true, mode: "push" },
                onHover: { enable: false },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                resize: true as any,
              },
              modes: {
                push: { quantity: 4 },
              },
            },
            particles: {
              color: { value: particleColor || "#ffffff" },
              move: {
                enable: true,
                direction: "none",
                speed: { min: 0.2, max: 1.4 },
                straight: false,
                outModes: { default: "out" },
              },
              number: {
                density: { enable: true, width: 500, height: 500 },
                value: particleDensity || 200,
              },
              opacity: {
                value: { min: 0.2, max: 1 },
                animation: {
                  enable: true,
                  speed: speed || 2.5,
                  startValue: "random",
                },
              },
              shape: { type: "circle" },
              size: {
                value: { min: minSize || 0.6, max: maxSize || 1.8 },
              },
            },
            detectRetina: true,
          }}
        />
      </motion.div>
    </ParticlesProvider>
  );
};
