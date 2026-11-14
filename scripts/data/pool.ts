/** Worker-thread pool for horizon computation (DEM pixels shared via SharedArrayBuffer). */
import { availableParallelism } from "node:os";
import type { MultiDem } from "./dem";

interface Job {
  points: Float64Array;
  mast: number;
  azBins: number;
  resolve: (out: Float32Array) => void;
}

export class HorizonPool {
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly queue: Job[] = [];
  private readonly pending = new Map<number, Job>();
  private nextId = 0;

  private constructor() {}

  static async create(dem: MultiDem, maxHeight: number, size = availableParallelism()): Promise<HorizonPool> {
    const pool = new HorizonPool();
    await Promise.all(
      Array.from({ length: size }, async () => {
        const w = new Worker(new URL("./horizon-worker.ts", import.meta.url).href);
        const ready = Promise.withResolvers<void>();
        w.onerror = (e) => ready.reject(e);
        w.onmessage = (ev) => {
          if (ev.data.type === "ready") ready.resolve();
          else pool.onResult(w, ev.data);
        };
        w.postMessage({ type: "init", rasters: dem.rasters, maxHeight });
        await ready.promise;
        pool.workers.push(w);
        pool.idle.push(w);
      }),
    );
    return pool;
  }

  get size(): number {
    return this.workers.length;
  }

  /** Horizons for points [X0, Y0, X1, Y1, ...]; result is point-major (point * azBins + k). */
  run(points: Float64Array, mast: number, azBins: number): Promise<Float32Array> {
    const { promise, resolve } = Promise.withResolvers<Float32Array>();
    this.queue.push({ points, mast, azBins, resolve });
    this.pump();
    return promise;
  }

  private pump(): void {
    for (;;) {
      const w = this.idle.pop();
      if (!w) return;
      const job = this.queue.shift();
      if (!job) {
        this.idle.push(w);
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, job);
      w.postMessage({
        id,
        points: job.points,
        mast: job.mast,
        azBins: job.azBins,
      });
    }
  }

  private onResult(w: Worker, data: { id: number; out: Float32Array }): void {
    const job = this.pending.get(data.id);
    if (!job) throw new Error(`unknown job ${data.id}`);
    this.pending.delete(data.id);
    this.idle.push(w);
    job.resolve(data.out);
    this.pump();
  }

  terminate(): void {
    for (const w of this.workers) w.terminate();
  }
}
