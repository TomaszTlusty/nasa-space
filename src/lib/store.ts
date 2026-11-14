"use client";

import { create } from "zustand";

/**
 * Single source of truth for UI state shared by the 3D scene, HUD, Science mode and Student mode.
 * Switching mode never resets landers, time or region (spec §2.2).
 */

export type Mode = "science" | "student";
export type RegionId = "shackleton" | "malapert";
export type LanderId = "A" | "B";
export type CameraMode = "orbit" | "lander";
export type Overlay = "none" | "instant" | "average" | "slope";
export type WindowDays = 1 | 7 | 15 | 30;

export interface LanderPlacement {
  /** region local frame, metres */
  x: number;
  y: number;
  /** set when placed on a curated site; precise per-site horizons are then used */
  siteId?: string;
}

export interface PowerPreset {
  /** vertical, sun-tracking array (polar landers). m^2 */
  panelAreaM2: number;
  /** cell + system efficiency 0..1 */
  efficiency: number;
  batteryWh: number;
  /** constant electrical load */
  loadW: number;
}

export interface DiscoveryCriteria {
  maxSlopeDeg: number;
  /** mean visible Sun fraction over the analysis window, 0..1 */
  minSun: number;
  /** fraction of the window with any part of Earth visible, 0..1 */
  minEarth: number;
}

export interface DiscoveryResult {
  rank: number;
  x: number;
  y: number;
  lat: number;
  lon: number;
  score: number;
  sun: number;
  earth: number;
  slopeDeg: number;
  longestDarkHours: number;
}

/** Mission dates the timeline can reach (UTC). Covers Griffin-1, Blue Moon MK1, Chang'e-7, Artemis IV. */
export const DATE_MIN = Date.UTC(2026, 10, 1);
export const DATE_MAX = Date.UTC(2028, 11, 31);
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Default lander used everywhere unless the user edits it. Values are illustrative, labelled as such in UI. */
export const DEFAULT_POWER: PowerPreset = { panelAreaM2: 4, efficiency: 0.28, batteryWh: 3000, loadW: 150 };

interface AppState {
  mode: Mode;
  regionId: RegionId;
  /** playhead, ms since epoch UTC */
  time: number;
  /** analysis window start (mission landing), ms UTC */
  windowStart: number;
  windowDays: WindowDays;
  playing: boolean;
  /** simulated hours per real second while playing */
  speed: number;
  landers: Partial<Record<LanderId, LanderPlacement>>;
  activeLander: LanderId;
  /** which lander the user is placing with the next terrain click; null = clicks only inspect */
  placing: LanderId | null;
  camera: CameraMode;
  overlay: Overlay;
  mastHeight: number;
  power: PowerPreset;
  discovery: { criteria: DiscoveryCriteria; results: DiscoveryResult[]; running: boolean };
  /**
   * Window-average visibility on the horizon grid, RGBA8 per node (R = mean Sun disc fraction,
   * G = fraction of hours with any Earth visible; 255 = 1). Produced by the analysis worker.
   */
  averageData: Uint8Array | null;
  /** one-shot camera request: the orbit camera flies to look at (x, y); `nonce` re-triggers the same target */
  focus: { x: number; y: number; distanceKm: number; nonce: number } | null;
  /** hide curated site pins (e.g. while the landing game asks the player to find a spot on their own) */
  sitePinsHidden: boolean;

