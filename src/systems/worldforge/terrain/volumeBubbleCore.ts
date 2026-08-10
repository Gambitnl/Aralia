/**
 * @file volumeBubbleCore.ts — the whole cost of a volume bubble, in one place
 * and off the main thread.
 *
 * ADR 0002 states the problem and does not solve it: "Bubble fill costs 778 ms
 * at this size. That is a visible freeze if it runs on the main thread." The
 * sandbox at `?step=volume` blocks 2–4 seconds building its first 240³ world.
 * Neither number is acceptable in a live world a player walks into.
 *
 * This file is the pure half of the fix. It fills a bubble from a height
 * source, captures the datum the strata read against, and meshes the result in
 * SLABS that can be handed over one at a time. It knows nothing about workers,
 * three.js or GroundWorld — which is the point twice over: the worker runs it,
 * and vitest runs it too, on Node, where no Worker exists.
 *
 * THREE DECISIONS, each of which the alternative gets wrong.
 *
 * ONE OWNER, NEVER TWO. The worker fills, transfers the volume, and is done.
 * Carves and bores stay on the main thread against that same volume. The
 * tempting design — keep the volume in the worker and post edits to it — gives
 * two copies of the ground that drift the first time a message is dropped or
 * reordered, and the campaign has already paid for one bed that disagreed with
 * the picture the player was looking at.
 *
 * SLABS, DELIVERED AS THEY FINISH. The whole-volume mesh is seconds. A slab is
 * milliseconds, and the surface band is a small minority of them, so the ground
 * a player can see arrives long before the buried rock does. The order is
 * nearest the surface first for exactly that reason.
 *
 * TRANSFER, NEVER CLONE. Every array a slab produces is a typed array, and
 * `transfersOf` lists their buffers so `postMessage` changes their owner
 * instead of copying them. A 256³ bubble moves about 2 MB of voxels and a few
 * MB of mesh; cloning that would hand back a good part of what the worker saved.
 */
import { VoxelVolume, Material, type VolumeSnapshot } from './voxelVolume';
import {
  fillBubbleFromGround,
  bubbleCellsPerEdge,
  type GroundHeightSource,
  type ColumnStackSource,
} from './groundVolumeFromWorld';
import { meshCellRange, type ChunkMeshData } from './surfaceNets';
import { DEFAULT_STACK } from './materials';
import type { ColumnStack } from './groundBiomeStack';

/**
 * Slab size, in lattice cells — the unit of delivery AND of drawing.
 *
 * The sandbox uses 32×4×32, and that is right for what it does: an interactive
 * re-mesh after a brush stroke, racing a 40 ms frame budget, where a thin slab
 * that early-outs on the brick occupancy check is the cheapest way to keep the
 * worst slice small.
 *
 * This is the opposite job. A one-shot build behind a worker has no frame to
 * miss, and its slab count becomes a DRAW CALL count that the live world pays
 * for every frame afterwards. Measured on the real cell-785 ground, 64 m at
 * 25 cm, same volume and same total 686,120 triangles:
 *
 * | slab       | drawn | mesh    | worst slab | first slab |
 * |------------|-------|---------|------------|------------|
 * | 32×8×32    |   932 | 2871 ms |      40 ms |      40 ms |
 * | 32×32×32   |   323 | 1707 ms |      10 ms |       8 ms |
 * | 64×32×64   |   131 | 1652 ms |      33 ms |      25 ms |
 * | 64×64×64   |    78 | 1681 ms |      56 ms |      37 ms |
 * | 128×64×128 |    31 | 1926 ms |     200 ms |     121 ms |
 *
 * 64³ takes the draw calls to 78 and still puts the first visible ground on
 * screen 37 ms in. Past that the apron each slab computes but does not emit
 * stops paying for itself and total work climbs again.
 */
export const BUBBLE_SLAB_CELLS = 64;

/** Slab height. Equal to the footprint — see the table above. */
export const BUBBLE_SLAB_CELLS_Y = 64;

/** Where one slab sits, in slab indices. */
export interface SlabCoord {
  cx: number;
  cy: number;
  cz: number;
}

