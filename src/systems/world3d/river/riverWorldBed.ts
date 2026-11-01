/**
 * THE WORLD'S RIVER AS THE LIVE RIVER'S BED (ADR 0009 step 6, slice 10,
 * 2026-10-26).
 *
 * The river page builds its own valley from a seed (`riverReach.ts`,
 * `makeTerrainHeight`). In the game world the bed is the WORLD's: the drawn
 * terrain the player walks on, and the world's own river line. This module
 * holds the plain data that describes such a bed and the pure arithmetic that
 * reads it, so the main thread (which has the world) and the flow worker
 * (which has the solver) agree bit for bit:
 *
 * - `WorldTerrainLattice`: the drawn terrain's vertex heights, world axes. The
 *   streamed terrain draws straight triangles between the vertices of an 8 m
 *   lattice (`streamedSurface.ts`); `latticeHeightAt` reads the same
 *   triangles, so the solver's bed IS the drawn ground, not a resample of it.
 * - `RiverWorldFrame`: where the river's local axes sit in the world. The
 *   river runs along local +x (the solver's inflow is the west edge, the
 *   outflow the east edge), so a world river at any bearing needs a turn as
 *   well as a move. `yaw` is the bearing of local +x in the world's xz plane.
 *   `datum` is the height datum (river-local y = world y - datum): the water's
 *   half-float levels keep their precision at any world altitude.
 *
 * Nothing here imports the world: the worker receives this data in its start
 * message and never touches the ground world itself.
 */

/** A lattice of terrain vertex heights, world axes. Vertex (i, j) is at (x0 + i step, z0 + j step). */
export interface WorldTerrainLattice {
  x0: number;
  z0: number;
  step: number;
  nx: number;
  nz: number;
  heights: Float32Array;
}

/** River-local axes in the world: local = R(-yaw) (world - (x, z)); local y = world y - datum. */
export interface RiverWorldFrame {
  x: number;
  z: number;
  /** The bearing of river-local +x in the world xz plane, radians (atan2(dz, dx)). */
  yaw: number;
  /** The height datum, world m. */
  datum: number;
}

/** Everything the flow worker needs to build the reach on the world's bed. */
export interface RiverWorldBedInit {
  frame: RiverWorldFrame;
  lattice: WorldTerrainLattice;
  /** The course's control points, river-local m, upstream first (a Catmull-Rom curve runs through them). */
  course: Array<[number, number]>;
  /** Half the world river's width, m. */
  halfW: number;
  /** The world's channel depth under its water line, m (the design level stands this far over the bed). */
  channelDepthM: number;
  /** Manning roughness n for the whole bed, s/m^(1/3). */
  manning: number;
  /**
   * The solver grid's x range, river-local m: the design level is built from
   * the bed inside it (the solver sees no sill past its outflow edge), and
   * holds its edge values beyond it.
   */
  levelRangeX: [number, number];
  /**
   * THE FINE GROUND (agora-257c, 2026-10-29, GG-533): the ground record's own
   * height grid (one value every 1.524 m) over the reach. Inside the river's
   * corridor the bed is this grid, not the drawn 8 m lattice. With the
   * lattice alone, a 10 m channel held one row of lattice points, and a
   * river that crossed the rows at a slant filled a chain of diamond pools
   * (on 17,4 the floor's width swung from 9.5 m to 1 m every 24 m).
   * Optional: without it (and `corridor`), the bed is the lattice, as before.
   */
  fine?: WorldFineGround;
  /** Where the bed swaps from the drawn lattice to the fine ground (needs `fine`). */
  corridor?: RiverBedCorridor;
  /**
   * ONE WATER (2026-10-30, GG-534): the world river's normal flow at the
   * reach's upstream (west) edge, m^3/s (`region/riverChannel.ts`: the flow
   * its width carries). `channelDepthM` is that flow's depth in the channel.
   */
  dischargeM3S: number;
  /** The world's other rivers that end inside the box: their water joins the reach there. */
  tributaries: RiverWorldTributary[];
}

/**
 * A tributary's mouth inside the reach's box, river-local m: its water enters
 * the solver over the cells within `halfW` of the mouth, moving along `dir`
 * (a unit vector, river-local axes) at `speedMS`.
 */
export interface RiverWorldTributary {
  x: number;
  z: number;
  halfW: number;
  dir: [number, number];
  speedMS: number;
  dischargeM3S: number;
}

