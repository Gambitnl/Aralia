/**
 * @file buildingModels.ts
 * Procedural roof-form geometry for styled town buildings (2026-07-01).
 * Origin at the roof BASE center; walls place it at wall-top Y. Plain arrays
 * so the React layer wraps them in BufferGeometry (memoized per form+dims).
 */
import type { ChunkGeometryArrays } from './types';
import type { RoofForm } from '../worldforge/town/architectureStyle';
import type {
  BlueprintFloor,
  BlueprintPlan,
  BlueprintWindow,
  Cell,
  RoofPlan,
  RoofPlane,
  WallRun,
} from '../worldforge/interior/blueprintTypes';
import { EXTERIOR, cellKey } from '../worldforge/interior/blueprintTypes';
import {
  INNER_THICKNESS_FT,
  OUTER_THICKNESS_FT,
} from '../worldforge/interior/walls';

export function buildRoofGeometry(form: RoofForm, width: number, depth: number, rise: number): ChunkGeometryArrays {
  switch (form) {
    case 'gable': return gable(width, depth, rise);
    case 'steep': return gable(width, depth, rise * 1.7);
    case 'flat': return flatParapet(width, depth);
    case 'hip': return hip(width, depth, rise);
  }
}

/** Ridge prism: two sloped faces + two triangular gable ends. Ridge runs along X (width). */
function gable(w: number, d: number, h: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2;
  const P: number[][] = [
    [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], // eaves 0-3
    [-hw, h, 0], [hw, h, 0],                                 // ridge 4-5
  ];
  const tris = [
    [0, 1, 5], [5, 4, 0],   // north slope
    [2, 3, 4], [4, 5, 2],   // south slope
    [3, 0, 4],              // west gable end
    [1, 2, 5],              // east gable end
  ];
  return fromTris(P, tris);
}

/** Pyramid (the old cone-as-pyramid, made explicit). Apex at center. */
function hip(w: number, d: number, h: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2;
  const P: number[][] = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, h, 0]];
  const tris = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  return fromTris(P, tris);
}

