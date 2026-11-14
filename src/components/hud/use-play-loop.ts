"use client";

import { useEffect } from "react";
import { DAY, HOUR, useApp } from "@/lib/store";

/** store writes per second while playing; the scene and HUD re-render at most this often */
const WRITE_HZ = 30;

/**
 * Advances the playhead while `playing`: `speed` simulated hours per real second, smooth sub-frame
 * accumulation, store writes throttled to ~30 Hz, stops at the window end. Mount once (Timeline does).
 */
export function usePlayLoop(): void {
  const playing = useApp((s) => s.playing);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastWrite = last;
    let t = useApp.getState().time;
    let written = t;

    const tick = (now: number) => {
      const s = useApp.getState();
      // the user scrubbed or jumped while playing: continue from there
      if (s.time !== written) t = s.time;
      const end = s.windowStart + s.windowDays * DAY;
      // clamp dt so a backgrounded tab does not leap days on return
      const dt = Math.min(now - last, 250) / 1000;
      last = now;
      t += dt * s.speed * HOUR;

      if (t >= end) {
        s.setTime(end);
        s.setPlaying(false);
        return;
      }
      if (now - lastWrite >= 1000 / WRITE_HZ) {
        lastWrite = now;
        s.setTime(t);
        written = useApp.getState().time;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