/** All the water that enters a world reach: the main river at its west edge and each tributary, m^3/s. */
export function worldBedInflowM3S(bed: Pick<RiverWorldBedInit, 'dischargeM3S' | 'tributaries'>): number {
  return bed.tributaries.reduce((q, t) => q + t.dischargeM3S, bed.dischargeM3S);
}

/** A height grid in world axes: value (i, j) at (x0 + i step, z0 + j step), world m, read bilinearly. */
export interface WorldFineGround {
  x0: number;
  z0: number;
  step: number;
  nx: number;
  nz: number;
  heights: Float32Array;
}

/**
 * THE CORRIDOR'S BLEND. The world's terrain is cut (not drawn) within `halfM`
 * of the course (`riverFootprintCut.ts`, the same course and the same
 * distance), and the river's bed draws there. The bed is the fine ground up
 * to `halfM - rimM - blendM` from the course, eases to the lattice over
 * `blendM`, and is the lattice for the last `rimM` before the cut line, so the
 * bed still meets the drawn ground there with no step. `rimM` covers the cut's
 * 512-sample center texture, which can stand a fraction of a meter off the
 * exact center line.
 */
export interface RiverBedCorridor {
  halfM: number;
  blendM: number;
  rimM: number;
}

/** The course's z at river-local x: linear between course points, held past the ends (the cut's center line). */
export function corridorCenterAt(course: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (course.length === 0) return 0;
  let best = course[0][1];
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < course.length - 1; i++) {
    const [ax, az] = course[i];
    const [bx, bz] = course[i + 1];
    if ((x - ax) * (x - bx) <= 0 && ax !== bx) return az + ((x - ax) / (bx - ax)) * (bz - az);
    for (const [px, pz] of [course[i], course[i + 1]]) {
      if (Math.abs(px - x) < bestD) { bestD = Math.abs(px - x); best = pz; }
    }
  }
  return best;
}

/** The fine ground at a world point (bilinear), or null outside the grid. */
export function fineGroundAt(g: WorldFineGround, xw: number, zw: number): number | null {
  const gx = (xw - g.x0) / g.step;
  const gz = (zw - g.z0) / g.step;
  if (gx < 0 || gz < 0 || gx > g.nx - 1 || gz > g.nz - 1) return null;
  const i0 = Math.min(g.nx - 2, Math.floor(gx));
  const j0 = Math.min(g.nz - 2, Math.floor(gz));
  const fx = gx - i0;
  const fz = gz - j0;
  const H = g.heights;
  const a = H[j0 * g.nx + i0] * (1 - fx) + H[j0 * g.nx + i0 + 1] * fx;
  const b = H[(j0 + 1) * g.nx + i0] * (1 - fx) + H[(j0 + 1) * g.nx + i0 + 1] * fx;
  return a * (1 - fz) + b * fz;
}

/** The share of the fine ground in the bed at `n` m from the corridor's center line (1 inside, 0 at the rim). */
export function fineGroundWeight(c: RiverBedCorridor, n: number): number {
  const full = c.halfM - c.rimM - c.blendM;
  if (n <= full) return 1;
  if (n >= c.halfM - c.rimM) return 0;
  const t = 1 - (n - full) / c.blendM;
  return t * t * (3 - 2 * t);
}

/**
 * THE FINE GROUND over a river-local box: the height grid's own vertices
 * (multiples of `step` from the world origin, as `groundSurfaceY` reads them)
 * that cover the box's turned corners, with one vertex of margin. `heightAt`
 * is the ground record's sampler.
 */
export function buildWorldFineGround(
  f: RiverWorldFrame, box: { x0: number; z0: number; x1: number; z1: number }, step: number,
  heightAt: (xw: number, zw: number) => number,
): WorldFineGround {
  const l = buildWorldTerrainLattice(f, box, step, heightAt);
  return { x0: l.x0, z0: l.z0, step: l.step, nx: l.nx, nz: l.nz, heights: l.heights };
}

/** A block of fine-ground values: rows i0..i0+w-1, j0..j0+h-1 of the grid, row-major. */
export interface WorldFineGroundPatch { i0: number; j0: number; w: number; h: number; values: Float32Array }

/** Read the fine ground's vertices inside a world box again from the ground record. Null when the box misses the grid. */
export function fineGroundPatch(
  g: WorldFineGround, box: { x0: number; z0: number; x1: number; z1: number },
  heightAt: (xw: number, zw: number) => number,
): WorldFineGroundPatch | null {
  const i0 = Math.max(0, Math.floor((box.x0 - g.x0) / g.step));
  const i1 = Math.min(g.nx - 1, Math.ceil((box.x1 - g.x0) / g.step));
  const j0 = Math.max(0, Math.floor((box.z0 - g.z0) / g.step));
  const j1 = Math.min(g.nz - 1, Math.ceil((box.z1 - g.z0) / g.step));
  if (i0 > i1 || j0 > j1) return null;
  const w = i1 - i0 + 1;
  const h = j1 - j0 + 1;
  const values = new Float32Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) values[j * w + i] = heightAt(g.x0 + (i0 + i) * g.step, g.z0 + (j0 + j) * g.step);
  }
  return { i0, j0, w, h, values };
}