/** One slab's mesh, plus where it belongs. Every array is transferable. */
export interface BubbleSlab extends SlabCoord {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  cutDepth: Float32Array;
  ao: Float32Array;
  /**
   * Per-vertex TOP-SURFACE tint, RGB: this column's own surface substance
   * divided by the bubble stack's. See `tintSlab`.
   */
  tint: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

/** What the fill produced, in a form that survives `postMessage` intact. */
export interface BubbleFillResult {
  snapshot: VolumeSnapshot;
  originM: [number, number, number];
  cellM: number;
  cellsPerEdge: number;
  /**
   * The drawn-ground height per voxel column BEFORE any carve, world meters,
   * laid out `z * cellsPerEdge + x`.
   *
   * This is the datum every strata depth reads against, and measuring it from
   * the CURRENT column top instead was the sandbox's round-one knockout: a
   * crater floor is the top of its own carved column, so every carved bowl read
   * depth zero and came back uniform surface litter with no strata at all.
   *
   * Read from the FILLED VOXELS rather than from the analytic source, because
   * the mesh is quantized to the cell grid and an analytic datum disagrees with
   * the drawn surface by up to a cell — enough to sweep across the 12 cm litter
   * horizon and band open ground in false contours.
   */
  originalTopY: Float32Array;
  fillMs: number;
  solidCells: number;
}

/**
 * A depth datum with a DEADBAND of most of a cell.
 *
 * Surface nets places a vertex at the average of its edge crossings, so a
 * top-surface vertex sits up to a cell below the column top it belongs to.
 * Measured against the raw column top that vertex reports a depth anywhere from
 * zero to one cell, which sweeps across the shallow horizons and draws contour
 * bands on flat ground. Subtracting most of a cell means "the top surface is
 * the top surface".
 */
export function depthDatumFor(
  originalTopY: Float32Array,
  originM: readonly [number, number, number],
  cellM: number,
  cellsPerEdge: number,
): (xM: number, zM: number) => number {
  const n = cellsPerEdge;
  const deadband = cellM * 0.75;
  return (xM, zM) => {
    const x = Math.min(n - 1, Math.max(0, Math.floor((xM - originM[0]) / cellM)));
    const z = Math.min(n - 1, Math.max(0, Math.floor((zM - originM[2]) / cellM)));
    return originalTopY[z * n + x] - deadband;
  };
}

/**
 * Fill a bubble and capture its datum. The expensive half of the build.
 *
 * The datum walk seeds itself from the analytic height and then asks the
 * VOXELS where the column actually ends, so it costs a few cell reads per
 * column rather than a full column scan.
 */
export function fillBubble(
  src: GroundHeightSource,
  centerXM: number,
  centerZM: number,
  extentM: number,
  cellM: number,
  stackSource: ColumnStackSource = DEFAULT_STACK,
): BubbleFillResult {
  const fill = fillBubbleFromGround(src, centerXM, centerZM, extentM, cellM, stackSource);
  const n = fill.cellsPerEdge;
  const originM = fill.originM as [number, number, number];

  const originalTopY = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const wz = originM[2] + (z + 0.5) * cellM;
    for (let x = 0; x < n; x++) {
      const wx = originM[0] + (x + 0.5) * cellM;
      let y = Math.min(
        n - 1,
        Math.max(0, Math.floor((src.surfaceYAt(wx, wz) - originM[1]) / cellM) + 3),
      );
      while (y < n - 1 && fill.volume.get(x, y + 1, z) !== Material.Air) y++;
      while (y >= 0 && fill.volume.get(x, y, z) === Material.Air) y--;
      originalTopY[z * n + x] = originM[1] + (y + 1) * cellM;
    }
  }

  return {
    snapshot: fill.volume.snapshot(),
    originM,
    cellM,
    cellsPerEdge: n,
    originalTopY,
    fillMs: fill.fillMs,
    solidCells: fill.solidCells,
  };
}

/** What a bubble footprint is made of, and which one substance stack wins it. */
export interface BubbleStackCensus {
  /** The stack the MATERIAL is built from — the one most columns stand on. */
  dominant: ColumnStack;
  /** Every stack present in the footprint, by key, with its column count. */
  counts: Record<string, number>;
  /** Columns sampled. `counts` sums to this. */
  sampled: number;
  /** Share of columns whose ground is NOT the dominant stack, 0 to 1. */
  minorityShare: number;
}