/** Flat roof slab + parapet rim (0.5 m lip). */
function flatParapet(w: number, d: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2, slab = 0.25, lip = 0.5, t = 0.3;
  const P: number[][] = [];
  const tris: number[][] = [];
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => {
    const b = P.length;
    P.push([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
           [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
    const q = (a: number, bb: number, c: number, dd: number) => tris.push([a, bb, c], [c, dd, a]);
    q(b + 4, b + 5, b + 6, b + 7);                       // top
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b + i, b + j, b + 4 + j, b + 4 + i); }
  };
  box(-hw, hw, -hd, hd, 0, slab);                        // slab
  box(-hw, hw, -hd, -hd + t, slab, slab + lip);          // rims
  box(-hw, hw, hd - t, hd, slab, slab + lip);
  box(-hw, -hw + t, -hd, hd, slab, slab + lip);
  box(hw - t, hw, -hd, hd, slab, slab + lip);
  return fromTris(P, tris);
}

/** Faceted mesh: duplicate verts per face for flat normals, both windings. */
function fromTris(P: number[][], tris: number[][]): ChunkGeometryArrays {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [];
  for (const [a, b, c] of tris) {
    const A = P[a], B = P[b], C = P[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = positions.length / 3;
    for (const V of [A, B, C]) { positions.push(V[0], V[1], V[2]); normals.push(nx, ny, nz); }
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), normals: new Float32Array(normals) };
}

/* ════════════════════════════════════════════════════════════════════════
 * Task 12 — pure blueprint → 3D mesh data.
 *
 * buildBuildingMeshData raises building geometry straight from a
 * BlueprintPlan: NO rectangular-envelope assumption. Walls follow the plan's
 * merged wallRuns (each run one box, thicknessFt grown OUTWARD along the
 * run's nx/ny normal), the irregular shell follows the kind:'outer' runs,
 * windows split their run vertically (sill + head + glazed pane, a real
 * void between), doors — which already break runs — get jamb reveals and a
 * lintel filling the rest of their 5 ft cell around a 3 ft clear opening,
 * and every level gets a floor slab from footprintCells (basement at
 * -storeyHeight) with a stair HOLE cut where a stair rises from below. The
 * topmost level gets a ceiling slab (lower ceilings ARE the next slab).
 *
 * Pure data — plain number boxes, no three.js. The three-side consumer
 * (interiorParts.blueprintStructureParts) converts feet → meters and maps
 * kinds onto materials. Deterministic: a pure walk of the plan arrays.
 * ════════════════════════════════════════════════════════════════════════ */

const CELL_FT = 5;
/** Default storey height, feet (callers may override to fit a shell). */
export const BLUEPRINT_STOREY_FT = 10;
/** Floor/ceiling slab thickness, feet. */
const SLAB_FT = 0.4;
/** Door clear opening width, feet (inside the 5 ft door cell). */
const DOOR_CLEAR_FT = 3;
/** Jamb reveal width each side of the opening, feet (fills the cell). */
const DOOR_JAMB_FT = (CELL_FT - DOOR_CLEAR_FT) / 2;
/** Door head height, feet (lintel fills from here to the storey top). */
const DOOR_HEAD_FT = 7;
/** Window clear opening width, feet. */
const WINDOW_FT = 3;
/** Window sill height, feet (sill box fills floor → here). */
const SILL_FT = 3;
/** Window head height, feet (head box fills here → storey top). */
const WINDOW_HEAD_FT = 6.5;
/** Stair flight footprint, feet. */
const STAIR_FT = 4;
/** Number of rises in a stair flight (steps per storey). */
const STAIR_STEPS = 11;

export type MeshBoxKind =
  | 'wall' | 'jamb' | 'door-lintel' | 'sill' | 'window-head' | 'window-pane'
  | 'floor' | 'ceiling' | 'stair'
  // Roof dressing (Task 5): a chimney flue rising above the roof, and a dormer
  // box seated on a sloped plane. Both live above wallTopFt (z0 ≥ wallTopFt-ish).
  | 'chimney' | 'dormer';

/** One axis-aligned box in PLAN FEET: x/y = footprint center (blueprint
 *  frame, origin at the footprint's 0,0 corner), w/d = extents, z0/h =
 *  vertical base + height (z0 < 0 for basement geometry). */
export interface MeshBox {
  kind: MeshBoxKind;
  /** For wall-derived boxes: which wall family the box belongs to. */
  wallKind?: 'outer' | 'inner';
  /** For wall-derived boxes: the run's outward normal (see WallRun.nx/ny). */
  nx?: number; ny?: number;
  x: number; y: number;
  w: number; d: number;
  z0: number; h: number;
}

export interface BuildingFloorMeshData {
  level: number;
  /** Slab base elevation, feet ( = level * storeyHeightFt). */
  baseZFt: number;
  /** Number of merged outer wall RUNS on this floor (NOT 5 ft fragments). */
  outerWallSegments: number;
  /** Number of merged inner wall RUNS on this floor. */
  innerWallSegments: number;
  /** Door openings cut into this floor's walls ( = plan doors). */
  doorOpenings: number;
  /** Window voids cut into this floor's walls ( = plan windows). */
  windowOpenings: number;
  /** Footprint cells SKIPPED in this level's floor slab so the stair from
   *  the level below rises through. Empty when nothing joins from below. */
  stairHoleCells: Cell[];
  boxes: MeshBox[];
}

export interface BuildingMeshData {
  storeyHeightFt: number;
  floors: BuildingFloorMeshData[];
}

/** Box for a stretch of a wall run: [alongLo, alongHi] on the run's line,
 *  centered on the grid line then offset t/2 OUTWARD along the normal. */
function runBox(
  run: Pick<WallRun, 'axis' | 'thicknessFt' | 'nx' | 'ny'> & { line: number },
  alongLo: number, alongHi: number, z0: number, h: number,
  kind: MeshBoxKind, thickness = run.thicknessFt,
): MeshBox {
  const mid = (alongLo + alongHi) / 2;
  const len = alongHi - alongLo;
  const base = { kind, z0, h, nx: run.nx, ny: run.ny } as const;
  return run.axis === 'y'
    ? { ...base, x: run.line + run.nx * (run.thicknessFt / 2), y: mid, w: thickness, d: len }
    : { ...base, x: mid, y: run.line + run.ny * (run.thicknessFt / 2), w: len, d: thickness };
}

/** Fixed grid-line coordinate of a run ('y' runs sit on an x line). */
const runLine = (r: WallRun): number => (r.axis === 'y' ? r.x1 : r.y1);
/** Along-span of a run (endpoints are ordered ascending by mergeWallRuns). */
const runSpan = (r: WallRun): [number, number] =>
  r.axis === 'y' ? [r.y1, r.y2] : [r.x1, r.x2];

/**
 * Deterministic ascent direction for a stair flight rising FROM `floor`.
 * The blueprint stores no orientation, so derive it: find the room that owns
 * the stair cell, then from that cell measure how many contiguous free
 * room-cells extend along each of the four axis directions (staying inside the
 * SAME room, never re-entering the stair cell). Ascend toward the largest free
 * extent — the run has room to climb. Ties break by axis ('x' before 'y') then
 * positive before negative direction. Returns a unit (dx, dy) cell delta.
 */
function stairAscentDir(
  floor: BlueprintFloor,
  stairCx: number,
  stairCy: number,
): { dx: number; dy: number } {
  const room = floor.rooms.find((r) =>
    r.cells.some((c) => c.cx === stairCx && c.cy === stairCy));
  // Directions in tie-break priority order: +x, -x, +y, -y (axis, then sign).
  const dirs: Array<{ dx: number; dy: number }> = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];
  if (!room) return dirs[0];
  const inRoom = new Set(room.cells.map((c) => cellKey(c.cx, c.cy)));
  const freeExtent = (dx: number, dy: number): number => {
    let n = 0, x = stairCx + dx, y = stairCy + dy;
    while (inRoom.has(cellKey(x, y))) { n += 1; x += dx; y += dy; }
    return n;
  };
  let best = dirs[0];
  let bestExtent = -1;
  for (const d of dirs) {
    const e = freeExtent(d.dx, d.dy);
    if (e > bestExtent) { bestExtent = e; best = d; }
  }
  return best;
}