  setMode: (mode: Mode) => void;
  setRegion: (id: RegionId) => void;
  setTime: (t: number) => void;
  setWindow: (start: number, days?: WindowDays) => void;
  /** shift the mission window (and playhead) by whole days: the "launch slip" button */
  slipDays: (days: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  placeLander: (id: LanderId, p: LanderPlacement) => void;
  removeLander: (id: LanderId) => void;
  setActiveLander: (id: LanderId) => void;
  setPlacing: (id: LanderId | null) => void;
  setCamera: (camera: CameraMode) => void;
  setOverlay: (overlay: Overlay) => void;
  setMastHeight: (m: number) => void;
  setPower: (p: Partial<PowerPreset>) => void;
  setDiscoveryCriteria: (c: Partial<DiscoveryCriteria>) => void;
  setDiscoveryResults: (results: DiscoveryResult[]) => void;
  setDiscoveryRunning: (running: boolean) => void;
  setAverageData: (data: Uint8Array | null) => void;
  /** fly the orbit camera to a local point; distanceKm = camera distance from it */
  focusOn: (x: number, y: number, distanceKm?: number) => void;
  setSitePinsHidden: (hidden: boolean) => void;
}

const clampTime = (t: number) => Math.min(DATE_MAX, Math.max(DATE_MIN, t));

const DEFAULT_START = Date.UTC(2027, 0, 15);

export const useApp = create<AppState>((set) => ({
  mode: "science",
  regionId: "shackleton",
  time: DEFAULT_START,
  windowStart: DEFAULT_START,
  windowDays: 15,
  playing: false,
  speed: 6,
  landers: {},
  activeLander: "A",
  placing: "A",
  camera: "orbit",
  overlay: "none",
  mastHeight: 2,
  power: DEFAULT_POWER,
  discovery: { criteria: { maxSlopeDeg: 10, minSun: 0.6, minEarth: 0.5 }, results: [], running: false },
  averageData: null,
  focus: null,
  sitePinsHidden: false,

  setMode: (mode) => set({ mode }),
  setRegion: (regionId) =>
    set((s) => ({
      regionId,
      landers: {},
      placing: "A",
      activeLander: "A",
      camera: "orbit",
      discovery: { ...s.discovery, results: [] },
      averageData: null,
      focus: null,
    })),
  setTime: (t) => set({ time: clampTime(t) }),
  setWindow: (start, days) =>
    set((s) => {
      const windowStart = clampTime(start);
      return { windowStart, windowDays: days ?? s.windowDays, time: windowStart };
    }),
  slipDays: (days) =>
    set((s) => ({
      windowStart: clampTime(s.windowStart + days * DAY),
      time: clampTime(s.time + days * DAY),
    })),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  placeLander: (id, p) =>
    set((s) => ({
      landers: { ...s.landers, [id]: p },
      activeLander: id,
      placing: null,
    })),
  removeLander: (id) =>
    set((s) => {
      const landers = { ...s.landers };
      delete landers[id];
      const remaining = (Object.keys(landers) as LanderId[])[0];
      return {
        landers,
        // keep pointing at a lander that exists; with none left, the next terrain click places A again
        activeLander: remaining ?? "A",
        placing: remaining ? s.placing : "A",
        camera: "orbit",
      };
    }),
  setActiveLander: (activeLander) => set({ activeLander }),
  setPlacing: (placing) => set({ placing }),
  setCamera: (camera) => set({ camera }),
  setOverlay: (overlay) => set({ overlay }),
  setMastHeight: (mastHeight) => set({ mastHeight }),
  setPower: (p) => set((s) => ({ power: { ...s.power, ...p } })),
  setDiscoveryCriteria: (c) =>
    set((s) => ({ discovery: { ...s.discovery, criteria: { ...s.discovery.criteria, ...c } } })),
  setDiscoveryResults: (results) => set((s) => ({ discovery: { ...s.discovery, results } })),
  setDiscoveryRunning: (running) => set((s) => ({ discovery: { ...s.discovery, running } })),
  setAverageData: (averageData) => set({ averageData }),
  focusOn: (x, y, distanceKm = 6) =>
    set((s) => ({ focus: { x, y, distanceKm, nonce: (s.focus?.nonce ?? 0) + 1 }, camera: "orbit" })),
  setSitePinsHidden: (sitePinsHidden) => set({ sitePinsHidden }),
}));

// Dev/QA handle: lets browser automation drive the app state (window.__app.getState()).
declare global {
  interface Window {
    __app?: typeof useApp;
  }
}
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__app = useApp;
}
