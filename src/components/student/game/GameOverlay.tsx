"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  CellSignalFull,
  CellSignalSlash,
  MapTrifold,
  Medal,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Kbd, Stat } from "@/components/ui/panel";
import { usePointAnalysis } from "@/lib/analysis";
import type { PointAnalysis } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import { DAY, HOUR, useApp } from "@/lib/store";
import { useGame } from "./game-store";
import {
  EARTH_GOAL_SOURCE,
  MISSIONS,
  type Mission,
  RANKS,
  sampleAt,
  scoreMission,
} from "./missions";

/** Real-time length of the mission time-lapse. */
const TIMELAPSE_MS = 10_000;
/** With reduced motion the Sun and Earth jump in 6-hour steps instead of sweeping smoothly. */
const REDUCED_STEP_MS = 6 * HOUR;
/** Analysis may sit on a nearby grid node; accept it within this distance of the lander (m). */
const MATCH_TOLERANCE_M = 100;

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Full-screen game layer: the landing time-lapse (first-person, ~10 s) and the debrief dialog.
 * Mount in the AppShell `overlay` slot. Renders nothing while the player picks a spot, so the
 * terrain stays clickable.
 */
export function GameOverlay() {
  const phase = useGame((s) => s.phase);
  return (
    <>
      {phase === "landing" && <LandingSequence />}
      <Debrief />
    </>
  );
}