/** Build the render-ready box list for one BlueprintPlan. Pure + deterministic. */
export function buildBuildingMeshData(
  plan: BlueprintPlan,
  opts: { storeyHeightFt?: number } = {},
): BuildingMeshData {
  const storeyFt = opts.storeyHeightFt ?? BLUEPRINT_STOREY_FT;
  const headFt = Math.min(DOOR_HEAD_FT, storeyFt - 0.5);
  const sillFt = Math.min(SILL_FT, storeyFt / 3);
  const winHeadFt = Math.min(WINDOW_HEAD_FT, storeyFt - 0.5);
  const topLevel = Math.max(...plan.floors.map((f) => f.level));
  const footprint = new Set(plan.footprintCells.map((c) => cellKey(c.cx, c.cy)));

  const floors = plan.floors.map((floor: BlueprintFloor): BuildingFloorMeshData => {
    const baseZ = floor.level * storeyFt;
    const boxes: MeshBox[] = [];

    // ── Floor slab from footprintCells, with a stair HOLE where a stair
    // rises from the level below (basement stair pierces the ground slab).
    const holeKeys = new Set<string>();
    const stairHoleCells: Cell[] = [];
    for (const s of plan.stairs) {
      if (s.fromLevel !== floor.level - 1) continue;
      const cell = { cx: Math.floor(s.x / CELL_FT), cy: Math.floor(s.y / CELL_FT) };
      holeKeys.add(`${cell.cx},${cell.cy}`);
      stairHoleCells.push(cell);
    }
    for (const c of plan.footprintCells) {
      if (holeKeys.has(`${c.cx},${c.cy}`)) continue;
      boxes.push({
        kind: 'floor',
        x: (c.cx + 0.5) * CELL_FT, y: (c.cy + 0.5) * CELL_FT,
        w: CELL_FT, d: CELL_FT, z0: baseZ, h: SLAB_FT,
      });
    }

    // ── Corner joints (Fix B): outer runs grow OUTWARD from their grid line and
    // stop at their span ends, so at a convex corner the two perpendicular outer
    // runs leave an open notch (thickness × thickness) into the wall. Close it by
    // extending ONE of the two runs at the shared endpoint — deterministically
    // the axis-'x' run — by the perpendicular run's OUTWARD thickness, in the
    // direction the 'y' run's thickness grows (its nx). Concave corners never
    // share an endpoint this way, so they are not double-filled.
    const outerRuns = floor.wallRuns.filter((w: WallRun) => w.kind === 'outer');
    const yRunsOuter = outerRuns.filter((w) => w.axis === 'y');
    // Per x-run (keyed by identity index), the extra span to add at lo / hi.
    const xExtend = new Map<WallRun, { lo: number; hi: number }>();
    for (const xr of outerRuns) {
      if (xr.axis !== 'x') continue;
      let extLo = 0, extHi = 0;
      // Endpoints of the x-run: (x1, y1) and (x2, y1).
      for (const yr of yRunsOuter) {
        const shareAtX1 = Math.abs(yr.x1 - xr.x1) < 1e-6 &&
          (Math.abs(yr.y1 - xr.y1) < 1e-6 || Math.abs(yr.y2 - xr.y1) < 1e-6);
        const shareAtX2 = Math.abs(yr.x1 - xr.x2) < 1e-6 &&
          (Math.abs(yr.y1 - xr.y1) < 1e-6 || Math.abs(yr.y2 - xr.y1) < 1e-6);
        // Extend by the y-run's thickness in ITS outward x direction (nx). The
        // notch sits where the y-run's wall grows past the x-run's end.
        if (shareAtX1 && yr.nx < 0) extLo = Math.max(extLo, yr.thicknessFt);
        if (shareAtX2 && yr.nx > 0) extHi = Math.max(extHi, yr.thicknessFt);
      }
      if (extLo !== 0 || extHi !== 0) xExtend.set(xr, { lo: extLo, hi: extHi });
    }

    // ── Walls: one box per run stretch, split around window voids.
    let windowOpenings = 0;
    for (const run of floor.wallRuns) {
      const line = runLine(run);
      let [lo, hi] = runSpan(run);
      // Apply the corner-joint extension (Fix B) to outer x-runs. Windows never
      // sit at a run's extreme end (they keep door/corner clearance), so the
      // widened stretch is always the first/last plain wall box.
      const ext = xExtend.get(run);
      if (ext) { lo -= ext.lo; hi += ext.hi; }
      const r = { axis: run.axis, thicknessFt: run.thicknessFt, nx: run.nx, ny: run.ny, line };
      const wins = floor.windows
        .filter((wv: BlueprintWindow) => {
          if (wv.axis !== run.axis) return false;
          const fixed = run.axis === 'y' ? wv.x : wv.y;
          const along = run.axis === 'y' ? wv.y : wv.x;
          return fixed === line && along > lo && along < hi;
        })
        .map((wv) => (run.axis === 'y' ? wv.y : wv.x))
        .sort((a, b) => a - b);
      let cursor = lo;
      for (const at of wins) {
        const a = at - WINDOW_FT / 2;
        const b = at + WINDOW_FT / 2;
        if (a > cursor) boxes.push({ ...runBox(r, cursor, a, baseZ, storeyFt, 'wall'), wallKind: run.kind });
        // Vertical 3-box split: sill below, head above, glazed pane in the void.
        boxes.push({ ...runBox(r, a, b, baseZ, sillFt, 'sill'), wallKind: run.kind });
        boxes.push({ ...runBox(r, a, b, baseZ + winHeadFt, storeyFt - winHeadFt, 'window-head'), wallKind: run.kind });
        boxes.push({ ...runBox(r, a, b, baseZ + sillFt, winHeadFt - sillFt, 'window-pane', run.thicknessFt * 0.4), wallKind: run.kind });
        windowOpenings += 1;
        cursor = b;
      }
      if (hi > cursor) boxes.push({ ...runBox(r, cursor, hi, baseZ, storeyFt, 'wall'), wallKind: run.kind });
    }

    // ── Door cells: runs already break at doors (door edges emit no wall),
    // so fill each door cell with jamb reveals flanking a 3 ft clear opening
    // and a lintel from the door head to the storey top. Thickness + normal
    // derive from the DOOR'S OWN cell edge — never borrowed from a collinear
    // run (a door can consume an entire one-cell run, and on notched shells
    // the nearest run's normal can point the wrong way). The two cells
    // flanking the edge decide everything: exactly one outside the footprint
    // ⇒ OUTER wall, outward normal toward the outside cell; both inside ⇒
    // INNER wall, normal along +axis (the wall scan's emission rule: inner
    // edges are always claimed by the lower-coordinate cell).
    for (const door of floor.doors) {
      const line = door.axis === 'y' ? door.x : door.y;
      const along = door.axis === 'y' ? door.y : door.x;
      const cLine = Math.round(line / CELL_FT);
      const cAlong = Math.floor(along / CELL_FT);
      const negCell = door.axis === 'y'
        ? cellKey(cLine - 1, cAlong) : cellKey(cAlong, cLine - 1);
      const posCell = door.axis === 'y'
        ? cellKey(cLine, cAlong) : cellKey(cAlong, cLine);
      const inNeg = footprint.has(negCell);
      const inPos = footprint.has(posCell);
      if (!inNeg && !inPos) {
        throw new Error(
          `buildBuildingMeshData: door at (${door.x},${door.y}) axis ${door.axis} ` +
          `on level ${floor.level} borders no footprint cell (contradictory plan)`,
        );
      }
      const isOuter = inNeg !== inPos;
      if (!isOuter && (door.a === EXTERIOR || door.b === EXTERIOR)) {
        throw new Error(
          `buildBuildingMeshData: entry door at (${door.x},${door.y}) axis ${door.axis} ` +
          `on level ${floor.level} sits between two footprint cells (contradictory plan)`,
        );
      }
      // Outer: outward = from the inside cell toward the outside one (for
      // entry doors this equals -openDir, since entries open inward).
      const sign = isOuter ? (inNeg ? 1 : -1) : 1;
      const thicknessFt = isOuter ? OUTER_THICKNESS_FT : INNER_THICKNESS_FT;
      const wallKind = isOuter ? 'outer' as const : 'inner' as const;
      const r = door.axis === 'y'
        ? { axis: 'y' as const, thicknessFt, nx: sign, ny: 0, line }
        : { axis: 'x' as const, thicknessFt, nx: 0, ny: sign, line };
      const a = along - DOOR_CLEAR_FT / 2;
      const b = along + DOOR_CLEAR_FT / 2;
      boxes.push({ ...runBox(r, a - DOOR_JAMB_FT, a, baseZ, storeyFt, 'jamb'), wallKind });
      boxes.push({ ...runBox(r, b, b + DOOR_JAMB_FT, baseZ, storeyFt, 'jamb'), wallKind });
      boxes.push({ ...runBox(r, a, b, baseZ + headFt, storeyFt - headFt, 'door-lintel'), wallKind });
    }

    // ── Stair flight rising FROM this level toward the next. A real straight
    // run: STAIR_STEPS stacked treads climbing from floor level to the next
    // slab, within the STAIR_FT shaft footprint, marching along the ascent
    // direction (largest free room extent from the shaft cell — see
    // stairAscentDir). Each step's box rises from the floor to its own tread
    // top, so the flight reads as a solid staircase from the side.
    for (const s of plan.stairs) {
      if (s.fromLevel !== floor.level) continue;
      const stairCx = Math.floor(s.x / CELL_FT);
      const stairCy = Math.floor(s.y / CELL_FT);
      const { dx, dy } = stairAscentDir(floor, stairCx, stairCy);
      const cellLo = { x: stairCx * CELL_FT, y: stairCy * CELL_FT };
      // Shaft footprint centered in the cell (STAIR_FT wide within 5 ft cell).
      const inset = (CELL_FT - STAIR_FT) / 2;
      const runLo = (dx !== 0 ? cellLo.x : cellLo.y) + inset;
      const stepDepth = STAIR_FT / STAIR_STEPS; // along the ascent axis
      const riseH = storeyFt / STAIR_STEPS;
      // Perpendicular (fixed) span of the flight = the full shaft width.
      const perpMid = dx !== 0 ? s.y : s.x;
      const sign = dx + dy; // exactly one of dx/dy is ±1
      for (let i = 0; i < STAIR_STEPS; i++) {
        // `i` counts treads from the LOW end of the flight upward. Its slot
        // along the run is placed in the ascent direction (sign): for +sign the
        // low step sits at runLo; for -sign it sits at the high-along end, so
        // the flight always climbs toward the ascent direction. Box fills
        // floor → tread top so the side profile is a solid staircase.
        const slot = sign > 0 ? i : STAIR_STEPS - 1 - i;
        const alongMid = runLo + slot * stepDepth + stepDepth / 2;
        const topH = (i + 1) * riseH;
        boxes.push(
          dx !== 0
            ? { kind: 'stair', x: alongMid, y: perpMid, w: stepDepth, d: STAIR_FT, z0: baseZ, h: topH }
            : { kind: 'stair', x: perpMid, y: alongMid, w: STAIR_FT, d: stepDepth, z0: baseZ, h: topH },
        );
      }
    }

    // ── Ceiling: only the TOP level caps itself — every other ceiling IS the
    // next level's floor slab (which carries the stair holes).
    if (floor.level === topLevel) {
      for (const c of plan.footprintCells) {
        boxes.push({
          kind: 'ceiling',
          x: (c.cx + 0.5) * CELL_FT, y: (c.cy + 0.5) * CELL_FT,
          w: CELL_FT, d: CELL_FT, z0: baseZ + storeyFt - SLAB_FT, h: SLAB_FT,
        });
      }
    }

    return {
      level: floor.level,
      baseZFt: baseZ,
      outerWallSegments: floor.wallRuns.filter((w: WallRun) => w.kind === 'outer').length,
      innerWallSegments: floor.wallRuns.filter((w: WallRun) => w.kind === 'inner').length,
      doorOpenings: floor.doors.length,
      windowOpenings,
      stairHoleCells,
      boxes,
    };
  });

  return { storeyHeightFt: storeyFt, floors };
}

