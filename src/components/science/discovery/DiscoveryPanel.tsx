"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Divider, Panel, PanelHeader } from "@/components/ui/panel";
import { Slider } from "@/components/ui/slider";
import { AnalysisCancelled, runDiscovery } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { type DiscoveryCriteria, type DiscoveryResult, type LanderId, useApp } from "@/lib/store";
import { useDiscoveryHover } from "./hover";
import { NoResultsHint } from "./NoResultsHint";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const SHOWN = 5;
const COLS = "grid grid-cols-[1rem_3.25rem_repeat(4,minmax(0,1fr))] items-baseline gap-x-1.5";

function ResultRow({
  r,
  target,
  hovered,
  onHover,
  onPlace,
}: {
  r: DiscoveryResult;
  target: LanderId;
  hovered: boolean;
  onHover: (rank: number | null) => void;
  onPlace: (r: DiscoveryResult) => void;
}) {
  const score = Math.round(r.score * 100);
  const sun = Math.round(r.sun * 100);
  const earth = Math.round(r.earth * 100);
  const dark = Math.round(r.longestDarkHours);
  return (
    <li>
      <button
        type="button"
        onPointerEnter={() => onHover(r.rank)}
        // Pointer clicks must not let the browser scroll the (overflow-hidden) page to the focused row.
        onMouseDown={(e) => {
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
        }}
        onFocus={() => onHover(r.rank)}
        onBlur={() => onHover(null)}
        onClick={() => onPlace(r)}
        aria-label={`Site ${r.rank}: score ${score}%, average sunlight ${sun}%, Earth contact ${earth}%, slope ${r.slopeDeg.toFixed(1)} degrees, longest darkness ${dark} hours. Place lander ${target} here.`}
        className={cn(
          COLS,
          "tabular w-full rounded-sm px-2 py-1.5 text-left text-xs",
          "transition-[background-color,transform] duration-150 ease-(--ease-out) active:scale-[0.98]",
          hovered ? "bg-white/8" : "hover:bg-white/5",
        )}
      >
        <span className="text-fg-faint">{r.rank}</span>
        <span className="text-fg">{score}%</span>
        <span className="text-sun">{sun}%</span>
        <span className="text-earth">{earth}%</span>
        <span className={r.slopeDeg >= 10 ? "text-danger" : "text-fg-muted"}>{r.slopeDeg.toFixed(1)}°</span>
        <span className="text-fg-muted">{dark} h</span>
      </button>
    </li>
  );
}

/**
 * Left-column panel: criteria sliders, "Find landing sites" and the ranked results list. The panel is a
 * flex column; give it `min-h-0` (and a flex size) from the parent and the results scroll inside it.
 */
