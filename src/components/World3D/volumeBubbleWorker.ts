/**
 * @file volumeBubbleWorker.ts — the voxel bubble, built off the main thread.
 *
 * Thin glue, exactly like `groundChunkWorker.ts`: receive the assembled
 * `GroundWorld` once, then answer a `build` with a fill and a stream of mesh
 * slabs. Every array is TRANSFERRED, never cloned.
 *
 * The message order is load-bearing. `fill` arrives first and carries the
 * voxels; the main thread rebuilds the volume from it and owns the only copy
 * from that moment. Slabs follow, nearest the surface first, so the ground the
 * player is standing on draws while the buried rock is still being meshed.
 *
 * Nothing here can be tested — Web Workers do not exist in Node — which is why
 * every decision above it lives in `volumeBubbleCore.ts` and every decision
 * below it in `surfaceNets.ts`, both of which vitest runs directly.
 */

/// <reference lib="webworker" />
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { streamedTerrainSurfaceY } from '@/systems/worldforge/bridge/streamedSurface';
import { groundSource } from '@/systems/worldforge/terrain/groundVolumeFromWorld';
import { colorAtDepth } from '@/systems/worldforge/terrain/materials';
import { VoxelVolume } from '@/systems/worldforge/terrain/voxelVolume';
import { applyBrush } from '@/systems/worldforge/terrain/voxelBrush';
import {
  makeColumnStackSampler,
  topColorOfStack,
} from '@/systems/worldforge/terrain/groundBiomeStack';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { SNOW_LINE_H } from '@/systems/worldforge/mountains/mountainTunables';
import {
  fillBubble,
  rimBlendedSource,
  planSlabs,
  meshSlab,
  depthDatumFor,
  censusColumnStacks,
  tintRatio,
  transfersOfSlab,
} from '@/systems/worldforge/terrain/volumeBubbleCore';

let ground: GroundWorld | null = null;

interface BuildMessage {
  type: 'build';
  id: number;
  centerXM: number;
  centerZM: number;
  extentM: number;
  cellM: number;
  preCut?: {
    xM: number;
    zM: number;
    radiusM: number;
    depthM: number;
    lengthM: number;
    axis: 'x' | 'z';
  };
}