/**
 * Which stacks a bubble footprint stands on, and which of them wins.
 *
 * A bubble is 64 m across and the artifact's biome grid is 1.524 m, so "which
 * biome is this bubble in" genuinely has more than one answer at a river bank or
 * the foot of a scree slope. The FILL takes them all — every column is built
 * from its own ground. The MATERIAL cannot: the substance shader carries one
 * band stack, so the strata a cut shows are the strata of whichever ground most
 * of the bubble is. This counts the columns and names that winner, and reports
 * `minorityShare` so a caller can say how wrong the losers are rather than
 * discovering it in a screenshot.
 *
 * Sampled on a one-metre lattice — finer than the biome grid, so no patch that
 * exists can be missed, and about four thousand samples against the fill's
 * sixteen million cells.
 */
export function censusColumnStacks(
  stackAt: (xM: number, zM: number) => ColumnStack,
  centerXM: number,
  centerZM: number,
  extentM: number,
): BubbleStackCensus {
  const STEP_M = 1;
  const half = extentM / 2;
  const counts: Record<string, number> = {};
  const byKey = new Map<string, ColumnStack>();
  let sampled = 0;
  for (let z = -half; z <= half; z += STEP_M) {
    for (let x = -half; x <= half; x += STEP_M) {
      const cs = stackAt(centerXM + x, centerZM + z);
      counts[cs.key] = (counts[cs.key] ?? 0) + 1;
      if (!byKey.has(cs.key)) byKey.set(cs.key, cs);
      sampled++;
    }
  }
  let bestKey = '';
  let best = -1;
  for (const [k, v] of Object.entries(counts)) {
    if (v > best) {
      best = v;
      bestKey = k;
    }
  }
  const dominant = byKey.get(bestKey);
  if (!dominant) throw new Error('censusColumnStacks: no columns sampled');
  return { dominant, counts, sampled, minorityShare: 1 - best / sampled };
}

/* ----------------------------------------------------- joining the bubble */

/**
 * How far in from the bubble's edge the surface dives under the heightfield.
 * Wide enough that the crossing is a shallow slope rather than a lip.
 */
export const RIM_RAMP_M = 8;

/** How far BELOW the terrain the bubble's rim ends up. */
export const RIM_SINK_M = 1.2;

/**
 * A height source that JOINS a volume bubble to a heightfield with no seam.
 *
 * The problem this solves is not alignment — `streamedTerrainSurfaceY` already
 * aligns them. It is that a bubble is a cube, and a cube ends. Its border cells
 * mesh into a vertical cut wall standing in the middle of open ground, and no
 * amount of matching heights removes a wall.
 *
 * The join is geometric and needs nothing from the renderer. Two offsets:
 *
 * - Inside the core the bubble is LIFTED just over one cell. The fill makes a
 *   column solid up to `floor((surface - originY) / cellM)`, so the drawn
 *   surface lands zero to one cell BELOW the height it was filled from. Lifting
 *   by a little over a cell puts it reliably above the heightfield instead of
 *   dancing across it, which is the difference between a clean cover and a disc
 *   of z-fighting speckle.
 * - Over the last `RIM_RAMP_M` the lift ramps down through zero to
 *   `-RIM_SINK_M`, so the rim — and the cut wall on it — finishes well under
 *   the terrain, where the heightfield draws over it.
 *
 * What the camera sees is the HIGHER of the two surfaces, and the higher of two
 * continuous surfaces is continuous. The visible ground runs from bubble, over
 * a crossing somewhere in the ramp, to heightfield, with no step anywhere. The
 * only artifact possible is a narrow band where the two are within depth
 * precision, and the ramp crosses steeply enough to keep that band centimetres
 * wide.
 *
 * The sink costs the annulus its top metre of matter. That is invisible and
 * harmless while nothing digs in the live world; a digging slice must either
 * widen the bubble past the ramp or move the join into the renderer.
 */
export function rimBlendedSource(
  base: GroundHeightSource,
  centerXM: number,
  centerZM: number,
  extentM: number,
  cellM: number,
): GroundHeightSource {
  const lift = cellM * 1.2;
  const r1 = extentM / 2;
  const r0 = Math.max(0, r1 - RIM_RAMP_M);
  const span = Math.max(1e-6, r1 - r0);
  return {
    surfaceYAt(xM: number, zM: number): number {
      const dx = xM - centerXM;
      const dz = zM - centerZM;
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r <= r0) return base.surfaceYAt(xM, zM) + lift;
      const t = Math.min(1, (r - r0) / span);
      return base.surfaceYAt(xM, zM) + lift - t * (lift + RIM_SINK_M);
    },
    materialAt: base.materialAt,
  };
}

