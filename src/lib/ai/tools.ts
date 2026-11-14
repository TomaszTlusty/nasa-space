import { type InferUITools, tool, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";

/**
 * Tools the assistant can call. They have NO server `execute`: every call is forwarded to the
 * browser and run against the app's own analysis engine (`src/lib/ai/client-tools.ts`), so the
 * model can only quote numbers our validated math produced. Shared by the route and the client.
 */

export type ChatMode = "science" | "student";

/** Max model steps per user turn (tool round-trips + final answer). Enforced on client and server. */
export const MAX_STEPS = 6;
/** Max chat messages sent to / accepted by the route. */
export const MAX_HISTORY = 12;
/** Max characters of one user message. */
export const MAX_INPUT_CHARS = 4000;

/** Mission window, ISO UTC minutes (`2027-03-01T00:00Z`). `end` = start + days. */
export interface WindowInfo {
  startUtc: string;
  endUtc: string;
  days: number;
}

/**
 * A place, described the way users know it: curated site name and/or selenographic lat/lon.
 * Local region-frame metres are deliberately never exposed to the model.
 */
export interface PlaceRef {
  siteId?: string;
  siteName?: string;
  /** degrees, 3 dp (south negative, lon east) */
  lat: number;
  lon: number;
}

/** Compact, rounded summary of one `PointAnalysis` (no time series). */
export interface PointSummary {
  where: PlaceRef & { elevationM: number; slopeDeg: number };
  window: WindowInfo;
  /** average share of the Sun's disc above the horizon over the window, % (solar energy proxy) */
  avgSunlightPct: number;
  /** share of the window with any part of the Sun above the horizon, % */
  sunVisibleTimePct: number;
  /** share of the window with any part of Earth visible, % */
  earthVisibleTimePct: number;
  longestDarkHours: number;
  longestNoEarthHours: number;
  sunUpAtLanding: boolean;
  /** first time the Sun fully sets / first rises inside the window (null = not in window) */
  firstSunsetUtc: string | null;
  firstSunriseUtc: string | null;
  earthUpAtLanding: boolean;
  firstEarthsetUtc: string | null;
  firstEarthriseUtc: string | null;
  power: {
    energyKWh: number;
    minBatteryPct: number;
    /** null = battery never empties inside the window */
    batteryEmptyUtc: string | null;
    batteryLastsDays: number | null;
  };
  /** against the screening thresholds returned by get_context */
  screening: { slopeOk: boolean; earthOk: boolean; sunOk: boolean };
}

export interface ContextOutput {
  region: { id: string; name: string };
  window: WindowInfo;
  playheadUtc: string;
  allowedWindowDays: number[];
  dateRangeUtc: { min: string; max: string };
  mastHeightM: number;
  powerAssumptions: {
    panels: string;
    panelAreaM2: number;
    efficiency: number;
    batteryWh: number;
    loadW: number;
  };
  screening: {
    maxSlopeDeg: number;
    minEarthPct: number;
    minSunPct: number;
    source: string;
  };
  landers: { A: PlaceRef | null; B: PlaceRef | null };
  sites: (PlaceRef & { kind: string })[];
  discovery: {
    criteria: { maxSlopeDeg: number; minSunPct: number; minEarthPct: number };
    resultCount: number;
  };
  gridPoints: number;
}

export interface WindowOutput {
  window: WindowInfo;
  previousWindow: WindowInfo;
  requestedDays?: number;
  slippedDays?: number;
  note?: string;
}

export interface DiscoveryOutput {
  criteria: { maxSlopeDeg: number; minSunPct: number; minEarthPct: number };
  window: WindowInfo;
  gridPointsSearched: number;
  /** number of (non-adjacent, best-first) grid points returned by the search */
  resultCount: number;
  top: {
    rank: number;
    lat: number;
    lon: number;
    /** average share of the Sun's disc visible over the window, % */
    avgSunlightPct: number;
    earthVisibleTimePct: number;
    slopeDeg: number;
    longestDarkHours: number;
  }[];
  note?: string;
}

export interface PlaceOutput {
  lander: "A" | "B";
  /** short human label, e.g. "Site #1", "Connecting Ridge CR1" or "−89.450°, −137.300°" */
  label: string;
  placedAt: PlaceRef;
  analysis: PointSummary;
}

export interface AnalyzeOutput {
  label: string;
  analysis: PointSummary;
}

type Winner = "A" | "B" | "tie";

export interface CompareOutput {
  window: WindowInfo;
  A: PointSummary;
  B: PointSummary;
  better: {
    avgSunlight: Winner;
    sunVisibleTime: Winner;
    earthVisibleTime: Winner;
    shorterLongestDark: Winner;
    battery: Winner;
  };
}

const empty = z.object({});

export const missionTools = {
  get_context: tool({
    description:
      "Read the current app state: region, mission window (UTC), placed landers, curated sites (ids and names), discovery criteria, power assumptions and screening thresholds. Call this first.",
    inputSchema: empty,
    outputSchema: z.custom<ContextOutput>(),
  }),
  set_mission_window: tool({
    description:
      "Set the landing date and mission length. The app supports windows of 1, 7, 15 or 30 days; the shortest window covering `days` is used and reported back.",
    inputSchema: z.object({
      startIso: z.string().describe("Landing date/time in UTC, ISO 8601, e.g. 2027-03-01 or 2027-03-01T12:00Z"),
      days: z.number().int().min(1).max(60).describe("Mission length the user needs, in days"),
    }),
    outputSchema: z.custom<WindowOutput>(),
  }),
  slip_launch: tool({
    description:
      "Shift the mission window (launch slip) by whole days, e.g. +3 or +7. Negative values move it earlier.",
    inputSchema: z.object({ days: z.number().int().min(-60).max(60) }),
    outputSchema: z.custom<WindowOutput>(),
  }),
  set_discovery_criteria_and_run: tool({
    description:
      "Search every terrain grid point of the region over the current window for spots meeting all criteria. Returns the best results (rank 1 = best).",
    inputSchema: z.object({
      maxSlopeDeg: z.number().min(0).max(45).describe("Maximum ground slope, degrees"),
      minSunPct: z
        .number()
        .min(0)
        .max(100)
        .describe("Minimum average sunlight (share of the Sun's disc visible, averaged over the window), %"),
      minEarthPct: z.number().min(0).max(100).describe("Minimum share of the window with Earth in view, %"),
    }),
    outputSchema: z.custom<DiscoveryOutput>(),
  }),
  analyze_point: tool({
    description:
      "Analyse one spot over the current window without placing a lander: sunlight, Earth visibility, longest darkness, battery. Give either siteId (from get_context) or lat and lon (degrees).",
    inputSchema: z.object({
      siteId: z.string().optional(),
      lat: z.number().min(-90).max(-80).optional(),
      lon: z.number().min(-180).max(360).optional(),
    }),
    outputSchema: z.custom<AnalyzeOutput>(),
  }),
  place_lander: tool({
    description:
      "Place lander A or B in the 3D scene and analyse it. Give exactly one of: siteId (curated site), resultRank (rank from the last discovery search), or lat and lon (degrees).",
    inputSchema: z.object({
      lander: z.enum(["A", "B"]),
      siteId: z.string().optional(),
      resultRank: z.number().int().min(1).optional(),
      lat: z.number().min(-90).max(-80).optional(),
      lon: z.number().min(-180).max(360).optional(),
    }),
    outputSchema: z.custom<PlaceOutput>(),
  }),
  compare_landers: tool({
    description: "Compare placed landers A and B over the current window. Both must be placed.",
    inputSchema: empty,
    outputSchema: z.custom<CompareOutput>(),
  }),
};

export type MissionTools = typeof missionTools;
export type MissionUITools = InferUITools<MissionTools>;
export type MissionToolName = keyof MissionTools & string;
export type MissionUIMessage = UIMessage<unknown, UIDataTypes, MissionUITools>;

/** Body the client posts to `/api/chat`. */
export interface ChatRequestBody {
  id?: string;
  mode: ChatMode;
  messages: MissionUIMessage[];
}

/** Number of model steps already taken in an assistant message (one `step-start` part per step). */
export function countSteps(message: MissionUIMessage | undefined): number {
  if (!message || message.role !== "assistant") return 0;
  return message.parts.reduce((n, p) => (p.type === "step-start" ? n + 1 : n), 0);
}
