"use client";

import { analyzePoint, runDiscovery } from "@/lib/analysis";
import type { PointAnalysis } from "@/lib/analysis/types";
import { fromLocal, toLocal } from "@/lib/moon/frames";
import type { RegionMeta } from "@/lib/moon/types";
import { DATE_MAX, DATE_MIN, DAY, type LanderPlacement, useApp, type WindowDays } from "@/lib/store";
import { fetchRegion } from "@/lib/use-region";
import type {
  AnalyzeOutput,
  CompareOutput,
  ContextOutput,
  DiscoveryOutput,
  MissionUITools,
  PlaceOutput,
  PlaceRef,
  PointSummary,
  WindowInfo,
  WindowOutput,
} from "./tools";

/**
 * Browser-side executors for the assistant's tools. They read/write the shared store and call the
 * real analysis engine, then return compact, rounded JSON for the model. Throwing an Error turns
 * into a tool error the model can read.
 */

const WINDOW_DAYS: WindowDays[] = [1, 7, 15, 30];

/** NASA HLS landing-site screening thresholds (NTRS 20240009596). */
const SCREENING = {
  maxSlopeDeg: 10,
  minEarthPct: 25,
  minSunPct: 5,
  source: "https://ntrs.nasa.gov/citations/20240009596",
};

const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
const iso = (t: number) => `${new Date(t).toISOString().slice(0, 16)}Z`;
const isoOrNull = (t: number | null | undefined) => (t == null ? null : iso(t));

function windowInfo(start: number, days: number): WindowInfo {
  return { startUtc: iso(start), endUtc: iso(start + days * DAY), days };
}

function currentWindow(): WindowInfo {
  const s = useApp.getState();
  return windowInfo(s.windowStart, s.windowDays);
}

async function regionMeta(): Promise<RegionMeta> {
  return (await fetchRegion(useApp.getState().regionId)).meta;
}

function placeRef(meta: RegionMeta, p: { x: number; y: number; siteId?: string }): PlaceRef {
  const site = p.siteId ? meta.sites.find((s) => s.id === p.siteId) : undefined;
  const { lat, lon } = fromLocal(p.x, p.y, meta);
  return {
    ...(site ? { siteId: site.id, siteName: site.name } : {}),
    lat: round(lat, 3),
    lon: round(lon, 3),
  };
}

function summarize(a: PointAnalysis, meta: RegionMeta, start: number, days: number): PointSummary {
  const end = start + days * DAY;
  const firstEnd = (ws: PointAnalysis["sunWindows"]) => {
    const t = ws.find((w) => w.end > start && w.end < end)?.end;
    return isoOrNull(t);
  };
  const firstStart = (ws: PointAnalysis["sunWindows"]) => isoOrNull(ws.find((w) => w.start > start)?.start);
  const upAt = (ws: PointAnalysis["sunWindows"]) => ws.some((w) => w.start <= start && w.end > start);
  const avgSunlightPct = round(a.sunMean * 100);
  const earthVisibleTimePct = round(a.earthMean * 100);
  const depleted = a.power.depletedAt;

  return {
    where: {
      ...placeRef(meta, a),
      elevationM: round(a.elevationM),
      slopeDeg: round(a.slopeDeg, 1),
    },
    window: windowInfo(start, days),
    avgSunlightPct,
    sunVisibleTimePct: round(a.sunAny * 100),
    earthVisibleTimePct,
    longestDarkHours: round(a.longestDarkHours, 1),
    longestNoEarthHours: round(a.longestBlackoutHours, 1),
    sunUpAtLanding: upAt(a.sunWindows),
    firstSunsetUtc: firstEnd(a.sunWindows),
    firstSunriseUtc: firstStart(a.sunWindows),
    earthUpAtLanding: upAt(a.earthWindows),
    firstEarthsetUtc: firstEnd(a.earthWindows),
    firstEarthriseUtc: firstStart(a.earthWindows),
    power: {
      energyKWh: round(a.power.energyWh / 1000, 1),
      minBatteryPct: round(a.power.minSocPct),
      batteryEmptyUtc: isoOrNull(depleted),
      batteryLastsDays: depleted == null ? null : round((depleted - start) / DAY, 1),
    },
    screening: {
      slopeOk: a.slopeDeg < SCREENING.maxSlopeDeg,
      earthOk: earthVisibleTimePct >= SCREENING.minEarthPct,
      sunOk: avgSunlightPct >= SCREENING.minSunPct,
    },
  };
}

