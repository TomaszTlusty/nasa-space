import { jsPDF } from "jspdf";
import { AI_DISCLOSURE, assumptions, type SourceLink } from "@/components/about/content";
import { formatClock, formatDate, formatDayMonth, formatUtc } from "@/components/hud/format";
import { CRITERIA, CRITERIA_SOURCE, screen } from "@/components/science/lander/format";
import type { Interval, PointAnalysis } from "@/lib/analysis/types";
import { DAY, type DiscoveryResult, HOUR, type PowerPreset } from "@/lib/store";
import type { DiscoveryStamp } from "./discovery-stamp";

/**
 * "Site Selection Report" PDF, drawn directly with jsPDF (text, lines, rects, one JPEG): no HTML
 * rasterisation, so charts stay vector and sharp in print. Standard Helvetica only supports Latin-1,
 * so every string goes through `latin1()`.
 */

export interface ReportLander {
  analysis: PointAnalysis;
  /** curated site name, null for a custom point */
  siteName: string | null;
}

export interface ReportSnapshot {
  dataUrl: string;
  width: number;
  height: number;
}

/** Discovery results go into the report only when they were computed for the report's window and criteria. */
export type ReportDiscovery =
  | { status: "none" }
  | { status: "stale" }
  | { status: "fresh"; results: DiscoveryResult[]; stamp: DiscoveryStamp };

export interface ReportInput {
  regionId: string;
  regionName: string;
  regionDescription: string;
  windowStart: number;
  windowDays: number;
  landers: ReportLander[];
  discovery: ReportDiscovery;
  snapshot: ReportSnapshot | null;
  power: PowerPreset;
  /** observer height of the precomputed skyline grid, m */
  gridMastHeight: number;
  sources: SourceLink[];
  generatedAt: number;
}

type RGB = readonly [number, number, number];

/** Print palette: same meanings as the app tokens (amber = Sun, blue = Earth, slate = skyline/shadow). */
const C = {
  ink: [24, 26, 32],
  muted: [88, 93, 106],
  faint: [140, 145, 156],
  line: [222, 224, 230],
  sun: [196, 128, 16],
  sunBand: [252, 241, 214],
  earth: [32, 110, 190],
  earthBand: [222, 236, 251],
  skyline: [112, 116, 134],
  ok: [22, 132, 88],
  danger: [196, 52, 40],
  link: [32, 96, 170],
} as const satisfies Record<string, RGB>;

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const CW = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 18;
const PT = 0.3528; // mm per point

const SUBST: Record<string, string> = {
  "—": "-",
  "–": "-",
  "−": "-",
  "≥": ">=",
  "≤": "<=",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "→": "->",
  Δ: "d",
};

function latin1(s: string): string {
  let out = "";
  for (const ch of s) out += (ch.codePointAt(0) ?? 0) <= 0xff ? ch : (SUBST[ch] ?? "?");
  return out;
}

export function reportFilename(regionId: string, windowStart: number, ext: "pdf" | "csv"): string {
  const date = new Date(windowStart).toISOString().slice(0, 10);
  return ext === "pdf" ? `site-report-${regionId}-${date}.pdf` : `site-hourly-${regionId}-${date}.csv`;
}

export interface Verdict {
  slope: boolean;
  earth: boolean;
  sun: boolean;
  survives: boolean;
  /** passes screening AND the battery never runs empty in the window */
  go: boolean;
}

/**
 * Fraction of the window with any part of the Sun above the skyline: the quantity the "Sun >= 5 % of the
 * time" screening rule refers to. Uses `sunAny` from the analysis when present, else derives it from the series.
 */
export function sunAnyOf(a: PointAnalysis): number {
  const given = (a as PointAnalysis & { sunAny?: number }).sunAny;
  if (given != null && Number.isFinite(given)) return given;
  const f = a.series.sunFraction;
  let lit = 0;
  for (const v of f) if (v > 0) lit++;
  return f.length > 0 ? lit / f.length : 0;
}

export function verdict(a: PointAnalysis): Verdict {
  const s = screen(a);
  const sun = sunAnyOf(a) >= CRITERIA.minSun;
  const survives = a.power.depletedAt === null;
  return { slope: s.slope, earth: s.earth, sun, survives, go: s.slope && s.earth && sun && survives };
}

