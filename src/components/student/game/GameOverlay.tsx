"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  BatteryWarning,
  CellSignalFull,
  CellSignalSlash,
  MapTrifold,
  Medal,
  Moon,
  RocketLaunch,
  Sun,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
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
  MAX_SLOPE_DEG,
  MISSIONS,
  type Mission,
  RANKS,
  sampleAt,
  scoreMission,
  TIP_OVER_SOURCE,
} from "./missions";

/** Real-time length of the mission time-lapse. */
const TIMELAPSE_MS = 10_000;
/** With reduced motion the Sun and Earth jump in 6-hour steps instead of sweeping smoothly. */
const REDUCED_STEP_MS = 6 * HOUR;
/** How long the tip-over notice stays before the debrief opens. */
const TIP_NOTICE_MS = 2_500;
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
 * Mount in the AppShell `overlay` slot. While the player picks a spot it only adds a small
 * countdown + LAND HERE pill below lg (where the game panel is a closable sheet), so the terrain
 * stays clickable.
 */
export function GameOverlay() {
  const phase = useGame((s) => s.phase);
  return (
    <>
      {phase === "choose" && <ChoosePill />}
      {phase === "landing" && <LandingSequence />}
      <Debrief />
    </>
  );
}

/** Compact countdown and LAND HERE button for screens where the game panel can be hidden. */
function ChoosePill() {
  const deadline = useGame((s) => s.deadline);
  const land = useGame((s) => s.land);
  const placed = useApp((s) => s.landers.A !== undefined);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));

  // The time-up action itself is owned by the panel's countdown ring, which stays mounted.
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <div className="glass pointer-events-auto absolute bottom-[156px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 lg:hidden max-md:bottom-[224px]">
      <span
        role="timer"
        aria-label={`${seconds} seconds left to pick a landing spot`}
        className={cn("tabular text-sm", seconds <= 10 ? "text-danger" : "text-fg")}
      >
        {seconds}
        <span className="text-fg-faint text-xs"> s</span>
      </span>
      <span className="whitespace-nowrap text-fg-muted text-xs">{placed ? "Spot picked" : "Tap the ground"}</span>
      <Button variant="primary" size="sm" disabled={!placed} onClick={land} className="rounded-full">
        <RocketLaunch size={14} weight="regular" />
        LAND HERE
      </Button>
    </div>
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
    Math.hypot(analysis.x - lander.x, analysis.y - lander.y) < MATCH_TOLERANCE_M &&
    analysis.series.start === mission.start &&
    (analysis.series.sunFraction.length - 1) * analysis.series.stepMinutes * 60_000 >= end - mission.start;
  const current = ready ? analysis : null;
  const tipped = current !== null && current.slopeDeg > MAX_SLOPE_DEG;

  // Lander removed (e.g. region switched) mid-sequence: nothing left to land.
  useEffect(() => {
    if (!lander) abort();
  }, [lander, abort]);

  useEffect(() => {
    if (!current) return;
    // A tipped lander never deploys: no time-lapse, just the notice, then the debrief.
    if (current.slopeDeg > MAX_SLOPE_DEG) {
      const timer = setTimeout(() => finish(scoreMission(mission, current)), TIP_NOTICE_MS);
      return () => clearTimeout(timer);
    }
    const { setTime } = useApp.getState();
    const span = end - mission.start;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / TIMELAPSE_MS);
      let elapsed = p * span;
      if (reducedMotion && p < 1) elapsed = Math.floor(elapsed / REDUCED_STEP_MS) * REDUCED_STEP_MS;
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
    if (current.slopeDeg <= MAX_SLOPE_DEG) useApp.getState().setTime(end);
    finish(scoreMission(mission, current));
  }, [current, mission, end, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  // Below xl the side panels would sit under the readout: the landing layer owns the screen there.
  return (
    <div className="pointer-events-none absolute inset-0 z-30 max-xl:pointer-events-auto max-xl:bg-canvas/55">
      {tipped && current ? (
        <TippedNotice mission={mission} slopeDeg={current.slopeDeg} reducedMotion={reducedMotion} onSkip={skip} />
      ) : (
        <LandingHud mission={mission} analysis={current} onSkip={skip} />
      )}
    </div>
  );
}

const hudCard =
  "glass pointer-events-auto absolute top-[84px] left-1/2 w-[min(540px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl p-4 max-md:top-[120px]";

function SkipButton({ onSkip, disabled }: { onSkip: () => void; disabled?: boolean }) {
  return (
    <Button variant="ghost" size="sm" onClick={onSkip} disabled={disabled} className="shrink-0">
      <span className="max-sm:hidden">Skip to results</span>
      <span className="sm:hidden">Skip</span>
      <Kbd className="max-sm:hidden">Esc</Kbd>
    </Button>
  );
}

