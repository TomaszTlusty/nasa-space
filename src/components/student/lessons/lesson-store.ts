"use client";

import { create } from "zustand";
import {
  type CameraMode,
  type LanderId,
  type LanderPlacement,
  type Overlay,
  type RegionId,
  useApp,
  type WindowDays,
} from "@/lib/store";
import { fetchRegion } from "@/lib/use-region";
import { LESSONS, type LessonId } from "./lessons";

/** App state a lesson may change; restored exactly when the lesson ends. */
export interface AppSnapshot {
  regionId: RegionId;
  time: number;
  windowStart: number;
  windowDays: WindowDays;
  playing: boolean;
  speed: number;
  landers: Partial<Record<LanderId, LanderPlacement>>;
  activeLander: LanderId;
  placing: LanderId | null;
  camera: CameraMode;
  overlay: Overlay;
  mastHeight: number;
}

export interface ActiveLesson {
  lessonId: LessonId;
  step: number;
  /** true while the step is setting up the scene (loading region, computing a good moment) */
  busy: boolean;
  /** shown when part of the step had to be skipped (missing site, no sunlight this month, ...) */
  note: string | null;
  snapshot: AppSnapshot;
}

interface LessonState {
  active: ActiveLesson | null;
  start: (id: LessonId) => void;
  goTo: (step: number) => void;
  /** leave the lesson and put the app back exactly as it was before it started */
  exit: () => void;
}

/** Bumped on every step change / exit so a slow async step cannot write into a newer one. */
let runId = 0;

export const useLessons = create<LessonState>((set, get) => {
  const run = async (lessonId: LessonId, step: number) => {
    const lesson = LESSONS.find((l) => l.id === lessonId);
    const current = get().active;
    if (!lesson || !current) return;
    const id = ++runId;
    const target = Math.max(0, Math.min(lesson.steps.length - 1, step));
    set({ active: { ...current, step: target, busy: true, note: null } });

    const app = useApp.getState();
    if (app.regionId !== lesson.regionId) app.setRegion(lesson.regionId);

    let note: string | null = null;
    try {
      const region = await fetchRegion(lesson.regionId);
      if (id !== runId) return;
      note = (await lesson.steps[target].apply?.({ region, isCurrent: () => id === runId })) ?? null;
    } catch {
      note = "LUNA-Bot could not set up this step, but you can still read along.";
    }
    if (id !== runId) return;
    const latest = get().active;
    if (latest) set({ active: { ...latest, busy: false, note } });
  };

  return {
    active: null,
    start: (lessonId) => {
      const s = useApp.getState();
      // Starting from inside another lesson keeps the original pre-lesson state.
      const snapshot: AppSnapshot = get().active?.snapshot ?? {
        regionId: s.regionId,
        time: s.time,
        windowStart: s.windowStart,
        windowDays: s.windowDays,
        playing: s.playing,
        speed: s.speed,
        landers: s.landers,
        activeLander: s.activeLander,
        placing: s.placing,
        camera: s.camera,
        overlay: s.overlay,
        mastHeight: s.mastHeight,
      };
      set({ active: { lessonId, step: 0, busy: true, note: null, snapshot } });
      void run(lessonId, 0);
    },
    goTo: (step) => {
      const active = get().active;
      if (active) void run(active.lessonId, step);
    },
    exit: () => {
      const active = get().active;
      if (!active) return;
      runId++;
      set({ active: null });
      const app = useApp.getState();
      if (app.regionId !== active.snapshot.regionId) app.setRegion(active.snapshot.regionId);
      useApp.setState(active.snapshot);
    },
  };
});
