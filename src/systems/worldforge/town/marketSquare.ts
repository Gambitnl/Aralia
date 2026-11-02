/**
 * @file marketSquare.ts — what stands on a town's market square (GG-586).
 *
 * WHY THIS EXISTS (Remy 2026-11-02, Hafting: "we need a market square to be
 * implemented"). The market square was one bare tan block in the middle of the
 * town: the plaza ward's block with nothing on it. A real market square holds
 * stalls in rows with lanes between them, a well, a market cross or a fountain,
 * and in a larger town a market hall, a weigh house and a pillory. Shops and
 * inns face it, and the streets come into it at its corners and sides.
 *
 * This module decides what the square holds and where each piece stands. It
 * uses the civic-grounds record of GG-566 (`civicKind: 'plaza'`, set piece
 * `market`), so the paths that carry civic grounds to the 2D map and to the 3D
 * bake (GG-569) carry the market too. The town engine owns the square itself
 * (the plaza ward's block) and calls `buildMarketSquare` once its houses are final.
 *
 * The rules:
 *  - The town's size (typology) and its wealth band choose the pieces
 *    (`marketPieces`). Nothing is rolled: the same town gets the same market.
 *  - A walk runs round the inside of the square, so every shop that faces the
 *    square and every street that enters it opens onto clear paving.
 *  - The centerpiece stands at the most open point of the square. A lane from
 *    the main street's mouth to the centerpiece stays clear.
 *  - Stalls stand back to back in pairs of rows along the square's longest
 *    side, with an aisle between pairs and a cross aisle after every few stalls.
 *  - The stalls nearest the centerpiece fill first, up to a cap by size and
 *    wealth, and at least `MARKET_OPEN_SHARE_MIN` of the square stays open.
 *  - A stall whose customer side no walker can reach from a street is dropped
 *    (`marketReach`). Removing a stall never cuts off another stall, so one pass
 *    is enough.
 *
 * Pure numbers: no React, no three.js, no import of `townEngine` at run time.
 */
import { fnv1a, type SeedPath } from '../seedPath';
import { pointInPolygon, type Pt } from '../submap/submapEngine';
import { orientedRect, type CivicGrounds, type CivicGroundsFeature } from './civicGrounds';

/** A town's size class (as `TownTypology` in `townEngine`). */
export type MarketTypology = 'hamlet' | 'village' | 'walled town' | 'city' | 'capital';

/** A town's wealth band (as `VillagePersonality['wealth']`, see `townWealthBand`). */
export type MarketWealthBand = 'poor' | 'comfortable' | 'rich';

/** The pieces a market square holds. */
export interface MarketPieces {
  centerpiece: 'well' | 'market-cross' | 'fountain';
  /** Most stalls the square takes; the square's own room can allow fewer. */
  stallCap: number;
  /** A market hall (a covered market) at the far end of the square. */
  hall: boolean;
  /** A weigh house, where goods are weighed for the market toll. */
  weighHouse: boolean;
  /** A pillory, the town's public punishment, beside the centerpiece. */
  pillory: boolean;
}

/** Stall caps by size. A village holds a weekly market; a capital a daily one. */
const STALL_CAP: Record<MarketTypology, number> = {
  hamlet: 3, village: 6, 'walled town': 24, city: 40, capital: 64,
};
/** A poor town's market is thinner and a rich town's fuller. */
const STALL_CAP_BAND: Record<MarketWealthBand, number> = { poor: 0.7, comfortable: 1, rich: 1.3 };

/**
 * The pieces of a market square, from the town's size and wealth band.
 *  - centerpiece: a poor town draws water at a well; a comfortable town raises
 *    a market cross; a rich town builds a fountain. A village goes one step
 *    down (a well, or a cross when rich); a city never has less than a cross,
 *    and a capital always has a fountain.
 *  - a market hall: every city and capital, and a rich walled town.
 *  - a weigh house: a walled town that is not poor, every city and capital.
 *  - a pillory: every walled town, city and capital.
 */
