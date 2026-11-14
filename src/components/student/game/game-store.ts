"use client";

import { create } from "zustand";
import { type AppSnapshot, useLessons } from "@/components/student/lessons/lesson-store";
import { useApp } from "@/lib/store";
import { MISSIONS, type MissionId, type MissionResult, RANKS, type Rank } from "./missions";

/**
 * Game flow shared by `GamePanel` (left column) and `GameOverlay` (full-screen layer).
 *   select -> brief -> choose (45 s) -> landing (time-lapse) -> result
 *                         \-> missed (no spot picked in time)
 *
 * The first mission start snapshots the player's scene (region, landers, time, window, overlay,
 * camera, playback). Retry / next mission keep that snapshot. Leaving the game (All missions, close,
 * cancel, leaving Student mode) puts it back exactly; "See it in Mission planning" (`keepMissionScene`)
 * drops it so the mission lander stays for planning.
 */

export type GamePhase = "select" | "brief" | "choose" | "missed" | "landing" | "result";

export const CHOOSE_SECONDS = 45;

/** Orbit distance (km) that frames the whole 41 km region when a mission starts. */
const MISSION_VIEW_KM = 36;

interface GameState {
  phase: GamePhase;
  missionIndex: number;
  /** `performance.now()` deadline of the choose phase */
  deadline: number;
  /** the player's scene before the first mission start; null = nothing borrowed */
  snapshot: AppSnapshot | null;
  /** last debrief; kept after leaving the result phase so the closing dialog keeps its content */
  result: MissionResult | null;
  /** best rank earned per mission in this session */
  best: Partial<Record<MissionId, Rank>>;

  openMission: (index: number) => void;
  /** back to the mission list, restoring the player's scene */
  backToMissions: () => void;
  /** set up the mission window/region and start the 45 s countdown */
  start: () => void;
  land: () => void;
  timeUp: () => void;
  finish: (result: MissionResult) => void;
  /** cancel the running mission and restore the player's scene */
  abort: () => void;
  /** leave the game keeping the mission scene (lander, window) instead of restoring the snapshot */
  keepMissionScene: () => void;
}

/** Stop borrowing the scene for a live mission step: the mission lander and window stay. */
function settleScene() {
  const app = useApp.getState();
  app.setPlaying(false);
  app.setCamera("orbit");
  app.setPlacing(null);
  app.setSitePinsHidden(false);
}

function restoreSnapshot(snapshot: AppSnapshot | null) {
  const app = useApp.getState();
  app.setSitePinsHidden(false);
  if (!snapshot) {
    settleScene();
    return;
  }
  if (app.regionId !== snapshot.regionId) app.setRegion(snapshot.regionId);
  useApp.setState(snapshot);
  if (snapshot.camera === "orbit") useApp.getState().resetView();
}

export const useGame = create<GameState>((set, get) => ({
  phase: "select",
  missionIndex: 0,
  deadline: 0,
  snapshot: null,
  result: null,
  best: {},

  openMission: (missionIndex) => set({ missionIndex, phase: "brief" }),

  backToMissions: () => {
    restoreSnapshot(get().snapshot);
    set({ phase: "select", snapshot: null });
  },

  start: () => {
    // A running lesson would restore its own snapshot over the mission later: end it first.
    useLessons.getState().exit();
    const mission = MISSIONS[get().missionIndex];
    const app = useApp.getState();
    const snapshot: AppSnapshot = get().snapshot ?? {
      regionId: app.regionId,
      time: app.time,
      windowStart: app.windowStart,
      windowDays: app.windowDays,
      playing: app.playing,
      speed: app.speed,
      landers: app.landers,
      activeLander: app.activeLander,
      placing: app.placing,
      camera: app.camera,
      overlay: app.overlay,
      mastHeight: app.mastHeight,
    };
    if (app.regionId !== mission.regionId) app.setRegion(mission.regionId);
    else app.removeLander("A");
    app.setWindow(mission.start, mission.days);
    app.setPlaying(false);
    app.setActiveLander("A");
    // Curated site labels would give the answer away: pick from the terrain (and helper map) only.
    app.setSitePinsHidden(true);
    app.focusOn(0, 0, MISSION_VIEW_KM);
    app.setPlacing("A");
    set({ phase: "choose", snapshot, deadline: performance.now() + CHOOSE_SECONDS * 1000 });
  },

  land: () => {
    if (get().phase !== "choose" || !useApp.getState().landers.A) return;
    const app = useApp.getState();
    const mission = MISSIONS[get().missionIndex];
    app.setPlacing(null);
    app.setPlaying(false);
    app.setActiveLander("A");
    app.setOverlay("none");
    app.setTime(mission.start);
    app.setCamera("lander");
    set({ phase: "landing" });
  },

  timeUp: () => {
    if (get().phase !== "choose") return;
    if (useApp.getState().landers.A) {
      get().land();
      return;
    }
    settleScene();
    set({ phase: "missed" });
  },

  finish: (result) => {
    if (get().phase !== "landing") return;
    settleScene();
    const overlay = get().snapshot?.overlay;
    if (overlay) useApp.getState().setOverlay(overlay);
    const { best } = get();
    const prev = best[result.missionId];
    const better = prev === undefined || RANKS.indexOf(result.rank) > RANKS.indexOf(prev);
    set({ phase: "result", result, best: better ? { ...best, [result.missionId]: result.rank } : best });
  },

  abort: () => {
    restoreSnapshot(get().snapshot);
    set({ phase: get().phase === "select" ? "select" : "brief", snapshot: null });
  },

  keepMissionScene: () => {
    settleScene();
    set({ phase: "select", snapshot: null });
  },
}));

// Leaving Student mode hands the player's scene back, whichever game component is mounted.
// ("See it in Mission planning" calls keepMissionScene first, so there is no snapshot to restore.)
useApp.subscribe((s, prev) => {
  if (prev.mode !== "student" || s.mode === "student") return;
  const { phase, snapshot } = useGame.getState();
  if (snapshot) useGame.getState().abort();
  else if (phase === "choose" || phase === "landing") settleScene();
});
