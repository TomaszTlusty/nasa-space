"use client";

import { type ComponentType, type ReactNode, useMemo } from "react";
import { Stat } from "@/components/ui/panel";
import { analyzePoint, useLiveVisibility, useWindowAverage } from "@/lib/analysis";
import type { LoadedRegion } from "@/lib/moon/horizon";
import { type RegionId, useApp } from "@/lib/store";
import { deg, pct, useLanderAnalysis } from "./live";
import {
  brightestMoment,
  downslopePoint,
  earthriseMoment,
  findCraterFloor,
  findCraterRim,
  findRidge,
  placeAtSite,
} from "./sites";
import { SOURCES, type Source } from "./sources";

/**
 * The four "knowledge pills". Every step drives the real app (region, window, landers, camera, overlay,
 * playback) so the student sees the actual terrain answer the question; numbers come from the analysis
 * hooks, facts only from the cited sources.
 */

export type LessonId = "shadows" | "eternal-light" | "earth-dance" | "short-move";

export interface LessonEnv {
  /** loaded assets of the lesson's region */
  region: LoadedRegion;
  /** false once the student moved on; async steps must not touch the store after that */
  isCurrent: () => boolean;
}

export interface LessonStep {
  title: string;
  Body: ComponentType;
  source: Source;
  /** Puts the app into the state this step needs. Returns a short note when part of it had to be skipped. */
  apply?: (env: LessonEnv) => Promise<string | null> | string | null;
}

export interface Lesson {
  id: LessonId;
  title: string;
  summary: string;
  regionId: RegionId;
  steps: LessonStep[];
}

/** Lessons that look at a whole month use a 30-day window: one full lunar day fits in it. */
const MONTH = 30;

type Tone = "sun" | "earth" | "night" | "danger" | "ok" | "neutral";

interface ReadoutItem {
  label: string;
  /** null while the analysis is still computing */
  value: string | null;
  unit?: string;
  tone?: Tone;
  hint?: string;
}

