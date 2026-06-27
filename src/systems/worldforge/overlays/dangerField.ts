/**
 * @file dangerField.ts — PROTOTYPE (2026-06-26). The first Worldforge map layer
 * DERIVED FROM WORLD STATE rather than read straight from the generator pack.
 *
 * Branch: "layers that mean something" + "controlled blending". Most atlas
 * overlays (biomes, states, temperature) are static facts of the generated
 * world. This one answers a question a PARTY actually has mid-adventure — "where
 * is it dangerous to go?" — by fusing the (previously inert) event zones
 * (wars / plagues / disasters) with terrain hostility and bleeding the threat
 * outward from its source.
 *
 * It is intentionally a heuristic first cut. The architecture is the point: a
 * pure `(atlas, opts) => per-cell scalar field` that a ramp/hatch renderer
 * consumes. The same shape extends to:
 *   - TIME SCRUBBER: pass the world state at time T (zones/factions then).
 *   - GAMEPLAY: feed real encounter tables, faction aggression, bounty levels.
 *   - KNOWN-VS-RUMORED: mask the field by what the party has actually learned.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';

/** Threat weight per zone type (0..1 at the zone's own cells). */
const ZONE_WEIGHT: Record<string, number> = {
  Invasion: 0.85, Crusade: 0.8, Rebels: 0.65, Disease: 0.7,
  Disaster: 0.6, Eruption: 0.75, Avalanche: 0.55, Fault: 0.4,
  Flood: 0.55, Tsunami: 0.7, Proselytism: 0.3,
};
const ZONE_WEIGHT_DEFAULT = 0.5;

/** Base terrain hostility by FMG biome id (0..~0.4). Open land is calm. */
const BIOME_HOSTILITY: Record<number, number> = {
  0: 0,    // Marine
  1: 0.32, // Hot desert
  2: 0.28, // Cold desert
  3: 0.12, // Savanna
  4: 0.05, // Grassland
  5: 0.16, // Tropical seasonal forest
  6: 0.1,  // Temperate deciduous forest
  7: 0.24, // Tropical rainforest
  8: 0.16, // Temperate rainforest
  9: 0.2,  // Taiga
  10: 0.3, // Tundra
  11: 0.4, // Glacier
  12: 0.26, // Wetland
};

export interface DangerFieldOptions {
  /** How far (cell rings) zone threat bleeds outward; each ring decays by `falloff`. */
  spreadRings?: number;
  falloff?: number;
  /** Per-ring zone weight multiplier applied before falloff (tunes overall intensity). */
  intensity?: number;
}

/**
 * Compute a per-cell danger scalar in [0,1], indexed by FMG cell id. Land cells
 * only (water = 0). Deterministic: pure function of the atlas pack.
 */
export function computeDangerField(atlas: FmgAtlasResult, opts: DangerFieldOptions = {}): Float32Array {
  const spreadRings = opts.spreadRings ?? 2;
  const falloff = opts.falloff ?? 0.5;
  const intensity = opts.intensity ?? 1;

  const cells = atlas.pack.cells as {
    h: ArrayLike<number>;
    c?: number[][];
    biome?: ArrayLike<number>;
  };
  const n = cells.h.length;
  const danger = new Float32Array(n);
  const isLand = (i: number): boolean => cells.h[i] >= 20;

  // 1. Terrain base hostility.
  if (cells.biome) {
    for (let i = 0; i < n; i++) {
      if (!isLand(i)) continue;
      danger[i] = BIOME_HOSTILITY[cells.biome[i]] ?? 0.1;
    }
  }

  // 2. Event zones — add threat at source cells, then bleed outward by BFS rings.
  const zones = (atlas.pack as { zones?: Array<{ cells?: number[]; type?: string }> }).zones ?? [];
  const neighbors = cells.c;
  for (const z of zones) {
    const w = (ZONE_WEIGHT[z.type ?? ''] ?? ZONE_WEIGHT_DEFAULT) * intensity;
    let frontier = (z.cells ?? []).filter((i) => i >= 0 && i < n);
    const visited = new Set<number>(frontier);
    for (let ring = 0; ring <= spreadRings; ring++) {
      const ringWeight = w * Math.pow(falloff, ring);
      for (const i of frontier) {
        if (!isLand(i)) continue;
        // Threats combine probabilistically so overlapping zones saturate toward 1.
        danger[i] = 1 - (1 - danger[i]) * (1 - ringWeight);
      }
      if (ring === spreadRings || !neighbors) break;
      const next: number[] = [];
      for (const i of frontier) {
        for (const j of neighbors[i] ?? []) {
          if (!visited.has(j)) { visited.add(j); next.push(j); }
        }
      }
      frontier = next;
    }
  }

  return danger;
}

export interface DangerCell { i: number; danger: number }

/**
 * Cells whose danger clears `threshold`, with their scalar — the render input for
 * the hatch overlay. Below threshold a cell reads as "safe" and is left unhatched
 * so the base coloring stays clean (controlled blending, not mud).
 */
export function dangerCellsAbove(field: Float32Array, threshold = 0.18): DangerCell[] {
  const out: DangerCell[] = [];
  for (let i = 0; i < field.length; i++) {
    if (field[i] >= threshold) out.push({ i, danger: field[i] });
  }
  return out;
}