/* ════════════════════════════════════════════════════════════════════════
 * Task 5 (BGv2 Phase 1B) — raise the solved roof.
 *
 * buildRoofMeshData turns a RoofPlan (from roofPlan.solveRoof, populated on a
 * BlueprintPlan when a StyleContext is passed) into pure render data:
 *   - tris: a single ChunkGeometryArrays of triangulated roof PLANES (fan
 *     triangulation of each convex n-gon) PLUS every tower cap as a pyramid /
 *     cone tri-fan (apex at wallTopFt + apexFt). Y = wallTopFt + plane-z, so the
 *     whole roof sits on the wall top. Built with the same faceted `fromTris`
 *     the legacy prism uses (flat normals, both windings).
 *   - chimneyBoxes: one MeshBox kind 'chimney' per chimney — a ~2 ft square flue
 *     rising from just under the roof surface at (x,y) up to wallTopFt + topFt.
 *   - dormerBoxes: one MeshBox kind 'dormer' per dormer — a small box seated on
 *     the roof surface at (x,y), carrying the piercing plane's outward normal
 *     (nx/ny) so the consumer can orient the gablet.
 *
 * PLAN FEET throughout (the worldforge frame), z lifted by wallTopFt. Pure +
 * deterministic — a straight walk of the plan arrays. No three.js. The three
 * consumer (interiorParts) converts feet → meters and colors the group.
 * ════════════════════════════════════════════════════════════════════════ */

