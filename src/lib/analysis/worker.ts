/**
 * Analysis Web Worker: loads each region once and serves point analyses, transitions, window
 * averages and site discovery. Jobs run one at a time; queued jobs are keyed and a newer job with the
 * same key replaces (cancels) an older queued one, so dragging the scrubber never builds a backlog.
 */
import {
  analyzeTimeline,
  type BodyTransitions,
  bodyTransitions,
  discover,
  encodeAverage,
  pointTimeline,
  stillValid,
  timelinePoint,
  toTransitions,
  type WindowAverage,
  windowAverage,
} from "@/lib/analysis/compute";
import type {
  AverageResult,
  JobResults,
  WorkerInbound,
  WorkerJob,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/analysis/protocol";
import { type LoadedRegion, loadRegion, type Timeline } from "@/lib/moon/horizon";
import type { RegionId } from "@/lib/store";

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  addEventListener(type: "message", listener: (e: MessageEvent<WorkerInbound>) => void): void;
}
const scope = self as unknown as WorkerScope;

const regions = new Map<RegionId, Promise<LoadedRegion>>();
const timelines = new Map<string, Timeline>();
const transitionCache = new Map<string, { sun: BodyTransitions; earth: BodyTransitions }>();
const averages = new Map<string, WindowAverage & { rgba: Uint8Array }>();

/** Small LRU on Map insertion order. */
function remember<T>(cache: Map<string, T>, key: string, max: number, compute: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = compute();
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value as string);
  return value;
}

function region(id: RegionId, origin: string): Promise<LoadedRegion> {
  let p = regions.get(id);
  if (!p) {
    p = loadRegion(origin, id);
    p.catch(() => regions.delete(id));
    regions.set(id, p);
  }
  return p;
}

function average(
  r: LoadedRegion,
  regionId: RegionId,
  start: number,
  days: number,
): WindowAverage & { rgba: Uint8Array } {
  return remember(averages, `${regionId}|${start}|${days}`, 4, () => {
    const a = windowAverage(r, start, days);
    return { ...a, rgba: encodeAverage(a.sun, a.earthAny) };
  });
}

function run(r: LoadedRegion, req: WorkerRequest): JobResults[WorkerJob["kind"]] {
  const job = req.job;
  switch (job.kind) {
    case "point": {
      const pointKey = JSON.stringify(timelinePoint(r, job.query));
      const tl = remember(timelines, `${req.regionId}|${pointKey}|${job.start}|${job.days}`, 8, () =>
        pointTimeline(r, job.query, job.start, job.days),
      );
      return analyzeTimeline(r, job.id, job.query, tl, job.power);
    }
    case "transitions": {
      const point = timelinePoint(r, job.query);
      const key = `${req.regionId}|${JSON.stringify(point)}`;
      const prev = transitionCache.get(key);
      const sun = prev && stillValid(prev.sun, job.from) ? prev.sun : bodyTransitions(r, point, job.from, "sun");
      const earth =
        prev && stillValid(prev.earth, job.from) ? prev.earth : bodyTransitions(r, point, job.from, "earth");
      transitionCache.delete(key);
      transitionCache.set(key, { sun, earth });
      if (transitionCache.size > 8) transitionCache.delete(transitionCache.keys().next().value as string);
      return toTransitions(sun, earth, job.from);
    }
    case "average": {
      const a = average(r, req.regionId, job.start, job.days);
      const result: AverageResult = {
        stats: {
          sun: a.sun,
          earth: a.earthAny,
          computeMs: a.computeMs,
          stepHours: a.stepHours,
        },
        rgba: a.rgba,
      };
      return result;
    }
    case "discovery":
      return discover(r, average(r, req.regionId, job.start, job.days), job.criteria, job.start, job.days);
  }
}

const queue = new Map<string, WorkerRequest>();
let busy = false;
let scheduled = false;

function schedule(): void {
  if (scheduled || busy || queue.size === 0) return;
  scheduled = true;
  // a macrotask lets messages that arrived during the previous job replace stale queued ones first
  setTimeout(pump, 0);
}

async function pump(): Promise<void> {
  scheduled = false;
  const next = queue.entries().next();
  if (next.done) return;
  const [key, req] = next.value;
  queue.delete(key);
  busy = true;
  try {
    const r = await region(req.regionId, req.origin);
    scope.postMessage({ reqId: req.reqId, ok: true, result: run(r, req) });
  } catch (e) {
    scope.postMessage({
      reqId: req.reqId,
      ok: false,
      cancelled: false,
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    busy = false;
    schedule();
  }
}

scope.addEventListener("message", (e) => {
  const msg = e.data;
  if ("cancel" in msg) {
    for (const [key, req] of queue) {
      if (req.reqId === msg.cancel) {
        queue.delete(key);
        scope.postMessage({
          reqId: req.reqId,
          ok: false,
          cancelled: true,
          error: "cancelled",
        });
      }
    }
    return;
  }
  const stale = queue.get(msg.key);
  if (stale)
    scope.postMessage({
      reqId: stale.reqId,
      ok: false,
      cancelled: true,
      error: "superseded",
    });
  queue.set(msg.key, msg);
  schedule();
});