async function analyze(p: { x: number; y: number; siteId?: string }, meta: RegionMeta): Promise<PointSummary> {
  const s = useApp.getState();
  const a = await analyzePoint({ ...p, mastHeight: s.mastHeight }, s.windowStart, s.windowDays);
  return summarize(a, meta, s.windowStart, s.windowDays);
}

/** Resolves siteId | resultRank | lat,lon to a placement inside the region. */
function resolvePlace(
  meta: RegionMeta,
  input: { siteId?: string; resultRank?: number; lat?: number; lon?: number },
): { placement: LanderPlacement; label: string } {
  if (input.siteId) {
    const site = meta.sites.find((s) => s.id === input.siteId);
    if (!site)
      throw new Error(`Unknown siteId "${input.siteId}". Known ids: ${meta.sites.map((s) => s.id).join(", ")}.`);
    return {
      placement: { x: site.x, y: site.y, siteId: site.id },
      label: site.name,
    };
  }
  if (input.resultRank != null) {
    const r = useApp.getState().discovery.results.find((d) => d.rank === input.resultRank);
    if (!r)
      throw new Error(`No discovery result with rank ${input.resultRank}. Run set_discovery_criteria_and_run first.`);
    return { placement: { x: r.x, y: r.y }, label: `Site #${r.rank}` };
  }
  if (input.lat != null && input.lon != null) {
    const { x, y } = toLocal(input.lat, input.lon, meta);
    const half = meta.extent / 2;
    if (Math.abs(x) > half || Math.abs(y) > half)
      throw new Error(`${input.lat}°, ${input.lon}° is outside the ${meta.name} region. Use a site from get_context.`);
    const ref = placeRef(meta, { x, y });
    return { placement: { x, y }, label: `${ref.lat.toFixed(3)}°, ${ref.lon.toFixed(3)}°` };
  }
  throw new Error("Give siteId, resultRank, or both lat and lon.");
}

async function getContext(): Promise<ContextOutput> {
  const meta = await regionMeta();
  const s = useApp.getState();
  const c = s.discovery.criteria;
  return {
    region: { id: meta.id, name: meta.name },
    window: currentWindow(),
    playheadUtc: iso(s.time),
    allowedWindowDays: WINDOW_DAYS,
    dateRangeUtc: { min: iso(DATE_MIN), max: iso(DATE_MAX) },
    mastHeightM: s.mastHeight,
    powerAssumptions: {
      panels: "vertical sun-tracking array (illustrative preset)",
      panelAreaM2: s.power.panelAreaM2,
      efficiency: s.power.efficiency,
      batteryWh: s.power.batteryWh,
      loadW: s.power.loadW,
    },
    screening: SCREENING,
    landers: {
      A: s.landers.A ? placeRef(meta, s.landers.A) : null,
      B: s.landers.B ? placeRef(meta, s.landers.B) : null,
    },
    sites: meta.sites.map((site) => ({ ...placeRef(meta, site), kind: site.kind })),
    discovery: {
      criteria: {
        maxSlopeDeg: c.maxSlopeDeg,
        minSunPct: round(c.minSun * 100),
        minEarthPct: round(c.minEarth * 100),
      },
      resultCount: s.discovery.results.length,
    },
    gridPoints: meta.horizon.width * meta.horizon.height,
  };
}

function setMissionWindow({ startIso, days }: MissionUITools["set_mission_window"]["input"]): WindowOutput {
  const start = Date.parse(startIso);
  if (Number.isNaN(start)) throw new Error(`Could not read the date "${startIso}". Use ISO format, e.g. 2027-03-01.`);
  const previousWindow = currentWindow();
  const applied = WINDOW_DAYS.find((d) => d >= days) ?? 30;
  useApp.getState().setWindow(start, applied);
  const window = currentWindow();
  const notes: string[] = [];
  if (applied !== days)
    notes.push(
      days > 30
        ? "The longest window is 30 days; using 30."
        : `Windows are 1, 7, 15 or 30 days; using ${applied} to cover the ${days} requested.`,
    );
  if (useApp.getState().windowStart !== start)
    notes.push(
      `Dates are limited to ${iso(DATE_MIN).slice(0, 10)} … ${iso(DATE_MAX).slice(0, 10)}; start was clamped.`,
    );
  return {
    window,
    previousWindow,
    requestedDays: days,
    ...(notes.length ? { note: notes.join(" ") } : {}),
  };
}