/** Chimney flue plan size, feet (≈ 2 ft square masonry stack). */
const CHIMNEY_FT = 2;
/** Dormer box plan size, feet (a small gablet mass on the slope). */
const DORMER_W_FT = 4;
const DORMER_D_FT = 3;
/** Dormer box height above the slope it seats on, feet. */
const DORMER_H_FT = 3;

export interface RoofMeshData {
  /** Triangulated roof planes + tower cap fans, Y = wallTopFt + plane z. */
  tris: ChunkGeometryArrays;
  /** Masonry flues, PLAN FEET, z0 < top = wallTopFt + chimney.topFt. */
  chimneyBoxes: MeshBox[];
  /** Gablet masses seated on the slope, carrying the piercing plane's normal. */
  dormerBoxes: MeshBox[];
}

/** Highest roof-plane z ABOVE wall-top covering (x,y); 0 (eave/flat) if none. */
function localRoofZ(planes: RoofPlane[], x: number, y: number): number {
  let best = 0;
  for (const p of planes) {
    if (pointInPolyXY(x, y, p.pts)) best = Math.max(best, planeZAt(p, x, y));
  }
  return best;
}

/** point-in-polygon (XY) — even-odd ray cast, mirrors roofPlan's helper. */
function pointInPolyXY(px: number, py: number, pts: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Evaluate a plane's z at (x,y) via a planar fit from three corners. */
function planeZAt(plane: RoofPlane, x: number, y: number): number {
  const p = plane.pts;
  if (p.length < 3) return p[0]?.[2] ?? 0;
  const [ax, ay, az] = p[0];
  for (let i = 1; i < p.length; i++) {
    const [bx, by, bz] = p[i];
    for (let j = i + 1; j < p.length; j++) {
      const [cx, cy, cz] = p[j];
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(det) < 1e-9) continue;
      const dx = x - ax, dy = y - ay;
      const s = (dx * (cy - ay) - dy * (cx - ax)) / det;
      const t = (dy * (bx - ax) - dx * (by - ay)) / det;
      return az + s * (bz - az) + t * (cz - az);
    }
  }
  return az;
}