function LandingSequence() {
  const index = useGame((s) => s.missionIndex);
  const finish = useGame((s) => s.finish);
  const abort = useGame((s) => s.abort);
  const lander = useApp((s) => s.landers.A);
  const analysis = usePointAnalysis("A");
  const reducedMotion = useReducedMotion() ?? false;
  const mission = MISSIONS[index];
  const end = mission.start + mission.days * DAY;

  const ready =
    analysis !== null &&
    lander !== undefined &&
    analysis.siteId === lander.siteId &&
    Math.hypot(analysis.x - lander.x, analysis.y - lander.y) <
      MATCH_TOLERANCE_M &&
    analysis.series.start === mission.start &&
    (analysis.series.sunFraction.length - 1) *
      analysis.series.stepMinutes *
      60_000 >=
      end - mission.start;
  const current = ready ? analysis : null;

  // Lander removed (e.g. region switched) mid-sequence: nothing left to land.
  useEffect(() => {
    if (!lander) abort();
  }, [lander, abort]);

  useEffect(() => {
    if (!current) return;
    const { setTime } = useApp.getState();
    const span = end - mission.start;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / TIMELAPSE_MS);
      let elapsed = p * span;
      if (reducedMotion && p < 1)
        elapsed = Math.floor(elapsed / REDUCED_STEP_MS) * REDUCED_STEP_MS;
      setTime(mission.start + elapsed);
      if (p >= 1) {
        finish(scoreMission(mission, current));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current, mission, end, reducedMotion, finish]);

  const skip = useCallback(() => {
    if (!current) return;
    useApp.getState().setTime(end);
    finish(scoreMission(mission, current));
  }, [current, mission, end, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  return <LandingHud mission={mission} analysis={current} onSkip={skip} />;
}

function LandingHud({
  mission,
  analysis,
  onSkip,
}: {
  mission: Mission;
  analysis: PointAnalysis | null;
  onSkip: () => void;
}) {
  const time = useApp((s) => s.time);
  const loadW = useApp((s) => s.power.loadW);
  const end = mission.start + mission.days * DAY;
  const progress = Math.min(
    1,
    Math.max(0, (time - mission.start) / (end - mission.start)),
  );

  let soc = 100;
  let sunUp: boolean | null = null;
  let earthUp: boolean | null = null;
  let charging = false;
  if (analysis) {
    const { series, power } = analysis;
    const { i, j, f } = sampleAt(series, time);
    soc = Math.max(
      0,
      power.socPct[i] + (power.socPct[j] - power.socPct[i]) * f,
    );
    sunUp = series.sunFraction[i] > 0;
    earthUp = series.earthFraction[i] > 0;
    charging = power.watts[i] > loadW && soc < 100;
  }
  const empty = analysis !== null && soc <= 0;
  const low = soc <= 20;
  const day = Math.min(mission.days, Math.floor(progress * mission.days) + 1);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Edges dim while the lander sits in shadow. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 shadow-[inset_0_0_180px_60px_oklch(0.05_0.01_270/0.75)] transition-opacity duration-700 ease-(--ease-in-out)",
          sunUp === false ? "opacity-100" : "opacity-0",
        )}
      />
      <section
        aria-label="Landing time-lapse"
        className="glass pointer-events-auto absolute top-[84px] left-1/2 w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Mission · {mission.title}</div>
            <div className="tabular mt-0.5 text-fg text-sm">
              Day {day} of {mission.days}
              <span className="ml-2 text-fg-faint">
                {dateFmt.format(time)} UTC
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={!analysis}
          >
            Skip to results <Kbd>Esc</Kbd>
          </Button>
        </div>

        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-white/6"
          aria-hidden="true"
        >
          <div
            className="h-full origin-left bg-fg-faint"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>

        {analysis ? (
          <>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Battery</span>
                <span
                  className={cn(
                    "text-xs",
                    empty ? "text-danger" : "text-fg-muted",
                  )}
                >
                  {empty
                    ? "Empty: lander asleep"
                    : charging
                      ? "Charging in sunlight"
                      : "Draining"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <meter
                  className="sr-only"
                  aria-label="Battery charge"
                  min={0}
                  max={100}
                  value={Math.round(soc)}
                />
                <div
                  aria-hidden="true"
                  className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/6 ring-1 ring-line"
                >
                  <div
                    className={cn(
                      "h-full origin-left",
                      low ? "bg-danger" : "bg-sun",
                    )}
                    style={{ transform: `scaleX(${soc / 100})` }}
                  />
                  {[25, 50, 75].map((t) => (
                    <span
                      key={t}
                      className="absolute inset-y-0 w-px bg-canvas/60"
                      style={{ left: `${t}%` }}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    "tabular w-[4.5ch] text-right text-3xl",
                    low ? "text-danger" : "text-sun",
                  )}
                >
                  {Math.round(soc)}
                  <span className="text-fg-faint text-sm">%</span>
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Cell
                label="Sunlight"
                icon={
                  sunUp ? (
                    <Sun size={18} weight="regular" className="text-sun" />
                  ) : (
                    <Moon
                      size={18}
                      weight="regular"
                      className="text-[oklch(0.7_0.05_270)]"
                    />
                  )
                }
                value={sunUp ? "In sunlight" : "In shadow"}
              />
              <Cell
                label="Temperature"
                icon={<Thermometer warm={sunUp === true} />}
                value={sunUp ? "Warm-ish" : "Freezing"}
                hint="Illustrative, not measured"
              />
              <Cell
                label="Earth signal"
                icon={
                  earthUp ? (
                    <CellSignalFull
                      size={18}
                      weight="regular"
                      className="text-earth"
                    />
                  ) : (
                    <CellSignalSlash
                      size={18}
                      weight="regular"
                      className="text-fg-faint"
                    />
                  )
                }
                value={earthUp ? "Connected" : "Earth hidden"}
              />
            </div>
            <p className="sr-only" aria-live="polite">
              {sunUp ? "In sunlight." : "In shadow."}{" "}
              {earthUp ? "Earth in view." : "Earth hidden."}
              {empty ? " Battery empty." : ""}
            </p>
          </>
        ) : (
          <p className="mt-4 text-fg-muted text-sm" aria-live="polite">
            Touchdown. Working out when the Sun and Earth are above the hills
            around you…
          </p>
        )}
      </section>
    </div>
  );
}

function Cell({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white/3 px-3 py-2.5 ring-1 ring-line">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-fg text-sm">
        <span
          className="flex size-5 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="truncate">{value}</span>
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-2xs text-fg-faint">{hint}</div>
      )}
    </div>
  );
}

