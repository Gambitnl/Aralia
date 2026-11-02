/**
 * @file laneVillage.ts — LANE VILLAGES: an unwalled settlement laid out as
 * houses along its road and a few branch lanes, with a garden behind each
 * house, a green and a church at the heart (GG-548).
 *
 * WHY THIS EXISTS (town-look pass, 2026-10-31). Every settlement used the same
 * Voronoi ward grid, so a village read as a small city without walls. The
 * census of world 903674813 measured a median village of 19 wards and 74
 * plots, with only 29% of plots on a main road. A Watabou village is a few
 * dozen houses strung along one to three winding lanes, with gardens and
 * orchards behind and ploughed fields around. Remy called those "lovely" and
 * chose this form for EVERY unwalled settlement (town-look sheet q4): walls
 * mean wards, no walls means lanes.
 *
 * THE RULES.
 *  - The inherited road IS the village street. With no road, one street runs
 *    through the village center on a seeded line.
 *  - The heart is the street point nearest the cell center. The green sits on
 *    one side of the street there, the church on the other.
 *  - Branch lanes leave the street near the heart, one per ~150 people, and
 *    wander out to the village edge. A branch that would run alongside another
 *    within two house depths is refused, so lanes do not stack into a grid.
 *  - Houses: one per ~5.5 people. Every lane side offers house slots, packed
 *    close near the heart and spread out with distance. The slots nearest the
 *    heart fill first, so a small village is a tight cluster and a large one
 *    spreads along its lanes, out past the core blob into its fields. (The
 *    first build held houses inside the blob and placed a median 22% of the
 *    houses a village needs; a 959-person village had 13.)
 *  - Each house has a garden (sometimes an orchard) behind it, to its rear.
 *
 * Pure: no React, no DOM, no import of `townEngine` at run time.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { clipPolylineToPolygon, pointInPolygon, type Pt } from '../submap/submapEngine';
import { pointAt, polylineLength, stripAlong } from './townSuburbs';
import type { BuildingPlot } from './townEngine';

export interface LaneVillageInput {
  footprint: readonly Pt[];
  /**
   * The village extent (the organic core blob). It sets the branch length and
   * the common meadow; houses may spread past it along the lanes.
   */
  extent: readonly Pt[];
  /** Cell center: the heart is the street point nearest it. */
  center: Pt;
  /** Inherited roads (plan units). They may run past the footprint. */
  roads: readonly Pt[][];
  /** Polygons no house may touch: river and quay corridors. */
  blockers: readonly Pt[][];
  /**
   * The river's center lines and half its width (GG-582). A branch lane may
   * not start in the water: that is the street's own bridge. Absent = no test.
   */
  river?: { lines: readonly Pt[][]; half: number };
  population: number;
  /** Hamlets get no green and no church. */
  hasGreen: boolean;
  hasChurch: boolean;
  /** Full width of the village street and of a branch lane (plan units). */
  streetWidth: number;
  laneWidth: number;
  lotWidth: number;
  minLotWidth: number;
  lotDepth: number;
  gardenDepth: number;
  /**
   * Front-garden depth (GG-564, Remy 2026-11-01: villages stand back behind
   * a front garden). Absent = the old 0 to a quarter lot setback, no garden.
   */
  frontGardenDepth?: number;
  /** Cell grid the frontage snaps to (plan units); 0 = no snap. */
  snap: number;
  /** Side of the green and of the church, in plan units. */
  greenSize: number;
  churchSize: number;
  /** Grounds margin round the church, in plan units (GG-566). Absent = none. */
  churchyardMargin?: number;
  intersects: (a: Pt[], b: Pt[]) => boolean;
  seedPath: SeedPath;
}

export interface LaneVillageLane {
  line: Pt[];
  kind: 'street' | 'branch';
}

export interface LaneVillageRow {
  /** Ground strip under the row: street edge back to the garden rear. */
  strip: Pt[];
  /** The same strip run out to the lane centerline: the ward polygon. */
  ground: Pt[];
  plots: BuildingPlot[];
}

export interface LaneVillageLayout {
  lanes: LaneVillageLane[];
  rows: LaneVillageRow[];
  /** Back gardens and orchards, and front gardens (`front`, GG-564). */
  gardens: Array<{ polygon: Pt[]; kind: 'garden' | 'orchard'; front?: boolean }>;
  green: Pt[] | null;
  church: Pt[] | null;
  /** The church grounds, church included (GG-566); null without a margin. */
  churchyard: Pt[] | null;
  /** Street centerline point before the church door (GG-566). */
  churchFoot: Pt | null;
  heart: Pt;
}