/** Write a patch into the fine ground (the worker's copy takes the main thread's patch). */
export function applyFineGroundPatch(g: WorldFineGround, p: WorldFineGroundPatch): void {
  for (let j = 0; j < p.h; j += 1) {
    for (let i = 0; i < p.w; i += 1) g.heights[(p.j0 + j) * g.nx + p.i0 + i] = p.values[j * p.w + i];
  }
}

/** The river-local box that holds a world box's four turned corners. */
export function worldBoxToRiverLocal(f: RiverWorldFrame, box: { x0: number; z0: number; x1: number; z1: number }): { x0: number; z0: number; x1: number; z1: number } {
  const c = [
    worldToRiverLocal(f, box.x0, box.z0), worldToRiverLocal(f, box.x1, box.z0),
    worldToRiverLocal(f, box.x0, box.z1), worldToRiverLocal(f, box.x1, box.z1),
  ];
  return {
    x0: Math.min(...c.map((p) => p[0])), z0: Math.min(...c.map((p) => p[1])),
    x1: Math.max(...c.map((p) => p[0])), z1: Math.max(...c.map((p) => p[1])),
  };
}

/** River-local (x, z) of a world point. */
export function worldToRiverLocal(f: RiverWorldFrame, xw: number, zw: number): [number, number] {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const dx = xw - f.x;
  const dz = zw - f.z;
  return [c * dx + s * dz, -s * dx + c * dz];
}

/** World (x, z) of a river-local point. */
export function riverLocalToWorld(f: RiverWorldFrame, xl: number, zl: number): [number, number] {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [f.x + c * xl - s * zl, f.z + s * xl + c * zl];
}

/** A world direction (x, z) turned into river-local axes (no move). */
export function worldDirToRiverLocal(f: RiverWorldFrame, dx: number, dz: number): [number, number] {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [c * dx + s * dz, -s * dx + c * dz];
}

/**
 * The drawn terrain height at a world point: the plane of the lattice
 * triangle under it. The streamed terrain splits each quad on the
 * anti-diagonal, (a, c, b) then (b, c, d) for corners a = (i, j),
 * b = (i + 1, j), c = (i, j + 1), d = (i + 1, j + 1), so `fx + fz` names the
 * triangle (`streamedSurface.ts`). Outside the lattice the nearest edge
 * vertex row or column holds (the terrain itself is sampled with a clamp).
 */
