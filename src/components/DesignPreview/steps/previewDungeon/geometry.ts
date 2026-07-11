/**
 * @file previewDungeon/geometry.ts
 * @description Pure, deterministic plan/grid helpers for the dungeon sheet
 * (extracted verbatim from PreviewDungeon.tsx): the rendering hash (hash2),
 * dug-tunnel and corridor-tier reconstruction, cell-contour tracing + Chaikin
 * smoothing, the WS6 scar depth/proximity fields, hex mixing, and the keyed-room
 * query. No canvas, no React — deterministic functions over a DungeonPlan.
 */
import { CellKind, type DungeonPlan, type DungeonRoom } from '../../../../systems/worldforge/dungeon/types';

/** Deterministic hash in [0, 1) for rendering-only variation. */
export function hash2(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 1274126177) | 0;
  h = ((h ^ (h >>> 13)) * 1103515245) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Reconstructs which corridor cells were DUG (hand-cut robber tunnels) rather
 * than built. Keys on `edge.dug`, NOT `isLoop`: a BUILT cross-cut (a mason's
 * loop door) is a cycle edge too but must render as a CLEAN built door, so only
 * `dug` edges get the rough hand-cut treatment. For each dug edge, BFS through
 * corridor cells that touch no third room — corridors each join exactly two
 * rooms, so the only corridor route between the pair is the tunnel itself.
 */
export function computeTunnelCells(plan: DungeonPlan): Set<number> {
  const { W, H, grid, corridor, rooms, edges, cellFt } = plan;
  const result = new Set<number>();
  const loopEdges = edges.filter((e) => e.dug);
  if (loopEdges.length === 0) return result;

  // roomId per room-floor cell (corridor cells stay -1).
  const roomIdOf = new Int16Array(W * H).fill(-1);
  for (const r of rooms) {
    const x0 = Math.round(r.x / cellFt);
    const y0 = Math.round(r.y / cellFt);
    const x1 = x0 + Math.round(r.w / cellFt);
    const y1 = y0 + Math.round(r.h / cellFt);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x;
        if (grid[i] === CellKind.Floor && corridor[i] === 0) roomIdOf[i] = r.id;
      }
    }
  }

  const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  const touching = (i: number): Set<number> => {
    const x = i % W;
    const y = (i / W) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const id = roomIdOf[ny * W + nx];
      if (id >= 0) s.add(id);
    }
    return s;
  };

  for (const e of loopEdges) {
    const passable = (i: number): boolean => {
      if (grid[i] !== CellKind.Floor || corridor[i] !== 1) return false;
      for (const id of touching(i)) if (id !== e.a && id !== e.b) return false;
      return true;
    };
    // starts: corridor cells hugging room a; goal test: hugging room b.
    const prev = new Int32Array(W * H).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (!passable(i)) continue;
      if (touching(i).has(e.a)) {
        prev[i] = -1;
        queue.push(i);
      }
    }
    let hit = -1;
    for (let q = 0; q < queue.length && hit === -1; q++) {
      const i = queue[q];
      if (touching(i).has(e.b)) {
        hit = i;
        break;
      }
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -2 || !passable(n)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    for (let c = hit; c >= 0; c = prev[c]) result.add(c);
  }
  return result;
}

/**
 * Corridor HIERARCHY tier per corridor cell (WS8) — so a sprawling network reads
 * with a legible spine instead of tangled same-weight spaghetti. Tier meaning:
 *   2 = ARTERIAL: the cell carries the entrance→boss critical spine (an edge on
 *       the critical path, OR a corridor run whose two rooms are consecutive on
 *       {@link DungeonPlan.criticalRoomIds}). Drawn heaviest — the eye's path.
 *   1 = THROUGH: a secondary passage joining two rooms both of which have graph
 *       degree > 1 (real circulation, not a stub). Medium weight.
 *   0 = SPUR: a dead-end run into a leaf room (degree-1). Lightest.
 * Attribution mirrors {@link computeTunnelCells}: flood each corridor component
 * (corridor cells touching no third room) between its two rooms and tag every
 * cell on that route. Pure/deterministic — no rng. Cells not on any two-room run
 * (rare junction cells touching 3+ rooms) default to THROUGH.
 */