const windowLabel = (start: number, days: number) =>
  `${formatDate(start)} to ${formatDate(start + days * DAY)} (${days} days)`;

const pct = (f: number) => `${(f * 100).toFixed(0)} %`;

function latLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? "W" : "E"}`;
}

/** Thin stateful wrapper: a y cursor with automatic page breaks. */
class Writer {
  y = M;
  constructor(readonly doc: jsPDF) {}

  font(size: number, color: RGB, style: "normal" | "bold" = "normal") {
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  draw(color: RGB, width = 0.2) {
    this.doc.setDrawColor(color[0], color[1], color[2]);
    this.doc.setLineWidth(width);
  }

  fill(color: RGB) {
    this.doc.setFillColor(color[0], color[1], color[2]);
  }

  ensure(h: number) {
    if (this.y + h > BOTTOM) {
      this.doc.addPage();
      this.y = M;
    }
  }

  split(text: string, width: number): string[] {
    return this.doc.splitTextToSize(latin1(text), width) as string[];
  }

  para(text: string, size: number, color: RGB, opts: { width?: number; style?: "normal" | "bold"; gap?: number } = {}) {
    this.font(size, color, opts.style);
    const lh = size * PT * 1.4;
    const lines = this.split(text, opts.width ?? CW);
    this.ensure(lines.length * lh);
    this.doc.text(lines, M, this.y + size * PT);
    this.y += lines.length * lh + (opts.gap ?? 0);
  }

  /** Section heading; `keep` reserves room for the content that must stay on the same page. */
  heading(text: string, keep = 0) {
    this.ensure(12 + keep);
    this.y += 3;
    this.draw(C.line);
    this.doc.line(M, this.y, M + CW, this.y);
    this.y += 5;
    this.font(7.5, C.faint, "bold");
    this.doc.setCharSpace(0.35);
    this.doc.text(latin1(text.toUpperCase()), M, this.y);
    this.doc.setCharSpace(0);
    this.y += 4;
  }
}

interface Cell {
  text: string;
  color?: RGB;
  bold?: boolean;
}

interface Column {
  header: string;
  width: number;
  align?: "left" | "right";
  color?: RGB;
}

const ROW_H = 6;

/** Height `table()` will take, for keeping a heading and its table on one page. */
const tableHeight = (rows: number) => (rows + 1) * ROW_H;

function table(w: Writer, columns: Column[], rows: Cell[][], rowH = ROW_H) {
  const { doc } = w;
  const header = () => {
    w.font(7, C.faint, "bold");
    let x = M;
    for (const c of columns) {
      if (c.color) doc.setTextColor(c.color[0], c.color[1], c.color[2]);
      else doc.setTextColor(C.faint[0], C.faint[1], C.faint[2]);
      doc.text(latin1(c.header), c.align === "right" ? x + c.width - 1 : x + 1, w.y + 4, {
        align: c.align ?? "left",
      });
      x += c.width;
    }
    w.y += rowH;
    w.draw(C.ink, 0.25);
    doc.line(M, w.y, M + CW, w.y);
  };

  w.ensure(rowH * 2);
  header();
  for (const row of rows) {
    if (w.y + rowH > BOTTOM) {
      doc.addPage();
      w.y = M;
      header();
    }
    let x = M;
    row.forEach((cell, i) => {
      const col = columns[i];
      w.font(8, cell.color ?? C.ink, cell.bold ? "bold" : "normal");
      const text = w.split(cell.text, col.width - 2)[0] ?? "";
      doc.text(text, col.align === "right" ? x + col.width - 1 : x + 1, w.y + 4.1, { align: col.align ?? "left" });
      x += col.width;
    });
    w.y += rowH;
    w.draw(C.line);
    doc.line(M, w.y, M + CW, w.y);
  }
}

interface ChartSeries {
  values: Float32Array;
  color: RGB;
  dashed?: boolean;
  width?: number;
}

interface LegendItem {
  label: string;
  color: RGB;
  kind: "line" | "dashed" | "band";
}

interface ChartSpec {
  title: string;
  unit: string;
  start: number;
  stepMs: number;
  series: ChartSeries[];
  bands?: { intervals: Interval[]; color: RGB };
  yRange?: [number, number];
  legend: LegendItem[];
}

/** Round axis step (1, 2, 2.5, 5 x 10^n) and the decimals needed to print it. */
function niceStep(raw: number): { step: number; decimals: number } {
  const p = Math.floor(Math.log10(raw));
  const base = 10 ** p;
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const decimals = Math.max(0, -p + (nice === 2.5 ? 1 : 0) - (nice === 10 ? 1 : 0));
  return { step: nice * base, decimals };
}

const X_TICKS = [6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 5 * DAY, 7 * DAY];

function chart(w: Writer, x: number, y: number, width: number, height: number, spec: ChartSpec) {
  const { doc } = w;
  const n = spec.series.reduce((m, s) => Math.max(m, s.values.length), 0);
  if (n < 2) return;

  // title + legend
  w.font(8, C.ink, "bold");
  doc.text(latin1(spec.title), x, y + 3);
  const titleW = doc.getTextWidth(latin1(spec.title));
  w.font(7, C.faint);
  doc.text(latin1(spec.unit), x + titleW + 1.5, y + 3);
  let lx = x + width;
  for (const item of [...spec.legend].reverse()) {
    const label = latin1(item.label);
    lx -= doc.getTextWidth(label);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text(label, lx, y + 3);
    lx -= 6;
    if (item.kind === "band") {
      w.fill(item.color);
      doc.rect(lx, y + 1.2, 4.5, 2.2, "F");
    } else {
      w.draw(item.color, 0.5);
      if (item.kind === "dashed") doc.setLineDashPattern([1, 0.7], 0);
      doc.line(lx, y + 2.3, lx + 4.5, y + 2.3);
      doc.setLineDashPattern([], 0);
    }
    lx -= 3;
  }

  const px = x + 10;
  const py = y + 6;
  const pw = width - 10;
  const ph = height - 12;
  const t0 = spec.start;
  const t1 = spec.start + (n - 1) * spec.stepMs;
  const xOf = (t: number) => px + ((t - t0) / (t1 - t0)) * pw;

  let lo: number;
  let hi: number;
  if (spec.yRange) {
    [lo, hi] = spec.yRange;
  } else {
    lo = Number.POSITIVE_INFINITY;
    hi = Number.NEGATIVE_INFINITY;
    for (const s of spec.series)
      for (const v of s.values)
        if (Number.isFinite(v)) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
    if (!Number.isFinite(lo)) return;
    if (hi - lo < 0.5) {
      lo -= 0.25;
      hi += 0.25;
    }
  }
  const { step, decimals } = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const yOf = (v: number) => py + ph - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * ph;

  // lit / in-view bands
  if (spec.bands) {
    w.fill(spec.bands.color);
    for (const iv of spec.bands.intervals) {
      const a = Math.max(t0, iv.start);
      const b = Math.min(t1, iv.end);
      if (b > a) doc.rect(xOf(a), py, xOf(b) - xOf(a), ph, "F");
    }
  }

  // y grid + labels
  w.font(6.5, C.faint);
  for (let v = lo; v <= hi + step / 2; v += step) {
    const yy = yOf(v);
    w.draw(C.line, 0.15);
    doc.line(px, yy, px + pw, yy);
    doc.text(v.toFixed(decimals), px - 1.5, yy + 0.9, { align: "right" });
  }

  // x ticks
  const span = t1 - t0;
  const tick = X_TICKS.find((d) => span / d <= 6) ?? 7 * DAY;
  for (let t = Math.ceil(t0 / tick) * tick; t <= t1; t += tick) {
    const xx = xOf(t);
    w.draw(C.line, 0.15);
    doc.line(xx, py, xx, py + ph);
    doc.text(latin1(tick >= DAY ? formatDayMonth(t) : formatClock(t)), xx, py + ph + 3.6, { align: "center" });
  }

  // series as polylines, broken at missing values
  for (const s of spec.series) {
    w.draw(s.color, s.width ?? 0.35);
    if (s.dashed) doc.setLineDashPattern([1.2, 0.8], 0);
    let seg: number[][] = [];
    let sx = 0;
    let sy = 0;
    let prevX = 0;
    let prevY = 0;
    let started = false;
    const flush = () => {
      if (seg.length > 0) doc.lines(seg, sx, sy, [1, 1], "S", false);
      seg = [];
      started = false;
    };
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (!Number.isFinite(v)) {
        flush();
        continue;
      }
      const X = xOf(t0 + i * spec.stepMs);
      const Y = yOf(v);
      if (started) seg.push([X - prevX, Y - prevY]);
      else {
        sx = X;
        sy = Y;
        started = true;
      }
      prevX = X;
      prevY = Y;
    }
    flush();
    doc.setLineDashPattern([], 0);
  }

  w.draw(C.faint, 0.2);
  doc.rect(px, py, pw, ph, "S");
}

function landerRows(landers: ReportLander[]): Cell[][] {
  const row = (label: string, cell: (l: ReportLander) => Cell): Cell[] => [
    { text: label, color: C.muted },
    ...landers.map(cell),
  ];
  return [
    row("Site", (l) => ({ text: l.siteName ?? "Custom point" })),
    row("Location", (l) => ({ text: latLon(l.analysis.lat, l.analysis.lon) })),
    row("Elevation", (l) => ({
      text: `${l.analysis.elevationM.toFixed(0)} m`,
    })),
    row("Slope", (l) => ({
      text: `${l.analysis.slopeDeg.toFixed(1)}°`,
      color: l.analysis.slopeDeg < CRITERIA.maxSlopeDeg ? C.ink : C.danger,
    })),
    row("Sunlight (mean visible Sun)", (l) => ({
      text: pct(l.analysis.sunMean),
      color: C.sun,
    })),
    row("Sun above skyline (any part)", (l) => ({
      text: pct(sunAnyOf(l.analysis)),
      color: C.sun,
    })),
    row("Earth in view", (l) => ({
      text: pct(l.analysis.earthMean),
      color: C.earth,
    })),
    row("Longest darkness", (l) => ({
      text: `${l.analysis.longestDarkHours.toFixed(0)} h`,
    })),
    row("Longest Earth blackout", (l) => ({
      text: `${l.analysis.longestBlackoutHours.toFixed(0)} h`,
    })),
    row("Lowest battery", (l) => ({
      text: `${l.analysis.power.minSocPct.toFixed(0)} %`,
      color: l.analysis.power.depletedAt === null ? C.ink : C.danger,
    })),
    row("Battery runs out", (l) =>
      l.analysis.power.depletedAt === null
        ? { text: "Survives the window", color: C.ok }
        : { text: formatUtc(l.analysis.power.depletedAt), color: C.danger },
    ),
    row("Screening (slope, Earth, Sun)", (l) => {
      const v = verdict(l.analysis);
      if (v.slope && v.earth && v.sun) return { text: "PASS", color: C.ok, bold: true };
      const failed = [!v.slope && "slope", !v.earth && "Earth", !v.sun && "Sun"].filter(Boolean).join(", ");
      return { text: `FAIL: ${failed}`, color: C.danger, bold: true };
    }),
    row("Verdict", (l) =>
      verdict(l.analysis).go ? { text: "GO", color: C.ok, bold: true } : { text: "NO-GO", color: C.danger, bold: true },
    ),
  ];
}

function sources(w: Writer, list: SourceLink[]) {
  const { doc } = w;
  for (const s of list) {
    w.ensure(8);
    w.para(s.label, 7.5, C.ink);
    w.font(7, C.link);
    const lines = w.split(s.url, CW);
    const lh = 7 * PT * 1.4;
    w.ensure(lines.length * lh);
    doc.text(lines, M, w.y + 7 * PT);
    doc.link(M, w.y, CW, lines.length * lh, { url: s.url });
    w.y += lines.length * lh + 1.2;
  }
}

/** Builds the report and triggers the browser download. */
export function downloadReportPdf(input: ReportInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({
    title: latin1(`Site Selection Report - ${input.regionName}`),
    subject: "Lunar south pole landing site comparison",
    creator: "Malapert",
  });
  const w = new Writer(doc);
  const windowEnd = input.windowStart + input.windowDays * DAY;

  // ---- page 1: summary ----
  w.font(7.5, C.faint, "bold");
  doc.setCharSpace(0.35);
  doc.text("SITE SELECTION REPORT", M, w.y + 2.6);
  doc.setCharSpace(0);
  w.y += 5;
  w.para(input.regionName, 20, C.ink, { style: "bold", gap: 1.5 });
  w.para(
    `Mission window ${formatUtc(input.windowStart)} to ${formatUtc(windowEnd)} (${input.windowDays} days)`,
    9.5,
    C.ink,
  );
  w.para(`Generated ${formatUtc(input.generatedAt)} with Malapert, lunar landing site navigator.`, 8, C.muted, {
    gap: 2,
  });
  w.para(input.regionDescription, 8.5, C.muted, { gap: 4 });

  if (input.snapshot) {
    const aspect = input.snapshot.width / input.snapshot.height;
    let imgW = CW;
    let imgH = CW / aspect;
    if (imgH > 88) {
      imgH = 88;
      imgW = imgH * aspect;
    }
    w.ensure(imgH + 6);
    const ix = M + (CW - imgW) / 2;
    doc.addImage(input.snapshot.dataUrl, "JPEG", ix, w.y, imgW, imgH);
    w.draw(C.line);
    doc.rect(ix, w.y, imgW, imgH, "S");
    w.y += imgH + 1.5;
    w.para("3D view of the region at the time of export.", 7, C.faint, {
      gap: 1,
    });
  }

  const rows = landerRows(input.landers);
  w.heading("Landers", 8 + tableHeight(rows.length));
  w.para(`Mission window ${windowLabel(input.windowStart, input.windowDays)}`, 7.5, C.muted, { gap: 1.5 });
  const labelW = 54;
  const colW = (CW - labelW) / input.landers.length;
  table(
    w,
    [
      { header: "", width: labelW },
      ...input.landers.map((l) => ({
        header: `Lander ${l.analysis.id}`,
        width: colW,
        color: C.ink,
      })),
    ],
    rows,
  );
  w.y += 2;
  w.para(
    `Screening: landing slope < ${CRITERIA.maxSlopeDeg}°, Earth in view >= ${CRITERIA.minEarth * 100} % of the time and some of the Sun above the skyline >= ${CRITERIA.minSun * 100} % of the time (${CRITERIA_SOURCE}). GO means the site passes screening and the battery never runs empty during the window with the illustrative power preset below.`,
    7,
    C.muted,
  );

  if (input.discovery.status === "stale") {
    w.heading("Best sites found by search", 10);
    w.para(
      "The last site search used a different mission window or criteria, so its results are left out. Run site search again for this window.",
      8,
      C.muted,
    );
  } else if (input.discovery.status === "fresh" && input.discovery.results.length > 0) {
    const { stamp } = input.discovery;
    const found = input.discovery.results.slice(0, 12);
    w.heading("Best sites found by search", 12 + tableHeight(found.length));
    w.para(
      `Searched over ${windowLabel(stamp.windowStart, stamp.windowDays)}: slope < ${stamp.criteria.maxSlopeDeg}°, mean sunlight >= ${Math.round(stamp.criteria.minSun * 100)} %, Earth in view >= ${Math.round(stamp.criteria.minEarth * 100)} % of the time.`,
      7.5,
      C.muted,
      { gap: 1.5 },
    );
    table(
      w,
      [
        { header: "#", width: 8 },
        { header: "Latitude", width: 26, align: "right" },
        { header: "Longitude", width: 26, align: "right" },
        { header: "Score", width: 18, align: "right" },
        { header: "Sunlight", width: 22, align: "right", color: C.sun },
        { header: "Earth in view", width: 26, align: "right", color: C.earth },
        { header: "Slope", width: 20, align: "right" },
        { header: "Longest dark", width: CW - 146, align: "right" },
      ],
      found.map((d) => [
        { text: String(d.rank), color: C.muted },
        { text: `${d.lat.toFixed(3)}°` },
        { text: `${d.lon.toFixed(3)}°` },
        { text: d.score.toFixed(2) },
        { text: pct(d.sun), color: C.sun },
        { text: pct(d.earth), color: C.earth },
        { text: `${d.slopeDeg.toFixed(1)}°` },
        { text: `${d.longestDarkHours.toFixed(0)} h` },
      ]),
    );
  }

  // ---- page 2: charts + provenance ----
  doc.addPage();
  w.y = M;
  w.para("Sun, Earth and battery over the mission window", 13, C.ink, {
    style: "bold",
    gap: 1,
  });
  w.para(
    "Elevation above the flat horizon in degrees. The grey line is the real terrain skyline in the direction of the Sun or Earth; shading marks hours when the body is above it.",
    7.5,
    C.muted,
    { gap: 3 },
  );

  const half = (CW - 6) / 2;
  for (const l of input.landers) {
    const a = l.analysis;
    const stepMs = a.series.stepMinutes * 60_000;
    w.ensure(60);
    w.para(`Lander ${a.id}  ·  ${l.siteName ?? latLon(a.lat, a.lon)}`, 9, C.ink, { style: "bold", gap: 1.5 });
    chart(w, M, w.y, half, 52, {
      title: "Sun",
      unit: "elevation, °",
      start: a.series.start,
      stepMs,
      series: [
        { values: a.series.sunHorizon, color: C.skyline, width: 0.3 },
        { values: a.series.sunElev, color: C.sun, width: 0.45 },
      ],
      bands: { intervals: a.sunWindows, color: C.sunBand },
      legend: [
        { label: "Sun", color: C.sun, kind: "line" },
        { label: "Skyline", color: C.skyline, kind: "line" },
        { label: "Lit", color: C.sunBand, kind: "band" },
      ],
    });
    chart(w, M + half + 6, w.y, half, 52, {
      title: "Earth",
      unit: "elevation, °",
      start: a.series.start,
      stepMs,
      series: [
        { values: a.series.earthHorizon, color: C.skyline, width: 0.3 },
        { values: a.series.earthElev, color: C.earth, width: 0.45 },
      ],
      bands: { intervals: a.earthWindows, color: C.earthBand },
      legend: [
        { label: "Earth", color: C.earth, kind: "line" },
        { label: "Skyline", color: C.skyline, kind: "line" },
        { label: "In view", color: C.earthBand, kind: "band" },
      ],
    });
    w.y += 56;
  }

  w.ensure(58);
  const first = input.landers[0].analysis.series;
  chart(w, M, w.y, CW, 52, {
    title: "Battery charge",
    unit: "%",
    start: first.start,
    stepMs: first.stepMinutes * 60_000,
    yRange: [0, 100],
    series: input.landers.map((l, i) => ({
      values: l.analysis.power.socPct,
      color: C.sun,
      dashed: i > 0,
      width: 0.45,
    })),
    legend: input.landers.map((l, i) => ({
      label: `Lander ${l.analysis.id}`,
      color: C.sun,
      kind: i > 0 ? "dashed" : "line",
    })),
  });
  w.y += 56;

  w.heading("Assumptions");
  for (const a of assumptions(input.power, input.gridMastHeight)) {
    w.para(a.title, 7.5, C.ink, { style: "bold" });
    w.para(a.source ? `${a.body} Source: ${a.source}` : a.body, 7.5, C.muted, {
      gap: 1.5,
    });
  }

  w.heading("Sources");
  sources(w, input.sources);

  w.heading("AI disclosure");
  w.para(AI_DISCLOSURE, 7.5, C.muted);

  // ---- footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    w.font(6.5, C.faint);
    w.draw(C.line);
    doc.line(M, PAGE_H - 12, M + CW, PAGE_H - 12);
    doc.text(latin1(`Malapert  ·  Site Selection Report  ·  ${input.regionName}`), M, PAGE_H - 8);
    doc.text(`Page ${p} of ${pages}`, M + CW, PAGE_H - 8, { align: "right" });
  }

  doc.save(reportFilename(input.regionId, input.windowStart, "pdf"));
}
