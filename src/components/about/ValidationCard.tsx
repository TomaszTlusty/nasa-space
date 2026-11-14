"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/components/hud/format";
import { cn } from "@/lib/cn";
import type { ValidationReport } from "@/lib/moon/types";

const HORIZONS_URL = "https://ssd.jpl.nasa.gov/horizons/";
const PGDA_URL = "https://pgda.gsfc.nasa.gov/products/69";

function isValidationReport(v: unknown): v is ValidationReport {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<ValidationReport>;
  return typeof r.generatedAt === "string" && Array.isArray(r.horizons);
}

let pending: Promise<ValidationReport | null> | null = null;

/** `/validation.json` is optional (written by the validation scripts); a missing or malformed file hides the card. */
function loadValidation(): Promise<ValidationReport | null> {
  pending ??= fetch("/validation.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: unknown) => (isValidationReport(data) ? data : null))
    .catch(() => null);
  return pending;
}

/** Smallest absolute angle between two azimuths, degrees. */
function azDiff(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

const fmtDelta = (v: number | null) =>
  v == null ? "n/a" : `${v < 0.001 ? "<0.001" : v.toFixed(3)}°`;

/** "Validated against NASA/JPL" card: our ephemeris + horizon pipeline vs JPL Horizons and Mazarico et al. */
export function ValidationCard({ className }: { className?: string }) {
  const [report, setReport] = useState<ValidationReport | null>(null);

  useEffect(() => {
    let alive = true;
    loadValidation().then((r) => alive && setReport(r));
    return () => {
      alive = false;
    };
  }, []);

  if (!report) return null;
  const mazarico = report.mazarico ?? [];
  if (report.horizons.length === 0 && mazarico.length === 0) return null;

  const rows = report.horizons.map((h) => ({
    ...h,
    dEl: Math.abs(h.oursElevation - h.jplElevation),
    dAz:
      h.jplAzimuth != null && h.oursAzimuth != null
        ? azDiff(h.oursAzimuth, h.jplAzimuth)
        : null,
  }));
  const maxEl = rows.reduce((m, r) => Math.max(m, r.dEl), 0);

  return (
    <section
      className={cn("rounded-lg bg-white/3 p-4 ring-1 ring-line", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-fg text-sm">
          Validated against NASA/JPL
        </h3>
        <span className="tabular text-2xs text-fg-faint">
          run {formatDate(Date.parse(report.generatedAt))}
        </span>
      </div>

      {rows.length > 0 && (
        <>
          <p className="mt-1 text-fg-muted text-xs">
            Sun and Earth positions compared with{" "}
            <a
              href={HORIZONS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-fg underline-offset-2 hover:underline"
            >
              JPL Horizons
            </a>
            . Largest elevation difference{" "}
            <span className="tabular text-fg">{fmtDelta(maxEl)}</span> over{" "}
            <span className="tabular text-fg">{rows.length}</span> checks.
          </p>
          <div className="mt-3 max-h-52 overflow-y-auto rounded-sm ring-1 ring-line">
            <table className="w-full border-collapse text-left text-2xs">
              <thead className="sticky top-0 bg-surface-2 text-fg-faint">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Body</th>
                  <th className="px-2 py-1.5 font-medium">Place</th>
                  <th className="px-2 py-1.5 font-medium">UTC</th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    |Δ| elev.
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    |Δ| azim.
                  </th>
                </tr>
              </thead>
              <tbody className="tabular text-fg-muted">
                {rows.map((r) => (
                  <tr
                    key={`${r.body}-${r.lat}-${r.lon}-${r.utc}`}
                    className="border-line border-t"
                  >
                    <td
                      className={cn(
                        "px-2 py-1 font-sans",
                        r.body === "sun" ? "text-sun" : "text-earth",
                      )}
                    >
                      {r.body === "sun" ? "Sun" : "Earth"}
                    </td>
                    <td className="px-2 py-1">
                      {r.lat.toFixed(2)}°, {r.lon.toFixed(2)}°
                    </td>
                    <td className="px-2 py-1">
                      {r.utc.replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="px-2 py-1 text-right text-fg">
                      {fmtDelta(r.dEl)}
                    </td>
                    <td className="px-2 py-1 text-right">{fmtDelta(r.dAz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mazarico.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-fg-muted text-xs">
            Window-average visibility compared with the{" "}
            <a
              href={PGDA_URL}
              target="_blank"
              rel="noreferrer"
              className="text-fg underline-offset-2 hover:underline"
            >
              Mazarico et al. maps (NASA PGDA)
            </a>
            :
          </p>
          {mazarico.map((m) => (
            <div key={m.region} className="text-xs">
              <span className="text-fg capitalize">{m.region}</span>
              <span className="text-fg-muted">
                {" "}
                Sun MAE{" "}
                <span className="tabular text-sun">
                  {m.sunMaePp.toFixed(1)} pp
                </span>
                , Earth MAE{" "}
                <span className="tabular text-earth">
                  {m.earthMaePp.toFixed(1)} pp
                </span>{" "}
                over{" "}
                <span className="tabular text-fg">
                  {m.samples.toLocaleString("en-US")}
                </span>{" "}
                points
              </span>
              <p
                className="line-clamp-2 text-2xs text-fg-faint"
                title={m.method}
              >
                {m.method}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
