"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { pct, useLanderAnalysis } from "@/components/student/lessons/live";
import { useLessons } from "@/components/student/lessons/lesson-store";
import { SOURCES } from "@/components/student/lessons/sources";
import { useLiveVisibility } from "@/lib/analysis";
import { type LanderId, useApp } from "@/lib/store";
import { useGuide } from "./guide-store";

const INTRO_KEY = "malapert.luna-bot.intro";

function Num({ children }: { children: ReactNode }) {
  return <span className="tabular text-fg">{children}</span>;
}

/**
 * Watches the app and queues LUNA-Bot messages for the moments that teach something: landing in a dark
 * crater or a great spot, losing Earth, first-person view, and sunrise/sunset while time plays.
 * Silent while a lesson runs; the lesson already explains what is on screen.
 */
export function useGuideEvents(): void {
  const say = useGuide((s) => s.say);
  const lessonActive = useLessons((s) => s.active !== null);
  const landers = useApp((s) => s.landers);
  const activeLander = useApp((s) => s.activeLander);
  const camera = useApp((s) => s.camera);
  const playing = useApp((s) => s.playing);
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  const live = useLiveVisibility(activeLander);

  // First visit to Student mode (persisted, so returning students are not greeted again).
  const hasLanderA = landers.A !== undefined;
  const introDone = useRef(false);
  useEffect(() => {
    if (introDone.current) return;
    introDone.current = true;
    if (window.localStorage.getItem(INTRO_KEY)) return;
    window.localStorage.setItem(INTRO_KEY, "1");
    say({
      key: "intro",
      kind: "intro",
      once: true,
      text: hasLanderA
        ? "Hi, I'm LUNA-Bot! This is real terrain near the Moon's south pole. Your lander is down; press play on the timeline and watch how the light moves."
        : "Hi, I'm LUNA-Bot! This is real terrain near the Moon's south pole. Click anywhere on the ground to land your first lander.",
      source: SOURCES.lola,
    });
  }, [say, hasLanderA]);

  // Landing verdicts: one per placement, from the window-average sunlight.
  useEffect(() => {
    if (lessonActive) return;
    for (const [id, analysis] of [
      ["A", a],
      ["B", b],
    ] as const) {
      if (!analysis) continue;
      const spot = `${id}:${Math.round(analysis.x)}:${Math.round(analysis.y)}`;
      if (analysis.sunMean < 0.02) {
        say({
          key: `crater:${spot}`,
          kind: "crater",
          once: true,
          text: (
            <>
              Lander {id} landed in a crater that gets almost no sunlight (<Num>{pct(analysis.sunMean)}%</Num> this
              window). Floors like this can sit in the dark for ages and drop to about <Num>−238 °C</Num>. Let's find
              higher ground!
            </>
          ),
          source: SOURCES.moonWater,
        });
      } else if (analysis.sunMean > 0.7) {
        say({
          key: `good:${spot}`,
          kind: "good-site",
          once: true,
          text: (
            <>
              Great spot! Lander {id} sees the Sun <Num>{pct(analysis.sunMean)}%</Num> of the time in this window. For
              comparison, Connecting Ridge, one of the sunniest places at the pole, gets about <Num>76%</Num>.
            </>
          ),
          source: SOURCES.glaser2018,
        });
      }
    }
  }, [a, b, lessonActive, say]);

  // First-person view: explain the polar Sun once.
  const prevCamera = useRef(camera);
  useEffect(() => {
    const entered = prevCamera.current !== "lander" && camera === "lander";
    prevCamera.current = camera;
    if (!entered || lessonActive) return;
    say({
      key: "first-person",
      kind: "first-person",
      once: true,
      text: (
        <>
          At the pole the Sun doesn't rise and set like at home: it circles the sky, never more than about{" "}
          <Num>1.5°</Num> above or below the horizon, skimming just over the mountains.
        </>
      ),
      source: SOURCES.svs4944,
    });
  }, [camera, lessonActive, say]);

  // Earth link and Sun transitions at the playhead for the active lander.
  const placement = landers[activeLander];
  const placementKey = placement ? `${activeLander}:${placement.x}:${placement.y}` : null;
  const prev = useRef<{ key: string; sun: boolean; earth: boolean } | null>(null);
  useEffect(() => {
    if (!live || !placementKey) {
      prev.current = null;
      return;
    }
    const sun = live.sunVis > 0;
    const earth = live.earthVis > 0;
    const before = prev.current;
    prev.current = { key: placementKey, sun, earth };
    // Only real changes over time at the same spot count, never the jump caused by moving the lander.
    if (!before || before.key !== placementKey || lessonActive) return;
    const id: LanderId = activeLander;

    if (before.earth && !earth) {
      say({
        key: "earth-lost",
        kind: "earth",
        text:
          live.earthElev > 0
            ? "A mountain is blocking Earth! No pictures home until it rises again."
            : `Earth just slipped below the horizon at lander ${id}. Near the pole it is up for about two weeks, then down for about two weeks, so no direct radio link for a while.`,
        source: SOURCES.hls2024,
      });
    }
    if (playing && before.sun !== sun) {
      say({
        key: sun ? "sunrise" : "sunset",
        kind: "sun",
        text: sun
          ? `Sunrise at lander ${id}! Its solar panels are making power again.`
          : `Sunset at lander ${id}. From now on it runs on its batteries until the Sun comes back.`,
        source: SOURCES.glaser2018,
      });
    }
  }, [live, placementKey, activeLander, playing, lessonActive, say]);
}
