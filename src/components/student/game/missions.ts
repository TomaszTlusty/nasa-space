import type { PointAnalysis } from "@/lib/analysis/types";
import { DAY, type RegionId, type WindowDays } from "@/lib/store";

/**
 * "Mission: Survive" definitions and scoring. Scoring reads only the real analysis result of
 * lander A (`usePointAnalysis('A')`): there is no separate game simulation.
 *
 * Goal thresholds follow NASA's landing-site screening: slope < 10 deg, Earth visible >= 25% of the
 * time (NASA HLS 2024 slides, https://ntrs.nasa.gov/citations/20240009596).
 * Mission windows were picked by scanning the precomputed horizon grid: each has spots that pass,
 * and the helper map shows where they are.
 */

export const EARTH_GOAL_SOURCE = "https://ntrs.nasa.gov/citations/20240009596";
/** Steepest ground the lander may stand on (NASA landing-site screening, EARTH_GOAL_SOURCE). */
export const MAX_SLOPE_DEG = 10;
/** IM-1 touched down on a ~12 deg slope and tipped over (Feb 2024). */
export const TIP_OVER_SOURCE =
  "https://arstechnica.com/science/2024/02/that-moment-when-you-land-on-the-moon-break-a-leg-and-are-about-to-topple-over/";

export type MissionId = "first-light" | "long-shadow" | "deep-survey";

export interface Mission {
  id: MissionId;
  title: string;
  regionId: RegionId;
  regionName: string;
  /** short region label for compact rows */
  regionShort: string;
  /** mission window start (landing), ms UTC */
  start: number;
  days: WindowDays;
  /** the battery must stay above 0% for at least this many days */
  minDays: number;
  /** fraction of the window with any part of Earth visible, 0..1 */
  minEarth: number;
  difficulty: 1 | 2 | 3;
  /** one-line story shown on the brief card */
  story: string;
  hint: string;
}

export const MISSIONS: Mission[] = [
  {
    id: "first-light",
    title: "First light",
    regionId: "shackleton",
    regionName: "Shackleton & Connecting Ridge",
    regionShort: "Shackleton",
    start: Date.UTC(2027, 0, 13),
    days: 7,
    minDays: 7,
    minEarth: 0.25,
    difficulty: 1,
    story: "Land near Shackleton crater in January 2027 and keep your lander alive for one week.",
    hint: "High ridges catch the low Sun. Crater floors stay dark.",
  },
  {
    id: "long-shadow",
    title: "Long shadow",
    regionId: "malapert",
    regionName: "Malapert Massif",
    regionShort: "Malapert",
    start: Date.UTC(2027, 3, 15),
    days: 7,
    minDays: 7,
    minEarth: 0.25,
    difficulty: 2,
    story: "April 2027 is a darker season near the pole: the Sun barely clears the hills. Survive a week at Malapert.",
    hint: "Only a few peaks stay lit. Turn on the helper map and look for the brightest spots.",
  },
  {
    id: "deep-survey",
    title: "Deep survey",
    regionId: "shackleton",
    regionName: "Shackleton & Connecting Ridge",
    regionShort: "Shackleton",
    start: Date.UTC(2027, 10, 1),
    days: 15,
    minDays: 10,
    minEarth: 0.6,
    difficulty: 3,
    story: "A long science mission in November 2027: stay powered for 10 days and keep Earth in view most of the time.",
    hint: "You need a spot that sees the Sun and Earth. Earth sits low over the near side of the Moon.",
  },
];

export type Rank = "Cadet" | "Navigator" | "Mission Specialist" | "Flight Director";
export const RANKS: Rank[] = ["Cadet", "Navigator", "Mission Specialist", "Flight Director"];

export interface MissionResult {
  missionId: MissionId;
  /** whole window survived without the battery hitting 0% */
  survivedWindow: boolean;
  /** days the battery stayed above 0% (capped at the window length) */
  aliveDays: number;
  minSocPct: number;
  /** share of hours with any sunlight, 0..1 */
  sunUp: number;
  /** share of hours with any part of Earth visible, 0..1 (analysis `earthMean`) */
  earthUp: number;
  longestDarkHours: number;
  longestEarthGapHours: number;
  slopeDeg: number;
  /** ground steeper than MAX_SLOPE_DEG: the lander tipped over on touchdown */
  tipped: boolean;
  goalSurvive: boolean;
  goalEarth: boolean;
  /** 0..100 */
  score: number;
  rank: Rank;
  sentences: [string, string];
}

const pct = (f: number) => Math.round(f * 100);

