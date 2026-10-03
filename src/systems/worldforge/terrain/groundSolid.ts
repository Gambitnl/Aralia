/**
 * @file groundSolid.ts — ground as a SOLID, not a sheet.
 *
 * The world reads as hollow because every surface in it is a surface and
 * nothing more. Remy's words, 2026-08-05: "it's like there's a bunch of sheets
 * overlaying each other instead of actual ground and water." The audit agreed:
 * terrain is one triangle layer with a skirt only at chunk borders, so below
 * grade the world is void.
 *
 * This module is the answer to that, at the smallest scale that can prove it.
 *
 * ONE MESH. The ground is a closed-sided solid: a top surface, plus wall faces
 * wherever the solid is cut or bounded. Nothing is stacked on anything.
 *
 * LAYERS ARE DATA, NOT GEOMETRY. A layer stack answers one question — at depth
 * d below the surface, what is this made of. It is never drawn. It has no
 * faces. Building three horizontal planes at three heights would be sheets on
 * sheets with extra steps, which is the disease rather than the cure.
 *
 * GEOMETRY APPEARS ONLY AT A CUT. Dig a pit and the pit walls are new faces in
 * the same mesh. Each wall vertex asks the stack what it is made of at its own
 * depth, so one continuous wall carries a gradient from litter to soil to rock.
 * Not three strips. One surface that changes.
 *
 * CLOSED, INCLUDING THE BOTTOM. Remy first called for no bottom cap, on the
 * sound reasoning that a player never gets under real terrain in play. Seeing
 * it decided the matter the other way: "the bottom is also see-through", and an
 * open base makes the patch read as a shell however solid its sides are. The
 * cap is a fan of about 200 triangles — roughly a fortieth of the patch and far
 * less than the doubt it removes. Judge from a frame, not from an argument.
 */

import { GroundBand, DEFAULT_STACK, colorAtDepth, substance } from './materials';

/* The layer stack now lives in `materials.ts`.
 *
 * It began here as four colors for a forest floor. It had to leave, because a
 * color is the least of what the ground must answer: a spell asks how hard the
 * substance is, water asks whether it drains, and a cut wall asks whether it
 * stands or slumps. Those belong to the substance, and it must be the SAME
 * substance the voxel stores, or the world has two material systems that agree
 * only by accident.
 *
 * These re-exports keep this module's callers working. The stack itself is
 * `BIOME_GROUND[6]`, temperate deciduous forest, which is what this file always
 * described. */
export type GroundLayer = GroundBand;
export const FOREST_FLOOR_STACK: readonly GroundBand[] = DEFAULT_STACK;

/**
 * The color of the ground at a given depth.
 *
 * A thin name over `colorAtDepth`. The blend across each horizon lives there
 * now, beside the substances it blends between.
 */
export function materialAtDepth(
  depthM: number,
  stack: readonly GroundBand[] = DEFAULT_STACK,
): [number, number, number] {
  return colorAtDepth(depthM, stack);
}

export interface GroundSolidData {
  positions: Float32Array;
  normals: Float32Array;
  /** Linear RGB per vertex. Top surface reads its own tone; cut walls read the stack. */
  colors: Float32Array;
  indices: Uint32Array;
  /** Triangle count, reported so a caller can judge cost. */
  triangles: number;
}

/** A pit cut into the solid. Circular, because a spell blast is. */
export interface PitCut {
  /** Center, meters, in the patch's own frame. */
  x: number;
  z: number;
  radiusM: number;
  depthM: number;
  /** How far the wall leans out at the top. 0 is a vertical shaft. */
  batter: number;
}

