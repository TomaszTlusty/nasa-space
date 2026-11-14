"use client";

import {
  Angle,
  ArrowCounterClockwise,
  BatteryHigh,
  CaretLeft,
  CellSignalFull,
  MapTrifold,
  RocketLaunch,
  Target,
} from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Switch } from "@/components/ui/overlay";
import { Badge, Divider, Panel, PanelHeader } from "@/components/ui/panel";
import { usePointAnalysis, useWindowAverage } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { CountdownRing } from "./CountdownRing";
import { CHOOSE_SECONDS, useGame } from "./game-store";
import { EARTH_GOAL_SOURCE, MAX_SLOPE_DEG, MISSIONS, type Mission, TIP_OVER_SOURCE } from "./missions";

/** The analysis may sit on the nearest grid node; accept it within this distance of the lander (m). */
const MATCH_TOLERANCE_M = 100;

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * "Mission: Survive" — left column in Student mode. Mission list, brief, the 45 s spot picker and
 * the in-flight status. The landing time-lapse and debrief live in `GameOverlay`.
 */
export function GamePanel() {
  const phase = useGame((s) => s.phase);
  return (
    <Panel aria-label="Mission: Survive" className="flex min-h-0 flex-col overflow-y-auto">
      {phase === "select" || phase === "result" ? (
        <MissionList />
      ) : phase === "brief" ? (
        <Brief />
      ) : phase === "choose" ? (
        <Choose />
      ) : phase === "missed" ? (
        <Missed />
      ) : (
        <InFlight />
      )}
    </Panel>
  );
}

function Difficulty({ level }: { level: Mission["difficulty"] }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`Difficulty ${level} of 3`}>
      {[1, 2, 3].map((d) => (
        <span key={d} className={cn("size-1.5 rounded-full", d <= level ? "bg-fg-muted" : "bg-white/10")} />
      ))}
    </span>
  );
}

