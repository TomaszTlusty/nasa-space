"use client";

import { create } from "zustand";

const SEEN_KEY = "malapert.welcome.seen";

interface WelcomeState {
  open: boolean;
  /** reopen the welcome screen (About dialog) */
  show: () => void;
  /** close and remember, so first-visit logic does not show it again */
  dismiss: () => void;
  /** open on first visit only; call once after mount (localStorage is client-only) */
  showIfFirstVisit: () => void;
}

export const useWelcome = create<WelcomeState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  dismiss: () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked (private mode): the welcome screen simply shows again next visit
    }
    set({ open: false });
  },
  showIfFirstVisit: () => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // storage blocked: treat as a first visit
    }
    if (!seen) set({ open: true });
  },
}));