/** Deterministic value noise for surface variation. */
function hash2(i: number, j: number): number {
  let h = Math.imul(i + 374761393, 668265263) ^ Math.imul(j + 1442695041, 1597334677);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function valueNoise(x: number, z: number, freq: number): number {
  const u = x * freq;
  const v = z * freq;
  const i = Math.floor(u);
  const j = Math.floor(v);
  let fu = u - i;
  let fv = v - j;
  fu = fu * fu * (3 - 2 * fu);
  fv = fv * fv * (3 - 2 * fv);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return a + (b - a) * fu + ((c + (d - c) * fu) - (a + (b - a) * fu)) * fv;
}

/**
 * Surface height of the patch before any cut, in meters.
 *
 * Gentle relief only. The patch exists to answer "does ground read as ground",
 * and a dramatic landform would answer a different question.
 */
function surfaceY(x: number, z: number): number {
  return (
    (valueNoise(x, z, 0.09) - 0.5) * 0.55 +
    (valueNoise(x, z, 0.31) - 0.5) * 0.14 +
    (valueNoise(x, z, 1.7) - 0.5) * 0.03
  );
}

/**
 * Build one patch of ground as a solid, with pits cut into it.
 *
 * The mesh is a grid whose vertices are pushed DOWN inside a pit, plus a wall
 * ring per pit joining the pit floor to the untouched surface. The wall is what
 * carries the layer stack, and it is the whole reason this file exists — it is
 * the first surface in Aralia that shows what the ground is made of.
 */
export function buildGroundSolid(
  sizeM: number,
  resolution: number,
  cuts: readonly PitCut[] = [],
  stack: readonly GroundBand[] = DEFAULT_STACK,
): GroundSolidData {
  const n = resolution + 1;
  const step = sizeM / resolution;
  const half = sizeM / 2;

  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];

  /** Surface tone of undisturbed ground — the litter reading, varied. */
  const surfaceTone = (x: number, z: number): [number, number, number] => {
    const base = materialAtDepth(0, stack);
    /* Wide band on purpose. Litter is not one tone — it is wet patches, bare
     * scrapes and drifts against roots, and a narrow band reads as painted
     * plastic at the three meters this patch is judged from. */
    const v = 0.55 + valueNoise(x + 11, z - 7, 2.3) * 0.95
      + valueNoise(x - 3, z + 5, 7.1) * 0.22;
    return [base[0] * v, base[1] * v, base[2] * v];
  };

  /** How deep a point sits inside a pit, and which pit reached deepest. */
  const cutAt = (x: number, z: number): { drop: number; pit: PitCut | null } => {
    let drop = 0;
    let pit: PitCut | null = null;
    for (const c of cuts) {
      const d = Math.hypot(x - c.x, z - c.z);
      const mouth = c.radiusM + c.depthM * c.batter;
      if (d >= mouth) continue;
      // Flat floor inside the radius, then a battered wall out to the mouth.
      const t = d <= c.radiusM ? 1 : 1 - (d - c.radiusM) / Math.max(1e-6, mouth - c.radiusM);
      const eased = t * t * (3 - 2 * t);
      const thisDrop = c.depthM * eased;
      if (thisDrop > drop) {
        drop = thisDrop;
        pit = c;
      }
    }
    return { drop, pit };
  };

  // ---- top surface, displaced downward wherever a cut reaches it ----------
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + i * step;
      const z = -half + j * step;
      const sy = surfaceY(x, z);
      const { drop } = cutAt(x, z);
      const y = sy - drop;
      pos.push(x, y, z);
      nrm.push(0, 1, 0);
      // A cut vertex reads the STACK at its own depth. An untouched vertex
      // reads the surface tone. This is the whole idea in two lines: material
      // is a function of depth, and it is sampled, never stacked.
      const c = drop > 0.002 ? materialAtDepth(drop, stack) : surfaceTone(x, z);
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  /* ---- rim wall ----------------------------------------------------------
   *
   * The patch is bounded, so its edge is itself a cut — the same kind of face a
   * pit wall is, made by the world ending rather than by a spade. It carries
   * the stack for the same reason and proves the same point: look at the side
   * of this patch and you see what the ground is made of.
   *
   * No bottom cap, by decision. The player never gets under real terrain in
   * play, so the underside stays open and a reviewer who flies below is meant
   * to see that it is open. */
  const RIM_DEPTH_M = 2.6;
  const RIM_RINGS = 5;
  const edge: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) edge.push([i, 0]);
  for (let j = 1; j < n; j++) edge.push([n - 1, j]);
  for (let i = n - 2; i >= 0; i--) edge.push([i, n - 1]);
  for (let j = n - 2; j >= 1; j--) edge.push([0, j]);

  /* Ring 0 REUSES the surface's own edge vertices rather than duplicating them.
   *
   * Duplicating looked identical — the positions coincide, so no gap shows —
   * but it leaves the surface and the rim as two separate shells that merely
   * touch. An edge-count check found 192 boundary edges along that seam. A mesh
   * that is watertight by coincidence is not watertight; move one vertex and it
   * splits. Sharing the vertices makes the join structural. */
  const rimStart = pos.length / 3;
  const rimIndex = (r: number, k: number): number => {
    if (r === 0) {
      const [i, j] = edge[k];
      return j * n + i;
    }
    return rimStart + (r - 1) * edge.length + k;
  };
  for (let r = 1; r <= RIM_RINGS; r++) {
    const depth = (r / RIM_RINGS) * RIM_DEPTH_M;
    for (const [i, j] of edge) {
      const x = -half + i * step;
      const z = -half + j * step;
      const topY = pos[(j * n + i) * 3 + 1];
      pos.push(x, topY - depth, z);
      // Outward normal, so the rim lights as a wall rather than as floor.
      const nx = i === 0 ? -1 : i === n - 1 ? 1 : 0;
      const nz = j === 0 ? -1 : j === n - 1 ? 1 : 0;
      const len = Math.hypot(nx, nz) || 1;
      nrm.push(nx / len, 0, nz / len);
      const c = materialAtDepth(depth, stack);
      col.push(c[0], c[1], c[2]);
    }
  }
  /* Winding faces OUTWARD.
   *
   * The first version wound these the same way as the top surface, which sent
   * every rim normal INWARD. Under back-face culling that hides the two walls
   * nearest the camera and leaves the two far ones, so the patch renders as an
   * L instead of a box. Remy found it by orbiting below the patch — which is
   * precisely the fault the below-grade turntable sweep was built to catch, and
   * a reminder that a solid is only solid from the outside if its faces agree.
   *
   * The order below is the mirror of the surface grid's, so the same edge loop
   * produces faces that point away from the patch center. */
  const ring = edge.length;
  for (let r = 0; r < RIM_RINGS; r++) {
    for (let k = 0; k < ring; k++) {
      const k2 = (k + 1) % ring;
      const a = rimIndex(r, k);
      const b = rimIndex(r, k2);
      const c = rimIndex(r + 1, k);
      const d = rimIndex(r + 1, k2);
      idx.push(a, b, c, b, d, c);
    }
  }

  /* ---- bottom cap ------------------------------------------------------
   *
   * A fan from the rim's lowest ring to one center point. It follows the relief
   * above it rather than sitting flat, so the solid has an even thickness and
   * no wedge of nothing at the corners.
   *
   * Wound to face DOWN, the mirror of the top surface, for the reason the rim
   * teaches: a solid is only solid from outside if every face agrees which way
   * is out. */
  const capRingStart = rimIndex(RIM_RINGS, 0);
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let k = 0; k < ring; k++) {
    cx += pos[(capRingStart + k) * 3];
    cy += pos[(capRingStart + k) * 3 + 1];
    cz += pos[(capRingStart + k) * 3 + 2];
  }
  const hub = pos.length / 3;
  pos.push(cx / ring, cy / ring, cz / ring);
  nrm.push(0, -1, 0);
  {
    const c = materialAtDepth(RIM_DEPTH_M, stack);
    col.push(c[0], c[1], c[2]);
  }
  for (let k = 0; k < ring; k++) {
    const k2 = (k + 1) % ring;
    // Mirror of the top surface's winding, so the cap faces DOWN. The first
    // version wound it the same way as the surface, which pointed it UP and
    // culled it from below — the exact see-through Remy reported after the rim
    // was fixed. Two winding faults in one mesh, both invisible from above.
    idx.push(hub, capRingStart + k, capRingStart + k2);
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    colors: new Float32Array(col),
    indices: new Uint32Array(idx),
    triangles: idx.length / 3,
  };
}

