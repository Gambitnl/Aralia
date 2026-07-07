// @vitest-environment node
/**
 * Off-thread ground chunk meshing — the pure core the ground mesh worker runs.
 * `handleGroundChunkRequest` must produce EXACTLY the mesh the current inline
 * loader closure (`buildGroundLoaderFromWorld`) builds today, chunk for chunk.
 * That equivalence is the determinism gate: the worker mesh must equal the
 * main-thread mesh.
 *
 * See docs/superpowers/specs/2026-07-07-offthread-ground-chunk-meshing-design.md.
 */
import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../legacySubmapBridge';
import { makeGroundWorld, buildGroundLoaderFromWorld } from '../groundChunkLoader';
import { handleGroundChunkRequest } from '../groundChunkWorkerCore';
import { resolutionForLod } from '../../../world3d/config';
import { listSelectableTowns } from '../../local/startTowns';
import { findCellAtPoint } from '../../../../components/Worldforge/atlasSvg';
import type { GroundWorld } from '../groundChunkLoader';

function portGround(seed: number): GroundWorld {
  const world = getBridgeAtlas(seed);
  const town = listSelectableTowns(world)
    .filter((t) => t.isPort)
    .sort((a, b) => a.population - b.population)[0];
  const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
  const cell = findCellAtPoint(world as never, burg.x, burg.y);
  const { local, region } = getWorldforgeLocalForCell(seed, cell, { centerPx: [burg.x, burg.y] });
  return makeGroundWorld(local, seed, region);
}

describe('handleGroundChunkRequest (ground mesh core)', () => {
  it('matches the inline loader closure output for every LOD, chunk for chunk', async () => {
    const ground = portGround(42);
    const closure = buildGroundLoaderFromWorld(ground);

    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [2, 2], [3, 1]] as const) {
      for (const lod of ['full', 'mid', 'low'] as const) {
        const viaClosure = await closure(cx, cy, lod);
        const viaCore = handleGroundChunkRequest(ground, { cx, cy, resolution: resolutionForLod(lod) });
        expect(viaCore, `chunk ${cx},${cy} lod ${lod}`).toEqual(viaClosure);
      }
    }
  }, 30000);
});