export function latticeHeightAt(l: WorldTerrainLattice, xw: number, zw: number): number {
  const gx = (xw - l.x0) / l.step;
  const gz = (zw - l.z0) / l.step;
  const i0 = Math.max(0, Math.min(l.nx - 2, Math.floor(gx)));
  const j0 = Math.max(0, Math.min(l.nz - 2, Math.floor(gz)));
  const fx = Math.max(0, Math.min(1, gx - i0));
  const fz = Math.max(0, Math.min(1, gz - j0));
  const H = l.heights;
  const h00 = H[j0 * l.nx + i0];
  const h10 = H[j0 * l.nx + i0 + 1];
  const h01 = H[(j0 + 1) * l.nx + i0];
  const h11 = H[(j0 + 1) * l.nx + i0 + 1];
  return fx + fz <= 1
    ? h00 + (h10 - h00) * fx + (h01 - h00) * fz
    : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

/**
 * The world bed's height at a river-local point, river-local m (the datum
 * taken off): the drawn lattice, or inside the corridor the fine ground (see
 * RiverBedCorridor), when the bed carries both.
 */
export function worldBedHeightLocal(
  bed: Pick<RiverWorldBedInit, 'frame' | 'lattice'> & Partial<Pick<RiverWorldBedInit, 'fine' | 'corridor' | 'course'>>,
  xl: number, zl: number,
): number {
  const [xw, zw] = riverLocalToWorld(bed.frame, xl, zl);
  const coarse = latticeHeightAt(bed.lattice, xw, zw);
  if (bed.fine && bed.corridor && bed.course) {
    const w = fineGroundWeight(bed.corridor, Math.abs(zl - corridorCenterAt(bed.course, xl)));
    if (w > 0) {
      const fine = fineGroundAt(bed.fine, xw, zw);
      if (fine !== null) return coarse + (fine - coarse) * w - bed.frame.datum;
    }
  }
  return coarse - bed.frame.datum;
}

/** A point on a polyline, world m. */
export interface XZ { x: number; z: number }

/**
 * THE FRAME FOR A WORLD RIVER NEAR A POINT. The river's polyline runs source
 * to mouth. The nearest segment to `near` gives the anchor (the point's foot
 * on the line); the segments within `windowM` of it give the downstream
 * bearing (one bearing for the whole reach: the solver's course follows the
 * line's bends, the frame only turns the axes). The anchor sits at river-local
 * (`anchorLocal`), so a grid centered there holds the river near the player.
 */
export function riverWorldFrameNear(
  line: ReadonlyArray<XZ>, near: XZ, anchorLocal: readonly [number, number], datum: number, windowM = 120,
): { frame: RiverWorldFrame; anchor: XZ; segment: number; distanceM: number } {
  if (line.length < 2) throw new Error('[river] A world river line needs at least two points.');
  let best = { k: 0, t: 0, d2: Infinity };
  for (let k = 0; k < line.length - 1; k += 1) {
    const a = line[k];
    const b = line[k + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((near.x - a.x) * dx + (near.z - a.z) * dz) / L2)) : 0;
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const d2 = (near.x - px) ** 2 + (near.z - pz) ** 2;
    if (d2 < best.d2) best = { k, t, d2 };
  }
  const a = line[best.k];
  const b = line[best.k + 1];
  const anchor = { x: a.x + (b.x - a.x) * best.t, z: a.z + (b.z - a.z) * best.t };
  // The downstream bearing: the chord between the points `windowM` upstream
  // and downstream of the anchor along the line.
  const at = (from: number, dir: 1 | -1, dist: number): XZ => {
    let p = anchor;
    let k = dir > 0 ? best.k + 1 : best.k;
    let left = dist;
    while (k >= 0 && k < line.length) {
      const q = line[k];
      const seg = Math.hypot(q.x - p.x, q.z - p.z);
      if (seg >= left) {
        const f = seg > 0 ? left / seg : 0;
        return { x: p.x + (q.x - p.x) * f, z: p.z + (q.z - p.z) * f };
      }
      left -= seg;
      p = q;
      k += dir;
    }
    return p;
  };
  const up = at(best.k, -1, windowM);
  const down = at(best.k + 1, 1, windowM);
  const yaw = Math.atan2(down.z - up.z, down.x - up.x);
  // The frame's origin: the world point at river-local (0, 0).
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const frame: RiverWorldFrame = {
    x: anchor.x - (c * anchorLocal[0] - s * anchorLocal[1]),
    z: anchor.z - (s * anchorLocal[0] + c * anchorLocal[1]),
    yaw,
    datum,
  };
  return { frame, anchor, segment: best.k, distanceM: Math.sqrt(best.d2) };
}

/**
 * THE COURSE'S CONTROL POINTS from the world line: the line's points in
 * river-local m, the run whose local x lies in [xMin, xMax] plus one point
 * past each end (so the course projects cleanly at the ends of the render
 * domain). Upstream first.
 */
export function riverLocalCourse(f: RiverWorldFrame, line: ReadonlyArray<XZ>, xMin: number, xMax: number): Array<[number, number]> {
  const local = line.map((p) => worldToRiverLocal(f, p.x, p.z));
  let first = -1;
  let last = -1;
  for (let k = 0; k < local.length; k += 1) {
    if (local[k][0] >= xMin && local[k][0] <= xMax) { if (first < 0) first = k; last = k; }
  }
  if (first < 0) throw new Error('[river] The world river line does not cross the reach.');
  first = Math.max(0, first - 1);
  last = Math.min(local.length - 1, last + 1);
  const out = local.slice(first, last + 1);
  if (out.length < 4) throw new Error(`[river] The world river line gives only ${out.length} course points in the reach (4 needed).`);
  return out;
}

/**
 * THE LATTICE of the drawn terrain over a river-local box: the world vertices
 * (multiples of `step`, anchored at the world origin as the streamed terrain
 * is) that cover the box's turned corners, with one vertex of margin.
 * `heightAt` is the world's vertex sampler.
 */
