/** Read the published ground water triangles for gameplay admission. Reusing
 * the sampler and water builder keeps town widths, overdraw, bends and clipped
 * falling surfaces together. This never edits water, land or a saved body. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 14:58:30
 * Dependents: systems/gameplay/lodging.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { sampleGroundChunk, type GroundWorld } from './groundChunkLoader';
import { buildWaterMesh } from '../../world3d/waterGeometry';
import { createDeckSupportQueryFromMesh, type DeckSupportQuery } from '../../world3d/deckGeometry';
import { WORLD3D_CONFIG } from '../../world3d/config';
import { GROUND_METERS_PER_CELL } from './groundWorldAdapter';

interface SurfaceCache { reach: number; chunks: Map<string, DeckSupportQuery> }
const worlds = new WeakMap<GroundWorld, SurfaceCache>();

function cacheFor(ground: GroundWorld): SurfaceCache {
  let cached = worlds.get(ground);
  if (cached) return cached;
  let halfWidth = 0;
  for (const river of ground.rivers) {
    if (!river.waterlineY?.length) continue;
    for (let i = 0; i < river.points.length; i++) {
      const width = river.surfaceWidthM?.[i] ?? river.widthM;
      if (Number.isFinite(width)) halfWidth = Math.max(halfWidth, width / 2 + (river.sourceKind === 'river' ? GROUND_METERS_PER_CELL : 0));
    }
  }
  cached = { reach: Math.ceil(halfWidth / WORLD3D_CONFIG.CHUNK_WORLD_SIZE), chunks: new Map() };
  worlds.set(ground, cached);
  return cached;
}

function chunkQuery(ground: GroundWorld, cx: number, cy: number, cache: SurfaceCache): DeckSupportQuery {
  const key = `${cx}|${cy}`, previous = cache.chunks.get(key);
  if (previous) return previous;
  // Bed sampling changes depth colors only when a ribbon carries its authored
  // waterline. Two terrain samples per edge avoid rebuilding detailed land or
  // depending on the camera's terrain LOD for this water-height query.
  const data = sampleGroundChunk(ground, cx, cy, 2);
  const mesh = buildWaterMesh({ ...data, rivers: data.rivers.filter(r => r.waterlineY?.length === r.points.length) });
  const indices = mesh.indices.slice();
  // Water is visible from both sides. The shared support reader indexes upward
  // faces, so orient this private index copy upward; draw buffers stay intact.
  const p = mesh.positions;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const up = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
    if (up < 0) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  const query = createDeckSupportQueryFromMesh({ positions: mesh.positions, indices });
  cache.chunks.set(key, query);
  return query;
}

/** Highest published water surface at this source point, including neighboring
 * ribbons whose bank overhangs the point's chunk. Undefined does not certify a
 * dry regional route: legacy ribbons without an authored waterline remain
 * unknown, as they were to the existing rest guard. Source travel rules still
 * own physical river/crossing admission. */
export function publishedGroundWaterSurfaceYAt(ground: GroundWorld, xM: number, zM: number): number | undefined {
  if (!Number.isFinite(xM) || !Number.isFinite(zM)) return undefined;
  const size = WORLD3D_CONFIG.CHUNK_WORLD_SIZE, cx = Math.floor(xM / size), cy = Math.floor(zM / size);
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) return undefined;
  const cache = cacheFor(ground);
  let highest = -Infinity;
  for (let x = cx - cache.reach; x <= cx + cache.reach; x++) for (let z = cy - cache.reach; z <= cy + cache.reach; z++) {
    for (const y of chunkQuery(ground, x, z, cache).surfaceHeightsAt(xM - x * size, zM - z * size)) highest = Math.max(highest, y);
  }
  return Number.isFinite(highest) ? highest : undefined;
}
