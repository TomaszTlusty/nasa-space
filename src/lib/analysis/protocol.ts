import type { PointQuery } from "@/lib/analysis/compute";
import type {
  PointAnalysis,
  Transitions,
  WindowAverageStats,
} from "@/lib/analysis/types";
import type {
  DiscoveryCriteria,
  DiscoveryResult,
  LanderId,
  PowerPreset,
  RegionId,
} from "@/lib/store";

/** Main thread <-> analysis worker messages. */

export type WorkerJob =
  | {
      kind: "point";
      id: LanderId;
      query: PointQuery;
      start: number;
      days: number;
      power: PowerPreset;
    }
  | { kind: "transitions"; query: PointQuery; from: number }
  | { kind: "average"; start: number; days: number }
  | {
      kind: "discovery";
      criteria: DiscoveryCriteria;
      start: number;
      days: number;
    };

export interface AverageResult {
  stats: WindowAverageStats;
  /** RGBA8 per horizon-grid node, see `averageData` in the store */
  rgba: Uint8Array;
}

export interface JobResults {
  point: PointAnalysis;
  transitions: Transitions;
  average: AverageResult;
  discovery: DiscoveryResult[];
}

export interface WorkerRequest {
  reqId: number;
  /** latest wins: a newer request with the same key cancels a queued older one */
  key: string;
  regionId: RegionId;
  /** absolute origin the region assets are fetched from */
  origin: string;
  job: WorkerJob;
}

export type WorkerInbound = WorkerRequest | { cancel: number };

export type WorkerResponse =
  | { reqId: number; ok: true; result: JobResults[WorkerJob["kind"]] }
  | { reqId: number; ok: false; cancelled: boolean; error: string };
