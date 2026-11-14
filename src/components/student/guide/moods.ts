/**
 * LUNA's moods and Student-mode palette. Student mode may use a playful lilac/teal suit trim on top of the
 * fixed data colours (amber = Sun, blue = Earth); these values are LUNA's only, never data encodings.
 */
export type Mood = "idle" | "happy" | "excited" | "worried" | "cold" | "sad" | "amazed" | "thinking";

export const LUNA_COLORS = {
  shell: "oklch(0.95 0.01 290)",
  shellShade: "oklch(0.83 0.025 290)",
  pack: "oklch(0.7 0.05 295)",
  visor: "oklch(0.21 0.035 280)",
  lilac: "oklch(0.78 0.12 300)",
  lilacDeep: "oklch(0.64 0.14 300)",
  teal: "oklch(0.84 0.1 190)",
  eye: "oklch(0.9 0.12 195)",
  ice: "oklch(0.92 0.05 220)",
  blush: "oklch(0.74 0.14 355)",
  sun: "var(--color-sun)",
  earth: "var(--color-earth)",
} as const;

/** Top edge / accent of the speech bubble per mood. */
export const MOOD_ACCENT: Record<Mood, string> = {
  idle: LUNA_COLORS.lilac,
  happy: LUNA_COLORS.lilac,
  excited: LUNA_COLORS.sun,
  worried: "oklch(0.72 0.06 280)",
  cold: LUNA_COLORS.ice,
  sad: LUNA_COLORS.earth,
  amazed: LUNA_COLORS.teal,
  thinking: LUNA_COLORS.lilac,
};
