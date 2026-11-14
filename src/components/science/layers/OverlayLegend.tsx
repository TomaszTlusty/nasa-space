"use client";

import type { Overlay } from "@/lib/store";
import {
  averageColor,
  EARTH_HATCH_MIX,
  FLAT_SHADE,
  INSTANT_EARTH,
  INSTANT_SHADOW,
  INSTANT_SUN,
  mix,
  slopeColor,
  toCss,
} from "./shader-colors";

// Every colour below is computed once from the shader's display-sRGB constants (see shader-colors.ts).
const SUN_CSS = toCss(INSTANT_SUN);
const SHADOW_CSS = toCss(INSTANT_SHADOW);
// The shader mixes unshaded Earth blue over the already shaded shadow colour.
const EARTH_STRIPE_CSS = toCss(
  mix(
    mix([0, 0, 0], INSTANT_SHADOW, FLAT_SHADE),
    INSTANT_EARTH,
    EARTH_HATCH_MIX,
  ),
  1,
);
// Shader stripes: step(0.82, fract((x + y) / 160 m)) -> 18% duty diagonal hatching.
const HATCH = `repeating-linear-gradient(135deg, ${EARTH_STRIPE_CSS} 0 1.5px, ${SHADOW_CSS} 1.5px 7px)`;

const AVERAGE_STOPS = Array.from({ length: 21 }, (_, i) => i / 20);
const AVERAGE_GRADIENT = `linear-gradient(90deg, ${AVERAGE_STOPS.map(
  (v) => `${toCss(averageColor(v))} ${v * 100}%`,
).join(", ")})`;

const SLOPE_MAX = 20;
const SLOPE_STOPS = Array.from({ length: 41 }, (_, i) => (i / 40) * SLOPE_MAX);
// The shader switches hard from teal to the ramp at exactly 5°, so place a duplicated stop there.
const SLOPE_GRADIENT = `linear-gradient(90deg, ${SLOPE_STOPS.flatMap((s) => {
  const at = `${(s / SLOPE_MAX) * 100}%`;
  const c = toCss(slopeColor(s));
  return s === 5
    ? [`${toCss(slopeColor(4.999))} ${at}`, `${c} ${at}`]
    : [`${c} ${at}`];
}).join(", ")})`;
const SLOPE_BANDS = [
  { label: "Under 5°", hint: "Easy", color: toCss(slopeColor(0)) },
  { label: "5–10°", hint: "Usable", color: toCss(slopeColor(7.5)) },
  { label: "Over 10°", hint: "Too steep", color: toCss(slopeColor(15)) },
] as const;

/** Landing slope < 10°: Artemis HLS key landing requirement (NASA, Artemis HLS DDL, 2022). */
const SLOPE_SOURCE =
  "https://ntrs.nasa.gov/api/citations/20220011114/downloads/ArtemisHLSDDL_v3.pdf";
/** Average solar illumination maps of the south pole (Mazarico et al. 2011, NASA PGDA). */
const AVERAGE_SOURCE = "https://pgda.gsfc.nasa.gov/products/69";

function Ticks({ labels }: { labels: string[] }) {
  return (
    <div className="tabular mt-1 flex justify-between text-2xs text-fg-faint">
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

export function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-fg-faint underline decoration-line-strong underline-offset-2 transition-colors duration-150 hover:text-fg"
    >
      Source
    </a>
  );
}

/** Colour key for the active terrain overlay; colours match the rendered terrain. */
export function OverlayLegend({ overlay }: { overlay: Overlay }) {
  if (overlay === "none") {
    return (
      <p className="text-2xs text-fg-faint">
        Plain terrain, lit by the Sun at the playhead time. Choose a layer to
        colour it.
      </p>
    );
  }

  if (overlay === "instant") {
    return (
      <ul className="flex flex-col gap-1.5 text-xs text-fg-muted">
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-5 rounded-[3px] ring-1 ring-line"
            style={{ background: SUN_CSS }}
          />
          Sunlit now
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-5 rounded-[3px] ring-1 ring-line"
            style={{ background: SHADOW_CSS }}
          />
          In shadow
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-5 rounded-[3px] ring-1 ring-line"
            style={{ background: HATCH }}
          />
          Earth visible now (blue hatching)
        </li>
      </ul>
    );
  }

  if (overlay === "average") {
    return (
      <div>
        <div className="flex items-baseline justify-between text-2xs text-fg-muted">
          <span>Share of the window in sunlight</span>
          <SourceLink href={AVERAGE_SOURCE} />
        </div>
        <div
          aria-hidden
          className="mt-1.5 h-2.5 rounded-[3px] ring-1 ring-line"
          style={{ background: AVERAGE_GRADIENT }}
        />
        <Ticks labels={["0%", "25%", "50%", "75%", "100%"]} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between text-2xs text-fg-muted">
        <span>Ground slope · landing limit 10°</span>
        <SourceLink href={SLOPE_SOURCE} />
      </div>
      <div
        aria-hidden
        className="mt-1.5 h-2.5 rounded-[3px] ring-1 ring-line"
        style={{ background: SLOPE_GRADIENT }}
      />
      <Ticks labels={["0°", "5°", "10°", "15°", "20°+"]} />
      <ul className="mt-2 grid grid-cols-3 gap-2 text-2xs">
        {SLOPE_BANDS.map((b) => (
          <li key={b.label} className="flex items-start gap-1.5">
            <span
              aria-hidden
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ background: b.color }}
            />
            <span>
              <span className="tabular block text-fg-muted">{b.label}</span>
              <span className="block text-fg-faint">{b.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