/** Houses per person: a rural household of about five and a half. */
const PEOPLE_PER_HOUSE = 5.5;
/** People per branch lane. */
const PEOPLE_PER_BRANCH = 150;
/** Most branch lanes a village grows. */
const MAX_BRANCHES = 6;

function meanRadius(poly: readonly Pt[], c: Pt): number {
  let r = 0;
  for (const p of poly) r += Math.hypot(p[0] - c[0], p[1] - c[1]);
  return r / (poly.length || 1);
}

function nearestOnLine(p: Pt, line: readonly Pt[]): { q: Pt; s: number; d: number } {
  let best = { q: line[0] as Pt, s: 0, d: Infinity };
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    const L = Math.sqrt(L2);
    const f = L2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    const q: Pt = [a[0] + dx * f, a[1] + dy * f];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.d) best = { q, s: acc + L * f, d };
    acc += L;
  }
  return best;
}

/** Thin quads along a polyline: the ground a lane occupies. */
function corridor(line: readonly Pt[], half: number): Pt[][] {
  const quads: Pt[][] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [x1, y1] = line[i];
    const [x2, y2] = line[i + 1];
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 1e-9) continue;
    const nx = (-(y2 - y1) / L) * half;
    const ny = ((x2 - x1) / L) * half;
    quads.push([[x1 - nx, y1 - ny], [x2 - nx, y2 - ny], [x2 + nx, y2 + ny], [x1 + nx, y1 + ny]]);
  }
  return quads;
}

/** A rectangle fronting a lane edge: frontage first, then back along `n`. */
function frontRect(p0: Pt, p1: Pt, n: Pt, depth: number): Pt[] {
  return [p0, p1, [p1[0] + n[0] * depth, p1[1] + n[1] * depth], [p0[0] + n[0] * depth, p0[1] + n[1] * depth]];
}

/**
 * The polygon pulled 1% toward its centroid. The shared overlap test counts a
 * touching edge or corner as a hit, so two attached lots (or a house and the
 * garden behind it) would refuse each other. Testing the shrunken copy keeps
 * true overlaps and lets exact contact through.
 */
/**
 * True when any point of the step from `a` to `b` lies in a blocker (GG-582).
 * Samples at `step` spacing, at most half a lane apart.
 */
function stepMeetsWater(a: Pt, b: Pt, blockers: readonly Pt[][], step: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(step, 1e-9)));
  for (let k = 1; k < n; k++) {
    const p: Pt = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
    if (blockers.some((poly) => pointInPolygon(p, poly as Pt[]))) return true;
  }
  return false;
}

function shrunk(poly: readonly Pt[]): Pt[] {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  x /= poly.length || 1; y /= poly.length || 1;
  return poly.map((p) => [x + (p[0] - x) * 0.99, y + (p[1] - y) * 0.99] as Pt);
}