export function computeCorridorTiers(plan: DungeonPlan): Uint8Array {
  const { W, H, grid, corridor, rooms, edges, cellFt } = plan;
  const tier = new Uint8Array(W * H); // default 0 (spur) for non-corridor cells

  // roomId per room-floor cell; degree per room; critical-path adjacency set.
  const roomIdOf = new Int16Array(W * H).fill(-1);
  const degreeOf = new Map<number, number>();
  for (const r of rooms) degreeOf.set(r.id, r.degree);
  for (const r of rooms) {
    const x0 = Math.round(r.x / cellFt);
    const y0 = Math.round(r.y / cellFt);
    const x1 = x0 + Math.round(r.w / cellFt);
    const y1 = y0 + Math.round(r.h / cellFt);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x;
        if (grid[i] === CellKind.Floor && corridor[i] === 0) roomIdOf[i] = r.id;
      }
    }
  }
  const critPair = new Set<number>();
  const crit = plan.criticalRoomIds;
  for (let i = 0; i + 1 < crit.length; i++) {
    critPair.add(crit[i] * 100000 + crit[i + 1]);
    critPair.add(crit[i + 1] * 100000 + crit[i]);
  }
  // an edge is arterial when flagged critical OR its endpoints are consecutive
  // on the critical room path.
  const isArterialEdge = (a: number, b: number, edgeCritical: boolean): boolean =>
    edgeCritical || critPair.has(a * 100000 + b);

  const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  const touching = (i: number): Set<number> => {
    const x = i % W;
    const y = (i / W) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const id = roomIdOf[ny * W + nx];
      if (id >= 0) s.add(id);
    }
    return s;
  };
  const isCorr = (i: number): boolean =>
    grid[i] === CellKind.Floor && corridor[i] === 1;

  // Default every corridor cell to THROUGH (1) so any cell we don't attribute to
  // a specific two-room run still reads as real circulation, not a spur.
  for (let i = 0; i < W * H; i++) if (isCorr(i)) tier[i] = 1;

  for (const e of edges) {
    const arterial = isArterialEdge(e.a, e.b, e.isCritical);
    const degA = degreeOf.get(e.a) ?? 2;
    const degB = degreeOf.get(e.b) ?? 2;
    // spur = a run into a leaf room (degree 1) that is NOT on the spine.
    const spur = !arterial && (degA <= 1 || degB <= 1);
    const t: number = arterial ? 2 : spur ? 0 : 1;
    // flood the corridor cells that connect ONLY e.a and e.b (its own run).
    const passable = (i: number): boolean => {
      if (!isCorr(i)) return false;
      for (const id of touching(i)) if (id !== e.a && id !== e.b) return false;
      return true;
    };
    const prev = new Int32Array(W * H).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (passable(i) && touching(i).has(e.a)) { prev[i] = -1; queue.push(i); }
    }
    let hit = -1;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (touching(i).has(e.b)) { hit = i; if (hit >= 0) break; }
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -2 || !passable(n)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    // Promote every cell on the found route to this edge's tier (max wins, so a
    // shared cell keeps the strongest role — arterial beats through beats spur).
    for (let c = hit; c >= 0; c = prev[c]) if (t > tier[c]) tier[c] = t;
  }
  return tier;
}

/** A cell-corner lattice point (integer grid vertex). */
interface Vtx { x: number; y: number }
/** An ordered boundary polyline in cell-corner space; `closed` = returns to start. */
interface Contour { pts: Vtx[]; closed: boolean }

/**
 * Traces the wall-facing outline of a set of cells into ordered contours by
 * stitching directed cell-face edges head-to-tail. A face is emitted only where
 * the neighbor is NOT part of `member` AND not `skip` (corridor mouths break the
 * loop, leaving an open arc at the opening — exactly where a cave wall should
 * stop). Interior-on-the-right clockwise winding chains adjacent faces into
 * loops; open chains fall out where the ring was broken. Coordinates are in
 * CELLS (multiply by the cell size to draw). This is what lets an "organic" room
 * read as one continuous inked wall instead of a raster staircase.
 */
export function traceContours(
  W: number,
  H: number,
  member: (x: number, y: number) => boolean,
  skip: (x: number, y: number) => boolean,
): Contour[] {
  // Directed edges keyed by their START vertex for O(1) head-to-tail stitching.
  const key = (x: number, y: number): number => y * (W + 1) + x;
  const byStart = new Map<number, { ex: number; ey: number }[]>();
  const push = (sx: number, sy: number, ex: number, ey: number): void => {
    const k = key(sx, sy);
    const arr = byStart.get(k);
    if (arr) arr.push({ ex, ey });
    else byStart.set(k, [{ ex, ey }]);
  };
  const wall = (x: number, y: number): boolean => !member(x, y) && !skip(x, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!member(x, y)) continue;
      // clockwise per cell: top, right, bottom, left — emit wall-facing faces.
      if (wall(x, y - 1)) push(x, y, x + 1, y);
      if (wall(x + 1, y)) push(x + 1, y, x + 1, y + 1);
      if (wall(x, y + 1)) push(x + 1, y + 1, x, y + 1);
      if (wall(x - 1, y)) push(x, y + 1, x, y);
    }
  }
  const contours: Contour[] = [];
  const takeFrom = (kx: number, ky: number): { ex: number; ey: number } | null => {
    const arr = byStart.get(key(kx, ky));
    if (!arr || arr.length === 0) return null;
    return arr.pop() ?? null;
  };
  // Prefer starting chains at a vertex that is a genuine loose END (a mouth),
  // so open arcs come out whole; leftovers are closed loops.
  const starts: number[] = [];
  for (const k of byStart.keys()) starts.push(k);
  for (const startK of starts) {
    let arr = byStart.get(startK);
    while (arr && arr.length > 0) {
      const pts: Vtx[] = [];
      let cx = (startK % (W + 1));
      let cy = (startK / (W + 1)) | 0;
      pts.push({ x: cx, y: cy });
      let closed = false;
      for (let guard = 0; guard < W * H * 4 + 16; guard++) {
        const nxt = takeFrom(cx, cy);
        if (!nxt) break;
        cx = nxt.ex;
        cy = nxt.ey;
        if (cx === (startK % (W + 1)) && cy === ((startK / (W + 1)) | 0)) { closed = true; break; }
        pts.push({ x: cx, y: cy });
      }
      if (pts.length >= 2) contours.push({ pts, closed });
      arr = byStart.get(startK);
    }
  }
  return contours;
}

