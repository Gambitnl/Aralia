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

/**
 * One dungeon site's danger contribution (Pillar 2, Task 8). A site whose apex
 * occupation is still UNCLEARED radiates a modest LOCAL danger bump around its
 * cell — a den that raids the neighbourhood, not a war that engulfs a province.
 * Cleared sites contribute nothing. `strength` overrides the default per-site
 * bump (0..1 at the site's own cell); omit for the standard local threat.
 */
export interface DungeonDangerSite {
  cellId: number;
  cleared: boolean;
  /** Peak danger at the site cell (0..1). Defaults to DUNGEON_SITE_STRENGTH. */
  strength?: number;
}

export interface DangerFieldOptions {
  /** How far (cell rings) zone threat bleeds outward; each ring decays by `falloff`. */
  spreadRings?: number;
  falloff?: number;
  /** Per-ring zone weight multiplier applied before falloff (tunes overall intensity). */
  intensity?: number;
  /**
   * Dungeon sites (Pillar 2, Task 8). Each UNCLEARED site adds a BFS-bled local
   * danger bump around its cell (same ring-bleed as zones, but a shorter reach
   * and a modest weight — a local threat, not a war). OMITTING this leaves the
   * output byte-identical to the pre-Task-8 field (flag-gated; the function
   * stays pure). Cleared sites are ignored.
   */
  dungeonSites?: ReadonlyArray<DungeonDangerSite>;
}

/** Default peak danger at an uncleared dungeon site's own cell (0..1). Modest:
 * a den bleeds the neighbourhood, it does not saturate a region like a war. */
export const DUNGEON_SITE_STRENGTH = 0.45;
/** How many cell rings a dungeon site's danger bleeds — shorter than a zone's,
 * because a dungeon's menace is local. */
const DUNGEON_SPREAD_RINGS = 2;
/** Per-ring decay for a dungeon site's bleed (each ring = this × the last). */
const DUNGEON_FALLOFF = 0.45;

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

  // 3. Dungeon sites (Task 8) — each UNCLEARED site bleeds a modest LOCAL bump
  // around its cell, exactly the same BFS ring-bleed as zones but with a shorter
  // reach and lower weight. Gated on `opts.dungeonSites`: when it is absent this
  // whole block is skipped, so the field is byte-identical to the pre-Task-8
  // output for every caller that does not pass site states.
  const dungeonSites = opts.dungeonSites;
  if (dungeonSites && neighbors) {
    for (const site of dungeonSites) {
      if (site.cleared) continue; // cleared sites radiate nothing
      const i0 = site.cellId;
      if (i0 < 0 || i0 >= n || !isLand(i0)) continue;
      const w = (site.strength ?? DUNGEON_SITE_STRENGTH) * intensity;
      let frontier = [i0];
      const visited = new Set<number>(frontier);
      for (let ring = 0; ring <= DUNGEON_SPREAD_RINGS; ring++) {
        const ringWeight = w * Math.pow(DUNGEON_FALLOFF, ring);
        for (const i of frontier) {
          if (!isLand(i)) continue;
          // Combine probabilistically, like zones, so a site near a war saturates
          // toward 1 rather than overwriting the higher of the two.
          danger[i] = 1 - (1 - danger[i]) * (1 - ringWeight);
        }
        if (ring === DUNGEON_SPREAD_RINGS) break;
        const nextFrontier: number[] = [];
        for (const i of frontier) {
          for (const j of neighbors[i] ?? []) {
            if (!visited.has(j)) { visited.add(j); nextFrontier.push(j); }
          }
        }
        frontier = nextFrontier;
      }
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