/** Lay out a lane village (see the file header). Deterministic per `seedPath`. */
export function buildLaneVillage(input: LaneVillageInput): LaneVillageLayout {
  const { footprint, extent, center, blockers, intersects } = input;
  const rng = rngFromPath(streamPath(input.seedPath, 'lane-village'));
  const R = meanRadius(extent, center);
  const streetHalf = input.streetWidth / 2;
  const laneHalf = input.laneWidth / 2;

  // ---- The village street: the inherited road, else a seeded line. --------
  let streets: Pt[][] = [];
  for (const road of input.roads) {
    for (const piece of clipPolylineToPolygon(road as Pt[], footprint as Pt[])) {
      if (polylineLength(piece) > input.lotWidth * 3) streets.push(piece);
    }
  }
  if (streets.length === 0) {
    const ang = rng.next() * Math.PI;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const bend = (rng.next() - 0.5) * R * 0.3;
    const line: Pt[] = [];
    for (let k = 0; k <= 6; k++) {
      const f = -1.3 + (2.6 * k) / 6;
      const sway = Math.sin((k / 6) * Math.PI) * bend;
      line.push([center[0] + dx * R * f - dy * sway, center[1] + dy * R * f + dx * sway]);
    }
    streets = clipPolylineToPolygon(line, footprint as Pt[]).filter((p) => p.length >= 2);
  }
  const lanes: LaneVillageLane[] = streets.map((line) => ({ line, kind: 'street' }));

  // ---- The heart: the street point nearest the cell center. ---------------
  let heart: Pt = center;
  let heartStreet = -1;
  let heartS = 0;
  let heartD = Infinity;
  streets.forEach((line, i) => {
    const hit = nearestOnLine(center, line);
    if (hit.d < heartD) { heartD = hit.d; heart = hit.q; heartStreet = i; heartS = hit.s; }
  });

  // ---- Branch lanes. -------------------------------------------------------
  const branchTarget = input.population < 60
    ? 0
    : Math.max(1, Math.min(MAX_BRANCHES, Math.round(input.population / PEOPLE_PER_BRANCH)));
  const branchClear = (input.lotDepth + input.gardenDepth) * 1.1;
  for (let attempt = 0; attempt < branchTarget * 4 && lanes.filter((l) => l.kind === 'branch').length < branchTarget; attempt++) {
    if (streets.length === 0) break;
    const host = streets[heartStreet >= 0 && rng.next() < 0.7 ? heartStreet : Math.floor(rng.next() * streets.length)];
    const hostLen = polylineLength(host);
    const hostHeartS = nearestOnLine(heart, host).s;
    const offset = (rng.next() < 0.5 ? -1 : 1) * R * (0.1 + rng.next() * 0.45);
    const s0 = Math.max(input.lotWidth, Math.min(hostLen - input.lotWidth, hostHeartS + offset));
    const at = pointAt(host, s0);
    // GG-582: no branch leaves a street on its bridge. Rostotynsk (burg 617)
    // grew a lane that started 17 ft out over its river.
    if (input.river && input.river.lines.some((l) => nearestOnLine(at.p, l).d < input.river!.half)) continue;
    const side = rng.next() < 0.5 ? 1 : -1;
    let heading = Math.atan2(at.t[0] * side, -at.t[1] * side) + (rng.next() - 0.5) * 0.9;
    const length = R * (0.7 + rng.next() * 0.6);
    const steps = 6;
    const line: Pt[] = [at.p];
    let cur = at.p;
    // Lanes are not houses: a lane may cross the water carve to leave a
    // riverside street. Once it reaches dry ground, water ends it.
    let dry = !blockers.some((b) => pointInPolygon(at.p, b));
    for (let k = 0; k < steps; k++) {
      heading += (rng.next() - 0.5) * 0.5;
      const next: Pt = [cur[0] + Math.cos(heading) * (length / steps), cur[1] + Math.sin(heading) * (length / steps)];
      if (!pointInPolygon(next, footprint as Pt[])) break;
      // GG-582: test the whole step, not only its end. A step is about a
      // sixth of the village radius, so it could jump clean over a river at a
      // slant (Rostotynsk, burg 617: a lane over its 36 ft river at 15 degrees).
      const wet = blockers.some((b) => pointInPolygon(next, b)) || (dry && stepMeetsWater(cur, next, blockers, laneHalf));
      if (wet && dry) break;
      // Still wet two steps out: this lane runs down the river, not away
      // from it. Refuse it; the next attempt picks another start.
      if (wet && k >= 2) { line.length = 0; break; }
      if (!wet) dry = true;
      line.push(next);
      cur = next;
    }
    if (polylineLength(line) < input.lotWidth * 4) continue;
    // Refuse a branch that runs alongside another lane: lanes fan out, they
    // do not stack into a grid.
    const tail = line.slice(2);
    const crowded = lanes.some((l) => l.line !== host && tail.some((p) => nearestOnLine(p, l.line).d < branchClear));
    if (crowded) continue;
    lanes.push({ line, kind: 'branch' });
  }

  // ---- The green and the church at the heart. -----------------------------
  const occupied: Pt[][] = [];
  const laneQuads = lanes.flatMap((l) => corridor(l.line, (l.kind === 'street' ? streetHalf : laneHalf) * 0.98));
  const free = (raw: Pt[]): boolean => {
    const poly = shrunk(raw);
    for (const v of raw) if (!pointInPolygon(v, footprint as Pt[])) return false;
    for (const b of blockers) if (intersects(poly, b)) return false;
    for (const q of laneQuads) if (intersects(poly, q)) return false;
    for (const q of occupied) if (intersects(poly, q)) return false;
    return true;
  };
  let green: Pt[] | null = null;
  let church: Pt[] | null = null;
  let churchyard: Pt[] | null = null;
  let churchFoot: Pt | null = null;
  if (heartStreet >= 0) {
    const hostLine = streets[heartStreet];
    const t = pointAt(hostLine, heartS).t;
    const nrm: Pt = [-t[1], t[0]];
    // Where along the street a piece of `size` may start: every position that
    // keeps it on the street, nearest the heart first. The old list of five
    // shifts ran past a street's end when the heart sat near it, and both
    // ends then landed on one point: a rectangle of no width, which the
    // overlap test let through. Villages 384 and 718 of world 903674813 had a
    // green and a church 0 ft wide (found by GG-566).
    const hostLen = polylineLength(hostLine);
    const starts = (size: number): number[] => {
      const out: number[] = [];
      const step = Math.max(size * 0.3, 1e-6);
      for (let s0 = 0; s0 <= hostLen - size + 1e-9; s0 += step) out.push(s0);
      return out.sort((p, q) => Math.abs(p + size / 2 - heartS) - Math.abs(q + size / 2 - heartS)).slice(0, 12);
    };
    const placeAt = (size: number, depth: number, side: 1 | -1, setback: number): { poly: Pt[]; a: Pt; b: Pt; n: Pt } | null => {
      for (const s0 of starts(size)) {
        const a = pointAt(hostLine, s0).p;
        const b = pointAt(hostLine, s0 + size).p;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < size * 0.8) continue; // a sharp bend
        const n: Pt = [nrm[0] * side, nrm[1] * side];
        const off = streetHalf + setback;
        const poly = frontRect([a[0] + n[0] * off, a[1] + n[1] * off], [b[0] + n[0] * off, b[1] + n[1] * off], n, depth);
        if (free(poly)) return { poly, a, b, n };
      }
      return null;
    };
    const greenSide: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
    if (input.hasGreen) {
      green = placeAt(input.greenSize, input.greenSize * 0.8, greenSide, 0)?.poly ?? null;
      if (green) occupied.push(green);
    }
    if (input.hasChurch) {
      // GG-566: the church stands in its own yard (the grounds), set back
      // from the street behind a forecourt, with the margin on its other
      // three sides. The whole yard is kept clear of houses. Without a
      // margin (a schematic plan) the yard is the church alone, as before.
      const m = input.churchyardMargin ?? 0;
      const setback = input.churchSize * 0.25;
      const depth = input.churchSize * 1.4;
      const yard = placeAt(input.churchSize + 2 * m, setback + depth + m, (greenSide * -1) as 1 | -1, 0);
      if (yard) {
        const { a, b, n } = yard;
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const u: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        const off = streetHalf + setback;
        const c0: Pt = [a[0] + u[0] * m + n[0] * off, a[1] + u[1] * m + n[1] * off];
        const c1: Pt = [c0[0] + u[0] * input.churchSize, c0[1] + u[1] * input.churchSize];
        church = frontRect(c0, c1, n, depth);
        churchyard = m > 0 ? yard.poly : null;
        const mid: Pt = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2];
        churchFoot = [mid[0] - n[0] * off, mid[1] - n[1] * off];
        occupied.push(yard.poly);
      }
    }
  }

  // ---- House slots along every lane side. ---------------------------------
  interface Slot { lane: number; side: 1 | -1; s: number; w: number; depth: number; setback: number; garden: number; orchard: boolean; rank: number }
  const slots: Slot[] = [];
  lanes.forEach((lane, li) => {
    const len = polylineLength(lane.line);
    const sHeart = nearestOnLine(heart, lane.line).s;
    const laneStartD = Math.hypot(lane.line[0][0] - heart[0], lane.line[0][1] - heart[1]);
    for (const side of [1, -1] as const) {
      for (const dir of [1, -1] as const) {
        let s = sHeart + dir * input.lotWidth * 0.4;
        for (;;) {
          const w = input.snap > 0
            ? Math.max(input.minLotWidth, Math.round((input.lotWidth * (0.8 + rng.next() * 0.5)) / input.snap) * input.snap)
            : Math.max(input.minLotWidth, input.lotWidth * (0.8 + rng.next() * 0.5));
          const s0 = dir > 0 ? s : s - w;
          if (s0 < 0 || s0 + w > len) break;
          const dist = Math.abs(s - sHeart) + (lane.kind === 'branch' ? laneStartD : 0);
          slots.push({
            lane: li,
            side,
            s: s0,
            w,
            depth: input.lotDepth * (0.8 + rng.next() * 0.4),
            setback: input.frontGardenDepth
              ? input.frontGardenDepth * (0.8 + 0.4 * rng.next())
              : input.lotWidth * 0.25 * rng.next(),
            garden: input.gardenDepth * (0.7 + rng.next() * 0.6),
            orchard: rng.next() < 0.22,
            rank: dist + rng.next() * input.lotWidth * 2,
          });
          // Close near the heart, spread out with distance.
          const gap = input.lotWidth * (0.15 + Math.min(2.5, dist / Math.max(R, 1e-6)) * (0.4 + rng.next() * 1.1));
          s += dir * (w + gap);
        }
      }
    }
  });
  slots.sort((a, b) => a.rank - b.rank);

  const houseTarget = Math.max(3, Math.round(input.population / PEOPLE_PER_HOUSE));
  const byRow = new Map<string, { lane: number; side: 1 | -1; plots: BuildingPlot[]; sMin: number; sMax: number; far: number }>();
  const gardens: LaneVillageLayout['gardens'] = [];
  let houses = 0;
  for (const slot of slots) {
    if (houses >= houseTarget) break;
    const lane = lanes[slot.lane];
    const half = lane.kind === 'street' ? streetHalf : laneHalf;
    const a = pointAt(lane.line, slot.s);
    const b = pointAt(lane.line, slot.s + slot.w);
    const tx = b.p[0] - a.p[0], ty = b.p[1] - a.p[1];
    const tl = Math.hypot(tx, ty) || 1;
    const n: Pt = [(-ty / tl) * slot.side, (tx / tl) * slot.side];
    const off = half + slot.setback;
    const p0: Pt = [a.p[0] + n[0] * off, a.p[1] + n[1] * off];
    const p1: Pt = [b.p[0] + n[0] * off, b.p[1] + n[1] * off];
    const house = slot.side > 0 ? frontRect(p0, p1, n, slot.depth) : frontRect(p1, p0, n, slot.depth);
    if (!free(house)) continue;
    occupied.push(house);
    houses++;
    // The front garden: the strip between the street edge and the house.
    if (input.frontGardenDepth) {
      const g0: Pt = [a.p[0] + n[0] * half, a.p[1] + n[1] * half];
      const g1: Pt = [b.p[0] + n[0] * half, b.p[1] + n[1] * half];
      const front = slot.side > 0 ? frontRect(g0, g1, n, slot.setback) : frontRect(g1, g0, n, slot.setback);
      if (free(front)) {
        occupied.push(front);
        gardens.push({ polygon: front, kind: 'garden', front: true });
      }
    }
    const key = `${slot.lane}:${slot.side}`;
    const row = byRow.get(key) ?? { lane: slot.lane, side: slot.side, plots: [], sMin: Infinity, sMax: -Infinity, far: 0 };
    row.plots.push({ polygon: house, frontageEdge: 0, kind: 'frontage', shape: 'rect' });
    row.sMin = Math.min(row.sMin, slot.s);
    row.sMax = Math.max(row.sMax, slot.s + slot.w);
    // The garden runs back from the house rear, same width; it is dropped
    // (not trimmed) when it would cross a lane, a house or the water.
    const g0 = house[3];
    const g1 = house[2];
    const garden = frontRect(g0, g1, n, slot.garden);
    let far = off + slot.depth;
    if (free(garden)) {
      occupied.push(garden);
      gardens.push({ polygon: garden, kind: slot.orchard ? 'orchard' : 'garden' });
      far += slot.garden;
    }
    row.far = Math.max(row.far, far);
    byRow.set(key, row);
  }

  const rows: LaneVillageRow[] = [...byRow.values()].map((row) => ({
    strip: stripAlong(lanes[row.lane].line, row.sMin, row.sMax, lanes[row.lane].kind === 'street' ? streetHalf : laneHalf, row.far, row.side),
    // The ward runs a little past the row at both ends and behind it, so no
    // house corner sits on the ward edge (the street-margin rule).
    ground: stripAlong(
      lanes[row.lane].line,
      Math.max(0, row.sMin - input.minLotWidth * 0.5),
      Math.min(polylineLength(lanes[row.lane].line), row.sMax + input.minLotWidth * 0.5),
      0,
      row.far * 1.15,
      row.side,
    ),
    // Order each row along its lane so neighbors are adjacent in the list.
    plots: row.plots,
  }));
  return { lanes, rows, gardens, green, church, churchyard, churchFoot, heart };
}
