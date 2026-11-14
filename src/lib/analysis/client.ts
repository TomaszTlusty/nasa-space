"use client";

import type { JobResults, WorkerJob, WorkerRequest, WorkerResponse } from "@/lib/analysis/protocol";
import type { RegionId } from "@/lib/store";

/**
 * Main-thread side of the analysis worker. `request` is latest-wins per key: a newer request with the
 * same key rejects the older one with `AnalysisCancelled` (and the worker drops it if still queued).
 */

export class AnalysisCancelled extends Error {
  constructor() {
    super("analysis request superseded");
    this.name = "AbortError";
  }
}

interface Pending {
  key: string;
  resolve: (value: JobResults[WorkerJob["kind"]]) => void;
  reject: (reason: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const latestByKey = new Map<string, number>();

function settle(reqId: number): Pending | undefined {
  const p = pending.get(reqId);
  if (!p) return undefined;
  pending.delete(reqId);
  if (latestByKey.get(p.key) === reqId) latestByKey.delete(p.key);
  return p;
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "analysis",
  });
  w.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const p = settle(msg.reqId);
    if (!p) return;
    if (msg.ok) p.resolve(msg.result);
    else p.reject(msg.cancelled ? new AnalysisCancelled() : new Error(msg.error));
  });
  w.addEventListener("error", (e) => {
    // the worker script itself failed: fail everything in flight and start fresh next time
    for (const id of [...pending.keys()]) settle(id)?.reject(new Error(`analysis worker failed: ${e.message}`));
    w.terminate();
    if (worker === w) worker = null;
  });
  worker = w;
  return w;
}

export function request<K extends WorkerJob["kind"]>(
  key: string,
  regionId: RegionId,
  job: Extract<WorkerJob, { kind: K }>,
): Promise<JobResults[K]> {
  const w = getWorker();
  const older = latestByKey.get(key);
  if (older !== undefined) {
    settle(older)?.reject(new AnalysisCancelled());
    w.postMessage({ cancel: older });
  }
  const reqId = nextId++;
  latestByKey.set(key, reqId);
  return new Promise<JobResults[K]>((resolve, reject) => {
    pending.set(reqId, { key, resolve: resolve as Pending["resolve"], reject });
    const msg: WorkerRequest = {
      reqId,
      key,
      regionId,
      origin: location.origin,
      job,
    };
    w.postMessage(msg);
  });
}

/** Shares one in-flight/finished promise between identical requests (e.g. several panels, one lander). */
const memo = new Map<string, Promise<unknown>>();
const MEMO_MAX = 24;

export function memoRequest<K extends WorkerJob["kind"]>(
  key: string,
  regionId: RegionId,
  job: Extract<WorkerJob, { kind: K }>,
): Promise<JobResults[K]> {
  const memoKey = `${regionId}|${JSON.stringify(job)}`;
  const hit = memo.get(memoKey) as Promise<JobResults[K]> | undefined;
  if (hit) return hit;
  const p = request(key, regionId, job);
  memo.set(memoKey, p);
  if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value as string);
  p.catch(() => {
    if (memo.get(memoKey) === p) memo.delete(memoKey);
  });
  return p;
}
