"use client";

import { ChartLine, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useMemo } from "react";
import { Area, ComposedChart, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { Button, IconButton } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { usePointAnalysis } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { type ChartsTab, useCharts } from "./charts-state";
import { GanttStrips } from "./GanttStrips";
import { buildChartData, type ChartRow, tickLabel } from "./series";

/* Plot-area geometry is fixed so the playhead can be drawn as a cheap overlay instead of re-rendering
 * every series on each animation frame. */
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const Y_AXIS_W = 44;
const X_AXIS_H = 20;

const axisProps = {
  axisLine: { stroke: "var(--color-line)" },
  tickLine: false,
  tick: {
    fill: "var(--color-fg-faint)",
    fontSize: 10,
    fontFamily: "var(--font-mono)",
  },
} as const;

const tooltipProps = {
  isAnimationActive: false,
  cursor: { stroke: "var(--color-line-strong)" },
  contentStyle: {
    background: "var(--color-surface-3)",
    border: "1px solid var(--color-line-strong)",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums",
  },
  labelStyle: { color: "var(--color-fg-muted)", marginBottom: 2 },
  itemStyle: { padding: 0 },
  labelFormatter: (t: unknown) => `${new Date(Number(t)).toISOString().slice(0, 16).replace("T", " ")} UTC`,
};

const SUN = "var(--color-sun)";
const EARTH = "var(--color-earth)";
const FG = "var(--color-fg)";

interface ChartProps {
  rows: ChartRow[];
  domain: [number, number];
  ticks: number[];
  hasA: boolean;
  hasB: boolean;
}

/** A solid and prominent, B thinner and translucent. */
const stroke = (id: "a" | "b") => (id === "a" ? { strokeWidth: 1.5 } : { strokeWidth: 1, strokeOpacity: 0.65 });

function xAxis(domain: [number, number], ticks: number[]) {
  return (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      height={X_AXIS_H}
      tickFormatter={(t: number) => tickLabel(t, domain)}
      {...axisProps}
    />
  );
}

const SkyChart = memo(function SkyChart({ rows, domain, ticks, hasA, hasB }: ChartProps) {
  const ids = [hasA && ("a" as const), hasB && ("b" as const)].filter((v) => v !== false);
  return (
    <LineChart data={rows} responsive style={{ width: "100%", height: "100%" }} margin={MARGIN}>
      {xAxis(domain, ticks)}
      <YAxis
        width={Y_AXIS_W}
        domain={["auto", "auto"]}
        tickCount={5}
        tickFormatter={(v: number) => `${v}°`}
        {...axisProps}
      />
      <ReferenceLine y={0} stroke="var(--color-line)" />
      <Tooltip {...tooltipProps} formatter={(v) => (typeof v === "number" ? `${v.toFixed(2)}°` : String(v))} />
      {ids.flatMap((id) => {
        const L = id.toUpperCase();
        return [
          <Line
            key={`${id}se`}
            dataKey={`${id}SunElev`}
            name={`${L} Sun`}
            stroke={SUN}
            {...stroke(id)}
            dot={false}
            isAnimationActive={false}
          />,
          <Line
            key={`${id}sh`}
            dataKey={`${id}SunHorizon`}
            name={`${L} terrain toward Sun`}
            stroke={SUN}
            {...stroke(id)}
            strokeDasharray="4 3"
            strokeOpacity={0.55}
            dot={false}
            isAnimationActive={false}
          />,
          <Line
            key={`${id}ee`}
            dataKey={`${id}EarthElev`}
            name={`${L} Earth`}
            stroke={EARTH}
            {...stroke(id)}
            dot={false}
            isAnimationActive={false}
          />,
          <Line
            key={`${id}eh`}
            dataKey={`${id}EarthHorizon`}
            name={`${L} terrain toward Earth`}
            stroke={EARTH}
            {...stroke(id)}
            strokeDasharray="4 3"
            strokeOpacity={0.55}
            dot={false}
            isAnimationActive={false}
          />,
        ];
      })}
    </LineChart>
  );
});

const PowerChart = memo(function PowerChart({ rows, domain, ticks, hasA, hasB }: ChartProps) {
  return (
    <ComposedChart data={rows} responsive style={{ width: "100%", height: "100%" }} margin={MARGIN}>
      {xAxis(domain, ticks)}
      <YAxis yAxisId="w" width={Y_AXIS_W} tickCount={4} tickFormatter={(v: number) => `${v} W`} {...axisProps} />
      <YAxis
        yAxisId="soc"
        orientation="right"
        width={Y_AXIS_W}
        domain={[0, 100]}
        ticks={[0, 50, 100]}
        tickFormatter={(v: number) => `${v}%`}
        {...axisProps}
      />
      <Tooltip
        {...tooltipProps}
        formatter={(v, name) =>
          typeof v !== "number"
            ? String(v)
            : String(name).includes("battery")
              ? `${v.toFixed(0)} %`
              : `${v.toFixed(0)} W`
        }
      />
      {hasA && (
        <Area
          yAxisId="w"
          dataKey="aWatts"
          name="A power"
          stroke={SUN}
          fill={SUN}
          fillOpacity={0.12}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      )}
      {hasB && (
        <Line
          yAxisId="w"
          dataKey="bWatts"
          name="B power"
          stroke={SUN}
          {...stroke("b")}
          dot={false}
          isAnimationActive={false}
        />
      )}
      {hasA && (
        <Line
          yAxisId="soc"
          dataKey="aSoc"
          name="A battery"
          stroke={FG}
          {...stroke("a")}
          dot={false}
          isAnimationActive={false}
        />
      )}
      {hasB && (
        <Line
          yAxisId="soc"
          dataKey="bSoc"
          name="B battery"
          stroke={FG}
          {...stroke("b")}
          dot={false}
          isAnimationActive={false}
        />
      )}
    </ComposedChart>
  );
});

/** Playhead drawn over the fixed plot area; subscribes to `time` on its own. */
function Playhead({ domain, rightAxis }: { domain: [number, number]; rightAxis: boolean }) {
  const time = useApp((s) => s.time);
  if (time < domain[0] || time > domain[1]) return null;
  const left = MARGIN.left + Y_AXIS_W;
  const right = MARGIN.right + (rightAxis ? Y_AXIS_W : 0);
  const f = (time - domain[0]) / (domain[1] - domain[0]);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute w-px bg-beacon"
      style={{
        top: MARGIN.top,
        bottom: X_AXIS_H + MARGIN.bottom,
        left: `calc(${left}px + (100% - ${left + right}px) * ${f})`,
      }}
    />
  );
}

