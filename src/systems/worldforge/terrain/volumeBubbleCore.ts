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
  /**
   * How many cells TALL the volume is.
   *
   * A bubble was a CUBE for its whole life, so every reader derived this from
   * `cellsPerEdge` and was right. It is not a cube when the caller asks for a
   * `heightM` (see `fillBubble`), and a reader that still derives it walks off
   * the end of the volume or stops short of its surface. Carried explicitly so
   * there is one answer rather than one convention.
   */
  cellsY: number;
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
  /**
   * Vertical extent, metres. OMITTED KEEPS THE CUBE — `extentM` tall, which is
   * every caller this function had before the town-on-LAND pane. See
   * `slabHeightForFootprint` for why a wide bubble wants this and a 64 m
   * walking bubble does not.
   */
  heightM?: number,
): BubbleFillResult {
  const fill = fillBubbleFromGround(
    src,
    centerXM,
    centerZM,
    extentM,
    cellM,
    stackSource,
    /* The VERTICAL cell stays the horizontal one, the same rule and the same
     * reason as `fillLandSlab`: the substance shader's noise is world-space and
     * isotropic, so a lattice fine sideways and coarse vertically draws grain
     * at two scales on one wall. The height row buys ROOM, not resolution. */
    heightM === undefined ? {} : { heightM, cellHM: cellM },
  );
  const n = fill.cellsPerEdge;
  const nY = fill.cellsY;
  const originM = fill.originM as [number, number, number];

  const originalTopY = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const wz = originM[2] + (z + 0.5) * cellM;
    for (let x = 0; x < n; x++) {
      const wx = originM[0] + (x + 0.5) * cellM;
      let y = Math.min(
        nY - 1,
        Math.max(0, Math.floor((src.surfaceYAt(wx, wz) - originM[1]) / cellM) + 3),
      );
      while (y < nY - 1 && fill.volume.get(x, y + 1, z) !== Material.Air) y++;
      while (y >= 0 && fill.volume.get(x, y, z) === Material.Air) y--;
      originalTopY[z * n + x] = originM[1] + (y + 1) * cellM;
    }
  }

  return {
    snapshot: fill.volume.snapshot(),
    originM,
    cellM,
    cellsPerEdge: n,
    cellsY: nY,
    originalTopY,
    fillMs: fill.fillMs,
    solidCells: fill.solidCells,
  };
}

/**
 * HOW TALL A WIDE BUBBLE HAS TO BE — measured, not guessed.
 *
 * A bubble is a cube, and that is affordable only because the shipped one is
 * 64 m across. The town-on-LAND pane wants to hold a whole burg: Hafting's
 * envelope half is 244 m, so covering it needs ~560 m of footprint, and a
 * 560 m CUBE at a walkable cell is not a volume anyone can fill. The pane's
 * answer before this was to keep the cube and pay in CELL SIZE — extent over a
 * fixed 256 cells per edge — which capped the bubble at 480 m because past
 * that the 1.9 m vertical quantization reads as terraces rather than ground.
 *
 * Both costs are vertical, and neither is needed: a town bubble is a lid over
 * terrain, and terrain relief across a few hundred metres is tens of metres,
 * not hundreds. So the footprint decides the height.
 *
 * The number that matters is not the relief but the reach from the CENTRE
 * COLUMN, because `fillBubbleFromGround` centres the slab on the ground under
 * the centre. A column whose surface sits above the slab's top is clamped and
 * draws a flat mesa; one below its floor is skipped entirely and draws a HOLE
 * through the world. So this takes the worst reach in either direction and
 * doubles it, plus a margin for the sky the camera stands in.
 *
 * Sampled on a coarse lattice — `STEP` columns per edge — because this runs
 * before the fill and a full-resolution pre-pass would cost what it saves. A
 * ridge narrower than the step can still be clipped; the margin absorbs a cell
 * or two of that, and a bubble is a LID, so the clip that survives is at the
 * rim where the terrain skin takes over.
 */