/** Slabs per axis for a bubble of `cellsPerEdge` voxels. */
export function slabCounts(cellsPerEdge: number): { xz: number; y: number } {
  const cn = cellsPerEdge + 1; // the lattice runs one past the volume on each side
  return {
    xz: Math.ceil(cn / BUBBLE_SLAB_CELLS),
    y: Math.ceil(cn / BUBBLE_SLAB_CELLS_Y),
  };
}

/**
 * Every slab in the bubble, ordered so the ones a player can SEE come first.
 *
 * Sorted by how far a slab's y band sits from the bubble's vertical middle,
 * then by horizontal distance from its center. The fill centers the terrain
 * surface at mid-bubble, so that ordering walks outward from the ground the
 * camera is standing on. Buried rock and open sky arrive last and nobody is
 * looking at either.
 */
export function planSlabs(cellsPerEdge: number): SlabCoord[] {
  const { xz, y } = slabCounts(cellsPerEdge);
  const midY = (y - 1) / 2;
  const midXZ = (xz - 1) / 2;
  const out: SlabCoord[] = [];
  for (let cy = 0; cy < y; cy++) {
    for (let cz = 0; cz < xz; cz++) {
      for (let cx = 0; cx < xz; cx++) out.push({ cx, cy, cz });
    }
  }
  const rank = (s: SlabCoord): number => {
    const dy = Math.abs(s.cy - midY);
    const dx = s.cx - midXZ;
    const dz = s.cz - midXZ;
    // The y term dominates: a whole ring of surface slabs is worth more than
    // the nearest buried one.
    return dy * 1000 + Math.sqrt(dx * dx + dz * dz);
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

/** A slab key that survives being used as a Map index. */
export function slabKey(s: SlabCoord): string {
  return `${s.cx},${s.cy},${s.cz}`;
}

/**
 * Which slabs an edit changes — including ones that were EMPTY before it.
 *
 * This is the whole of a bug worth keeping written down. A build only delivers
 * slabs that produced triangles, so a caller holding "the slabs I am drawing"
 * is holding the SURFACE band and nothing else: every slab of buried rock
 * meshed to zero and was dropped. Re-meshing only those on a carve therefore
 * removes the ground the cut took away and never adds the floor and walls it
 * exposed, because those belong to a slab one step DOWN that has never existed.
 * The live picture of that is exact and unmistakable — the trench reads as a
 * hole straight through the ground to the sky behind it.
 *
 * Measured on a 64 m bubble at 25 cm with a 7 m by 26 m trench 2.2 m deep: four
 * surface slabs lose 3,300 triangles between them and four slabs that had NONE
 * gain 6,200. Half the answer is in slabs a drawn-slab list cannot name.
 *
 * So the edit window is resolved against the SLAB PLAN, which is total, and the
 * caller keeps whatever it already has for the slabs this does not name.
 *
 * `min`/`max` are inclusive voxel cell bounds — what `applyBrush` returns. They
 * are padded by the AO reach, because baked occupancy AO samples several cells
 * out and a slab re-meshed to its own bounds leaves a lit seam along every
 * boundary the cut crossed.
 */
export function slabsForEdit(
  cellsPerEdge: number,
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  padCells: number,
): SlabCoord[] {
  const lo = [min[0] - padCells, min[1] - padCells, min[2] - padCells];
  const hi = [max[0] + padCells, max[1] + padCells, max[2] + padCells];
  const span = (c: number, step: number, i: number): boolean =>
    c * step <= hi[i] && (c + 1) * step >= lo[i];
  return planSlabs(cellsPerEdge).filter(
    (s) =>
      span(s.cx, BUBBLE_SLAB_CELLS, 0) &&
      span(s.cy, BUBBLE_SLAB_CELLS_Y, 1) &&
      span(s.cz, BUBBLE_SLAB_CELLS, 2),
  );
}

/** Mesh one slab. Returns null when the slab holds no surface. */
export function meshSlab(
  vol: VoxelVolume,
  cellM: number,
  originM: readonly [number, number, number],
  colorAtDepth: (depthM: number) => readonly [number, number, number],
  surfaceYAt: (xM: number, zM: number) => number,
  slab: SlabCoord,
  /**
   * The per-vertex top tint. Omitted leaves every vertex at 1, which the
   * material's `uTintMix` default already makes a no-op.
   */
  tintAt?: (xM: number, zM: number) => readonly [number, number, number],
): BubbleSlab | null {
  const cn = vol.cells + 1;
  const hi = (c: number, step: number) => Math.min(cn - 1, (c + 1) * step - 1);
  const mesh: ChunkMeshData = meshCellRange(vol, cellM, originM, colorAtDepth, surfaceYAt, {
    min: [slab.cx * BUBBLE_SLAB_CELLS, slab.cy * BUBBLE_SLAB_CELLS_Y, slab.cz * BUBBLE_SLAB_CELLS],
    max: [
      hi(slab.cx, BUBBLE_SLAB_CELLS),
      hi(slab.cy, BUBBLE_SLAB_CELLS_Y),
      hi(slab.cz, BUBBLE_SLAB_CELLS),
    ],
  });
  if (mesh.triangles === 0) return null;
  return {
    cx: slab.cx,
    cy: slab.cy,
    cz: slab.cz,
    positions: mesh.positions,
    normals: mesh.normals,
    colors: mesh.colors,
    cutDepth: mesh.cutDepth,
    ao: mesh.ao,
    tint: tintSlab(mesh.positions, tintAt),
    indices: mesh.indices,
    triangles: mesh.triangles,
  };
}

/**
 * The per-vertex top-surface tint for one slab's vertices.
 *
 * A bubble spans about 42 artifact cells, so it can straddle a river bar, a
 * scree foot or a snow line — and the substance shader carries ONE band stack
 * per material, chosen for the bubble as a whole. Its weathered top, though,
 * takes a per-vertex multiplier that IMPL-4 added for exactly this reason on the
 * combat arena. This builds it: the ratio between what a column's surface really
 * is and what the bubble's stack says it is, so a sand bar in a grassland bubble
 * reads as sand and a turf column reads as exactly itself, at 1.0.
 *
 * It rides the TOP only. The shader mixes the tinted top out again as soon as
 * a fragment has cut depth, so a bore through a minority column still shows the
 * bubble's true strata rather than a tinted lie about them.
 *
 * Positions are WORLD meters here — the rebase to the bubble centre happens on
 * the main thread, after this.
 */
export function tintSlab(
  positions: Float32Array,
  tintAt?: (xM: number, zM: number) => readonly [number, number, number],
): Float32Array {
  const n = positions.length / 3;
  const tint = new Float32Array(positions.length);
  if (!tintAt) {
    tint.fill(1);
    return tint;
  }
  for (let i = 0; i < n; i++) {
    const c = tintAt(positions[i * 3], positions[i * 3 + 2]);
    tint[i * 3] = c[0];
    tint[i * 3 + 1] = c[1];
    tint[i * 3 + 2] = c[2];
  }
  return tint;
}

/**
 * The tint one column shows against a reference stack.
 *
 * A RATIO, not a colour, because the shader multiplies: every octave of macro
 * noise, grain and fine tooth the top surface already carries survives it. A
 * column whose surface matches the reference returns exactly 1, which is why a
 * single-biome bubble is bit-identical to one with the tint switched off.
 */
export function tintRatio(
  columnTop: readonly [number, number, number],
  referenceTop: readonly [number, number, number],
): [number, number, number] {
  return [
    columnTop[0] / referenceTop[0],
    columnTop[1] / referenceTop[1],
    columnTop[2] / referenceTop[2],
  ];
}

/** The buffers of one slab, for `postMessage`'s transfer list. */
export function transfersOfSlab(s: BubbleSlab): ArrayBuffer[] {
  return [
    s.positions.buffer,
    s.normals.buffer,
    s.colors.buffer,
    s.cutDepth.buffer,
    s.ao.buffer,
    s.tint.buffer,
    s.indices.buffer,
  ] as ArrayBuffer[];
}

/** The buffers of a fill result, for `postMessage`'s transfer list. */
export function transfersOfFill(f: BubbleFillResult): ArrayBuffer[] {
  return [
    f.snapshot.brickUniform.buffer,
    f.snapshot.brickCells.buffer,
    f.originalTopY.buffer,
  ] as ArrayBuffer[];
}

/** How many voxels a bubble of this size and cell holds along one edge. */
export { bubbleCellsPerEdge };
