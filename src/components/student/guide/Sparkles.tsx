"use client";

import { motion, useReducedMotion } from "motion/react";
import { LUNA_COLORS as C } from "./moods";

const STAR = "M0 -5 Q0.9 -0.9 5 0 Q0.9 0.9 0 5 Q-0.9 0.9 -5 0 Q-0.9 -0.9 0 -5 Z";
const COLORS = [C.sun, C.lilac, C.teal, "oklch(0.97 0 0)"];
const COUNT = 9;

/**
 * A one-shot burst of little four-point stars around LUNA (~600 ms). Re-key with a new `burst` number to fire
 * again. Purely decorative; nothing under reduced motion.
 */
export function Sparkles({ burst }: { burst: number }) {
  const reduce = useReducedMotion();
  if (reduce || burst === 0) return null;
  return (
    <svg
      key={burst}
      viewBox="-60 -60 120 120"
      aria-hidden="true"
      className="pointer-events-none absolute inset-[-30%] size-[160%] overflow-visible"
    >
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2 + (i % 2) * 0.2;
        const dist = 38 + (i % 3) * 7;
        return (
          <motion.path
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size decorative set
            key={i}
            d={STAR}
            fill={COLORS[i % COLORS.length]}
            initial={{ opacity: 0, scale: 0.3, x: Math.cos(angle) * 14, y: Math.sin(angle) * 14 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.3, 1 - (i % 3) * 0.18, 0.5],
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
            }}
            transition={{ duration: 0.62, ease: [0.23, 1, 0.32, 1], delay: (i % 3) * 0.03 }}
          />
        );
      })}
    </svg>
  );
}
