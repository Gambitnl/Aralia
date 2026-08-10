/**
 * @file arenaVolumeWorker.ts — the arena's ground, built off the main thread.
 *
 * MEASURED, THEN MOVED. At the shipped map size (120 x 90 tiles, 256 cells per
 * edge, 0.469-unit cells) the fill costs 132 ms and the slab mesh 669 ms, for
 * about 800 ms of solid block. Combat opens on that frame. The brief's bar was
 * 100 ms; this is eight times it, so the whole build runs here and the main
 * thread pays only for `BufferGeometry` construction.
 *
 * The slab size was measured too, on the same map, identical 276,772 triangles:
 *
 * | slab     | total  | drawn | worst slab | first slab out |
 * |----------|--------|-------|------------|----------------|
 * | 64x64    | 1394ms |    20 |    216.7ms |          217ms |
 * | 128x32   |  661ms |     6 |    196.9ms |          196ms |
 * | **64x32**| **669ms** | **20** | **58.3ms** |       **55ms** |
 * | 32x32    |  701ms |    63 |     17.5ms |           13ms |
 * | 32x16    |  744ms |   126 |     10.9ms |            8ms |
 * | 16x16    |  862ms |   442 |      4.2ms |            3ms |
 *
 * 64 x 32 ships. It is the cheapest total, it puts the first visible ground out
 * at 55 ms, and its 20 draw calls are a permanent per-frame cost that the
 * finer slabs multiply for no gain a worker can use — nothing here is racing a
 * frame budget, so the small worst-slice the 16³ plan buys is worth nothing and
 * its 442 draw calls are worth something negative.
 *
 * The Y plan stops at the highest occupied cell. The volume is no longer cubic
 * — it buys exactly the height the arena needs at `ARENA_CELL_H_M` — but the
 * top row is still mostly sky over the low ground, and walking it would cost
 * the band scan on every empty slab for nothing.
 *
 * ONE OWNER, NEVER TWO. The worker fills, transfers, and is done. Carves stay
 * on the main thread against the one live volume the client rebuilds from the
 * snapshot. There is no edit channel back, so there is no second copy of the
 * ground to drift.
 */
import {
  buildArenaVolume,
  arenaDepthDatum,
  arenaBiomeStack,
  arenaSurfaceTint,
  type ArenaTiles,
} from './arenaVolume';
import { meshCellRange } from '@/systems/worldforge/terrain/surfaceNets';
import { colorAtDepth } from '@/systems/worldforge/terrain/materials';
import type { VolumeSnapshot } from '@/systems/worldforge/terrain/voxelVolume';

/**
 * Slab footprint in lattice cells.
 *
 * 32, not the 64 slice 1 measured, and the number that changed the answer is
 * not in the table above: **what a CARVE costs on the main thread.** The build
 * runs in a worker where a fat slab is only latency, so slice 1 optimised for
 * the cheapest total and the fewest draw calls and landed on 64. A crater
 * lands mid-encounter, on the render thread, and re-meshes every slab it
 * touched — measured on the shipped map with a Fireball-sized bore
 * (`.agent/scratch/impl5-carve-bench.test.ts`, 498 cells changed):
 *
 * | slab   | carve remesh | worst slab | build slabs drawn |
 * |--------|--------------|------------|-------------------|
 * | 64x100 |      465 ms  |   245.2 ms |                20 |
 * | 64x32  |      508 ms  |   163.7 ms |                54 |
 * | 32x32  |      160 ms  |  **31.6 ms** |             154 |
 * | 32x24  |      113 ms  |    18.1 ms |               205 |
 * | 24x24  |       67 ms  |     9.2 ms |               296 |
 * | 16x16  |       31 ms  |     4.7 ms |               748 |
 *
 * A slab is the smallest thing a carve can re-mesh, so the worst slab is the
 * smallest hitch the frame can be asked to swallow — 245 ms at the slice-1 plan,
 * and no budget can split it. 32 is where that becomes a slice the frame can
 * take, and the 134 extra draw calls are the price. Finer plans keep paying
 * draw calls every frame forever to buy hitch protection the budget already
 * provides.
 */
export const ARENA_SLAB_XZ = 32;
/** Slab height in lattice cells. See the table above. */
/** Slab height in lattice cells. Same argument as the footprint above. */
export const ARENA_SLAB_Y = 32;

export interface ArenaBuildRequest {
  kind: 'build';
  id: number;
  tiles: ArenaTiles;
  cells?: number;
  cellM?: number;
  cellHM?: number;
}

export interface ArenaFillMessage {
  kind: 'fill';
  id: number;
  snapshot: VolumeSnapshot;
  originM: [number, number, number];
  cellM: number;
  cellHM: number;
  cells: number;
  cellsY: number;
  topOccupiedCell: number;
  originalTopY: Float32Array;
  surfaceMaterial: Uint8Array;
  biome: string;
  fillMs: number;
  solidCells: number;
}