function LegendLine({
  dashed,
  thin,
  color,
  children,
}: {
  dashed?: boolean;
  thin?: boolean;
  color: string;
  children: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="14" height="6" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          x2="14"
          y1="3"
          y2="3"
          stroke={color}
          strokeWidth={thin ? 1 : 1.5}
          strokeOpacity={thin ? 0.65 : dashed ? 0.55 : 1}
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {children}
    </span>
  );
}

const TABS: { value: ChartsTab; label: string }[] = [
  { value: "sky", label: "Sun & Earth" },
  { value: "power", label: "Power" },
  { value: "links", label: "Timeline" },
];

/**
 * Collapsible charts panel for the mission window (fixed, bottom-left above the timeline).
 * Toggled by `ChartsToggle`; data from `usePointAnalysis` for landers A and B.
 */
export function ChartsDrawer() {
  const open = useCharts((s) => s.open);
  const setOpen = useCharts((s) => s.setOpen);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key="charts"
          aria-label="Mission window charts"
          className="glass fixed bottom-[148px] left-3 z-20 flex h-[240px] w-[min(760px,60vw)] flex-col rounded-xl max-md:w-[calc(100vw-1.5rem)]"
          initial={{
            opacity: 0,
            transform: reduce ? "none" : "translateY(8px)",
          }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{
            opacity: 0,
            transform: reduce ? "none" : "translateY(8px)",
            transition: { duration: 0.12 },
          }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <ChartsBody onClose={() => setOpen(false)} />
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function ChartsBody({ onClose }: { onClose: () => void }) {
  const tab = useCharts((s) => s.tab);
  const setTab = useCharts((s) => s.setTab);
  const landers = useApp((s) => s.landers);
  const a = usePointAnalysis("A");
  const b = usePointAnalysis("B");
  const data = useMemo(() => buildChartData(a, b), [a, b]);
  const anyLander = Boolean(landers.A || landers.B);
  const both = Boolean(a && b);

  return (
    <>
      <header className="flex items-center gap-3 px-3 pt-2.5 pb-1.5">
        <Segmented<ChartsTab> ariaLabel="Chart" size="sm" value={tab} onChange={setTab} options={TABS} />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 overflow-hidden text-2xs text-fg-muted">
          {tab === "sky" && (
            <>
              <LegendLine color={SUN}>Sun</LegendLine>
              <LegendLine color={EARTH}>Earth</LegendLine>
              <LegendLine color="var(--color-fg-muted)" dashed>
                Terrain horizon
              </LegendLine>
            </>
          )}
          {tab === "power" && (
            <>
              <LegendLine color={SUN}>Power (W)</LegendLine>
              <LegendLine color={FG}>Battery (%)</LegendLine>
            </>
          )}
          {tab === "links" && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-full bg-sun" />
                Sun in view
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-full bg-earth" />
                Earth in view
              </span>
            </>
          )}
          {both && tab !== "links" && (
            <span className="inline-flex items-center gap-2 border-line border-l pl-3">
              <LegendLine color="var(--color-fg-muted)">A</LegendLine>
              <LegendLine color="var(--color-fg-muted)" thin>
                B
              </LegendLine>
            </span>
          )}
        </div>
        <IconButton label="Close charts" size="sm" onClick={onClose}>
          <X size={14} weight="regular" />
        </IconButton>
      </header>
      <div className="relative min-h-0 flex-1 px-2 pb-2">
        {data ? (
          tab === "links" ? (
            <GanttStrips a={a} b={b} domain={data.domain} ticks={data.ticks} />
          ) : (
            <div className="relative h-full w-full">
              {tab === "sky" ? (
                <SkyChart
                  rows={data.rows}
                  domain={data.domain}
                  ticks={data.ticks}
                  hasA={Boolean(a)}
                  hasB={Boolean(b)}
                />
              ) : (
                <PowerChart
                  rows={data.rows}
                  domain={data.domain}
                  ticks={data.ticks}
                  hasA={Boolean(a)}
                  hasB={Boolean(b)}
                />
              )}
              <Playhead domain={data.domain} rightAxis={tab === "power"} />
            </div>
          )
        ) : (
          <p className="flex h-full items-center justify-center text-fg-muted text-xs">
            {anyLander ? "Computing the mission window…" : "Place a lander on the terrain to chart its mission window."}
          </p>
        )}
      </div>
    </>
  );
}

/** Small toggle for the timeline area that opens/closes `ChartsDrawer`. */
export function ChartsToggle({ className }: { className?: string }) {
  const open = useCharts((s) => s.open);
  const setOpen = useCharts((s) => s.setOpen);
  return (
    <Button
      size="sm"
      variant={open ? "secondary" : "ghost"}
      aria-pressed={open}
      onClick={() => setOpen(!open)}
      className={cn(open && "text-fg", className)}
    >
      <ChartLine size={14} weight="regular" />
      Charts
    </Button>
  );
}
