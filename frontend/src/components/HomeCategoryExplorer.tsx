"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CategoryCard {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  sampleLabel: string;
  sampleClaim: string;
  tint: string;
}

const CATEGORIES: CategoryCard[] = [
  {
    id: "movie_announcement",
    emoji: "🎬",
    title: "Movie Announcements",
    tagline: "Official studio slates, sequels & director-actor pairings.",
    sampleLabel: "SRK & Sujoy Ghosh's King",
    sampleClaim: "Shah Rukh Khan and Sujoy Ghosh announce action thriller King",
    tint: "from-violet-100/90 to-indigo-50/70 border-violet-200/80",
  },
  {
    id: "casting",
    emoji: "🎭",
    title: "Casting Rumours",
    tagline: "Lead roles, surprise cameos & actor replacement buzz.",
    sampleLabel: "Rajamouli × Mahesh Babu",
    sampleClaim:
      "SS Rajamouli's next film with Mahesh Babu begins shooting in Hyderabad",
    tint: "from-amber-100/80 to-orange-50/60 border-amber-200/80",
  },
  {
    id: "release_update",
    emoji: "📅",
    title: "Release Dates",
    tagline: "Theatrical schedules, postponements & OTT premieres.",
    sampleLabel: "Pushpa 3 Christmas 2027",
    sampleClaim: "Pushpa 3 releasing on Christmas 2027",
    tint: "from-sky-100/80 to-cyan-50/60 border-sky-200/80",
  },
  {
    id: "box_office",
    emoji: "💰",
    title: "Box-Office Claims",
    tagline: "Nett vs. worldwide gross milestones & trade records.",
    sampleLabel: "Kalki 2898 AD ₹1000 Cr",
    sampleClaim: "Kalki 2898 AD crossed 1000 crore worldwide at the box office",
    tint: "from-emerald-100/80 to-lime-50/60 border-emerald-200/80",
  },
];

export default function HomeCategoryExplorer() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      style={{ perspective: "1000px" }}
    >
      {CATEGORIES.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.35, delay: index * 0.06 }}
          whileHover={{
            y: -6,
            rotateX: 3,
            rotateY: -2,
            scale: 1.015,
            transition: { type: "spring", stiffness: 320, damping: 22 },
          }}
          className="h-full"
        >
          <Link
            href={`/verify?claim=${encodeURIComponent(item.sampleClaim)}&type=text`}
            className="glass-card group flex h-full flex-col justify-between p-5 transition-shadow duration-200 hover:border-[var(--border-strong)] hover:bg-white/90 hover:shadow-[0_18px_36px_-14px_rgba(40,40,110,0.22)]"
          >
            <div>
              {/* 3D-style floating emoji badge */}
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br text-2xl shadow-[0_6px_14px_-4px_rgba(26,26,51,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 ${item.tint}`}
                aria-hidden="true"
              >
                {item.emoji}
              </div>

              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink-900)]">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-500)]">
                {item.tagline}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-3">
              <span className="truncate text-[11px] font-semibold text-[var(--ink-900)]">
                Try: {item.sampleLabel}
              </span>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-tint)] text-[var(--ink-900)] transition-colors group-hover:bg-[var(--lime-500)]">
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
