/**
 * @file burgProximity.ts — cell-native town distance-LOD (grid retirement).
 *
 * The living-world sim ticks only the towns NEAR the player each day (far towns
 * catch up identically on approach — a pure perf LOD). The legacy selector did
 * this with `getTownTilesForGrid` + a grid-tile Manhattan radius off `coord_X_Y`.
 * This is the cell-native successor: burgs whose seat cell sits within a graph
 * radius of the player's canonical cell. No grid round-trip.
 *
 * Pure (per-seed atlas cache). Correctness-neutral: which towns tick early is a
 * perf choice, not a game-state change.
 */
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';

interface BurgLike { i?: number; cell?: number; removed?: boolean }

/**
 * Burg ids whose seat cell is within `graphRadius` (atlas graph units) of the
 * given cell's site. Includes the burg on `cellId` itself.
 */
export function nearBurgIdsForCell(worldSeed: number, cellId: number, graphRadius: number): number[] {
  const atlas = getBridgeAtlas(worldSeed);
  const p = atlas.pack.cells.p as ReadonlyArray<readonly [number, number]>;
  const origin = p[cellId];
  if (!origin) return [];
  const r2 = graphRadius * graphRadius;
  const burgs = (atlas.pack.burgs ?? []) as BurgLike[];
  const out: number[] = [];
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    const site = p[b.cell];
    if (!site) continue;
    const dx = site[0] - origin[0];
    const dy = site[1] - origin[1];
    if (dx * dx + dy * dy <= r2) out.push(typeof b.i === 'number' ? b.i : i);
  }
  return out;
}