function MissionList() {
  const best = useGame((s) => s.best);
  const openMission = useGame((s) => s.openMission);
  return (
    <>
      <PanelHeader eyebrow="Mission: Survive" title="Land the lander!" />
      <p className="px-4 pb-3 text-fg-muted text-sm">
        Pick a spot on the real lunar terrain. Your lander needs sunlight for power and Earth in view to radio home.
      </p>
      <ul className="flex flex-col gap-2 px-3 pb-3">
        {MISSIONS.map((m, i) => {
          const rank = best[m.id];
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => openMission(i)}
                className="w-full rounded-lg bg-white/3 px-3 py-2.5 text-left ring-1 ring-line transition-[transform,background-color] duration-150 ease-(--ease-out) hover:bg-white/6 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-fg text-sm">
                    <span className="tabular mr-2 text-fg-faint">{i + 1}</span>
                    {m.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {rank && (
                      <Badge tone="sun" className="whitespace-nowrap">
                        {rank}
                      </Badge>
                    )}
                    <Difficulty level={m.difficulty} />
                  </span>
                </div>
                <div className="mt-1 whitespace-nowrap text-fg-muted text-xs">
                  {m.regionShort} · <span className="tabular">{dateFmt.format(m.start)}</span> ·{" "}
                  <span className="tabular">{m.days}</span> days
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Goals({ mission }: { mission: Mission }) {
  return (
    <ul className="flex flex-col gap-2 text-fg text-sm">
      <li className="flex items-start gap-2.5">
        <Angle size={16} weight="light" className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
        <span>
          Land on ground flatter than <span className="tabular">{MAX_SLOPE_DEG}°</span>, or the lander tips over{" "}
          <a
            href={TIP_OVER_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="text-fg-faint text-xs underline decoration-line-strong underline-offset-2 hover:text-fg-muted"
          >
            Source
          </a>
        </span>
      </li>
      <li className="flex items-start gap-2.5">
        <BatteryHigh size={16} weight="light" className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />
        <span>
          Keep the battery above <span className="tabular">0%</span> for{" "}
          {mission.minDays === mission.days ? (
            <>
              all <span className="tabular">{mission.days}</span> days
            </>
          ) : (
            <>
              at least <span className="tabular">{mission.minDays}</span> of the{" "}
              <span className="tabular">{mission.days}</span> days
            </>
          )}
        </span>
      </li>
      <li className="flex items-start gap-2.5">
        <CellSignalFull size={16} weight="light" className="mt-0.5 shrink-0 text-earth" aria-hidden="true" />
        <span>
          See Earth at least <span className="tabular">{Math.round(mission.minEarth * 100)}%</span> of the time, so you
          can radio home{" "}
          <a
            href={EARTH_GOAL_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="text-fg-faint text-xs underline decoration-line-strong underline-offset-2 hover:text-fg-muted"
          >
            Source
          </a>
        </span>
      </li>
    </ul>
  );
}

function Brief() {
  const index = useGame((s) => s.missionIndex);
  const back = useGame((s) => s.backToMissions);
  const start = useGame((s) => s.start);
  const power = useApp((s) => s.power);
  const mission = MISSIONS[index];
  return (
    <>
      <PanelHeader
        eyebrow={`Mission ${index + 1} of ${MISSIONS.length}`}
        title={mission.title}
        actions={
          <IconButton label="Back to missions" size="sm" onClick={back}>
            <CaretLeft size={14} weight="regular" />
          </IconButton>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-fg-muted text-sm">{mission.story}</p>
        <div className="text-fg-faint text-xs">
          {mission.regionName} · <span className="tabular">{dateFmt.format(mission.start)}</span>
        </div>
        <Divider />
        <div>
          <div className="eyebrow mb-2">Your goal</div>
          <Goals mission={mission} />
        </div>
        <p className="flex items-start gap-2.5 text-fg-muted text-xs">
          <Target size={14} weight="light" className="mt-0.5 shrink-0" aria-hidden="true" />
          {mission.hint}
        </p>
        <p className="text-2xs text-fg-faint">
          Your lander: <span className="tabular">{(power.batteryWh / 1000).toFixed(1)}</span> kWh battery,{" "}
          <span className="tabular">{power.loadW}</span> W always on, upright Sun-tracking solar panels (an illustrative
          design).
        </p>
        <Button variant="primary" size="lg" onClick={start} className="mt-1 w-full">
          <RocketLaunch size={18} weight="regular" />
          Start: <span className="tabular">{CHOOSE_SECONDS}</span> s to pick a spot
        </Button>
      </div>
    </>
  );
}

function Choose() {
  const index = useGame((s) => s.missionIndex);
  const deadline = useGame((s) => s.deadline);
  const land = useGame((s) => s.land);
  const timeUp = useGame((s) => s.timeUp);
  const abort = useGame((s) => s.abort);
  const lander = useApp((s) => s.landers.A);
  const analysis = usePointAnalysis("A");
  const placing = useApp((s) => s.placing);
  const overlay = useApp((s) => s.overlay);
  const setOverlay = useApp((s) => s.setOverlay);
  const setPlacing = useApp((s) => s.setPlacing);
  const reducedMotion = useReducedMotion() ?? false;
  const mission = MISSIONS[index];
  const slopeDeg =
    lander && analysis && Math.hypot(analysis.x - lander.x, analysis.y - lander.y) < MATCH_TOLERANCE_M
      ? analysis.slopeDeg
      : null;
  const helperOn = overlay === "average";

  // The heatmap needs the window average for this mission window.
  useWindowAverage(helperOn);

  // Every terrain click (re)places lander A while choosing: keep placement armed.
  useEffect(() => {
    if (placing !== "A") setPlacing("A");
  }, [placing, setPlacing]);

  return (
    <>
      <PanelHeader eyebrow={`Mission ${index + 1} · ${mission.title}`} title="Pick your landing spot" />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex items-center gap-4">
          <CountdownRing
            deadline={deadline}
            totalSeconds={CHOOSE_SECONDS}
            reducedMotion={reducedMotion}
            onDone={timeUp}
          />
          <p className="text-fg-muted text-sm">
            Click the terrain to place your lander. Click again to move it. When time runs out, it lands where it is.
          </p>
        </div>
        <div className="rounded-lg bg-white/3 p-3 ring-1 ring-line">
          <Switch
            checked={helperOn}
            onChange={(on) => setOverlay(on ? "average" : "none")}
            label={
              <span className="flex items-center gap-2 text-fg">
                <MapTrifold size={16} weight="light" aria-hidden="true" />
                Helper map
              </span>
            }
          />
          <p className="mt-1.5 text-fg-faint text-xs">
            Shows how much sunlight each spot gets during this mission. Brighter ground means more power.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs" aria-live="polite">
          <span className="text-fg-faint">Landing spot</span>
          {!lander ? (
            <Badge>Not picked yet</Badge>
          ) : slopeDeg === null ? (
            <Badge>Checking the ground…</Badge>
          ) : slopeDeg > MAX_SLOPE_DEG ? (
            <Badge tone="danger" className="tabular">
              Too steep: {Math.round(slopeDeg)}°
            </Badge>
          ) : (
            <Badge tone="ok" className="tabular">
              Flat enough: {Math.round(slopeDeg)}°
            </Badge>
          )}
        </div>
        <Button variant="primary" size="lg" disabled={!lander} onClick={land} className="w-full">
          <RocketLaunch size={18} weight="regular" />
          LAND HERE
        </Button>
        <Button variant="ghost" size="sm" onClick={abort} className="self-center">
          Cancel mission
        </Button>
      </div>
    </>
  );
}

function Missed() {
  const start = useGame((s) => s.start);
  const back = useGame((s) => s.backToMissions);
  return (
    <>
      <PanelHeader eyebrow="Mission: Survive" title="Time's up" />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-fg-muted text-sm">
          The lander ran out of hover time before a landing spot was picked. Click the terrain sooner next time.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={start} className="flex-1">
            <ArrowCounterClockwise size={16} weight="regular" />
            Try again
          </Button>
          <Button onClick={back}>All missions</Button>
        </div>
      </div>
    </>
  );
}

function InFlight() {
  const index = useGame((s) => s.missionIndex);
  const abort = useGame((s) => s.abort);
  const mission = MISSIONS[index];
  return (
    <>
      <PanelHeader eyebrow={`Mission ${index + 1} · ${mission.title}`} title="Touchdown!" />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-fg-muted text-sm">
          You are looking out from your lander. Watch the battery, the Sun and the Earth signal while the mission days
          fly by.
        </p>
        <Goals mission={mission} />
        <Button variant="ghost" size="sm" onClick={abort} className="self-center">
          Cancel mission
        </Button>
      </div>
    </>
  );
}