function slipLaunch({ days }: MissionUITools["slip_launch"]["input"]): WindowOutput {
  const before = useApp.getState().windowStart;
  const previousWindow = currentWindow();
  useApp.getState().slipDays(days);
  const window = currentWindow();
  const moved = round((useApp.getState().windowStart - before) / DAY, 2);
  return {
    window,
    previousWindow,
    slippedDays: moved,
    ...(moved !== days ? { note: "The window hit the supported date range and was clamped." } : {}),
  };
}

async function runSearch(input: MissionUITools["set_discovery_criteria_and_run"]["input"]): Promise<DiscoveryOutput> {
  const meta = await regionMeta();
  const criteria = {
    maxSlopeDeg: input.maxSlopeDeg,
    minSun: input.minSunPct / 100,
    minEarth: input.minEarthPct / 100,
  };
  useApp.getState().setDiscoveryCriteria(criteria);
  const results = await runDiscovery(criteria);
  return {
    criteria: {
      maxSlopeDeg: input.maxSlopeDeg,
      minSunPct: round(input.minSunPct),
      minEarthPct: round(input.minEarthPct),
    },
    window: currentWindow(),
    gridPointsSearched: meta.horizon.width * meta.horizon.height,
    resultCount: results.length,
    top: results.slice(0, 5).map((r) => ({
      rank: r.rank,
      lat: round(r.lat, 3),
      lon: round(r.lon, 3),
      avgSunlightPct: round(r.sun * 100),
      earthVisibleTimePct: round(r.earth * 100),
      slopeDeg: round(r.slopeDeg, 1),
      longestDarkHours: round(r.longestDarkHours, 1),
    })),
    ...(results.length === 0
      ? {
          note: "No grid point meets all criteria in this window. Relax one criterion or try another date.",
        }
      : {}),
  };
}

async function analyzeTool(input: MissionUITools["analyze_point"]["input"]): Promise<AnalyzeOutput> {
  const meta = await regionMeta();
  const { placement, label } = resolvePlace(meta, input);
  return { label, analysis: await analyze(placement, meta) };
}

async function placeLander(input: MissionUITools["place_lander"]["input"]): Promise<PlaceOutput> {
  const meta = await regionMeta();
  const { placement, label } = resolvePlace(meta, input);
  useApp.getState().placeLander(input.lander, placement);
  return {
    lander: input.lander,
    label,
    placedAt: placeRef(meta, placement),
    analysis: await analyze(placement, meta),
  };
}

async function compareLanders(): Promise<CompareOutput> {
  const meta = await regionMeta();
  const { A, B } = useApp.getState().landers;
  if (!A || !B) throw new Error(`Lander ${A ? "B" : "A"} is not placed. Use place_lander first.`);
  const [a, b] = await Promise.all([analyze(A, meta), analyze(B, meta)]);
  const pick = (va: number, vb: number, higherIsBetter: boolean) =>
    va === vb ? "tie" : va > vb === higherIsBetter ? "A" : "B";
  // battery: surviving the whole window beats running out; otherwise the later run-out wins
  const lasts = (s: PointSummary) => s.power.batteryLastsDays ?? Number.POSITIVE_INFINITY;
  return {
    window: currentWindow(),
    A: a,
    B: b,
    better: {
      avgSunlight: pick(a.avgSunlightPct, b.avgSunlightPct, true),
      sunVisibleTime: pick(a.sunVisibleTimePct, b.sunVisibleTimePct, true),
      earthVisibleTime: pick(a.earthVisibleTimePct, b.earthVisibleTimePct, true),
      shorterLongestDark: pick(a.longestDarkHours, b.longestDarkHours, false),
      battery:
        lasts(a) === lasts(b)
          ? pick(a.power.minBatteryPct, b.power.minBatteryPct, true)
          : pick(lasts(a), lasts(b), true),
    },
  };
}

export const toolExecutors = {
  get_context: getContext,
  set_mission_window: setMissionWindow,
  slip_launch: slipLaunch,
  set_discovery_criteria_and_run: runSearch,
  analyze_point: analyzeTool,
  place_lander: placeLander,
  compare_landers: compareLanders,
} satisfies {
  [K in keyof MissionUITools]: (
    input: MissionUITools[K]["input"],
  ) => MissionUITools[K]["output"] | Promise<MissionUITools[K]["output"]>;
};
