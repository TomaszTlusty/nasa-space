import type { WorkerRequest, WorkerResponse } from "@/lib/analysis/protocol";
import { DEFAULT_POWER } from "@/lib/store";

const PUBLIC = `${import.meta.dir}/../public`;
const server = Bun.serve({ port: 0, fetch: (req) => new Response(Bun.file(PUBLIC + new URL(req.url).pathname)) });
const origin = `http://localhost:${server.port}`;
const w = new Worker(new URL("../src/lib/analysis/worker.ts", import.meta.url), { type: "module" });
const sent = new Map<number, number>();
const done = new Map<number, (r: WorkerResponse) => void>();
w.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
  const r = e.data;
  const ms = performance.now() - (sent.get(r.reqId) ?? 0);
  console.log(`#${r.reqId}`, r.ok ? "ok" : r.cancelled ? "cancelled" : `error ${r.error}`, `${ms.toFixed(0)} ms`);
  done.get(r.reqId)?.(r);
});
let id = 1;
const send = (key: string, job: WorkerRequest["job"]) => {
  const reqId = id++;
  sent.set(reqId, performance.now());
  const p = new Promise<WorkerResponse>((res) => done.set(reqId, res));
  w.postMessage({ reqId, key, regionId: "shackleton", origin, job } satisfies WorkerRequest);
  return p;
};
const start = Date.UTC(2027, 0, 15);
const c1 = { x: -11030, y: -5618, siteId: "c1", mastHeight: 2 };
await send("point:A", { kind: "point", id: "A", query: c1, start, days: 30, power: DEFAULT_POWER });
const again = await send("point:A", { kind: "point", id: "A", query: c1, start, days: 30, power: { ...DEFAULT_POWER, loadW: 300 } });
if (again.ok) console.log("power-only recompute ok");
// scrubbing flood: only the last should run
const flood: Promise<WorkerResponse>[] = [];
for (let k = 0; k < 20; k++) flood.push(send("transitions:A", { kind: "transitions", query: c1, from: start + k * 3_600_000 }));
const last = await flood[flood.length - 1];
if (last.ok) console.log(last.result);
// playing forward: cached
for (let k = 1; k <= 5; k++) await send("transitions:A", { kind: "transitions", query: c1, from: start + 19 * 3_600_000 + k * 60_000 });
const avg = await send("average", { kind: "average", start, days: 15 });
if (avg.ok && "stats" in avg.result) console.log("avg15 computeMs", avg.result.stats.computeMs.toFixed(0), "step", avg.result.stats.stepHours);
const avg30 = await send("average", { kind: "average", start, days: 30 });
if (avg30.ok && "stats" in avg30.result) console.log("avg30 computeMs", avg30.result.stats.computeMs.toFixed(0), "step", avg30.result.stats.stepHours);
const disc = await send("discovery", { kind: "discovery", criteria: { maxSlopeDeg: 10, minSun: 0.6, minEarth: 0.5 }, start, days: 15 });
if (disc.ok) console.log(disc.result);
const disc2 = await send("discovery", { kind: "discovery", criteria: { maxSlopeDeg: 10, minSun: 0.5, minEarth: 0.3 }, start, days: 15 });
if (disc2.ok) console.log(disc2.result);
w.terminate();
server.stop(true);
for (let k = 1; k <= 4; k++) {
  const a = await send("average", { kind: "average", start: start + k * 86_400_000, days: 15 });
  if (a.ok && "stats" in a.result) console.log("avg15 warm", a.result.stats.computeMs.toFixed(0));
  const p = await send("point:B", { kind: "point", id: "B", query: { x: 1000 * k, y: 2000 }, start, days: 30, power: DEFAULT_POWER });
  if (p.ok) console.log("point 30d");
  const t = await send("transitions:B", { kind: "transitions", query: { x: 1000 * k, y: 2000 }, from: start });
  if (t.ok) console.log("transitions cold point");
}