/** Plain-language duration: hours below two days, else days with at most one decimal. */
export function duration(hours: number): string {
  if (hours < 48) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${(hours / 24).toFixed(1).replace(/\.0$/, "")} days`;
}

export function scoreMission(mission: Mission, a: PointAnalysis): MissionResult {
  const { series, power } = a;
  const n = series.sunFraction.length;
  let lit = 0;
  for (const v of series.sunFraction) if (v > 0) lit++;
  const sunUp = n > 0 ? lit / n : 0;
  const earthUp = a.earthMean;
  const longestEarthGapHours = a.longestBlackoutHours;
  const longestDarkHours = a.longestDarkHours;

  const survivedWindow = power.depletedAt === null;
  const aliveDays = survivedWindow
    ? mission.days
    : Math.min(mission.days, Math.max(0, ((power.depletedAt ?? series.start) - series.start) / DAY));
  const minSocPct = Math.max(0, power.minSocPct);
  const goalSurvive = aliveDays >= mission.minDays;
  const goalEarth = earthUp >= mission.minEarth;
  const slopeDeg = a.slopeDeg;
  const tipped = slopeDeg > MAX_SLOPE_DEG;

  const raw =
    45 * Math.min(1, aliveDays / mission.minDays) +
    25 * (minSocPct / 100) +
    30 * Math.min(1, earthUp / mission.minEarth);
  // A tipped lander fails the mission whatever the light was; it keeps a token score for the numbers.
  const score = Math.round(tipped ? raw * 0.25 : raw);
  const rank: Rank = tipped
    ? "Cadet"
    : goalSurvive && goalEarth
      ? score >= 85
        ? "Flight Director"
        : "Mission Specialist"
      : goalSurvive || goalEarth || score >= 50
        ? "Navigator"
        : "Cadet";

  const slope = Math.round(slopeDeg);
  let sentences: [string, string];
  if (tipped) {
    sentences = [
      `Your spot was tilted ${slope}°, steeper than the ${MAX_SLOPE_DEG}° safe limit, so the lander tipped over on touchdown, just like the IM-1 lander did on a 12° slope in 2024.`,
      `Standing upright there, it would have seen sunlight ${pct(sunUp)}% of the time and Earth ${pct(earthUp)}% of the time: look for flatter ground next time.`,
    ];
  } else {
    let power1: string;
    if (survivedWindow && minSocPct >= 99.5) {
      power1 =
        lit === n
          ? "Your spot saw sunlight every hour, so the battery stayed full the whole mission."
          : `Your spot saw sunlight ${pct(sunUp)}% of the time, and the battery stayed full the whole mission.`;
    } else if (survivedWindow) {
      power1 =
        longestDarkHours > 0
          ? `Your spot saw sunlight ${pct(sunUp)}% of the time, and the battery never fell below ${Math.round(minSocPct)}%, even through ${duration(longestDarkHours)} of darkness.`
          : `Your spot saw at least part of the Sun the whole mission, and the battery never fell below ${Math.round(minSocPct)}%.`;
    } else if (goalSurvive) {
      power1 = `Your spot saw sunlight ${pct(sunUp)}% of the time; the battery lasted ${aliveDays.toFixed(1).replace(/\.0$/, "")} days before ${duration(longestDarkHours)} of darkness drained it, which still meets the ${mission.minDays}-day goal.`;
    } else if (lit === 0) {
      power1 = `Your spot never saw the Sun during this mission, so the battery ran empty after ${duration(aliveDays * 24)}.`;
    } else {
      power1 = `Your spot saw sunlight only ${pct(sunUp)}% of the time, and ${duration(longestDarkHours)} of darkness emptied the battery on day ${Math.max(1, Math.ceil(aliveDays))}.`;
    }

    const goal = pct(mission.minEarth);
    let earth2: string;
    if (longestEarthGapHours === 0) {
      earth2 = "Earth stayed above your horizon the whole time, so mission control could hear you every hour.";
    } else if (earthUp === 0) {
      earth2 = `Earth never rose above the hills around you, so you could not radio home (goal: ${goal}% of the time).`;
    } else if (goalEarth) {
      earth2 = `Earth was in view ${pct(earthUp)}% of the time (goal: ${goal}%), but it was hidden for ${duration(longestEarthGapHours)} in a row.`;
    } else {
      earth2 = `Earth was in view only ${pct(earthUp)}% of the time (goal: ${goal}%) and was hidden for ${duration(longestEarthGapHours)} in a row.`;
    }
    sentences = [power1, earth2];
  }

  return {
    missionId: mission.id,
    survivedWindow,
    aliveDays,
    minSocPct,
    sunUp,
    earthUp,
    longestDarkHours,
    longestEarthGapHours,
    slopeDeg,
    tipped,
    goalSurvive,
    goalEarth,
    score,
    rank,
    sentences,
  };
}

/** Index of the hourly sample at or before `t`, plus the interpolation weight to the next one. */
export function sampleAt(series: PointAnalysis["series"], t: number): { i: number; j: number; f: number } {
  const n = series.sunFraction.length;
  const u = Math.max(0, (t - series.start) / (series.stepMinutes * 60_000));
  const i = Math.min(n - 1, Math.floor(u));
  const j = Math.min(n - 1, i + 1);
  return { i, j, f: j === i ? 0 : u - i };
}
