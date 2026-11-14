"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/components/student/game/game-store";
import { useLessons } from "@/components/student/lessons/lesson-store";
import { pct, useLanderAnalysis } from "@/components/student/lessons/live";
import { SOURCES } from "@/components/student/lessons/sources";
import { analyzePoint, useLiveVisibility } from "@/lib/analysis";
import type { PointAnalysis } from "@/lib/analysis/types";
import { type LanderId, useApp } from "@/lib/store";
import { heightAt } from "@/lib/terrain";
import { fetchRegion } from "@/lib/use-region";
import { useGuide } from "./guide-store";

const INTRO_KEY = "malapert.luna-bot.intro";
/** A dark spot only counts as a crater floor when it sits this far below the region centre (metres). */
const CRATER_DEPTH_M = 1000;
const CRATER_CHECK_DAYS = 30;

/**
 * True only for a real cold trap: a named crater-floor site, or a spot that gets no sunlight at all over
 * 30 days AND lies more than 1 km below the region centre. A flank in its dark season is not a crater.
 */
async function isCraterFloor(analysis: PointAnalysis, siteId: string | undefined): Promise<boolean> {
  const s = useApp.getState();
  const region = await fetchRegion(s.regionId);
  const site = siteId ? region.meta.sites.find((x) => x.id === siteId) : undefined;
  if (site && /floor/i.test(site.name)) return true;
  const centreM = heightAt(region.meta, region.heights, 0, 0);
  if (centreM - analysis.elevationM <= CRATER_DEPTH_M) return false;
  const month =
    s.windowDays === CRATER_CHECK_DAYS
      ? analysis
      : await analyzePoint({ x: analysis.x, y: analysis.y, siteId, id: analysis.id }, s.windowStart, CRATER_CHECK_DAYS);
  return !month.series.sunFraction.some((v) => v > 0);
}

/**
 * Watches the app and queues LUNA's messages (with a matching mood) for the moments that teach something:
 * landing in a dark crater or a great spot, losing Earth, first-person view, sunrise/sunset while time plays,
 * and the end of a game mission. Silent while a lesson runs; the lesson already explains what is on screen.
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
      mood: "happy",
      once: true,
      text: hasLanderA
        ? "Hi, I'm LUNA! Your lander is already down on real Moon terrain near the south pole. Press play on the timeline and watch the light move!"
        : "Hi, I'm LUNA! We're floating over real Moon terrain near the south pole. Click anywhere on the ground to land your first lander!",
      source: SOURCES.lola,
    });
  }, [say, hasLanderA]);

  // Landing verdicts: one per placement, from the window-average sunlight.
  const darkChecked = useRef(new Set<string>());
  useEffect(() => {
    if (lessonActive) return;
    for (const [id, analysis] of [
      ["A", a],
      ["B", b],
    ] as const) {
      if (!analysis) continue;
      const spot = `${id}:${Math.round(analysis.x)}:${Math.round(analysis.y)}`;
      if (analysis.sunMean < 0.02) {
        if (darkChecked.current.has(spot)) continue;
        darkChecked.current.add(spot);
        const placement = useApp.getState().landers[id];
        isCraterFloor(analysis, placement?.siteId).then(
          (crater) => {
            const now = useApp.getState().landers[id];
            if (!now || Math.hypot(now.x - analysis.x, now.y - analysis.y) > 50) return;
            say(
              crater
                ? {
                    key: `crater:${spot}`,
                    kind: "crater",
                    mood: "cold",
                    once: true,
                    text: `Brrr! Lander ${id} landed on a crater floor that never sees the Sun. Floors like this can sit in the dark for ages and drop to about −238 °C. My visor is frosting up! Let's find higher ground.`,
                    source: SOURCES.paige2010,
                  }
                : {
                    key: `shadow:${spot}`,
                    kind: "crater",
                    mood: "worried",
                    once: true,
                    text: `Hmm, lander ${id} is in shadow for most of this window (${pct(analysis.sunMean)}% sunlight). The Sun sits so low here that nearby hills block it. Try higher ground, or a later date?`,
                    source: SOURCES.svs4944,
                  },
            );
          },
          () => darkChecked.current.delete(spot),
        );
      } else if (analysis.sunMean > 0.7) {
        say({
          key: `good:${spot}`,
          kind: "good-site",
          mood: "excited",
          once: true,
          text: `Great spot! Lander ${id} sees the Sun ${pct(analysis.sunMean)}% of the time in this window. Over many years, even the best ridge spots average under 90%.`,
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
      mood: "amazed",
      once: true,
      text: "Whoa, look around! At the pole the Sun doesn't rise and set like at home. It circles the sky, never more than about 1.5° above or below the horizon, skimming over the mountains.",
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
        mood: "sad",
        text:
          live.earthElev > 0
            ? "Oh no, a mountain is blocking Earth! No pictures home until it rises again."
            : `Earth just slipped below the horizon at lander ${id}, so no radio link home for a while. Near the pole, Earth is often up about two weeks and down about two weeks; high or Earth-facing spots see it longer.`,
        source: SOURCES.hls2024,
      });
    }
    if (playing && before.sun !== sun) {
      say({
        key: sun ? "sunrise" : "sunset",
        kind: "sun",
        mood: sun ? "excited" : "worried",
        text: sun
          ? `Sunrise at lander ${id}! Its solar panels are making power again.`
          : `Sunset at lander ${id}. Now it runs on its batteries until the Sun comes back.`,
        source: SOURCES.glaser2018,
      });
    }
  }, [live, placementKey, activeLander, playing, lessonActive, say]);

  // Game debrief: cheer (or comfort) when a mission result comes in.
  const phase = useGame((s) => s.phase);
  const result = useGame((s) => s.result);
  const announced = useRef(result);
  useEffect(() => {
    if (phase !== "result" || !result || announced.current === result) return;
    announced.current = result;
    const key = `game:${result.missionId}:${result.score}:${Date.now()}`;
    if (result.tipped) {
      say({
        key,
        kind: "game",
        mood: "worried",
        text: "Whoops, the lander tipped over on steep ground. Landers need slopes under 10°, so look for flatter ground next time!",
      });
    } else if (result.survivedWindow) {
      say({
        key,
        kind: "game",
        mood: "excited",
        text: `Mission complete! You earned the ${result.rank} badge. Your lander kept its lights on the whole time.`,
      });
    } else {
      say({
        key,
        kind: "game",
        mood: "sad",
        text: "The battery ran out this time. A sunnier spot keeps the lights on longer. Want to try again?",
      });
    }
  }, [phase, result, say]);
}