export function buildWorldTerrainLattice(
  f: RiverWorldFrame, box: { x0: number; z0: number; x1: number; z1: number }, step: number,
  heightAt: (xw: number, zw: number) => number,
): WorldTerrainLattice {
  const corners = [
    riverLocalToWorld(f, box.x0, box.z0), riverLocalToWorld(f, box.x1, box.z0),
    riverLocalToWorld(f, box.x0, box.z1), riverLocalToWorld(f, box.x1, box.z1),
  ];
  const i0 = Math.floor(Math.min(...corners.map((c) => c[0])) / step) - 1;
  const i1 = Math.ceil(Math.max(...corners.map((c) => c[0])) / step) + 1;
  const j0 = Math.floor(Math.min(...corners.map((c) => c[1])) / step) - 1;
  const j1 = Math.ceil(Math.max(...corners.map((c) => c[1])) / step) + 1;
  const nx = i1 - i0 + 1;
  const nz = j1 - j0 + 1;
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) heights[j * nx + i] = heightAt((i0 + i) * step, (j0 + j) * step);
  }
  return { x0: i0 * step, z0: j0 * step, step, nx, nz, heights };
}

/**
 * THE WATER OF ONE REACH (one water, step 1, 2026-10-30). The solver's depth,
 * discharges (depth times velocity, river-local axes) and bed (river-local m,
 * datum taken off), one value per solver cell (index j * nx + i).
 */
export interface RiverWaterExport {
  h: Float32Array;
  hu: Float32Array;
  hv: Float32Array;
  bed: Float32Array;
}

/** A reach's water with the frame and grid it lives on: what the next reach starts from. */
export interface RiverWorldCarry extends RiverWaterExport {
  frame: RiverWorldFrame;
  grid: { x0: number; z0: number; dx: number; nx: number; nz: number };
}

/** Shallower than this, a carried cell is dry, m. */
const CARRY_WET_M = 1e-3;

/**
 * CARRY THE WATER INTO A MOVED REACH (one water, step 1, 2026-10-30). When the
 * live river's box moves along the world's river with the player, the new
 * box overlaps the old one. Each new cell inside the old box takes the old
 * water SURFACE at its world point (the nearest old cell: both grids are
 * 0.5 m, and the surface varies slowly), less its own bed, so the water keeps
 * its level even where the two beds differ by a lattice step. Its velocity
 * turns from the old river-local axes into the new ones. A new cell outside
 * the old box, or over a bed the old box did not have, keeps what `out`
 * already holds (the design level of `startCold`).
 *
 * `out.u` and `out.v` are velocities (m/s), as `RiverFlowSolver.setState`
 * takes them. Returns the number of new cells taken from the old water.
 */
export function carryRiverWater(
  carry: RiverWorldCarry,
  frame: RiverWorldFrame,
  grid: { x0: number; z0: number; dx: number; nx: number; nz: number },
  bed: ArrayLike<number>,
  out: { h: Float64Array; u: Float64Array; v: Float64Array },
): number {
  const og = carry.grid;
  // old-local direction -> world (turn by the old yaw) -> new-local (turn back by the new yaw).
  const turn = carry.frame.yaw - frame.yaw;
  const ct = Math.cos(turn);
  const st = Math.sin(turn);
  let taken = 0;
  for (let j = 0; j < grid.nz; j += 1) {
    const zl = grid.z0 + (j + 0.5) * grid.dx;
    for (let i = 0; i < grid.nx; i += 1) {
      const c = j * grid.nx + i;
      const nb = bed[c];
      if (!Number.isFinite(nb)) continue;
      const xl = grid.x0 + (i + 0.5) * grid.dx;
      const [xw, zw] = riverLocalToWorld(frame, xl, zl);
      const [ox, oz] = worldToRiverLocal(carry.frame, xw, zw);
      const oi = Math.floor((ox - og.x0) / og.dx);
      const oj = Math.floor((oz - og.z0) / og.dx);
      if (oi < 0 || oj < 0 || oi >= og.nx || oj >= og.nz) continue;
      const oc = oj * og.nx + oi;
      const ob = carry.bed[oc];
      if (!Number.isFinite(ob)) continue;
      taken += 1;
      const oh = carry.h[oc];
      const depth = oh > CARRY_WET_M ? carry.frame.datum + ob + oh - frame.datum - nb : 0;
      if (depth <= CARRY_WET_M) { out.h[c] = 0; out.u[c] = 0; out.v[c] = 0; continue; }
      const u = carry.hu[oc] / oh;
      const v = carry.hv[oc] / oh;
      out.h[c] = depth;
      out.u[c] = ct * u - st * v;
      out.v[c] = st * u + ct * v;
    }
  }
  return taken;
}