/**
 * Roof plan → pure render data (triangles + chimney/dormer boxes), PLAN FEET,
 * z lifted by wallTopFt. Deterministic.
 */
export function buildRoofMeshData(roof: RoofPlan, wallTopFt: number): RoofMeshData {
  const P: number[][] = [];
  const tris: number[][] = [];

  // ── Roof planes: fan-triangulate each convex n-gon; lift z by wallTopFt. ──
  for (const plane of roof.planes) {
    const base = P.length;
    // Map plan (x, y, zAboveWallTop) → mesh (x, Y=wallTopFt+z, z=y): Y is up.
    for (const [x, y, z] of plane.pts) P.push([x, wallTopFt + z, y]);
    // Fan-triangulate the convex n-gon: [base, base+i, base+i+1].
    for (let i = 1; i + 1 < plane.pts.length; i++) tris.push([base, base + i, base + i + 1]);
  }

  // ── Tower caps: pyramid (rect base) or cone-as-pyramid, apex above wall-top. ──
  for (const cap of roof.towerCaps) {
    const { x, y, w, d, apexFt } = cap;
    const base = P.length;
    // Base ring at the roof-local z where the cap meets the mass (0 above the
    // wall top — the tower's own walls carry it there) and the apex at apexFt.
    P.push(
      [x, wallTopFt, y],           // 0 base NW
      [x + w, wallTopFt, y],       // 1 base NE
      [x + w, wallTopFt, y + d],   // 2 base SE
      [x, wallTopFt, y + d],       // 3 base SW
      [x + w / 2, wallTopFt + apexFt, y + d / 2], // 4 apex
    );
    tris.push([base, base + 1, base + 4], [base + 1, base + 2, base + 4],
              [base + 2, base + 3, base + 4], [base + 3, base, base + 4]);
  }

  // ── Chimneys: a flue box rising from just under the local roof surface to
  // wallTopFt + topFt. Seat the base a little BELOW the roof so the stack
  // pierces the surface (no floating gap at the roof line). ──
  const chimneyBoxes: MeshBox[] = roof.chimneys.map((c) => {
    const surfaceZ = wallTopFt + localRoofZ(roof.planes, c.x, c.y);
    const top = wallTopFt + c.topFt;
    const z0 = Math.min(surfaceZ - 0.5, top - 0.5); // start below the surface
    return {
      kind: 'chimney' as const,
      x: c.x, y: c.y, w: CHIMNEY_FT, d: CHIMNEY_FT,
      z0, h: top - z0,
    };
  });

  // ── Dormers: a small gablet mass seated on the slope at (x,y), carrying the
  // piercing plane's outward normal so the consumer can face it downslope. ──
  const dormerBoxes: MeshBox[] = roof.dormers.map((dm) => {
    const surfaceZ = wallTopFt + localRoofZ(roof.planes, dm.x, dm.y);
    return {
      kind: 'dormer' as const,
      nx: dm.nx, ny: dm.ny,
      x: dm.x, y: dm.y, w: DORMER_W_FT, d: DORMER_D_FT,
      z0: surfaceZ, h: DORMER_H_FT,
    };
  });

  return { tris: fromTris(P, tris), chimneyBoxes, dormerBoxes };
}