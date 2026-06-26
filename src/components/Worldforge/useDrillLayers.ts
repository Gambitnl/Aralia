import { useEffect, useRef, useState } from 'react';

export interface LayerDef<K extends string = string> { id: K; label: string; desc: string }

/**
 * Per-save toggle state persisted to localStorage scoped by `scope` (pass the
 * world seed) so different campaigns remember different views. Reloads on scope
 * change after mount (ref-guarded: reload-then-persist so a scope switch never
 * overwrites the new save with old state). Shared by every drill-tier panel.
 */
function usePersistedToggles<K extends string>(
  keyBase: string,
  defaults: Record<K, boolean>,
  scope?: string | number,
): { layers: Record<K, boolean>; toggle: (id: K) => void } {
  const key = `${keyBase}:${scope ?? 'global'}`;
  const keyRef = useRef(key);
  const load = (k: string): Record<K, boolean> => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(k) || '{}') }; }
    catch { return { ...defaults }; }
  };
  const [layers, setLayers] = useState<Record<K, boolean>>(() => load(key));

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (keyRef.current === key) return;
    keyRef.current = key;
    setLayers(load(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try { localStorage.setItem(keyRef.current, JSON.stringify(layers)); } catch { /* ignore */ }
  }, [layers]);

  const toggle = (id: K): void => setLayers((l) => ({ ...l, [id]: !l[id] }));
  return { layers, toggle };
}

// ── Region / submap tiers ─────────────────────────────────────────────────────
// Only the features that exist at submap scale are offered — biome coloring is
// intrinsic to the cells, so there is no coloring radio here, just toggles.
export type DrillLayerId = 'labels' | 'rivers' | 'roads';
export type DrillLayers = Record<DrillLayerId, boolean>;
export const DRILL_LAYER_DEFS: Array<LayerDef<DrillLayerId>> = [
  { id: 'labels', label: 'Labels', desc: 'Settlement and place names' },
  { id: 'rivers', label: 'Rivers', desc: 'Watercourses inherited from the parent cell' },
  { id: 'roads', label: 'Roads', desc: 'Routes inherited from the parent cell' },
];
const DRILL_DEFAULTS: DrillLayers = { labels: true, rivers: true, roads: true };

export function useDrillLayers(scope?: string | number): { layers: DrillLayers; toggle: (id: DrillLayerId) => void } {
  return usePersistedToggles('aralia.atlas.drillLayers.v1', DRILL_DEFAULTS, scope);
}

// ── Town leaf tier ────────────────────────────────────────────────────────────
// A town plan's geometry is wards/streets/plots/walls/civic, not Voronoi features,
// so it gets its own toggle set. The ground (blocks, core, outskirts) stays on.
export type TownLayerId = 'buildings' | 'roads' | 'walls' | 'civic';
export type TownLayers = Record<TownLayerId, boolean>;
export const TOWN_LAYER_DEFS: Array<LayerDef<TownLayerId>> = [
  { id: 'buildings', label: 'Buildings', desc: 'Building plots and rural farmsteads' },
  { id: 'roads', label: 'Main roads', desc: 'Inherited through-roads over the street grid' },
  { id: 'walls', label: 'Walls', desc: 'Defensive ring and gatehouses' },
  { id: 'civic', label: 'Civic', desc: 'Plaza, temple, keep, citadel, docks' },
];
const TOWN_DEFAULTS: TownLayers = { buildings: true, roads: true, walls: true, civic: true };

export function useTownLayers(scope?: string | number): { layers: TownLayers; toggle: (id: TownLayerId) => void } {
  return usePersistedToggles('aralia.atlas.townLayers.v1', TOWN_DEFAULTS, scope);
}