const post = (msg: unknown, transfer: Transferable[] = []): void => {
  (self as unknown as Worker).postMessage(msg, transfer);
};

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;

  if (msg.type === 'init') {
    ground = msg.ground as GroundWorld;
    return;
  }

  if (msg.type !== 'build' || !ground) return;
  const req = msg as BuildMessage;
  const g = ground;

  const drawnY = (x: number, z: number): number => streamedTerrainSurfaceY(g, x, z);
  const base = groundSource(drawnY);
  const src = rimBlendedSource(base, req.centerXM, req.centerZM, req.extentM, req.cellM);

  /* WHAT THE GROUND IS, COLUMN BY COLUMN.
   *
   * IMPL-1 shipped this bubble on `DEFAULT_STACK` — forest litter, everywhere,
   * including on a snow-capped mountain. The GroundWorld has carried the answer
   * all along: `biomeIds` is the same 1.524 m grid the heightfield takes its
   * tint from, so the bubble and the terrain around it now read the same cell.
   * Unknown ids throw; nothing here can quietly become litter again. */
  const stackAt = makeColumnStackSampler(
    {
      cols: g.cols,
      rows: g.rows,
      metersPerCell: GROUND_METERS_PER_CELL,
      biomeIds: g.biomeIds,
      heights: g.heights,
      snowLineH: g.snowLineH ?? SNOW_LINE_H,
    },
    drawnY,
  );

  /* One stack wins the MATERIAL, because the substance shader holds one band
   * stack; every column still gets its own substances in the VOXELS, and the
   * top surface gets the difference back as a per-vertex tint below. */
  const census = censusColumnStacks(stackAt, req.centerXM, req.centerZM, req.extentM);
  const bubbleStack = census.dominant.stack;
  const bubbleTop = topColorOfStack(bubbleStack);

  const fill = fillBubble(src, req.centerXM, req.centerZM, req.extentM, req.cellM, (x, z) =>
    stackAt(x, z).stack,
  );
  const slabs = planSlabs(fill.cellsPerEdge);

  /* The tint is a RATIO against the bubble's own stack, so a single-biome bubble
   * hands every vertex exactly 1 and the top is untouched. Cached per stack key:
   * a slab has tens of thousands of vertices and at most a handful of grounds. */
  const tintCache = new Map<string, readonly [number, number, number]>();
  const tintAt = (x: number, z: number): readonly [number, number, number] => {
    const cs = stackAt(x, z);
    const hit = tintCache.get(cs.key);
    if (hit) return hit;
    const made = tintRatio(topColorOfStack(cs.stack), bubbleTop);
    tintCache.set(cs.key, made);
    return made;
  };

  /* The volume is snapshotted into the fill message and rebuilt HERE too.
   * `snapshot` copies, so the worker's own volume is still intact and the
   * meshing below runs against it; the main thread gets its own owner. The
   * worker's copy dies with the build. */
  const vol = VoxelVolume.fromSnapshot(fill.snapshot);

  /* A rig cut, applied BEFORE anything is meshed. The datum stays the pre-cut
   * ground — a crater floor is the top of its own carved column, and measuring
   * depth from it is the fault that made every carved bowl read as surface
   * litter — so `originalTopY` above is untouched and only the voxels change.
   * The snapshot the main thread receives is re-taken, so its volume and the
   * mesh it draws are the same ground. */
  let snapshot = fill.snapshot;
  if (req.preCut) {
    const c = req.preCut;
    const idx = (m: number, o: number): number =>
      Math.min(fill.cellsPerEdge - 1, Math.max(0, Math.floor((m - o) / fill.cellM)));
    const topY =
      fill.originalTopY[idx(c.zM, fill.originM[2]) * fill.cellsPerEdge + idx(c.xM, fill.originM[0])];
    applyBrush(
      { volume: vol, cellM: fill.cellM, originM: fill.originM },
      [c.xM, topY, c.zM],
      { shape: 'ditch', mode: 'dig', radiusM: c.radiusM, heightM: c.depthM, lengthM: c.lengthM, axis: c.axis },
      bubbleStack,
    );
    snapshot = vol.snapshot();
  }

  /* The datum reads `originalTopY`, and the post below TRANSFERS it — a
   * transferred buffer is detached in the sender, so a closure over the
   * original would read zeros for every vertex and every strata would come
   * back surface litter. Copy first; a 256² field is 256 KB. */
  const datumTopY = fill.originalTopY.slice();

  post(
    {
      type: 'fill',
      id: req.id,
      snapshot,
      originM: fill.originM,
      cellM: fill.cellM,
      cellsPerEdge: fill.cellsPerEdge,
      originalTopY: fill.originalTopY,
      fillMs: fill.fillMs,
      solidCells: fill.solidCells,
      slabCount: slabs.length,
      /* The bubble's ground, named. `VolumeGroundBubble` builds the substance
       * material from `stackKey`, and a capture rig reads the census to say
       * which biome a frame is standing on rather than guessing from the tone. */
      stackKey: census.dominant.key,
      /* The bands themselves, so the main thread builds the material from the
       * ground the worker actually filled instead of re-deriving it from a name.
       * Plain numbers and `Infinity`, both of which structured clone keeps. */
      stack: bubbleStack,
      stackCounts: census.counts,
      minorityShare: census.minorityShare,
    },
    [snapshot.brickUniform.buffer, snapshot.brickCells.buffer, fill.originalTopY.buffer],
  );

  const datum = depthDatumFor(datumTopY, fill.originM, fill.cellM, fill.cellsPerEdge);
  const t0 = Date.now();
  let drawn = 0;
  for (let i = 0; i < slabs.length; i++) {
    const slab = meshSlab(
      vol,
      fill.cellM,
      fill.originM,
      /* The vertex colours the mesher bakes are read by nothing — the substance
       * material decides its own albedo from the band uniforms — but they are
       * the honest record of what the mesh IS, so they follow the bubble's
       * stack rather than a hardcoded forest. */
      (d) => colorAtDepth(d, bubbleStack),
      datum,
      slabs[i],
      tintAt,
    );
    if (!slab) continue;
    drawn++;
    post({ type: 'slab', id: req.id, slab }, transfersOfSlab(slab));
  }
  post({ type: 'done', id: req.id, meshMs: Date.now() - t0, drawnSlabs: drawn });
};
