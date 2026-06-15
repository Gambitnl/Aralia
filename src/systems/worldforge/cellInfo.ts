/**
 * @file src/systems/worldforge/cellInfo.ts
 * Pure cell inspector for the Worldforge atlas. Given a generated atlas and a
 * Voronoi cell id, returns a structured, render-agnostic summary of that
 * cell's contents (terrain, biome, political/cultural ownership, settlement,
 * population). Used by the atlas cartographer's cell-selection info panel.
 *
 * Pure: no React, no canvas. Tolerant of partial atlases (atlas-only artifacts
 * with no civilization layers return the geographic fields and omit the rest).
 */

import { FEET_PER_FMG_PIXEL } from "./adapter/atlasArtifact";
import type { FmgAtlasResult } from "./fmg/generateAtlas";

/** Land/water classification derived from cell height (FMG: >= 20 is land). */
export type CellTerrain = "land" | "water";

/** A named reference into one of the atlas civilization collections. */
export interface CellOwnership {
  id: number;
  name: string;
}

/** Settlement (burg) summary when a cell hosts one. */
export interface CellBurg {
  id: number;
  name: string;
  population: number;
  capital: boolean;
  port: boolean;
}

/** Structured, render-agnostic summary of a single atlas cell's contents. */
export interface CellInfo {
  cellId: number;
  terrain: CellTerrain;
  /** Raw FMG height value (0–100; >= 20 is land). */
  height: number;
  /** Cell centroid in world feet (feet-canon, per spec §4). */
  positionFt: { x: number; y: number };
  biome?: string;
  state?: CellOwnership;
  culture?: CellOwnership;
  religion?: CellOwnership;
  province?: CellOwnership;
  burg?: CellBurg;
  /** Estimated rural population on the cell (FMG `pop`, ×1000 inhabitants). */
  ruralPopulation?: number;
  /** True when a river channel runs through the cell. */
  hasRiver: boolean;
}

const FMG_LAND_THRESHOLD = 20;

/**
 * Build a structured summary of the given cell. `cellId` is clamped/validated;
 * an out-of-range id returns a minimal water entry rather than throwing.
 */
export function describeCell(atlas: FmgAtlasResult, cellId: number): CellInfo {
  const { cells } = atlas.pack;
  const n = cells.h.length;

  if (cellId < 0 || cellId >= n) {
    return {
      cellId,
      terrain: "water",
      height: 0,
      positionFt: { x: 0, y: 0 },
      hasRiver: false,
    };
  }

  const height = cells.h[cellId];
  const terrain: CellTerrain = height >= FMG_LAND_THRESHOLD ? "land" : "water";
  const p = cells.p[cellId] ?? [0, 0];

  const info: CellInfo = {
    cellId,
    terrain,
    height,
    positionFt: {
      x: Math.round(p[0] * FEET_PER_FMG_PIXEL),
      y: Math.round(p[1] * FEET_PER_FMG_PIXEL),
    },
    hasRiver: Boolean(cells.r && cells.r[cellId]),
  };

  // Biome (geographic — present on any full atlas).
  const biomeId = cells.biome?.[cellId];
  if (biomeId != null) {
    info.biome = atlas.biomesData?.name?.[biomeId];
  }

  // Civilization layers — only present after generateFmgWorld. Each guarded so
  // an atlas-only artifact degrades to geography-only.
  const stateId = cells.state?.[cellId];
  const state = stateId ? atlas.pack.states?.[stateId] : undefined;
  if (state && !state.removed && state.i > 0) {
    info.state = { id: state.i, name: state.fullName ?? state.name };
  }

  const cultureId = cells.culture?.[cellId];
  const culture = cultureId ? atlas.pack.cultures?.[cultureId] : undefined;
  if (culture && culture.i > 0) {
    info.culture = { id: culture.i, name: culture.name };
  }

  const religionId = cells.religion?.[cellId];
  const religion = religionId ? atlas.pack.religions?.[religionId] : undefined;
  if (religion && religion.i > 0) {
    info.religion = { id: religion.i, name: religion.name };
  }

  const provinceId = cells.province?.[cellId];
  const province = provinceId ? atlas.pack.provinces?.[provinceId] : undefined;
  if (province && province.i > 0) {
    info.province = { id: province.i, name: province.fullName ?? province.name };
  }

  const burgId = cells.burg?.[cellId];
  const burg = burgId ? atlas.pack.burgs?.[burgId] : undefined;
  if (burg && !burg.removed && (burg.i ?? 0) > 0) {
    info.burg = {
      id: burg.i ?? (burgId as number),
      name: burg.name ?? `Burg ${burgId}`,
      // FMG population is in arbitrary thousands; round to whole inhabitants.
      population: Math.round((burg.population ?? 0) * 1000),
      capital: Boolean(burg.capital),
      port: Boolean(burg.port),
    };
  }

  const pop = cells.pop?.[cellId];
  if (pop != null && pop > 0) {
    info.ruralPopulation = Math.round(pop * 1000);
  }

  return info;
}