/**
 * Collapses a cell-staircase contour into a hand-drawn curve. Two Chaikin
 * corner-cut passes round the 90° jogs; the result is fed to the caller as
 * control points for a quadratic-through-midpoints stroke. Keeps endpoints of
 * OPEN arcs pinned (a mouth shouldn't drift) while smoothing everything between.
 */
export function chaikin(pts: Vtx[], closed: boolean, passes: number): Vtx[] {
  let out = pts;
  for (let p = 0; p < passes; p++) {
    const n = out.length;
    if (n < 3) break;
    const next: Vtx[] = [];
    if (!closed) next.push(out[0]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) next.push(out[n - 1]);
    out = next;
  }
  return out;
}

// ── WS6 overlay intensity fields ─────────────────────────────────────────────
// A scar (water/rubble/scorch/bloom) must read with DEPTH and ORIGIN, not as a
// flat tint. These pure helpers turn the per-cell `overlay` mask into distance
// fields the drawer paints gradients + contours from — all deterministic (a BFS
// over the seed-fixed grid), never Math.random. Cell index = y*W + x.

/**
 * For every cell whose overlay === `kind` (and which is floor), the chebyshev
 * distance (in cells) OUT to the nearest cell that is NOT this scar — i.e. how
 * deep into the body a cell sits. Shore cells = 1, the deep centre = the max.
 * `maxDepth` is the largest value seen. Returns a Float32 field over W*H (0 off
 * the body) plus that max, so the drawer can normalize shallow→deep.
 */
export function scarDepthField(
  W: number,
  H: number,
  isKind: (x: number, y: number) => boolean,
): { depth: Float32Array; maxDepth: number } {
  const depth = new Float32Array(W * H);
  const q: number[] = [];
  // Seed the BFS at shore cells (a scar cell with a non-scar 4-neighbor).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isKind(x, y)) continue;
      const shore =
        !isKind(x, y - 1) || !isKind(x, y + 1) || !isKind(x - 1, y) || !isKind(x + 1, y);
      if (shore) { depth[y * W + x] = 1; q.push(y * W + x); }
    }
  }
  let maxDepth = q.length > 0 ? 1 : 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % W;
    const y = (i / W) | 0;
    const d = depth[i];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!isKind(nx, ny)) continue;
      const ni = ny * W + nx;
      if (depth[ni] !== 0) continue;
      depth[ni] = d + 1;
      if (d + 1 > maxDepth) maxDepth = d + 1;
      q.push(ni);
    }
  }
  return { depth, maxDepth };
}

/**
 * Multi-source BFS proximity field: for every scar cell, the cell distance to the
 * NEAREST seed cell in `sources` (0 at a seed, growing outward, staying inside the
 * scar). Used to intensify scorch/bloom toward their epicentre (the fire's near-
 * hall source cell, the bloom's deep seed room). Cells not reached stay -1.
 */
export function scarProximityField(
  W: number,
  H: number,
  isKind: (x: number, y: number) => boolean,
  sources: number[],
): Float32Array {
  const prox = new Float32Array(W * H).fill(-1);
  const q: number[] = [];
  for (const s of sources) {
    if (s >= 0 && s < W * H && prox[s] === -1) { prox[s] = 0; q.push(s); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % W;
    const y = (i / W) | 0;
    const d = prox[i];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!isKind(nx, ny)) continue;
      const ni = ny * W + nx;
      if (prox[ni] !== -1) continue;
      prox[ni] = d + 1;
      q.push(ni);
    }
  }
  return prox;
}

/** Blend two `#rrggbb` hexes by t∈[0,1] → `#rrggbb`. Used to ramp water depth. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** The numbered rooms: exactly those an event touched (they carry a note),
 * in map-key order (shallow → deep). Shared by the drawer and the notes list. */
export function keyedRooms(plan: DungeonPlan): DungeonRoom[] {
  return plan.rooms
    .filter((r) => r.note !== undefined)
    .sort((a, b) => a.depth - b.depth || a.id - b.id);
}
