"use client";

import { create } from "zustand";
import { type Overlay, useApp } from "@/lib/store";
import { MISSIONS, type MissionId, type MissionResult, RANKS, type Rank } from "./missions";

/**
 * Game flow shared by `GamePanel` (left column) and `GameOverlay` (full-screen layer).
 *   select -> brief -> choose (45 s) -> landing (time-lapse) -> result
 *                         \-> missed (no spot picked in time)
 * Every exit from choose/landing restores the shared scene state the game borrowed:
 * camera back to orbit, playing false, placing off, site pins visible, overlay as it was before.
 */

export type GamePhase = "select" | "brief" | "choose" | "missed" | "landing" | "result";

export const CHOOSE_SECONDS = 45;

interface GameState {
  phase: GamePhase;
  missionIndex: number;
  /** `performance.now()` deadline of the choose phase */
  deadline: number;
  /** overlay the player had before the game borrowed it for the helper map; null = nothing borrowed */
  savedOverlay: Overlay | null;
  /** last debrief; kept after leaving the result phase so the closing dialog keeps its content */
  result: MissionResult | null;
  /** best rank earned per mission in this session */
  best: Partial<Record<MissionId, Rank>>;

  openMission: (index: number) => void;
  backToMissions: () => void;
  /** set up the mission window/region and start the 45 s countdown */
  start: () => void;
  land: () => void;
  timeUp: () => void;
  finish: (result: MissionResult) => void;
  /** leave the game flow and give the scene back (camera orbit, playing false, overlay restored) */
  abort: () => void;
}

function restoreScene(savedOverlay: Overlay | null) {
  const app = useApp.getState();
  app.setPlaying(false);
  app.setCamera("orbit");
  app.setPlacing(null);
  app.setSitePinsHidden(false);
  if (savedOverlay !== null) app.setOverlay(savedOverlay);
}

/** Orbit distance (km) that frames the whole 41 km region when a mission starts. */
const MISSION_VIEW_KM = 36;

export const useGame = create<GameState>((set, get) => ({
  phase: "select",
  missionIndex: 0,
  deadline: 0,
  savedOverlay: null,
  result: null,
  best: {},

  openMission: (missionIndex) => set({ missionIndex, phase: "brief" }),
  backToMissions: () => set({ phase: "select" }),

  start: () => {
    const mission = MISSIONS[get().missionIndex];
    const app = useApp.getState();
    const savedOverlay = get().savedOverlay ?? app.overlay;
    if (app.regionId !== mission.regionId) app.setRegion(mission.regionId);
    else app.removeLander("A");
    app.setWindow(mission.start, mission.days);
    app.setPlaying(false);
    app.setActiveLander("A");
    // Curated site labels would give the answer away: pick from the terrain (and helper map) only.
    app.setSitePinsHidden(true);
    app.focusOn(0, 0, MISSION_VIEW_KM);
    app.setPlacing("A");
    set({
      phase: "choose",
      savedOverlay,
      deadline: performance.now() + CHOOSE_SECONDS * 1000,
    });
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
    restoreScene(get().savedOverlay);
    set({ phase: "missed", savedOverlay: null });
  },

  finish: (result) => {
    if (get().phase !== "landing") return;
    restoreScene(get().savedOverlay);
    const { best } = get();
    const prev = best[result.missionId];
    const better = prev === undefined || RANKS.indexOf(result.rank) > RANKS.indexOf(prev);
    set({
      phase: "result",
      result,
      savedOverlay: null,
      best: better ? { ...best, [result.missionId]: result.rank } : best,
    });
  },

  abort: () => {
    const { phase, savedOverlay } = get();
    if (phase === "choose" || phase === "landing") restoreScene(savedOverlay);
    set({ phase: phase === "select" ? "select" : "brief", savedOverlay: null });
  },
}));

// Leaving Student mode mid-game hands the scene back, whichever game component is mounted.
useApp.subscribe((s, prev) => {
  if (s.mode === prev.mode || s.mode === "student") return;
  const { phase } = useGame.getState();
  if (phase === "choose" || phase === "landing") useGame.getState().abort();
});
