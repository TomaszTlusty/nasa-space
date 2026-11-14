"use client";

import { Check, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge, Stat } from "@/components/ui/panel";
import { Slider } from "@/components/ui/slider";
import { useLiveVisibility, usePointAnalysis } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { type LanderId, useApp } from "@/lib/store";
import { CRITERIA, CRITERIA_SOURCE, DASH, deg, fmt, pct, screen, stepIndex } from "./format";
import { Section, SourceLink } from "./Section";

/** Mast heights with precomputed per-site horizons (see RegionSite.horizons). */
const MASTS: readonly number[] = [0, 2, 5, 10];

/** Gläser et al. 2018: Connecting Ridge ~76 % light at ground level, 88 % at a 2 m mast. */
const MAST_SOURCE = "https://ntrs.nasa.gov/citations/20170007365";

function VisRow({
  label,
  tone,
  elev,
  horizon,
  vis,
}: {
  label: string;
  tone: "sun" | "earth";
  elev: number | undefined;
  horizon: number | undefined;
  vis: number | undefined;
}) {
  const up = vis !== undefined && vis > 0;
  // Near the horizon one decimal makes "Sun 1.5° · terrain 1.5° · 50% visible" look contradictory.
  const digits = elev !== undefined && horizon !== undefined && Math.abs(elev - horizon) < 0.3 ? 2 : 1;
  return (
    <div className="flex items-center gap-3">
      <span className={cn("w-11 shrink-0 text-xs", tone === "sun" ? "text-sun" : "text-earth")}>{label}</span>
      <span className="tabular min-w-0 flex-1 truncate text-fg-muted text-xs">
        <span className="text-fg">{deg(elev, digits)}</span>
        <span className="text-fg-faint"> · terrain </span>
        {deg(horizon, digits)}
      </span>
      <Badge tone={vis === undefined ? "neutral" : up ? tone : "night"} className="tabular">
        {vis === undefined ? DASH : up ? `${pct(vis)}% visible` : "hidden"}
      </Badge>
    </div>
  );
}

function Chip({ pass, children }: { pass: boolean | undefined; children: ReactNode }) {
  return (
    <Badge tone={pass === undefined ? "neutral" : pass ? "ok" : "danger"} className="tabular">
      {pass === undefined ? null : pass ? <Check size={11} weight="bold" /> : <X size={11} weight="bold" />}
      {children}
    </Badge>
  );
}