export function marketPieces(typology: MarketTypology, band: MarketWealthBand): MarketPieces {
  const stallCap = Math.round(STALL_CAP[typology] * STALL_CAP_BAND[band]);
  switch (typology) {
    case 'hamlet':
    case 'village':
      return { centerpiece: band === 'rich' ? 'market-cross' : 'well', stallCap, hall: false, weighHouse: false, pillory: false };
    case 'walled town':
      return {
        centerpiece: band === 'rich' ? 'fountain' : band === 'comfortable' ? 'market-cross' : 'well',
        stallCap, hall: band === 'rich', weighHouse: band !== 'poor', pillory: true,
      };
    case 'city':
      return { centerpiece: band === 'poor' ? 'market-cross' : 'fountain', stallCap, hall: true, weighHouse: true, pillory: true };
    case 'capital':
      return { centerpiece: 'fountain', stallCap, hall: true, weighHouse: true, pillory: true };
  }
}

/** A stall's width along its row and its depth, in feet. */
export const STALL_WIDTH_FT = 10;
export const STALL_DEPTH_FT = 7;
/** Aisle between two pairs of rows, in feet: customers on both sides. */
export const MARKET_AISLE_FT = 12;
/** Cross aisle after every `MARKET_RUN_STALLS` stalls in a row, in feet. */
export const MARKET_CROSS_AISLE_FT = 8;
export const MARKET_RUN_STALLS = 4;
/** The clear walk round the inside of the square, in feet (a village green is smaller). */
export const MARKET_EDGE_WALK_FT = 16;
export const VILLAGE_EDGE_WALK_FT = 8;
/** The clear lane from the main street's mouth to the centerpiece, in feet. */
export const MARKET_LANE_FT = 16;
/** Clear paving round the centerpiece and round each building, in feet. */
export const MARKET_PIECE_CLEAR_FT = 10;
/** Least share of the square left open for walking. */
export const MARKET_OPEN_SHARE_MIN = 0.55;
/** Most of the square a market hall may cover. */
export const MARKET_HALL_SHARE_MAX = 0.18;
/** Cell size of the walk grid that tests reach, in feet. */
const WALK_CELL_FT = 2.5;

/** Footprints in feet: [across the square, along it]. */
const HALL_FT: Record<'walled town' | 'city' | 'capital', [number, number]> = {
  'walled town': [32, 52], city: [40, 64], capital: [50, 90],
};
const WEIGH_HOUSE_FT: [number, number] = [20, 26];
const PILLORY_FT: [number, number] = [5, 8];
/** Radius of the centerpiece in feet (a well's kerb, a cross's steps, a fountain's basin). */
const CENTERPIECE_RADIUS_FT: Record<MarketPieces['centerpiece'], number> = { well: 4, 'market-cross': 6, fountain: 10 };

/** A street that may lead walkers into the square. */
export interface MarketStreet {
  line: Pt[];
  /** Half the street's full width, plan units. */
  half: number;
}

export interface MarketSquareInput {
  wardIndex: number;
  /** The open square: the plaza ward's block. */
  square: Pt[];
  typology: MarketTypology;
  band: MarketWealthBand;
  /** Every street of the town except the passages to back courts and civic doors. */
  streets: MarketStreet[];
  /** Where the main street meets the square, if the town has one. */
  mainEnd?: Pt;
  unit: (ft: number) => number;
  seedPath: SeedPath;
}

// ── small geometry ─────────────────────────────────────────────────────────

function polyArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
}

function nearestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
  return [a[0] + t * vx, a[1] + t * vy];
}

/** Distance from `p` to a closed ring's boundary. */
export function distToRing(p: Pt, ring: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % ring.length]));
  return d;
}

/** The nearest point of a closed ring's boundary to `p`. */
export function nearestOnRing(p: Pt, ring: Pt[]): Pt {
  let best: Pt = ring[0], bd = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const q = nearestOnSeg(p, ring[i], ring[(i + 1) % ring.length]);
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

function distToLine(p: Pt, line: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < line.length - 1; i++) d = Math.min(d, segDist(p, line[i], line[i + 1]));
  return d;
}

/** Two convex polygons overlap (separating-axis test). */
function convexOverlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], ny = p[0] - q[0];
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const v of a) { const s = v[0] * nx + v[1] * ny; aMin = Math.min(aMin, s); aMax = Math.max(aMax, s); }
      for (const v of b) { const s = v[0] * nx + v[1] * ny; bMin = Math.min(bMin, s); bMax = Math.max(bMax, s); }
      if (aMax <= bMin || bMax <= aMin) return false;
    }
  }
  return true;
}