export function slabHeightForFootprint(
  src: GroundHeightSource,
  centerXM: number,
  centerZM: number,
  extentM: number,
  marginM: number,
): number {
  const STEP = 33; // odd, so the centre column is one of the samples
  const half = extentM / 2;
  const centre = src.surfaceYAt(centerXM, centerZM);
  let reach = 0;
  for (let j = 0; j < STEP; j++) {
    const wz = centerZM - half + (j / (STEP - 1)) * extentM;
    for (let i = 0; i < STEP; i++) {
      const wx = centerXM - half + (i / (STEP - 1)) * extentM;
      const d = Math.abs(src.surfaceYAt(wx, wz) - centre);
      if (d > reach) reach = d;
    }
  }
  return 2 * (reach + marginM);
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

/**
 * Slabs per axis for a bubble of `cellsPerEdge` voxels.
 *
 * `cellsY` defaults to `cellsPerEdge` because a bubble was a CUBE until the
 * town-on-LAND pane asked for a slab, and every caller that does not pass it is
 * still building a cube. Passing it is what keeps the plan from naming slabs
 * that do not exist (wasted meshes of pure air) or missing the ones that do.
 */
export function slabCounts(
  cellsPerEdge: number,
  cellsY: number = cellsPerEdge,
): { xz: number; y: number } {
  const cn = cellsPerEdge + 1; // the lattice runs one past the volume on each side
  return {
    xz: Math.ceil(cn / BUBBLE_SLAB_CELLS),
    y: Math.ceil((cellsY + 1) / BUBBLE_SLAB_CELLS_Y),
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
export function planSlabs(cellsPerEdge: number, cellsY: number = cellsPerEdge): SlabCoord[] {
  const { xz, y } = slabCounts(cellsPerEdge, cellsY);
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
  /** Vertical cell count. Defaults to the cube this function grew up on. */
  cellsY: number = cellsPerEdge,
): SlabCoord[] {
  const lo = [min[0] - padCells, min[1] - padCells, min[2] - padCells];
  const hi = [max[0] + padCells, max[1] + padCells, max[2] + padCells];
  const span = (c: number, step: number, i: number): boolean =>
    c * step <= hi[i] && (c + 1) * step >= lo[i];
  return planSlabs(cellsPerEdge, cellsY).filter(
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
 * THE PER-COLUMN TINT, BAKED — so both threads read one table.
 *
 * `settle-hooks.md` gap 1: a re-meshed bubble slab drew visibly darker and
 * rougher than its worker-built neighbours, and a slump made it cover half the
 * view. The cause was ownership, not shading. The worker builds its `tintAt`
 * from a column-stack sampler that reads the whole `GroundWorld`, and the
 * `GroundWorld` lives in the worker — so the main thread's re-mesh passed
 * `undefined` and `tintSlab` filled the slab with 1. A cut is metres wide, but
 * a SLAB IS SIXTEEN, so every untouched vertex in that slab lost its tint too.
 * (The old comment at the call site said a cut is inside one column's ground
 * "by construction", which is true of the cut and false of the slab.)
 *
 * The fix is a field, not a re-derivation: bake the tint once per column at
 * fill time, transfer it with the voxels, and have the WORKER read the same
 * table when it meshes. Two threads reading one array cannot disagree — the
 * re-meshed slab is byte-equivalent to the one it replaced, by construction
 * rather than by care.
 *
 * A PALETTE, because the tint is a function of the column's stack KEY and a
 * bubble sees a handful of stacks. 256² columns cost 64 KB of index instead of
 * 768 KB of triples, and the palette is exact — it is the same tuple object the
 * worker's own cache would have handed back.
 *
 * THE ONE THING THAT CHANGED FOR THE WORKER. It used to evaluate the sampler at
 * each VERTEX's exact x/z; it now reads the column the vertex stands in. The
 * tint is piecewise constant per artifact cell (1.524 m) and a column is a
 * quarter metre, so a stack boundary can move by at most half a column — 12 cm,
 * on a signal that only rides the top surface. That is the price of the two
 * paths being provably identical, and it is worth it.
 */
export interface BubbleTintField {
  cellsPerEdge: number;
  originM: readonly [number, number, number];
  cellM: number;
  /** Palette index per column, `z * cellsPerEdge + x`. */
  index: Uint8Array;
  /** The distinct tints, three floats each. At most 256 of them. */
  palette: Float32Array;
}

/**
 * Bake the field from a sampler. Runs where the sampler lives — the worker.
 *
 * A stack the palette cannot hold (more than 256 distinct tints in one bubble,
 * which has never happened and would mean the census was meaningless) falls
 * back to entry 0, the bubble's own reference. Silently is the right way round
 * here: a tint is a decoration on the top surface, and refusing to mesh the
 * ground over it would be the worse failure.
 */
export function bakeTintField(
  tintAt: (xM: number, zM: number) => readonly [number, number, number],
  originM: readonly [number, number, number],
  cellM: number,
  cellsPerEdge: number,
): BubbleTintField {
  const index = new Uint8Array(cellsPerEdge * cellsPerEdge);
  const slots = new Map<string, number>();
  const flat: number[] = [1, 1, 1];
  slots.set('1,1,1', 0);
  for (let z = 0; z < cellsPerEdge; z++) {
    const wz = originM[2] + (z + 0.5) * cellM;
    for (let x = 0; x < cellsPerEdge; x++) {
      const wx = originM[0] + (x + 0.5) * cellM;
      const c = tintAt(wx, wz);
      const key = `${c[0]},${c[1]},${c[2]}`;
      let slot = slots.get(key);
      if (slot === undefined) {
        if (slots.size >= 256) {
          index[z * cellsPerEdge + x] = 0;
          continue;
        }
        slot = slots.size;
        slots.set(key, slot);
        flat.push(c[0], c[1], c[2]);
      }
      index[z * cellsPerEdge + x] = slot;
    }
  }
  return {
    cellsPerEdge,
    originM: [originM[0], originM[1], originM[2]],
    cellM,
    index,
    palette: new Float32Array(flat),
  };
}

/**
 * The sampler both threads mesh with. Pure, and it allocates nothing per call:
 * the palette becomes a small array of tuples once, and every lookup hands one
 * of them back.
 */
export function tintFromField(
  f: BubbleTintField,
): (xM: number, zM: number) => readonly [number, number, number] {
  const n = f.cellsPerEdge;
  const tuples: Array<readonly [number, number, number]> = [];
  for (let i = 0; i * 3 < f.palette.length; i++) {
    tuples.push([f.palette[i * 3], f.palette[i * 3 + 1], f.palette[i * 3 + 2]]);
  }
  const ox = f.originM[0];
  const oz = f.originM[2];
  const cell = f.cellM;
  return (xM: number, zM: number) => {
    const x = Math.min(n - 1, Math.max(0, Math.floor((xM - ox) / cell)));
    const z = Math.min(n - 1, Math.max(0, Math.floor((zM - oz) / cell)));
    return tuples[f.index[z * n + x]] ?? tuples[0];
  };
}

/** The field's buffers, for `postMessage`'s transfer list. */
export function transfersOfTintField(f: BubbleTintField): ArrayBuffer[] {
  return [f.index.buffer, f.palette.buffer] as ArrayBuffer[];
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

/* ------------------------------------------------------- THE TOWN'S FLOOR */

/**
 * Trodden town earth, and the two numbers that place it. Copied from the
 * SHEET path's own constants in `groundChunkLoader.sampleGroundChunk` so the
 * volume top and the flat terrain agree about what a town's ground looks like.
 *
 * The values are duplicated rather than imported on purpose: this module is the
 * pure terrain layer and imports nothing from `bridge/`, which is the rule that
 * keeps it runnable under vitest with no GroundWorld in sight. The tests below
 * pin the numbers on both sides, so a drift is a failing test rather than a
 * silent divergence between the two paths.
 *
 * Why the town needs its own floor at all is written out at the sheet-path call
 * site: measured on Hafting, 49.4% of the ground inside the built radius had
 * NOTHING painted on it and rendered as bright meadow grass between the houses.
 * A pale street ribbon with vivid grass on both sides has nothing to separate
 * it from its surroundings, so the street network broke into disconnected
 * strips. Feet wear ground bare; the tint is what says so.
 */
export const TOWN_FLOOR_RGB: readonly [number, number, number] = [0.42, 0.36, 0.27];

/** How far past the town ring the bare ground fades back to wild biome. */
export const TOWN_FLOOR_FEATHER_M = 26;

/**
 * How completely the town overrides its biome. Below 1 so a town on moor,
 * marsh or red desert keeps a trace of where it stands instead of every
 * settlement in the world sharing one identical brown.
 */
export const TOWN_FLOOR_STRENGTH = 0.88;

/**
 * Blend one column's top color toward trodden town earth.
 *
 * `townT` is the TOWN MASK: 1 inside a keep-out ring, ramping to 0 a feather
 * away from it. Callers derive it from `townClearance` as `1 - clearance`, the
 * same ring the vegetation keep-out already uses — so bare ground, cleared
 * trees and the sheet path's floor can never disagree about where the town is.
 *
 * Returns the input tuple's values unchanged at `townT <= 0`, which is the
 * whole world outside a settlement, so a bubble with no town in it is
 * bit-identical to one built before this existed.
 */
export function townFloorTop(
  columnTop: readonly [number, number, number],
  townT: number,
): [number, number, number] {
  const t = Math.max(0, Math.min(1, townT)) * TOWN_FLOOR_STRENGTH;
  if (t <= 0) return [columnTop[0], columnTop[1], columnTop[2]];
  return [
    columnTop[0] + (TOWN_FLOOR_RGB[0] - columnTop[0]) * t,
    columnTop[1] + (TOWN_FLOOR_RGB[1] - columnTop[1]) * t,
    columnTop[2] + (TOWN_FLOOR_RGB[2] - columnTop[2]) * t,
  ];
}

/**
 * How many steps the town mask is quantized into before it reaches the tint
 * cache and the palette.
 *
 * The mask is CONTINUOUS across the feather, and both consumers below are
 * keyed tables: the worker's per-stack tint cache, and `bakeTintField`'s
 * 256-entry palette. Left continuous, a single town would hand the palette a
 * new entry for almost every column in its feather ring, blow past 256, and
 * drop the overflow to entry 0 — the reference tint — which is a hard bright
 * edge exactly where the feather exists to avoid one.
 *
 * 32 steps over a 26 m feather is a band 80 cm wide, well under the 1–2 m cell
 * a town bubble is drawn at, so the quantization is invisible and the palette
 * costs at most 32 entries per ground stack.
 */
export const TOWN_MASK_STEPS = 32;

/** Snap a town mask to the palette's step grid. */
export function quantizeTownMask(townT: number): number {
  if (townT <= 0) return 0;
  if (townT >= 1) return 1;
  return Math.round(townT * TOWN_MASK_STEPS) / TOWN_MASK_STEPS;
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

/* ------------------------------------------------ THE LAND PAGE'S OWN FILL */

/**
 * THE SANDBOX'S FILL, LIFTED OUT OF ITS RENDER.
 *
 * `?step=land` built its whole world inside one synchronous React render — the
 * fill, the datum walk, the pre-carves, the compaction and the first mesh — and
 * measured on the real cell-785 ground that is 10.2 s of frozen tab at 360 m
 * and 13.5 s at 480 m (`landsize.md`). The mesh is the bulk of it and the land
 * page drains that through its own remesh pump now; THIS is the rest, moved
 * off the main thread through `landVolumeWorker`.
 *
 * It is deliberately NOT `fillBubble` above. That one serves the live world's
 * bubble and differs in four ways that are all load-bearing there and all wrong
 * here: it is a CUBE (no `heightM`), it blends its rim into the surrounding
 * heightfield (the sandbox has no surrounding heightfield and a rim ramp would
 * be an invented slope), it reads `streamedTerrainSurfaceY` rather than the
 * sandbox's `groundSurfaceY`, and it knows nothing about the sandbox's two
 * pre-carves. Sharing one function would have meant four flags and one of them
 * silently changing the terrain nine critic rounds were judged on.
 *
 * What IS shared is everything underneath: `fillBubbleFromGround`,
 * `VoxelVolume`, `meshCellRange`, the snapshot/transfer contract, and the rule
 * that ONE THREAD OWNS THE VOXELS — the worker fills, hands the snapshot over,
 * and never hears about an edit again.
 */
export type LandPreCarve = 'none' | 'shafts' | 'crater';

export interface LandFillSpec {
  centerXM: number;
  centerZM: number;
  extentM: number;
  /** Vertical extent, metres. The slab; not derived from `extentM`. */
  heightM: number;
  cellM: number;
  preCarve: LandPreCarve;
}

export interface LandFillResult {
  snapshot: VolumeSnapshot;
  originM: [number, number, number];
  cellsPerEdge: number;
  cellsY: number;
  /** Pre-carve drawn-ground height per column, `z * cellsPerEdge + x`. */
  originalTopY: Float32Array;
  fillMs: number;
  solidCells: number;
}

/**
 * Fill one land slab, capture its datum, apply its pre-carve, compact.
 *
 * The ORDER is the whole correctness of this function and every step of it was
 * learned from a bug:
 *
 *   fill → datum → carve → compact
 *
 * The datum is captured BEFORE the carve, because a crater floor is the top of
 * its own carved column and measuring depth against that gave every carved bowl
 * depth zero — surface litter, no strata, the round-one knockout. It is read
 * from the FILLED VOXELS rather than from the analytic source, because the mesh
 * is quantised to the cell grid and an analytic datum disagrees by up to a cell
 * — enough to sweep across the 12 cm litter horizon and band open ground.
 *
 * The compaction comes LAST, because a cell-by-cell dig allocates every brick
 * it passes through and leaves it allocated even when the whole brick ends up
 * air; an allocated brick reads as "interesting" to the mesher's band scan, and
 * that is the mechanism behind the round-7 critic's 154 ms slice beside the
 * pre-bored shafts.
 */
export function fillLandSlab(
  src: GroundHeightSource,
  stackSource: ColumnStackSource,
  spec: LandFillSpec,
): LandFillResult {
  const { centerXM, centerZM, extentM, heightM, cellM, preCarve } = spec;
  /* The VERTICAL cell stays the horizontal one. The height row buys ROOM, not
   * resolution: the substance shader's noise is world-space and isotropic, so a
   * lattice fine sideways and coarse vertically draws grain at two scales on
   * one wall — the combat arena's known wart. */
  const fill = fillBubbleFromGround(src, centerXM, centerZM, extentM, cellM, stackSource, {
    heightM,
    cellHM: cellM,
  });
  const n = fill.cellsPerEdge;
  const nY = fill.cellsY;
  const originM = fill.originM as [number, number, number];

  const originalTopY = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const wx = originM[0] + (x + 0.5) * cellM;
      const wz = originM[2] + (z + 0.5) * cellM;
      let y = Math.min(
        nY - 1,
        Math.max(0, Math.floor((src.surfaceYAt(wx, wz) - originM[1]) / cellM) + 3),
      );
      while (y < nY - 1 && fill.volume.get(x, y + 1, z) !== Material.Air) y++;
      while (y >= 0 && fill.volume.get(x, y, z) === Material.Air) y--;
      originalTopY[z * n + x] = originM[1] + (y + 1) * cellM;
    }
  }

  /** The cell the ground surface sits in under the window's centre. */
  const surfaceCell = Math.min(
    nY - 1,
    Math.floor((src.surfaceYAt(centerXM, centerZM) - originM[1]) / cellM),
  );

  if (preCarve === 'shafts') {
    /* Two pre-bored wells, carved AFTER the fill like any spell would. A square
     * one and a round one, mouths about 16 m across, floors a few cells above
     * the base — over a hundred metres down at the 240 m preset. A shaft that
     * deep walks the whole material stack in one look. */
    const mid = Math.floor(n / 2);
    const floorCell = 4; // a bottomless well drains the water demo
    const mouth = Math.max(3, Math.round(Math.min(8, extentM / 15) / cellM));
    const off = Math.round(n * 0.18);
    const dig = (x: number, z: number): void => {
      if (x < 0 || z < 0 || x >= n || z >= n) return;
      for (let y = surfaceCell; y >= floorCell; y--) fill.volume.set(x, y, z, Material.Air);
    };
    for (let dz = -mouth; dz <= mouth; dz++) {
      for (let dx = -mouth; dx <= mouth; dx++) {
        dig(mid - off + dx, mid + dz); // the square well
        if (dx * dx + dz * dz <= mouth * mouth) dig(mid + off + dx, mid + dz); // the round well
      }
    }
  }

  if (preCarve === 'crater') {
    const mid = Math.floor(n / 2);
    const rCells = Math.max(3, Math.round(extentM / 11 / cellM));
    /* The crater's depth is a fraction of the WIDTH, and width and height are
     * independent — so at 480 m the bowl wants to be 37 m deep and a 32 m slab
     * has 16 m under its surface. Unclamped it punches through the bottom seal
     * and the sealed volume becomes a hole into nothing, which ADR 0002 records
     * as the fault that made a crater read as a lit dome hanging in mid-air.
     * Four rows of floor stand, the same margin the shafts keep. */
    const dCells = Math.min(
      Math.max(3, Math.round(extentM / 13 / cellM)),
      Math.max(3, surfaceCell - 4),
    );
    for (let y = surfaceCell; y > surfaceCell - dCells; y--) {
      const t = (surfaceCell - y) / dCells;
      const r = rCells * (1 - t * 0.45);
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const dx = x - mid;
          const dz = z - mid;
          if (dx * dx + dz * dz <= r * r) fill.volume.set(x, y, z, Material.Air);
        }
      }
    }
  }

  fill.volume.compact();

  return {
    snapshot: fill.volume.snapshot(),
    originM,
    cellsPerEdge: n,
    cellsY: nY,
    originalTopY,
    fillMs: fill.fillMs,
    solidCells: fill.solidCells,
  };
}

/** The buffers of a land fill, for `postMessage`'s transfer list. */
export function transfersOfLandFill(f: LandFillResult): ArrayBuffer[] {
  return [
    f.snapshot.brickUniform.buffer,
    f.snapshot.brickCells.buffer,
    f.originalTopY.buffer,
  ] as ArrayBuffer[];
}