/** Location, live sky, mission-window results, screening and mast height for one lander. */
export function LanderDetails({ id, siteName }: { id: LanderId; siteName?: string }) {
  const a = usePointAnalysis(id);
  const live = useLiveVisibility(id);
  const time = useApp((s) => s.time);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const power = useApp((s) => s.power);
  const mastHeight = useApp((s) => s.mastHeight);
  const setMastHeight = useApp((s) => s.setMastHeight);
  const onSite = Boolean(useApp((s) => s.landers[id]?.siteId));

  const i = a ? stepIndex(a.series, time) : null;
  const wattsNow = a && i !== null ? a.power.watts[i] : undefined;
  const socNow = a && i !== null ? a.power.socPct[i] : undefined;
  const s = a ? screen(a) : null;
  const start = new Date(windowStart).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const mastIndex = MASTS.reduce<[number, number]>(
    ([bk, bd], m, k) => {
      const d = Math.abs(m - mastHeight);
      return d < bd ? [k, d] : [bk, bd];
    },
    [0, Number.POSITIVE_INFINITY],
  )[0];

  return (
    <>
      <Section title="Location" aside={siteName && <span className="truncate text-2xs text-fg-muted">{siteName}</span>}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <Stat size="sm" label="Latitude" value={a ? `${fmt(a.lat, 3)}°` : DASH} />
          <Stat size="sm" label="Longitude" value={a ? `${fmt(a.lon, 3)}°` : DASH} />
          <Stat size="sm" label="Elevation" value={fmt(a?.elevationM)} unit="m" hint="vs. 1737.4 km reference" />
          <Stat
            size="sm"
            label="Slope"
            value={fmt(a?.slopeDeg, 1)}
            unit="°"
            tone={s ? (s.slope ? "ok" : "danger") : "neutral"}
            hint={`landing limit < ${CRITERIA.maxSlopeDeg}°`}
          />
        </div>
      </Section>

      <Section
        title="Now"
        aside={
          <span className="tabular text-2xs text-fg-faint">
            {new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        }
      >
        <div className="flex flex-col gap-2">
          <VisRow label="Sun" tone="sun" elev={live?.sunElev} horizon={live?.sunHorizon} vis={live?.sunVis} />
          <VisRow label="Earth" tone="earth" elev={live?.earthElev} horizon={live?.earthHorizon} vis={live?.earthVis} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4">
          <Stat size="sm" label="Power now" value={fmt(wattsNow)} unit="W" tone="sun" />
          <Stat size="sm" label="Battery now" value={fmt(socNow)} unit="%" />
        </div>
        {a && i === null && <p className="mt-2 text-2xs text-fg-faint">Playhead is outside the mission window.</p>}
      </Section>

      <Section
        title="Mission window"
        aside={<span className="tabular text-2xs text-fg-faint">{`${windowDays} d from ${start}`}</span>}
      >
        <div className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5 transition-opacity duration-200", !a && "opacity-60")}>
          <Stat
            size="sm"
            label="Average sunlight"
            value={pct(a?.sunMean)}
            unit="%"
            tone="sun"
            hint="mean visible share of the Sun's disc"
          />
          <Stat
            size="sm"
            label="Sun visible"
            value={pct(a?.sunAny)}
            unit="% of time"
            tone="sun"
            hint="any part of the Sun in view"
          />
          <Stat
            size="sm"
            label="Earth contact"
            value={pct(a?.earthMean)}
            unit="%"
            tone="earth"
            hint="time Earth in view"
          />
          <Stat size="sm" label="Longest darkness" value={fmt(a?.longestDarkHours)} unit="h" />
          <Stat size="sm" label="Longest blackout" value={fmt(a?.longestBlackoutHours)} unit="h" hint="no Earth link" />
          <Stat
            size="sm"
            label="Energy"
            value={a ? (a.power.energyWh / 1000).toFixed(1) : DASH}
            unit="kWh"
            tone="sun"
          />
          <Stat
            size="sm"
            label="Min battery"
            value={fmt(a?.power.minSocPct)}
            unit="%"
            tone={a ? (a.power.minSocPct > 0 ? "neutral" : "danger") : "neutral"}
          />
          <Stat
            size="sm"
            label="Survives the window"
            value={!a ? DASH : a.power.depletedAt === null ? "Yes" : "No"}
            tone={!a ? "neutral" : a.power.depletedAt === null ? "ok" : "danger"}
            hint={
              a?.power.depletedAt != null
                ? `battery empty ${new Date(a.power.depletedAt).toISOString().slice(0, 16).replace("T", " ")} UTC`
                : undefined
            }
          />
        </div>
        <p className="mt-2.5 text-2xs text-fg-faint leading-4">
          {a ? "" : "Computing… "}
          Assumes vertical sun-tracking panels ({power.panelAreaM2} m², {Math.round(power.efficiency * 100)}%), a{" "}
          {(power.batteryWh / 1000).toFixed(1)} kWh battery and a {power.loadW} W load (illustrative). Flat panels would
          catch only ~2.6% of the light at the pole.
        </p>
      </Section>

      <Section
        title="Screening"
        aside={
          s ? (
            <Badge tone={s.go ? "ok" : "danger"} className="tracking-[0.08em]">
              {s.go ? "GO" : "NO-GO"}
            </Badge>
          ) : (
            <Badge>{DASH}</Badge>
          )
        }
      >
        <div className="flex flex-wrap gap-1.5">
          <Chip pass={s?.slope}>
            Slope {a ? `${a.slopeDeg.toFixed(1)}°` : DASH} {"<"} {CRITERIA.maxSlopeDeg}°
          </Chip>
          <Chip pass={s?.earth}>
            Earth {pct(a?.earthMean)}% ≥ {CRITERIA.minEarth * 100}%
          </Chip>
          <Chip pass={s?.sun}>
            Sun {pct(a?.sunAny)}% ≥ {CRITERIA.minSun * 100}%
          </Chip>
        </div>
        <div className="mt-2 flex items-start justify-between gap-2 text-2xs text-fg-faint leading-4">
          <span>Thresholds from NASA Artemis III site screening (applied to this window)</span>
          <SourceLink href={CRITERIA_SOURCE} />
        </div>
      </Section>

      {onSite && (
        <Section title="Mast height" aside={<SourceLink href={MAST_SOURCE} />}>
          <Slider
            label="Panel height above ground"
            min={0}
            max={MASTS.length - 1}
            step={1}
            value={mastIndex}
            onChange={(k) => setMastHeight(MASTS[k])}
            valueLabel={`${MASTS[mastIndex]} m`}
          />
          <div className="tabular mt-1 flex justify-between px-0.5 text-[10px] text-fg-faint">
            {MASTS.map((m) => (
              <span key={m}>{m} m</span>
            ))}
          </div>
          <p className="mt-2 text-2xs text-fg-muted leading-4">
            Raising the panels catches light over nearby ridges. At Connecting Ridge, average light rises from about 76%
            at ground level to 88% on a 2 m mast.
          </p>
        </Section>
      )}
    </>
  );
}