export interface ArenaSlabMessage {
  kind: 'slab';
  id: number;
  cx: number;
  cy: number;
  cz: number;
  positions: Float32Array;
  normals: Float32Array;
  cutDepth: Float32Array;
  ao: Float32Array;
  tint: Float32Array;
  indices: Uint32Array;
  triangles: number;
  /** Max drawn vertex Y per dual column owned by this slab. */
  dualTopY: Float32Array;
  dualRect: { x0: number; z0: number; w: number; h: number };
}

export interface ArenaDoneMessage {
  kind: 'done';
  id: number;
  meshMs: number;
  slabs: number;
}

export type ArenaWorkerMessage = ArenaFillMessage | ArenaSlabMessage | ArenaDoneMessage;

function build(req: ArenaBuildRequest, post: (m: ArenaWorkerMessage, t: Transferable[]) => void): void {
  const a = buildArenaVolume(req.tiles, {
    cells: req.cells,
    cellM: req.cellM,
    cellHM: req.cellHM,
  });

  /* The snapshot's buffers TRANSFER — `snapshot()` builds them fresh and
   * nothing here reads them again. `originalTopY` and `surfaceMaterial` are
   * COPIED, because the mesh loop below is still reading both (the depth datum
   * and the surface tint), and transferring a buffer this thread is about to
   * use detaches it out from under itself. 320 KB of copy against 800 ms of
   * work is not a trade worth thinking about twice. */
  const snapshot = a.volume.snapshot();
  post(
    {
      kind: 'fill',
      id: req.id,
      snapshot,
      originM: a.originM,
      cellM: a.cellM,
      cellHM: a.cellHM,
      cells: a.cells,
      cellsY: a.cellsY,
      topOccupiedCell: a.topOccupiedCell,
      originalTopY: a.originalTopY.slice(),
      surfaceMaterial: a.surfaceMaterial.slice(),
      biome: req.tiles.biome,
      fillMs: a.fillMs,
      solidCells: a.solidCells,
    },
    [snapshot.brickUniform.buffer, snapshot.brickCells.buffer] as Transferable[],
  );

  const t0 = Date.now();
  const datum = arenaDepthDatum(a);
  const stack = arenaBiomeStack(req.tiles.biome);
  const cn = a.cells + 1;
  const cnY = a.cellsY + 1;
  const nxz = Math.ceil(cn / ARENA_SLAB_XZ);
  const ny = Math.floor(a.topOccupiedCell / ARENA_SLAB_Y) + 1;
  let slabs = 0;
  for (let cy = 0; cy < ny; cy++) {
    for (let cz = 0; cz < nxz; cz++) {
      for (let cx = 0; cx < nxz; cx++) {
        const mesh = meshCellRange(
          a.volume,
          a.cellM,
          a.originM,
          (d) => colorAtDepth(d, stack),
          datum,
          {
            min: [cx * ARENA_SLAB_XZ, cy * ARENA_SLAB_Y, cz * ARENA_SLAB_XZ],
            max: [
              Math.min(cn - 1, (cx + 1) * ARENA_SLAB_XZ - 1),
              Math.min(cnY - 1, (cy + 1) * ARENA_SLAB_Y - 1),
              Math.min(cn - 1, (cz + 1) * ARENA_SLAB_XZ - 1),
            ],
          },
          a.cellHM,
        );
        if (mesh.triangles === 0) continue;
        const tint = arenaSurfaceTint(a, mesh.positions);
        slabs++;
        post(
          {
            kind: 'slab',
            id: req.id,
            cx,
            cy,
            cz,
            positions: mesh.positions,
            normals: mesh.normals,
            cutDepth: mesh.cutDepth,
            ao: mesh.ao,
            tint,
            indices: mesh.indices,
            triangles: mesh.triangles,
            dualTopY: mesh.dualTopY,
            dualRect: mesh.dualRect,
          },
          [
            mesh.positions.buffer,
            mesh.normals.buffer,
            mesh.cutDepth.buffer,
            mesh.ao.buffer,
            tint.buffer,
            mesh.indices.buffer,
            mesh.dualTopY.buffer,
          ],
        );
      }
    }
  }
  post({ kind: 'done', id: req.id, meshMs: Date.now() - t0, slabs }, []);
}

/* The vertex COLOR the mesher produces is deliberately dropped on the floor.
 * The substance material re-derives strata per FRAGMENT from its band uniforms
 * and the per-vertex cut depth — vertex colours interpolate across a whole
 * cell, which at this cell size smears a 12 cm litter horizon into a
 * half-metre gradient. Sending them would be three floats a vertex of pure
 * transfer cost for something nothing reads. */

self.onmessage = (e: MessageEvent<ArenaBuildRequest>) => {
  if (e.data?.kind !== 'build') return;
  build(e.data, (m, t) => (self as unknown as Worker).postMessage(m, t));
};

export {};
