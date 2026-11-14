"use client";

import { usePointAnalysis } from "@/lib/analysis";
import type { PointAnalysis } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import { DASH, distance, screen } from "./format";
import { Section } from "./Section";

interface Metric {
  label: string;
  unit: string;
  digits: number;
  better: "high" | "low";
  get: (p: PointAnalysis) => number;
}

const METRICS: Metric[] = [
  {
    label: "Sunlight",
    unit: "%",
    digits: 0,
    better: "high",
    get: (p) => p.sunMean * 100,
  },
  {
    label: "Earth contact",
    unit: "%",
    digits: 0,
    better: "high",
    get: (p) => p.earthMean * 100,
  },
  {
    label: "Longest darkness",
    unit: "h",
    digits: 0,
    better: "low",
    get: (p) => p.longestDarkHours,
  },
  {
    label: "Longest blackout",
    unit: "h",
    digits: 0,
    better: "low",
    get: (p) => p.longestBlackoutHours,
  },
  {
    label: "Energy",
    unit: "kWh",
    digits: 1,
    better: "high",
    get: (p) => p.power.energyWh / 1000,
  },
  {
    label: "Min battery",
    unit: "%",
    digits: 0,
    better: "high",
    get: (p) => p.power.minSocPct,
  },
  {
    label: "Slope",
    unit: "°",
    digits: 1,
    better: "low",
    get: (p) => p.slopeDeg,
  },
];

/** One plain-language sentence comparing B with A, generated only from the analysed numbers. */
function summary(a: PointAnalysis, b: PointAnalysis): string {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const dz = b.elevationM - a.elevationM;
  const where =
    Math.abs(dz) < 5
      ? `${distance(d)} from A`
      : `${distance(d)} ${dz < 0 ? "down-slope" : "up-slope"} from A`;
  const sunPts = (b.sunMean - a.sunMean) * 100;
  const earthPts = (b.earthMean - a.earthMean) * 100;
  const darkH = b.longestDarkHours - a.longestDarkHours;
  const pts = (v: number) =>
    `${Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0)} percentage points`;

  const parts = [
    Math.abs(sunPts) < 0.5
      ? "gets about the same sunlight"
      : `gets ${pts(sunPts)} ${sunPts < 0 ? "less" : "more"} sunlight`,
  ];
  if (Math.abs(earthPts) >= 0.5)
    parts.push(
      `${pts(earthPts)} ${earthPts < 0 ? "less" : "more"} Earth contact`,
    );
  let sentence = `B, ${where}, ${parts.join(" and ")}`;
  if (Math.abs(darkH) >= 1)
    sentence += `, and its longest night is ${Math.round(Math.abs(darkH))} h ${darkH > 0 ? "longer" : "shorter"}`;
  sentence += ".";

  const aLives = a.power.depletedAt === null;
  const bLives = b.power.depletedAt === null;
  if (aLives !== bLives)
    sentence += ` Only ${aLives ? "A" : "B"} keeps its battery alive through the window.`;
  const ga = screen(a).go;
  const gb = screen(b).go;
  if (ga !== gb)
    sentence += ` Only ${ga ? "A" : "B"} passes landing screening.`;
  return sentence;
}

/** Side-by-side window metrics for landers A and B with deltas (B − A); the better value is highlighted. */
export function CompareView() {
  const a = usePointAnalysis("A");
  const b = usePointAnalysis("B");
  const ready = a && b;

  return (
    <Section title="A vs B · mission window">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-2xs text-fg-faint">
            <th className="pb-1.5 font-normal">Metric</th>
            <th className="pb-1.5 text-right font-normal">A</th>
            <th className="pb-1.5 text-right font-normal">B</th>
            <th className="pb-1.5 text-right font-normal">B − A</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const va = a ? m.get(a) : null;
            const vb = b ? m.get(b) : null;
            const delta = va !== null && vb !== null ? vb - va : null;
            const tie = delta === null || Math.abs(delta) < 10 ** -m.digits / 2;
            const aBetter =
              !tie &&
              delta !== null &&
              (m.better === "high" ? delta < 0 : delta > 0);
            const bBetter = !tie && !aBetter;
            const cell = (v: number | null, better: boolean) => (
              <td
                className={cn(
                  "tabular py-1 text-right",
                  better ? "font-medium text-ok" : "text-fg-muted",
                )}
              >
                {v === null ? DASH : v.toFixed(m.digits)}
              </td>
            );
            return (
              <tr key={m.label} className="border-line border-t">
                <td className="py-1 pr-2 text-fg-muted">
                  {m.label} <span className="text-fg-faint">{m.unit}</span>
                </td>
                {cell(va, aBetter)}
                {cell(vb, bBetter)}
                <td className="tabular py-1 text-right text-fg-faint">
                  {delta === null
                    ? DASH
                    : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(m.digits)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 min-h-10 text-fg text-sm leading-5">
        {ready ? (
          summary(a, b)
        ) : (
          <span className="text-fg-muted">Computing both mission windows…</span>
        )}
      </p>
    </Section>
  );
}