/** Grow a convex polygon outward from its centroid by `d` (a margin, not an exact offset). */
function grow(poly: Pt[], d: number): Pt[] {
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0]; cy += p[1]; }
  cx /= poly.length; cy /= poly.length;
  return poly.map((p) => {
    const dx = p[0] - cx, dy = p[1] - cy;
    const L = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / L) * d * Math.SQRT2, p[1] + (dy / L) * d * Math.SQRT2] as Pt;
  });
}

/** A regular octagon of radius `r` round `c`. */
function octagon(c: Pt, r: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

/** Every corner and edge midpoint of `poly` lies in `square`, `margin` or more from its edge. */
function insideWithMargin(poly: Pt[], square: Pt[], margin: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    for (const s of [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as Pt]) {
      if (!pointInPolygon(s, square) || distToRing(s, square) < margin) return false;
    }
  }
  return true;
}

// ── the walk grid ──────────────────────────────────────────────────────────

/** The square cut into walk cells; a cell is free when no piece covers its center. */
interface WalkGrid {
  minX: number; minY: number; cell: number; cols: number; rows: number;
  /** 0 = outside the square, 1 = free paving, 2 = under a piece. */
  state: Uint8Array;
}

function walkGrid(square: Pt[], cell: number, occupied: Pt[][]): WalkGrid {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of square) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell));
  const state = new Uint8Array(cols * rows);
  const boxes = occupied.map((poly) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of poly) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    return { poly, a, b, c, d };
  });
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const p: Pt = [minX + (k + 0.5) * cell, minY + (r + 0.5) * cell];
      if (!pointInPolygon(p, square)) continue;
      const covered = boxes.some((o) => p[0] >= o.a && p[0] <= o.c && p[1] >= o.b && p[1] <= o.d && pointInPolygon(p, o.poly));
      state[r * cols + k] = covered ? 2 : 1;
    }
  }
  return { minX, minY, cell, cols, rows, state };
}

function cellOf(g: WalkGrid, p: Pt): number {
  const k = Math.floor((p[0] - g.minX) / g.cell), r = Math.floor((p[1] - g.minY) / g.cell);
  return k >= 0 && k < g.cols && r >= 0 && r < g.rows ? r * g.cols + k : -1;
}

function cellCenter(g: WalkGrid, i: number): Pt {
  return [g.minX + ((i % g.cols) + 0.5) * g.cell, g.minY + (Math.floor(i / g.cols) + 0.5) * g.cell];
}

/**
 * Free cells a walker reaches from the streets. A walker comes in where the
 * square's edge lies within a street (its half width plus `slack`); when no
 * edge does (a village green set back from its street), the free edge cells
 * nearest a street are the way in.
 */