/** Qualitative thermometer: high fill in sunlight, low in shadow. No temperature is computed. */
function Thermometer({ warm }: { warm: boolean }) {
  return (
    <span className="relative flex h-5 w-2 overflow-hidden rounded-full bg-white/8 ring-1 ring-line">
      <span
        className={cn(
          "absolute inset-0 origin-bottom transition-transform duration-500 ease-(--ease-in-out)",
          warm ? "scale-y-75 bg-sun" : "scale-y-20 bg-[oklch(0.7_0.05_270)]",
        )}
      />
    </span>
  );
}

function Debrief() {
  const phase = useGame((s) => s.phase);
  const result = useGame((s) => s.result);
  const start = useGame((s) => s.start);
  const openMission = useGame((s) => s.openMission);
  const back = useGame((s) => s.backToMissions);
  const setMode = useApp((s) => s.setMode);
  if (!result) return null;

  const index = MISSIONS.findIndex((m) => m.id === result.missionId);
  const mission = MISSIONS[index];
  const passed = result.goalSurvive && result.goalEarth;
  const earned = RANKS.indexOf(result.rank);
  const hasNext = index < MISSIONS.length - 1;
  const days = result.aliveDays.toFixed(1).replace(/\.0$/, "");

  return (
    <Dialog
      open={phase === "result"}
      onOpenChange={(open) => {
        if (!open) back();
      }}
      title={`${mission.title}: ${passed ? "mission complete" : "mission failed"}`}
      description={`${mission.regionName} · ${mission.days} days from ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(mission.start)}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full ring-1",
              passed
                ? "bg-sun-soft text-sun ring-sun/40"
                : "bg-white/6 text-fg-muted ring-line",
            )}
            aria-hidden="true"
          >
            <Medal size={28} weight="light" />
          </div>
          <div className="min-w-0">
            <div className="eyebrow">Your badge</div>
            <div className="font-medium text-fg text-xl tracking-[-0.01em]">
              {result.rank}
            </div>
            <div className="tabular text-fg-muted text-xs">
              Score {result.score} / 100
            </div>
          </div>
        </div>

        <ol className="flex flex-wrap gap-1.5" aria-label="Badge ranks">
          {RANKS.map((r, i) => (
            <li key={r}>
              <Badge
                tone={i === earned ? "sun" : "neutral"}
                className={cn(i > earned && "opacity-50")}
              >
                {r}
              </Badge>
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Powered"
            value={days}
            unit={`/ ${mission.days} d`}
            tone={result.goalSurvive ? "ok" : "danger"}
            hint={`Goal ${mission.minDays} days`}
          />
          <Stat
            label="Lowest battery"
            value={Math.round(result.minSocPct)}
            unit="%"
            tone={result.minSocPct <= 20 ? "danger" : "sun"}
          />
          <Stat
            label="Earth in view"
            value={Math.round(result.earthUp * 100)}
            unit="%"
            tone="earth"
            hint={`Goal ${Math.round(mission.minEarth * 100)}%`}
          />
          <Stat
            label="Sunlight"
            value={Math.round(result.sunUp * 100)}
            unit="%"
            tone="sun"
            hint="of the time"
          />
        </div>

        <div className="flex flex-col gap-2 text-fg text-sm">
          <p>{result.sentences[0]}</p>
          <p>{result.sentences[1]}</p>
        </div>

        <p className="text-2xs text-fg-faint">
          Numbers come from the same horizon analysis as Mission planning. Power
          assumes upright Sun-tracking panels; the Earth goal follows NASA
          landing-site screening.{" "}
          <a
            href={EARTH_GOAL_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted"
          >
            Source
          </a>
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant={passed ? "secondary" : "primary"} onClick={start}>
            <ArrowCounterClockwise size={16} weight="regular" />
            Retry
          </Button>
          <Button
            variant={passed ? "primary" : "secondary"}
            onClick={() => (hasNext ? openMission(index + 1) : back())}
          >
            {hasNext ? "Next mission" : "All missions"}
            <ArrowRight size={16} weight="regular" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              back();
              setMode("science");
            }}
          >
            <MapTrifold size={16} weight="light" />
            See it in Mission planning
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
