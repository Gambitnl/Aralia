/** Read the published ground water triangles for gameplay admission. Reusing
 * the sampler and water builder keeps town widths, overdraw, bends and clipped
 * falling surfaces together. This never edits water, land or a saved body. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 17:13:33
 * Dependents: systems/gameplay/lodging.ts, systems/worldforge/bridge/groundWaterMovement.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
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

interface SurfaceCache { reach: number; samplingGround: GroundWorld; chunks: Map<string, DeckSupportQuery> }
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
  // The point guard below rejects the entire possible footprint of an unknown
  // ribbon. Elsewhere, read only qualified surfaces; an unrelated unresolved
  // ribbon must not make the rest of a town impassable. This shallow query view
  // changes no world or render data and retains the original bed and identity.
  const rivers = ground.rivers.filter(r => r.waterlineY?.length === r.points.length && r.waterlineY.every(Number.isFinite));
  const samplingGround = rivers.length === ground.rivers.length ? ground : {...ground, rivers};
  cached = { reach: Math.ceil(halfWidth / WORLD3D_CONFIG.CHUNK_WORLD_SIZE), samplingGround, chunks: new Map() };
  worlds.set(ground, cached);
  return cached;
}

function chunkQuery(ground: GroundWorld, cx: number, cy: number, cache: SurfaceCache): DeckSupportQuery {
  const key = `${cx}|${cy}`, previous = cache.chunks.get(key);
  if (previous) return previous;
  // Native packets carry a copied source bed beside the coarse display grid.
  // The same water builder therefore retains narrow channels at every LOD.
  const data = sampleGroundChunk(cache.samplingGround, cx, cy, 2);
  const mesh = buildWaterMesh(data);
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
  if (hasUnresolvedRibbonAt(ground, xM, zM)) throw new Error('Native river waterline unavailable');
  const size = WORLD3D_CONFIG.CHUNK_WORLD_SIZE, cx = Math.floor(xM / size), cy = Math.floor(zM / size);
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) return undefined;
  const cache = cacheFor(ground);
  let highest = -Infinity;
  for (let x = cx - cache.reach; x <= cx + cache.reach; x++) for (let z = cy - cache.reach; z <= cy + cache.reach; z++) {
    for (const y of chunkQuery(ground, x, z, cache).surfaceHeightsAt(xM - x * size, zM - z * size)) highest = Math.max(highest, y);
  }
  return Number.isFinite(highest) ? highest : undefined;
}

/** Missing levels cannot certify dry banks, overdraw or the rounded end caps.
 * Outside a finite ribbon envelope that ribbon cannot cover the query point. */
function hasUnresolvedRibbonAt(ground: GroundWorld, xM: number, zM: number): boolean {
  for (const river of ground.rivers) {
    if (river.waterlineY?.length === river.points.length && river.waterlineY.every(Number.isFinite)) continue;
    if (river.points.length < 2) return true;
    for (let i = 1; i < river.points.length; i++) {
      const a = river.points[i-1], b = river.points[i];
      const width = Math.max(river.surfaceWidthM?.[i-1] ?? river.widthM, river.surfaceWidthM?.[i] ?? river.widthM);
      if (![a.x,a.z,b.x,b.z,width].every(Number.isFinite) || width < 0) return true;
      const dx=b.x-a.x, dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((xM-a.x)*dx+(zM-a.z)*dz)/(dx*dx+dz*dz||1)));
      if (Math.hypot(xM-a.x-t*dx,zM-a.z-t*dz) <= width/2+GROUND_METERS_PER_CELL) return true;
    }
  }
  return false;
}

/** Admission callers must distinguish a validated dry point from unavailable
 * water evidence. This reads the existing immutable GroundWorld instance;
 * replacement worlds receive separate caches. No saved body is migrated. */
export type GroundWaterEvidence = {status: 'valid'; surfaceY: number | undefined}
  | {status: 'unavailable'; reason: string};
export function inspectGroundWater(ground: GroundWorld, xM: number, zM: number): GroundWaterEvidence {
  if (!Number.isFinite(xM) || !Number.isFinite(zM)) return {status: 'unavailable', reason: 'Invalid source coordinate'};
  try { return {status: 'valid', surfaceY: publishedGroundWaterSurfaceYAt(ground, xM, zM)}; }
  catch (error) { return {status: 'unavailable', reason: error instanceof Error ? error.message : String(error)}; }
}
