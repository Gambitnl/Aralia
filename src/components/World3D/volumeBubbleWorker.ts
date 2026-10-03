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
import { townClearance } from '@/systems/worldforge/bridge/townVegetationKeepOut';
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
  townFloorTop,
  quantizeTownMask,
  slabHeightForFootprint,
  TOWN_FLOOR_FEATHER_M,
  bakeTintField,
  tintFromField,
  transfersOfTintField,
  transfersOfSlab,
} from '@/systems/worldforge/terrain/volumeBubbleCore';

/**
 * Sky and rock a slab bubble keeps beyond the terrain it measured, metres
 * EACH WAY. Absorbs a ridge narrower than the height pre-pass's sample step,
 * and leaves room under the surface for a cut to have somewhere to go.
 */
const SLAB_MARGIN_M = 24;

let ground: GroundWorld | null = null;

interface BuildMessage {
  type: 'build';
  id: number;
  centerXM: number;
  centerZM: number;
  extentM: number;
  cellM: number;
  /**
   * Vertical extent, metres — a FLOOR, not the final height. Omitted keeps
   * the cube every walking bubble has always been. See `slabHeightForFootprint`.
   */
  heightM?: number;
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

  /* HOW TALL THIS BUBBLE IS. Omit `heightM` and it is a cube, which is every
   * walking bubble. Ask for one and the footprint gets a vote: the request's
   * height is a FLOOR, and the measured relief across the footprint raises it
   * when the ground needs more room. A slab shorter than its own terrain
   * clamps ridges into mesas and drops valleys into holes, and a hole in the
   * ground of a town pane is worse than any cost this pre-pass has. */
  const heightM =
    req.heightM === undefined
      ? undefined
      : Math.max(
          req.heightM,
          slabHeightForFootprint(src, req.centerXM, req.centerZM, req.extentM, SLAB_MARGIN_M),
        );

  const fill = fillBubble(
    src,
    req.centerXM,
    req.centerZM,
    req.extentM,
    req.cellM,
    (x, z) => stackAt(x, z).stack,
    heightM,
  );
  const slabs = planSlabs(fill.cellsPerEdge, fill.cellsY);


  /* THE TOWN'S FLOOR, ON THE VOLUME TOP (agora-f452).
   *
   * The SHEET path has painted trodden earth inside a town since 2026-08-24 —
   * see the TOWN_FLOOR_RGB blend in `sampleGroundChunk`. The VOLUME path never
   * learned it, so the town-on-LAND pane put the burg on ground that was still
   * whatever biome it stood on: measured on Hafting, half the floor inside the
   * built radius rendered as bright meadow grass between the houses, and the
   * pale street ribbons laid over it had nothing to separate them from their
   * surroundings. The bubble showed the exact fault the sheet fix cured.
   *
   * The mask is the town's own keep-out ring, which is the SAME ring the
   * vegetation scatter reads — so cleared trees, bare ground and the sheet
   * path's floor cannot disagree about where the town is. Quantized before it
   * reaches the cache and the palette; `quantizeTownMask` says why.
   *
   * Empty for a bubble with no settlement in it, and `townFloorTop` returns its
   * input unchanged at mask 0, so wilderness bubbles are untouched. */
  const keepOuts = g.townKeepOuts ?? [];
  const townMaskAt =
    keepOuts.length === 0
      ? null
      : (x: number, z: number): number =>
          quantizeTownMask(1 - townClearance(x, z, keepOuts, TOWN_FLOOR_FEATHER_M));

  /* The tint is a RATIO against the bubble's own stack, so a single-biome bubble
   * with no town in it hands every vertex exactly 1 and the top is untouched.
   * Cached per stack key AND town-mask step: a slab has tens of thousands of
   * vertices and at most a handful of grounds. */
  const tintCache = new Map<string, readonly [number, number, number]>();
  const sampleTint = (x: number, z: number): readonly [number, number, number] => {
    const cs = stackAt(x, z);
    const townT = townMaskAt ? townMaskAt(x, z) : 0;
    const key = townT === 0 ? cs.key : `${cs.key}|${townT}`;
    const hit = tintCache.get(key);
    if (hit) return hit;
    const made = tintRatio(townFloorTop(topColorOfStack(cs.stack), townT), bubbleTop);
    tintCache.set(key, made);
    return made;
  };

  /* THE TINT IS BAKED, AND THE WORKER MESHES FROM THE BAKE.
   *
   * It could go on sampling `sampleTint` directly and be marginally more exact.
   * It must not: the main thread re-meshes slabs after every carve and every
   * slump slice, it cannot reach the `GroundWorld` this sampler reads, and a
   * re-meshed slab that redraws its whole sixteen metres at the reference tint
   * is the visible seam `settle-hooks.md` gap 1 recorded. So the field is the
   * SOURCE for both threads, and the two paths are identical by construction
   * rather than by care. See `bakeTintField`. */
  const tintField = bakeTintField(sampleTint, fill.originM, fill.cellM, fill.cellsPerEdge);
  const tintAt = tintFromField(tintField);

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
  /* The tint field is transferred too, and `tintAt` above reads its index on
   * every vertex of every slab below — so the copy goes out and the original
   * stays here. Same rule, same reason, one line apart. */
  const outTint = {
    ...tintField,
    index: tintField.index.slice(),
    palette: tintField.palette.slice(),
  };

  post(
    {
      type: 'fill',
      id: req.id,
      snapshot,
      originM: fill.originM,
      cellM: fill.cellM,
      cellsPerEdge: fill.cellsPerEdge,
      /* The volume is not always a cube any more. Every main-thread reader
       * that used to derive its Y extent from `cellsPerEdge` reads this. */
      cellsY: fill.cellsY,
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
      /* The per-column top tint, so a MAIN-THREAD re-mesh draws what the worker
       * drew. Without it a carve or a slump repaints its whole slab footprint
       * at the reference tint. See `bakeTintField`. */
      tintField: outTint,
    },
    [
      snapshot.brickUniform.buffer,
      snapshot.brickCells.buffer,
      fill.originalTopY.buffer,
      ...transfersOfTintField(outTint),
    ],
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
