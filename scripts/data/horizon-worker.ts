/// <reference lib="webworker" />
import { HorizonMarcher } from "./horizon-core";
import type { PolarRaster } from "./pds";

declare const self: Worker;

let marcher: HorizonMarcher | null = null;

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === "init") {
    marcher = new HorizonMarcher(msg.rasters as PolarRaster[], msg.maxHeight as number);
    self.postMessage({ type: "ready" });
    return;
  }
  if (!marcher) throw new Error("worker not initialised");
  const { id, points, mast, azBins } = msg as {
    id: number;
    points: Float64Array;
    mast: number;
    azBins: number;
  };
  const n = points.length / 2;
  const out = new Float32Array(n * azBins);
  for (let i = 0; i < n; i++) marcher.horizon(points[2 * i], points[2 * i + 1], mast, azBins, out, i * azBins, 1);
  self.postMessage({ type: "result", id, out }, [out.buffer]);
};
