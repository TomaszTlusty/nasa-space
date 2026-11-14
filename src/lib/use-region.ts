"use client";

import { useEffect, useState } from "react";
import { type LoadedRegion, loadRegion } from "@/lib/moon/horizon";
import type { RegionId } from "@/lib/store";

const cache = new Map<RegionId, Promise<LoadedRegion>>();

export function fetchRegion(id: RegionId): Promise<LoadedRegion> {
  let p = cache.get(id);
  if (!p) {
    p = loadRegion("", id);
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Loads (once, cached) the precomputed assets of a region. `null` while loading. */
export function useRegion(id: RegionId): { region: LoadedRegion | null; error: Error | null } {
  const [state, setState] = useState<{ id: RegionId; region: LoadedRegion | null; error: Error | null }>({
    id,
    region: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    fetchRegion(id).then(
      (region) => alive && setState({ id, region, error: null }),
      (error: Error) => alive && setState({ id, region: null, error }),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  return state.id === id ? { region: state.region, error: state.error } : { region: null, error: null };
}