export function DiscoveryPanel({ className }: { className?: string }) {
  const criteria = useApp((s) => s.discovery.criteria);
  const results = useApp((s) => s.discovery.results);
  const running = useApp((s) => s.discovery.running);
  const setCriteria = useApp((s) => s.setDiscoveryCriteria);
  const regionId = useApp((s) => s.regionId);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const placing = useApp((s) => s.placing);
  const placeLander = useApp((s) => s.placeLander);
  const hoveredRank = useDiscoveryHover((s) => s.hoveredRank);
  const setHoveredRank = useDiscoveryHover((s) => s.setHoveredRank);

  const [lastRunKey, setLastRunKey] = useState<string | null>(null);
  const [seenResults, setSeenResults] = useState(results);
  const [error, setError] = useState<string | null>(null);

  const keyOf = (c: DiscoveryCriteria) =>
    `${regionId}|${windowStart}|${windowDays}|${c.maxSlopeDeg}|${c.minSun}|${c.minEarth}`;
  const key = keyOf(criteria);

  // Results written by someone else (the assistant) were computed for the current store settings.
  if (results !== seenResults) {
    setSeenResults(results);
    if (results.length > 0) setLastRunKey(key);
  }

  const target: LanderId = placing ?? "A";
  const shown = results.slice(0, SHOWN);
  const stale = shown.length > 0 && lastRunKey !== key;
  const searchedEmpty = !running && !error && lastRunKey === key && results.length === 0;

  useEffect(() => () => setHoveredRank(null), [setHoveredRank]);

  const find = async (c: DiscoveryCriteria) => {
    setError(null);
    setLastRunKey(keyOf(c));
    try {
      await runDiscovery(c);
    } catch (e) {
      if (e instanceof AnalysisCancelled) return;
      setError(e instanceof Error ? e.message : "The search failed.");
    }
  };

  return (
    // Tall column: controls stay put and only the results list scrolls. Short column (e.g. 1024×768):
    // the results block keeps a minimum height, so the whole panel scrolls instead of overflowing.
    <Panel
      className={cn("flex min-h-0 flex-col overflow-y-auto overscroll-contain", className)}
      aria-label="Site discovery"
    >
      <div className="shrink-0">
        <PanelHeader eyebrow="Site discovery" title="Where can a lander live?" />
        <div className="flex flex-col gap-3 px-4 pb-3">
          <Slider
            label="Max ground slope"
            value={criteria.maxSlopeDeg}
            onChange={(v) => setCriteria({ maxSlopeDeg: v })}
            min={2}
            max={20}
            step={1}
            tone="neutral"
            valueLabel={`≤ ${criteria.maxSlopeDeg}°`}
          />
          <Slider
            label="Min average sunlight"
            value={Math.round(criteria.minSun * 100)}
            onChange={(v) => setCriteria({ minSun: v / 100 })}
            min={0}
            max={100}
            step={5}
            tone="sun"
            valueLabel={`≥ ${Math.round(criteria.minSun * 100)}%`}
          />
          <Slider
            label="Min Earth contact"
            value={Math.round(criteria.minEarth * 100)}
            onChange={(v) => setCriteria({ minEarth: v / 100 })}
            min={0}
            max={100}
            step={5}
            tone="earth"
            valueLabel={`≥ ${Math.round(criteria.minEarth * 100)}% of window`}
          />
          <p className="text-2xs text-fg-faint">
            Over the next{" "}
            <span className="tabular text-fg-muted">
              {windowDays} {windowDays === 1 ? "day" : "days"}
            </span>{" "}
            from <span className="tabular text-fg-muted">{DATE_FMT.format(windowStart)}</span>
          </p>
          <Button variant="primary" onClick={() => find(criteria)} disabled={running} aria-busy={running}>
            <MagnifyingGlass size={16} weight="regular" />
            {running ? "Searching every grid point…" : "Find landing sites"}
          </Button>
          <div aria-live="polite" className="empty:hidden">
            {error && <p className="text-danger text-xs">{error}</p>}
            {searchedEmpty && (
              <NoResultsHint
                regionId={regionId}
                criteria={criteria}
                onApply={(next) => {
                  setCriteria(next);
                  find(next);
                }}
              />
            )}
            {!running && !error && lastRunKey === key && results.length > 0 && (
              <p className="tabular text-fg-muted text-xs">
                {results.length} {results.length === 1 ? "site" : "sites"} found
                {results.length > SHOWN ? `, best ${SHOWN} shown` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
      {shown.length > 0 && (
        <div className={cn("flex min-h-36 flex-1 flex-col transition-opacity duration-150", running && "opacity-50")}>
          <Divider />
          <div aria-hidden className={cn(COLS, "eyebrow shrink-0 px-4 pt-2.5 pb-1")}>
            <span>#</span>
            <span>Score</span>
            <span>Sun</span>
            <span>Earth</span>
            <span>Slope</span>
            <span>Dark</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
            <ol aria-label="Best landing sites" onPointerLeave={() => setHoveredRank(null)}>
              {shown.map((r) => (
                <ResultRow
                  key={r.rank}
                  r={r}
                  target={target}
                  hovered={hoveredRank === r.rank}
                  onHover={setHoveredRank}
                  onPlace={(p) => {
                    placeLander(target, { x: p.x, y: p.y });
                    useApp.getState().focusOn(p.x, p.y, 5);
                  }}
                />
              ))}
            </ol>
            <p className="px-2 pt-1.5 text-2xs text-fg-faint">
              {stale ? "From earlier settings — search again to update. " : ""}
              Click a site to place lander {target}. “Dark” is the longest stretch without Sun.
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}