function Readout({ items }: { items: ReadoutItem[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-lg bg-white/3 px-3 py-2.5 ring-1 ring-line">
      {items.map((item) => (
        <Stat
          key={item.label}
          size="sm"
          label={item.label}
          value={item.value ?? "—"}
          unit={item.value === null ? undefined : item.unit}
          hint={item.value === null ? "Calculating…" : item.hint}
          tone={item.value === null ? "neutral" : item.tone}
        />
      ))}
    </div>
  );
}

function Text({ children }: { children: ReactNode }) {
  return <p className="text-pretty text-fg-muted text-sm">{children}</p>;
}

function Num({ children }: { children: ReactNode }) {
  return <span className="tabular text-fg">{children}</span>;
}

/* ───────────────────────── 1 · Why are Moon shadows pitch black? ───────────────────────── */

/** Live Sun state at lander A, shown only once A is placed. */
function SunAtA() {
  const live = useLiveVisibility("A");
  const hasA = useApp((s) => s.landers.A !== undefined);
  if (!hasA) return null;
  return (
    <Readout
      items={[
        {
          label: "Sun height at A",
          value: live ? deg(live.sunElev) : null,
          unit: "°",
          tone: "sun",
        },
        {
          label: "Sun disc visible",
          value: live ? pct(live.sunVis) : null,
          unit: "%",
          tone: "sun",
        },
      ]}
    />
  );
}

function RimBody() {
  return (
    <>
      <Text>
        The rim of Shackleton crater is in full sunlight, yet the inside is black. The Sun is so low here that even
        small hills cast very long shadows.
      </Text>
      <SunAtA />
    </>
  );
}

function NoAirBody() {
  return (
    <>
      <Text>
        On Earth, air scatters sunlight into every shadow, so you can still see inside them. The Moon has almost no air,
        so nothing lights the shadows up: they stay pitch black.
      </Text>
      <SunAtA />
    </>
  );
}

function FloorBody() {
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  const hasB = useApp((s) => s.landers.B !== undefined);
  return (
    <>
      <Text>
        Deep crater floors near the pole can go without direct sunlight for ages. They get as cold as <Num>−238 °C</Num>{" "}
        (<Num>35 K</Num>), cold enough to keep water ice frozen.
      </Text>
      {hasB && (
        <Readout
          items={[
            {
              label: "Sunlight at B, 30 d",
              value: b ? pct(b.sunMean) : null,
              unit: "%",
              tone: "night",
            },
            {
              label: "B below rim A",
              value: a && b ? String(Math.round(a.elevationM - b.elevationM)) : null,
              unit: "m",
            },
          ]}
        />
      )}
    </>
  );
}

/* ─────────────────── 2 · Peaks of eternal light vs craters of eternal night ─────────────────── */

function AverageMapBody() {
  const stats = useWindowAverage(true);
  const shares = useMemo(() => {
    if (!stats || stats.sun.length === 0) return null;
    let sunny = 0;
    let dark = 0;
    for (const v of stats.sun) {
      if (v > 0.5) sunny++;
      else if (v < 0.02) dark++;
    }
    return { sunny: sunny / stats.sun.length, dark: dark / stats.sun.length };
  }, [stats]);
  return (
    <>
      <Text>
        This map colours every spot by its average sunlight over the next 30 days. Bright ground is sunny most of the
        time; dark ground almost never sees the Sun.
      </Text>
      <Readout
        items={[
          {
            label: "Map lit > half the time",
            value: shares ? pct(shares.sunny) : null,
            unit: "%",
            tone: "sun",
          },
          {
            label: "Map lit < 2% of the time",
            value: shares ? pct(shares.dark) : null,
            unit: "%",
            tone: "night",
          },
        ]}
      />
    </>
  );
}

function PeakVsPitBody() {
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  const landers = useApp((s) => s.landers);
  const km = landers.A && landers.B ? Math.hypot(landers.A.x - landers.B.x, landers.A.y - landers.B.y) / 1000 : null;
  return (
    <>
      <Text>
        A stands on Connecting Ridge; B sits on the floor of Shackleton crater
        {km !== null && (
          <>
            , <Num>{km.toFixed(0)} km</Num> away
          </>
        )}
        . Same Sun, same month, very different light.
      </Text>
      <Readout
        items={[
          {
            label: "Sunlight at A, 30 d",
            value: a ? pct(a.sunMean) : null,
            unit: "%",
            tone: "sun",
          },
          {
            label: "Sunlight at B, 30 d",
            value: b ? pct(b.sunMean) : null,
            unit: "%",
            tone: "night",
          },
        ]}
      />
    </>
  );
}

function WhyBody() {
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  return (
    <>
      <Text>
        At the pole the Sun circles only about <Num>1.5°</Num> above or below the horizon, so a high ridge peeks over
        the hills while a deep crater floor never can. Over many years, Connecting Ridge gets about <Num>76%</Num>{" "}
        sunlight.
      </Text>
      <Readout
        items={[
          {
            label: "Longest dark at A",
            value: a ? String(Math.round(a.longestDarkHours)) : null,
            unit: "h",
            tone: "night",
          },
          {
            label: "Longest dark at B",
            value: b ? String(Math.round(b.longestDarkHours)) : null,
            unit: "h",
            tone: "night",
          },
        ]}
      />
    </>
  );
}

/* ───────────────────────── 3 · Why does Earth dance in the sky? ───────────────────────── */

function FindEarthBody() {
  const live = useLiveVisibility("A");
  return (
    <>
      <Text>
        You are looking around from lander A. Find the small blue Earth near the skyline: its disc is only about{" "}
        <Num>2°</Num> wide.
      </Text>
      <Readout
        items={[
          {
            label: "Earth height",
            value: live ? deg(live.earthElev) : null,
            unit: "°",
            tone: "earth",
          },
          {
            label: "Earth disc visible",
            value: live ? pct(live.earthVis) : null,
            unit: "%",
            tone: "earth",
          },
        ]}
      />
    </>
  );
}

function BobBody() {
  const live = useLiveVisibility("A");
  return (
    <>
      <Text>
        Now one Earth day passes every second. Earth does not cross the sky like the Sun: it stays in roughly the same
        direction and slowly bobs up and down.
      </Text>
      <Readout
        items={[
          {
            label: "Earth height",
            value: live ? deg(live.earthElev) : null,
            unit: "°",
            tone: "earth",
          },
          {
            label: "Earth direction",
            value: live ? deg(live.earthAz) : null,
            unit: "°",
            tone: "earth",
          },
        ]}
      />
    </>
  );
}

function LibrationBody() {
  const live = useLiveVisibility("A");
  return (
    <>
      <Text>
        This wobble is called libration. Seen from the Moon, Earth sways up to <Num>6.7°</Num> up and down and{" "}
        <Num>7.9°</Num> side to side.
      </Text>
      <Readout
        items={[
          {
            label: "Earth height",
            value: live ? deg(live.earthElev) : null,
            unit: "°",
            tone: "earth",
          },
          {
            label: "Skyline under Earth",
            value: live ? deg(live.earthHorizon) : null,
            unit: "°",
          },
        ]}
      />
    </>
  );
}

function TwoWeeksBody() {
  const a = useLanderAnalysis("A");
  return (
    <>
      <Text>
        Near the pole, Earth spends about two weeks above the horizon and then about two weeks below it. While it is
        down, a lander cannot radio home directly.
      </Text>
      <Readout
        items={[
          {
            label: "Earth in view, 30 d",
            value: a ? pct(a.earthMean) : null,
            unit: "%",
            tone: "earth",
          },
          {
            label: "Longest blackout",
            value: a ? String(Math.round(a.longestBlackoutHours)) : null,
            unit: "h",
            tone: "danger",
          },
        ]}
      />
    </>
  );
}

/* ───────────────────────── 4 · How a short move saves a mission ───────────────────────── */

function NeighboursBody() {
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  const landers = useApp((s) => s.landers);
  const metres = landers.A && landers.B ? Math.hypot(landers.A.x - landers.B.x, landers.A.y - landers.B.y) : null;
  return (
    <>
      <Text>A is on Connecting Ridge. B is a short walk away, a little further down the slope.</Text>
      <Readout
        items={[
          {
            label: "Distance A to B",
            value: metres === null ? null : String(Math.round(metres)),
            unit: "m",
          },
          {
            label: "B lower than A",
            value: a && b ? String(Math.round(a.elevationM - b.elevationM)) : null,
            unit: "m",
          },
        ]}
      />
    </>
  );
}

function CountSunBody() {
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  const gap = a && b ? Math.round((a.sunMean - b.sunMean) * 100) : null;
  return (
    <>
      <Text>
        {gap === null ? (
          "Counting the hours of sunlight at both landers over the next 30 days…"
        ) : gap >= 3 ? (
          <>
            Over these 30 days B gets <Num>{gap}</Num> percentage points less sunlight than A. Lower ground hides behind
            nearby hills more often.
          </>
        ) : (
          "This month the two spots get about the same sunlight. Lower ground usually hides behind nearby hills more often; try a later date on the timeline."
        )}
      </Text>
      <Readout
        items={[
          {
            label: "Sunlight at A, 30 d",
            value: a ? pct(a.sunMean) : null,
            unit: "%",
            tone: "sun",
          },
          {
            label: "Sunlight at B, 30 d",
            value: b ? pct(b.sunMean) : null,
            unit: "%",
            tone: "sun",
          },
        ]}
      />
    </>
  );
}

function SurviveBody() {
  const a = useLanderAnalysis("A");
  const b = useLanderAnalysis("B");
  const battery = (depletedAt: number | null): Pick<ReadoutItem, "value" | "tone"> =>
    depletedAt === null ? { value: "Survives", tone: "ok" } : { value: "Runs out", tone: "danger" };
  return (
    <>
      <Text>
        Every dark hour runs on batteries, so the longest night decides how big the battery must be. Even on Connecting
        Ridge, the longest darkness can last about <Num>112 h</Num>.
      </Text>
      <Readout
        items={[
          {
            label: "Longest dark at A",
            value: a ? String(Math.round(a.longestDarkHours)) : null,
            unit: "h",
            tone: "night",
          },
          {
            label: "Longest dark at B",
            value: b ? String(Math.round(b.longestDarkHours)) : null,
            unit: "h",
            tone: "night",
          },
          {
            label: "Battery at A",
            ...(a ? battery(a.power.depletedAt) : { value: null }),
          },
          {
            label: "Battery at B",
            ...(b ? battery(b.power.depletedAt) : { value: null }),
          },
        ]}
      />
      <p className="mt-2 text-2xs text-fg-faint">
        Battery: example lander with vertical, sun-tracking solar panels (our assumption).
      </p>
    </>
  );
}

/* ───────────────────────── step setup ───────────────────────── */

const NO_RIDGE = "This map has no ridge site in its data, so LUNA-Bot skipped placing lander A.";
const NO_FLOOR = "This map has no crater-floor site in its data, so LUNA-Bot skipped placing lander B.";

/** Common start of a lesson step: paused, seen from orbit, 30-day window. */
function resetView(overlay: "none" | "instant" | "average") {
  const app = useApp.getState();
  app.setPlaying(false);
  app.setWindow(app.windowStart, MONTH);
  app.removeLander("A");
  app.removeLander("B");
  app.setCamera("orbit");
  app.setOverlay(overlay);
}

export const LESSONS: Lesson[] = [
  {
    id: "shadows",
    title: "Why are Moon shadows pitch black?",
    summary: "Sunlit rims, black craters, and the missing air.",
    regionId: "shackleton",
    steps: [
      {
        title: "Light and dark, side by side",
        Body: RimBody,
        source: SOURCES.svs4944,
        apply: async ({ region, isCurrent }) => {
          resetView("instant");
          const rim = findCraterRim(region.meta);
          if (!rim) return "This map has no crater-rim site in its data, so LUNA-Bot kept the current time.";
          placeAtSite("A", rim);
          const analysis = await analyzePoint(
            { x: rim.x, y: rim.y, siteId: rim.id, id: "A" },
            useApp.getState().windowStart,
            MONTH,
          );
          if (!isCurrent()) return null;
          const t = brightestMoment(analysis);
          if (t === null) return "The rim stays dark for this whole month. Try a later date on the timeline.";
          useApp.getState().setTime(t);
          return null;
        },
      },
      {
        title: "No air, no glow",
        Body: NoAirBody,
        source: SOURCES.amesShadows,
        apply: () => {
          const app = useApp.getState();
          app.setPlaying(false);
          if (!app.landers.A) return "Lander A is not placed, so the first-person view was skipped.";
          app.setActiveLander("A");
          app.setCamera("lander");
          return null;
        },
      },
      {
        title: "Night that never ends",
        Body: FloorBody,
        source: SOURCES.moonWater,
        apply: ({ region }) => {
          const app = useApp.getState();
          app.setPlaying(false);
          app.setCamera("orbit");
          app.setOverlay("instant");
          const floor = findCraterFloor(region.meta);
          if (!floor) return NO_FLOOR;
          placeAtSite("B", floor);
          return null;
        },
      },
    ],
  },
  {
    id: "eternal-light",
    title: "Peaks of eternal light vs craters of eternal night",
    summary: "Why a ridge and a crater floor next door live in different worlds.",
    regionId: "shackleton",
    steps: [
      {
        title: "A map of sunlight",
        Body: AverageMapBody,
        source: SOURCES.glaser2018,
        apply: () => {
          resetView("average");
          return null;
        },
      },
      {
        title: "Peak and pit",
        Body: PeakVsPitBody,
        source: SOURCES.glaser2018,
        apply: ({ region }) => {
          const app = useApp.getState();
          app.setPlaying(false);
          app.setCamera("orbit");
          app.setOverlay("average");
          const ridge = findRidge(region.meta);
          const floor = findCraterFloor(region.meta);
          if (floor) placeAtSite("B", floor);
          if (ridge) placeAtSite("A", ridge);
          if (ridge && floor) app.setActiveLander("A");
          return [ridge ? null : NO_RIDGE, floor ? null : NO_FLOOR].filter(Boolean).join(" ") || null;
        },
      },
      {
        title: "Why the difference?",
        Body: WhyBody,
        source: SOURCES.glaser2018,
      },
    ],
  },
  {
    id: "earth-dance",
    title: "Why does Earth dance in the sky?",
    summary: "Stand on the ridge and watch a month go by in seconds.",
    regionId: "shackleton",
    steps: [
      {
        title: "Find Earth",
        Body: FindEarthBody,
        source: SOURCES.hls2024,
        apply: async ({ region, isCurrent }) => {
          resetView("none");
          const site = findRidge(region.meta) ?? region.meta.sites[0];
          if (!site) return "This map has no landing sites in its data, so the first-person view was skipped.";
          placeAtSite("A", site);
          useApp.getState().setCamera("lander");
          const analysis = await analyzePoint(
            { x: site.x, y: site.y, siteId: site.id, id: "A" },
            useApp.getState().windowStart,
            MONTH,
          );
          if (!isCurrent()) return null;
          const t = earthriseMoment(analysis);
          if (t === null) return "Earth stays hidden from here for this whole month. Try a later date on the timeline.";
          useApp.getState().setTime(t);
          return null;
        },
      },
      {
        title: "One day per second",
        Body: BobBody,
        source: SOURCES.svs4944,
        apply: () => {
          const app = useApp.getState();
          if (app.landers.A) {
            app.setActiveLander("A");
            app.setCamera("lander");
          }
          app.setSpeed(24);
          app.setPlaying(true);
          return null;
        },
      },
      {
        title: "The libration wobble",
        Body: LibrationBody,
        source: SOURCES.hls2024,
      },
      {
        title: "Two weeks on, two weeks off",
        Body: TwoWeeksBody,
        source: SOURCES.hls2024,
      },
    ],
  },
  {
    id: "short-move",
    title: "How a short move saves a mission",
    summary: "Move a lander 300 m downhill and count the sunlight.",
    regionId: "shackleton",
    steps: [
      {
        title: "Two neighbours",
        Body: NeighboursBody,
        source: SOURCES.lola,
        apply: ({ region }) => {
          resetView("none");
          const ridge = findRidge(region.meta);
          if (!ridge) return NO_RIDGE;
          placeAtSite("A", ridge);
          const down = downslopePoint(region, ridge.x, ridge.y, 300);
          if (!down) return "There is no terrain data around the ridge, so LUNA-Bot skipped placing lander B.";
          const app = useApp.getState();
          app.placeLander("B", { x: down.x, y: down.y });
          app.setActiveLander("A");
          return null;
        },
      },
      {
        title: "Count the sunlight",
        Body: CountSunBody,
        source: SOURCES.glaser2018,
      },
      {
        title: "Surviving the night",
        Body: SurviveBody,
        source: SOURCES.glaser2018,
      },
    ],
  },
];
