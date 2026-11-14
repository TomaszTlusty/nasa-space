"use client";

import type { ReactNode } from "react";
import { create } from "zustand";
import type { Source } from "@/components/student/lessons/sources";

/**
 * LUNA-Bot's message queue. One bubble at a time; repeats are dropped by key, chatty event kinds have a
 * cooldown, and a newer message of the same kind replaces the queued one so the bot never lags behind.
 * Other Student-mode features may call `useGuide.getState().say(...)` with kind "custom".
 */
export type GuideKind =
  | "intro"
  | "crater"
  | "good-site"
  | "earth"
  | "sun"
  | "first-person"
  | "custom";

export interface GuideMessage {
  /** dedupe key: identical keys are never queued twice; with `once` they are never shown twice per session */
  key: string;
  kind: GuideKind;
  text: ReactNode;
  source?: Source;
  once?: boolean;
}

const COOLDOWN_MS: Record<GuideKind, number> = {
  intro: 0,
  crater: 0,
  "good-site": 0,
  earth: 90_000,
  sun: 60_000,
  "first-person": 0,
  custom: 0,
};

const MAX_QUEUE = 3;

interface GuideState {
  current: GuideMessage | null;
  queue: GuideMessage[];
  seen: string[];
  lastShownAt: Partial<Record<GuideKind, number>>;
  say: (message: GuideMessage) => void;
  dismiss: () => void;
  /** move the next queued message into the bubble */
  advance: () => void;
}

export const useGuide = create<GuideState>((set) => ({
  current: null,
  queue: [],
  seen: [],
  lastShownAt: {},
  say: (m) =>
    set((s) => {
      if (m.once && s.seen.includes(m.key)) return s;
      if (s.current?.key === m.key || s.queue.some((q) => q.key === m.key))
        return s;
      const now = Date.now();
      const last = s.lastShownAt[m.kind];
      if (last !== undefined && now - last < COOLDOWN_MS[m.kind]) return s;
      const seen = m.once ? [...s.seen, m.key] : s.seen;
      const lastShownAt = { ...s.lastShownAt, [m.kind]: now };
      if (!s.current && s.queue.length === 0)
        return { current: m, seen, lastShownAt };
      const queue = [
        ...s.queue.filter((q) => q.kind !== m.kind || m.kind === "custom"),
        m,
      ].slice(-MAX_QUEUE);
      return { queue, seen, lastShownAt };
    }),
  dismiss: () => set({ current: null }),
  advance: () =>
    set((s) =>
      s.current || s.queue.length === 0
        ? s
        : { current: s.queue[0], queue: s.queue.slice(1) },
    ),
}));