function reachFromStreets(g: WalkGrid, square: Pt[], streets: MarketStreet[], slack: number): Uint8Array {
  const seen = new Uint8Array(g.state.length);
  const edge: Array<{ i: number; d: number }> = [];
  for (let i = 0; i < g.state.length; i++) {
    if (g.state[i] !== 1) continue;
    const c = cellCenter(g, i);
    if (distToRing(c, square) > g.cell * 1.5) continue;
    const q = nearestOnRing(c, square);
    let d = Infinity;
    for (const s of streets) d = Math.min(d, distToLine(q, s.line) - s.half);
    edge.push({ i, d });
  }
  if (edge.length === 0) return seen;
  const best = Math.min(...edge.map((e) => e.d));
  const limit = Math.max(slack, best + g.cell);
  const queue: number[] = [];
  for (const e of edge) if (e.d <= limit) { seen[e.i] = 1; queue.push(e.i); }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h], k = i % g.cols, r = Math.floor(i / g.cols);
    const next = [k > 0 ? i - 1 : -1, k < g.cols - 1 ? i + 1 : -1, r > 0 ? i - g.cols : -1, r < g.rows - 1 ? i + g.cols : -1];
    for (const j of next) {
      if (j < 0 || seen[j] || g.state[j] !== 1) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

/** The customer side of a stall: the midpoint of corners 2 and 3, and its outward direction. */
export function stallFront(stall: Pt[]): { mid: Pt; out: Pt } {
  const mid: Pt = [(stall[2][0] + stall[3][0]) / 2, (stall[2][1] + stall[3][1]) / 2];
  const back: Pt = [(stall[0][0] + stall[1][0]) / 2, (stall[0][1] + stall[1][1]) / 2];
  const L = Math.hypot(mid[0] - back[0], mid[1] - back[1]) || 1;
  return { mid, out: [(mid[0] - back[0]) / L, (mid[1] - back[1]) / L] };
}

/** How a market square serves its walkers (the GG-586 measure). */
export interface MarketReach {
  stalls: number;
  /** Stalls whose customer side a walker reaches from a street. */
  reachedStalls: number;
  /** Share of the square's area that no piece covers. */
  openShare: number;
  /** Share of the free paving a walker reaches from a street. */
  reachedOpenShare: number;
  /** Nearest any stall comes to the square's edge, plan units (Infinity with no stall). */
  stallEdgeGap: number;
}

function stallReached(g: WalkGrid, seen: Uint8Array, stall: Pt[]): boolean {
  const { mid, out } = stallFront(stall);
  for (const step of [0.75, 1.5]) {
    const i = cellOf(g, [mid[0] + out[0] * g.cell * step, mid[1] + out[1] * g.cell * step]);
    if (i >= 0 && seen[i]) return true;
  }
  return false;
}

/** Measure a built market square: reach, open share, and the walk at its edge. */
export function marketReach(market: CivicGrounds, streets: MarketStreet[], unit: (ft: number) => number): MarketReach {
  const square = market.grounds;
  const occupied = market.features.map((f) => f.polygon);
  const g = walkGrid(square, unit(WALK_CELL_FT), occupied);
  const seen = reachFromStreets(g, square, streets, unit(6));
  const stalls = market.features.filter((f) => f.kind === 'stall');
  let free = 0, reachedFree = 0;
  for (let i = 0; i < g.state.length; i++) if (g.state[i] === 1) { free++; if (seen[i]) reachedFree++; }
  const area = polyArea(square);
  const covered = occupied.reduce((s, p) => s + polyArea(p), 0);
  let gap = Infinity;
  for (const s of stalls) for (const p of s.polygon) gap = Math.min(gap, distToRing(p, square));
  return {
    stalls: stalls.length,
    reachedStalls: stalls.filter((s) => stallReached(g, seen, s.polygon)).length,
    openShare: area > 0 ? 1 - covered / area : 0,
    reachedOpenShare: free > 0 ? reachedFree / free : 0,
    stallEdgeGap: gap,
  };
}

// ── the builder ────────────────────────────────────────────────────────────

/**
 * Lay out a market square. Returns null when the square is too small to hold
 * even its centerpiece. Deterministic: the same input gives the same market.
 */
export function buildMarketSquare(a: MarketSquareInput): CivicGrounds | null {
  const { square, unit } = a;
  if (square.length < 3) return null;
  const pieces = marketPieces(a.typology, a.band);
  const village = a.typology === 'village' || a.typology === 'hamlet';
  const walk = unit(village ? VILLAGE_EDGE_WALK_FT : MARKET_EDGE_WALK_FT);
  const clear = unit(MARKET_PIECE_CLEAR_FT);

  // The square's own frame: u along its longest side, v across it.
  let li = 0, lmax = -1;
  for (let i = 0; i < square.length; i++) {
    const p = square[i], q = square[(i + 1) % square.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L > lmax) { lmax = L; li = i; }
  }
  const e0 = square[li], e1 = square[(li + 1) % square.length];
  const u: Pt = [(e1[0] - e0[0]) / lmax, (e1[1] - e0[1]) / lmax];
  const v: Pt = [-u[1], u[0]];

  // The centerpiece stands at the most open point: the free cell farthest
  // from the square's edge (ties go to the cell nearest the middle).
  const g0 = walkGrid(square, unit(WALK_CELL_FT), []);
  let cx = 0, cy = 0;
  for (const p of square) { cx += p[0]; cy += p[1]; }
  cx /= square.length; cy /= square.length;
  let pole: Pt | null = null, poleD = -1, poleM = Infinity;
  for (let i = 0; i < g0.state.length; i++) {
    if (g0.state[i] !== 1) continue;
    const c = cellCenter(g0, i);
    const d = distToRing(c, square);
    const m = Math.hypot(c[0] - cx, c[1] - cy);
    if (d > poleD + 1e-9 || (Math.abs(d - poleD) <= 1e-9 && m < poleM)) { pole = c; poleD = d; poleM = m; }
  }
  const cpR = unit(CENTERPIECE_RADIUS_FT[pieces.centerpiece]);
  if (!pole || poleD < cpR + unit(2)) return null;
  const center = pole;
  const L = (p: Pt): [number, number] => [(p[0] - center[0]) * u[0] + (p[1] - center[1]) * u[1], (p[0] - center[0]) * v[0] + (p[1] - center[1]) * v[1]];
  const at = (lu: number, lv: number): Pt => [center[0] + u[0] * lu + v[0] * lv, center[1] + u[1] * lu + v[1] * lv];

  const features: CivicGroundsFeature[] = [];
  const centerpiece = pieces.centerpiece === 'market-cross' ? orientedRect(center, v, cpR * 2, cpR * 2) : octagon(center, cpR);
  features.push({ kind: pieces.centerpiece, polygon: centerpiece });
  // Kept clear: the paving round each piece, and the lane from the main street.
  const keepOut: Pt[][] = [octagon(center, cpR + clear)];
  let mouth: Pt | null = null;
  if (a.mainEnd) {
    mouth = nearestOnRing(a.mainEnd, square);
    const dx = center[0] - mouth[0], dy = center[1] - mouth[1];
    const dl = Math.hypot(dx, dy);
    if (dl > 1e-9) {
      const f: Pt = [dx / dl, dy / dl];
      keepOut.push(orientedRect([(mouth[0] + center[0]) / 2, (mouth[1] + center[1]) / 2], f, unit(MARKET_LANE_FT), dl));
    }
  }
  const fits = (poly: Pt[], margin = walk): boolean => insideWithMargin(poly, square, margin) && !keepOut.some((k) => convexOverlap(poly, k));
  const take = (kind: CivicGroundsFeature['kind'], poly: Pt[]): void => {
    features.push({ kind, polygon: poly });
    keepOut.push(grow(poly, clear));
  };

  // A building's spot: of every place on a 4 ft grid where it fits (either
  // way round), the one that scores highest. Ties keep the first found.
  const step = unit(4);
  const bestSpot = (w: number, d: number, score: (c: Pt) => number): Pt[] | null => {
    let best: Pt[] | null = null, bestS = -Infinity;
    for (let t = -lmax; t <= lmax; t += step) {
      for (let s = -lmax; s <= lmax; s += step) {
        const c = at(t, s);
        if (!pointInPolygon(c, square)) continue;
        const sc = score(c);
        if (sc <= bestS) continue;
        for (const face of [u, v]) {
          const poly = orientedRect(c, face, w, d);
          if (fits(poly)) { best = poly; bestS = sc; break; }
        }
      }
    }
    return best;
  };
  const centerOf = (poly: Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  // The market hall stands as far from the main street's mouth as the square
  // allows (from its middle, with no main street); it shrinks to fit.
  const from = mouth ?? center;
  let hall: Pt[] | null = null;
  if (pieces.hall) {
    const [w0, d0] = HALL_FT[a.typology as 'walled town' | 'city' | 'capital'] ?? HALL_FT.city;
    // The hall takes at most `MARKET_HALL_SHARE_MAX` of the square, so a small
    // square keeps room for its stalls.
    const kMax = Math.min(1, Math.sqrt((MARKET_HALL_SHARE_MAX * polyArea(square)) / (unit(w0) * unit(d0))));
    for (let k = kMax; k >= 0.5 - 1e-9 && !hall; k -= 0.1) {
      hall = bestSpot(unit(w0) * k, unit(d0) * k, (c) => Math.hypot(c[0] - from[0], c[1] - from[1]));
    }
    if (hall) take('market-hall', hall);
  }
  // The weigh house stands beside the hall; with no hall, far from the mouth.
  if (pieces.weighHouse) {
    const [w0, d0] = WEIGH_HOUSE_FT;
    const hc = hall ? centerOf(hall) : null;
    const spot = bestSpot(unit(w0), unit(d0), (c) => hc ? -Math.hypot(c[0] - hc[0], c[1] - hc[1]) : Math.hypot(c[0] - from[0], c[1] - from[1]));
    if (spot) take('weigh-house', spot);
  }
  // The pillory stands in the open beside the centerpiece, in sight of the market.
  if (pieces.pillory) {
    const [w0, d0] = PILLORY_FT;
    const r = cpR + clear + unit(d0);
    for (const [lu, lv] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, -r]]) {
      const poly = orientedRect(at(lu, lv), u, unit(w0), unit(d0));
      // Its own clear ring is half a piece's: a pillory needs room, not a yard.
      const ok = insideWithMargin(poly, square, walk) && !keepOut.slice(1).some((k) => convexOverlap(poly, k));
      if (ok) { features.push({ kind: 'pillory', polygon: poly }); keepOut.push(grow(poly, clear / 2)); break; }
    }
  }

  // Stalls: pairs of rows along u, back to back, an aisle between pairs. Row
  // A of a pair faces -v, row B faces +v; the first row faces the edge walk.
  const sw = unit(STALL_WIDTH_FT), sd = unit(STALL_DEPTH_FT);
  const aisle = unit(MARKET_AISLE_FT), cross = unit(MARKET_CROSS_AISLE_FT);
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const p of square) { const [lu, lv] = L(p); uMin = Math.min(uMin, lu); uMax = Math.max(uMax, lu); vMin = Math.min(vMin, lv); vMax = Math.max(vMax, lv); }
  const candidates: Array<{ poly: Pt[]; d: number; key: string }> = [];
  for (let v0 = vMin + walk, pair = 0; v0 + 2 * sd <= vMax - walk + 1e-9; v0 += 2 * sd + aisle, pair++) {
    for (const [row, lv, face] of [[0, v0 + sd / 2, -1], [1, v0 + sd * 1.5, 1]] as const) {
      for (let u0 = uMin + walk, n = 0; u0 + sw <= uMax - walk + 1e-9; n++) {
        const lu = u0 + sw / 2;
        // The stall's customer side is corner 2 to corner 3 of `orientedRect`,
        // which lies along +face: turn `face` toward this row's aisle.
        const f: Pt = [v[0] * face, v[1] * face];
        const poly = orientedRect(at(lu, lv), f, sw, sd);
        if (fits(poly)) candidates.push({ poly, d: Math.hypot(lu, lv), key: `${pair}:${row}:${n}` });
        u0 += sw;
        if ((n + 1) % MARKET_RUN_STALLS === 0) u0 += cross;
      }
    }
  }
  // Nearest the centerpiece first; ties broken by a stable hash, not by order.
  const tie = (k: string): number => fnv1a(`${a.seedPath}|stall:${k}`);
  candidates.sort((p, q) => p.d - q.d || tie(p.key) - tie(q.key));
  const area = polyArea(square);
  let covered = features.reduce((s, f) => s + polyArea(f.polygon), 0);
  const stalls: Pt[][] = [];
  for (const c of candidates) {
    if (stalls.length >= pieces.stallCap) break;
    const add = polyArea(c.poly);
    if (covered + add > area * (1 - MARKET_OPEN_SHARE_MIN)) break;
    stalls.push(c.poly);
    covered += add;
  }

  // Every stall must open onto paving a walker reaches from a street.
  const g = walkGrid(square, unit(WALK_CELL_FT), [...features.map((f) => f.polygon), ...stalls]);
  const seen = reachFromStreets(g, square, a.streets, unit(6));
  for (const s of stalls) if (stallReached(g, seen, s)) features.push({ kind: 'stall', polygon: s });

  return {
    wardIndex: a.wardIndex,
    civicKind: 'plaza',
    setPiece: 'market',
    chosenBy: `${a.typology}, ${a.band}`,
    grounds: square,
    forecourt: [],
    approach: [],
    approachWidth: 0,
    features,
  };
}

/**
 * Whether a frontage plot faces the square: its street side (corners 0 to 1,
 * as the lot packer leaves them) looks onto the square across at most `maxGap`.
 */
export function plotFacesSquare(polygon: Pt[], square: Pt[], maxGap: number): boolean {
  if (polygon.length < 3 || square.length < 3) return false;
  const a = polygon[0], b = polygon[1];
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let cx = 0, cy = 0;
  for (const p of polygon) { cx += p[0]; cy += p[1]; }
  cx /= polygon.length; cy /= polygon.length;
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const el = Math.hypot(ex, ey) || 1;
  let n: Pt = [-ey / el, ex / el];
  if ((m[0] - cx) * n[0] + (m[1] - cy) * n[1] < 0) n = [-n[0], -n[1]];
  const q = nearestOnRing(m, square);
  const d = Math.hypot(q[0] - m[0], q[1] - m[1]);
  if (d > maxGap || d < 1e-9) return false;
  return ((q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1]) / d >= 0.7;
}