/** Side-on lander outline (body, mast, legs) for the tip-over notice. */
function LanderGlyph() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="12" y="12" width="16" height="14" rx="2" />
      <path d="M20 12V5M17 5h6M12 26l-5 9M28 26l5 9M4 35h6M30 35h6" strokeLinecap="round" />
    </svg>
  );
}

function TippedNotice({
  mission,
  slopeDeg,
  reducedMotion,
  onSkip,
}: {
  mission: Mission;
  slopeDeg: number;
  reducedMotion: boolean;
  onSkip: () => void;
}) {
  const tilted = { transform: "rotate(78deg)" };
  return (
    <section aria-label="Landing result" className={hudCard}>
      <div className="flex items-center justify-between gap-3">
        <div className="eyebrow min-w-0 truncate">Mission · {mission.title}</div>
        <SkipButton onSkip={onSkip} />
      </div>
      <div className="mt-3 flex items-center gap-4" role="alert">
        <div className="flex size-16 shrink-0 items-end justify-center border-line-strong border-b pb-px text-danger">
          <motion.div
            className="size-12 origin-[85%_100%]"
            initial={reducedMotion ? tilted : { transform: "rotate(0deg)" }}
            animate={tilted}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.77, 0, 0.175, 1] }}
          >
            <LanderGlyph />
          </motion.div>
        </div>
        <div className="min-w-0">
          <div className="font-medium text-danger text-lg">Tipped over!</div>
          <p className="text-fg-muted text-sm">
            The ground here tilts <span className="tabular">{Math.round(slopeDeg)}°</span>, steeper than the{" "}
            <span className="tabular">{MAX_SLOPE_DEG}°</span> safe limit. The lander fell on its side as it touched
            down.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <Cell
          label="Battery"
          icon={<BatteryWarning size={18} weight="regular" className="text-danger" />}
          value="Not deployed"
        />
        <Cell
          label="Solar panels"
          icon={<Sun size={18} weight="regular" className="text-fg-faint" />}
          value="Facing the ground"
        />
      </div>
      <p className="mt-3 text-fg-faint text-xs">Mission report coming up…</p>
    </section>
  );
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
  const progress = Math.min(1, Math.max(0, (time - mission.start) / (end - mission.start)));

  let soc = 100;
  let sunUp: boolean | null = null;
  let earthUp: boolean | null = null;
  let charge: "full" | "charging" | "draining" = "full";
  if (analysis) {
    const { series, power } = analysis;
    const { i, j, f } = sampleAt(series, time);
    soc = Math.max(0, power.socPct[i] + (power.socPct[j] - power.socPct[i]) * f);
    sunUp = series.sunFraction[i] > 0;
    earthUp = series.earthFraction[i] > 0;
    const watts = power.watts[i];
    charge = soc >= 99.5 && watts >= loadW ? "full" : watts > loadW ? "charging" : "draining";
  }
  const empty = analysis !== null && soc <= 0;
  const low = soc <= 20;
  const day = Math.min(mission.days, Math.floor(progress * mission.days) + 1);

  return (
    <>
      {/* Edges dim while the lander sits in shadow. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 shadow-[inset_0_0_180px_60px_oklch(0.05_0.01_270/0.75)] transition-opacity duration-700 ease-(--ease-in-out)",
          sunUp === false ? "opacity-100" : "opacity-0",
        )}
      />
      <section aria-label="Landing time-lapse" className={hudCard}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow truncate">Mission · {mission.title}</div>
            <div className="tabular mt-0.5 text-fg text-sm">
              Day {day} of {mission.days}
              <span className="ml-2 text-fg-faint">{dateFmt.format(time)} UTC</span>
            </div>
          </div>
          <SkipButton onSkip={onSkip} disabled={!analysis} />
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/6" aria-hidden="true">
          <div className="h-full origin-left bg-fg-faint" style={{ transform: `scaleX(${progress})` }} />
        </div>

        {analysis ? (
          <>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Battery</span>
                <span className={cn("text-xs", empty ? "text-danger" : "text-fg-muted")}>
                  {empty
                    ? "Empty: lander asleep"
                    : charge === "full"
                      ? "Full"
                      : charge === "charging"
                        ? "Charging in sunlight"
                        : "Draining"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <meter className="sr-only" aria-label="Battery charge" min={0} max={100} value={Math.round(soc)} />
                <div
                  aria-hidden="true"
                  className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/6 ring-1 ring-line"
                >
                  <div
                    className={cn("h-full origin-left", low ? "bg-danger" : "bg-sun")}
                    style={{ transform: `scaleX(${soc / 100})` }}
                  />
                  {[25, 50, 75].map((t) => (
                    <span key={t} className="absolute inset-y-0 w-px bg-canvas/60" style={{ left: `${t}%` }} />
                  ))}
                </div>
                <span className={cn("tabular w-[4.5ch] text-right text-3xl", low ? "text-danger" : "text-sun")}>
                  {Math.round(soc)}
                  <span className="text-fg-faint text-sm">%</span>
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <Cell
                label="Sunlight"
                icon={
                  sunUp ? (
                    <Sun size={18} weight="regular" className="text-sun" />
                  ) : (
                    <Moon size={18} weight="regular" className="text-[oklch(0.7_0.05_270)]" />
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
                    <CellSignalFull size={18} weight="regular" className="text-earth" />
                  ) : (
                    <CellSignalSlash size={18} weight="regular" className="text-fg-faint" />
                  )
                }
                value={earthUp ? "Connected" : "Earth hidden"}
              />
            </div>
            <p className="sr-only" aria-live="polite">
              {sunUp ? "In sunlight." : "In shadow."} {earthUp ? "Earth in view." : "Earth hidden."}
              {empty ? " Battery empty." : ""}
            </p>
          </>
        ) : (
          <p className="mt-4 text-fg-muted text-sm" aria-live="polite">
            Touchdown. Working out when the Sun and Earth are above the hills around you…
          </p>
        )}
      </section>
    </>
  );
}

/** Readout tile: stacked on wide screens, one compact row (label left, value right) on phones. */
function Cell({ label, icon, value, hint }: { label: string; icon: ReactNode; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white/3 px-3 py-2 ring-1 ring-line sm:block sm:py-2.5">
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        {hint && <div className="text-2xs text-fg-faint sm:hidden">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-fg text-sm sm:mt-1">
        <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
        <span>{value}</span>
      </div>
      {hint && <div className="mt-0.5 text-2xs text-fg-faint max-sm:hidden">{hint}</div>}
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
  const keepMissionScene = useGame((s) => s.keepMissionScene);
  const setMode = useApp((s) => s.setMode);
  if (!result) return null;

  const index = MISSIONS.findIndex((m) => m.id === result.missionId);
  const mission = MISSIONS[index];
  const passed = !result.tipped && result.goalSurvive && result.goalEarth;
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
              passed ? "bg-sun-soft text-sun ring-sun/40" : "bg-white/6 text-fg-muted ring-line",
            )}
            aria-hidden="true"
          >
            <Medal size={28} weight="light" />
          </div>
          <div className="min-w-0">
            <div className="eyebrow">Your badge</div>
            <div className="font-medium text-fg text-xl tracking-[-0.01em]">{result.rank}</div>
            <div className="tabular text-fg-muted text-xs">Score {result.score} / 100</div>
          </div>
        </div>

        <ol className="flex flex-wrap gap-1.5" aria-label="Badge ranks">
          {RANKS.map((r, i) => (
            <li key={r}>
              <Badge
                tone={i === earned ? "sun" : "neutral"}
                className={cn("whitespace-nowrap", i > earned && "opacity-50")}
              >
                {r}
              </Badge>
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Stat
            label="Ground tilt"
            value={Math.round(result.slopeDeg)}
            unit="°"
            tone={result.tipped ? "danger" : "ok"}
            hint={`Safe below ${MAX_SLOPE_DEG}°`}
          />
          <Stat
            label="Powered"
            value={days}
            unit={`/ ${mission.days} d`}
            tone={result.goalSurvive ? "ok" : "danger"}
            hint={`Goal ${mission.minDays} days`}
          />
          <Stat
            label="Min battery"
            value={Math.round(result.minSocPct)}
            unit="%"
            tone={result.minSocPct <= 20 ? "danger" : "sun"}
            hint="lowest point"
          />
          <Stat
            label="Earth view"
            value={Math.round(result.earthUp * 100)}
            unit="%"
            tone="earth"
            hint={`Goal ${Math.round(mission.minEarth * 100)}%`}
          />
          <Stat label="Sunlight" value={Math.round(result.sunUp * 100)} unit="%" tone="sun" hint="of the time" />
          <Stat
            label="Longest dark"
            value={
              result.longestDarkHours >= 48
                ? (result.longestDarkHours / 24).toFixed(1)
                : Math.round(result.longestDarkHours)
            }
            unit={result.longestDarkHours >= 48 ? "days" : "h"}
            tone="night"
            hint="in a row"
          />
        </div>

        <div className="flex flex-col gap-2 text-fg text-sm">
          <p>{result.sentences[0]}</p>
          <p>{result.sentences[1]}</p>
        </div>

        <p className="text-2xs text-fg-faint">
          Numbers come from the same horizon analysis as Mission planning. Power assumes upright Sun-tracking panels;
          the slope and Earth goals follow NASA landing-site screening.{" "}
          <a
            href={EARTH_GOAL_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted"
          >
            Source
          </a>
          {result.tipped && (
            <>
              {" · "}
              <a
                href={TIP_OVER_SOURCE}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted"
              >
                IM-1 tip-over
              </a>
            </>
          )}
        </p>

        {/* Actions stay pinned to the dialog's bottom edge while the report scrolls on small screens. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap gap-2 border-line border-t bg-surface px-5 py-3">
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
              keepMissionScene();
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
