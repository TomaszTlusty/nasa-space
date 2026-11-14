"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const R = 34;
const CIRC = 2 * Math.PI * R;

/**
 * Countdown to a `performance.now()` deadline. The ring sweeps smoothly with rAF; with reduced
 * motion it only moves once per second. `onDone` fires once when the time runs out.
 */
export function CountdownRing({
  deadline,
  totalSeconds,
  reducedMotion,
  onDone,
}: {
  deadline: number;
  totalSeconds: number;
  reducedMotion: boolean;
  onDone: () => void;
}) {
  const arc = useRef<SVGCircleElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));

  useEffect(() => {
    let raf = 0;
    let fired = false;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      const whole = Math.ceil(left / 1000);
      setSeconds(whole);
      const shown = reducedMotion ? whole : left / 1000;
      arc.current?.setAttribute("stroke-dashoffset", String(CIRC * (1 - shown / totalSeconds)));
      if (left <= 0) {
        if (!fired) {
          fired = true;
          done.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [deadline, totalSeconds, reducedMotion]);

  const urgent = seconds <= 10;
  return (
    <div
      className="relative size-24 shrink-0"
      role="timer"
      aria-label={`${seconds} seconds left to pick a landing spot`}
    >
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={R} fill="none" strokeWidth="4" className="stroke-white/8" />
        <circle
          ref={arc}
          cx="40"
          cy="40"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={0}
          className={cn("transition-[stroke] duration-200", urgent ? "stroke-danger" : "stroke-sun")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className={cn("tabular text-2xl", urgent ? "text-danger" : "text-fg")}>{seconds}</span>
        <span className="eyebrow -mt-0.5">sec</span>
      </div>
    </div>
  );
}
