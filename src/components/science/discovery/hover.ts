"use client";

import { create } from "zustand";

/**
 * Which discovery result the pointer/focus is on in the results list. Kept out of the app store
 * because it is transient UI state shared only between DiscoveryPanel and the 3D Beacons.
 */
export interface DiscoveryHoverState {
  hoveredRank: number | null;
  setHoveredRank: (rank: number | null) => void;
}

export const useDiscoveryHover = create<DiscoveryHoverState>((set) => ({
  hoveredRank: null,
  setHoveredRank: (hoveredRank) => set({ hoveredRank }),
}));