/**
 * What the ground is at one point, in words a person can read.
 *
 * The reviewer can see a cut face and still not know what they are looking at.
 * A gradient is only evidence once somebody can name the bands in it, so the
 * probe reports the layer, the depth, and how far it is to the next material.
 *
 * Remy asked for this while judging: "i want to be able to point at the ground
 * and it gives me the info."
 */
export interface GroundProbe {
  /** Depth below the undisturbed surface, meters. Zero on open ground. */
  depthM: number;
  /** Which band the point sits in. */
  layerId: string;
  /** Meters down to the next material, or null at bedrock. */
  toNextM: number | null;
  /** Linear RGB the renderer used at this depth. */
  rgb: [number, number, number];
}

export function probeGround(
  x: number,
  z: number,
  cuts: readonly PitCut[] = [],
  stack: readonly GroundBand[] = DEFAULT_STACK,
): GroundProbe {
  let drop = 0;
  for (const c of cuts) {
    const d = Math.hypot(x - c.x, z - c.z);
    const mouth = c.radiusM + c.depthM * c.batter;
    if (d >= mouth) continue;
    const t = d <= c.radiusM ? 1 : 1 - (d - c.radiusM) / Math.max(1e-6, mouth - c.radiusM);
    const eased = t * t * (3 - 2 * t);
    drop = Math.max(drop, c.depthM * eased);
  }
  let layerId = substance(stack[stack.length - 1].substance).label;
  let toNextM: number | null = null;
  for (const layer of stack) {
    if (drop <= layer.depthM || !Number.isFinite(layer.depthM)) {
      layerId = substance(layer.substance).label;
      toNextM = Number.isFinite(layer.depthM) ? layer.depthM - drop : null;
      break;
    }
  }
  return { depthM: drop, layerId, toNextM, rgb: materialAtDepth(drop, stack) };
}
