"use client";

import { create } from "zustand";

export type ChartsTab = "sky" | "power" | "links";

/** Local UI state shared by `ChartsToggle` (timeline) and `ChartsDrawer`; not part of the app store. */
export const useCharts = create<{
  open: boolean;
  tab: ChartsTab;
  setOpen: (open: boolean) => void;
  setTab: (tab: ChartsTab) => void;
}>((set) => ({
  open: false,
  tab: "sky",
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab }),
}));
