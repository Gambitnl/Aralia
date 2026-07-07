import { describe, it, expect } from 'vitest';
import {
  solveRoof,
  planeZAt,
  clipPolyToRectXY,
  __private,
  type SolveRoofInput,
} from '../roofPlan';
import type { FootprintMass } from '../footprint';
import type { RoofPlane } from '../blueprintTypes';
import { genFootprint } from '../footprint';
import { rootSeedPath } from '../../seedPath';
import type { BuildingType, Cell } from '../blueprintTypes';

const CELL_FT = 5;

// ── Helpers ─────────────────────────────────────────────────────────────────
const cellsOfMass = (m: FootprintMass): Cell[] => {
  const out: Cell[] = [];
  for (let cy = m.y; cy < m.y + m.h; cy++) {
    for (let cx = m.x; cx < m.x + m.w; cx++) out.push({ cx, cy });
  }
  return out;
};

const unionCells = (masses: FootprintMass[]): Cell[] => {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const m of masses) {
    for (const c of cellsOfMass(m)) {
      const k = `${c.cx},${c.cy}`;
      if (!seen.has(k)) { seen.add(k); out.push(c); }
    }
  }
  return out;
};

// point-in-polygon over the XY projection of a plane's corners (ray cast).
const pointInPolyXY = (px: number, py: number, pts: Array<[number, number, number]>): boolean => {
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
};

const coveredBySomePlane = (px: number, py: number, planes: RoofPlane[]): boolean =>
  planes.some((p) => pointInPolyXY(px, py, p.pts));

const baseStyle = (roofForm: 'gable' | 'hip' | 'steep' | 'flat'): SolveRoofInput['style'] => ({
  roofForm,
  pitchRiseFt: 10,
  eaveOverhangFt: 1,
});

const mkInput = (over: Partial<SolveRoofInput> & { masses: FootprintMass[]; style: SolveRoofInput['style'] }): SolveRoofInput => ({
  footprintCells: unionCells(over.masses),
  hearths: [],
  windowlessUpperRooms: [],
  wallTopFt: 20,
  ...over,
});

// ─────────────────────────────────────────────────────────────────────────────
describe('planeZAt', () => {
  it('interpolates the plane z at an interior xy (planar face)', () => {
    // Plane through (0,0,0),(10,0,0),(10,10,10),(0,10,10): z = y.
    const plane: RoofPlane = {
      pts: [
        [0, 0, 0],
        [10, 0, 0],
        [10, 10, 10],
        [0, 10, 10],
      ],
    };
    expect(planeZAt(plane, 5, 0)).toBeCloseTo(0, 6);
    expect(planeZAt(plane, 5, 5)).toBeCloseTo(5, 6);
    expect(planeZAt(plane, 5, 10)).toBeCloseTo(10, 6);
  });
});

describe('clipPolyToRectXY', () => {
  it('removes a quad wholly inside the clip rect', () => {
    const quad: Array<[number, number, number]> = [
      [0, 0, 0], [10, 0, 0], [10, 10, 5], [0, 10, 5],
    ];
    // Rect covers the whole quad → nothing survives.
    const out = clipPolyToRectXY(quad, { x: -1, y: -1, w: 12, h: 12 });
    expect(out.length).toBe(0);
  });

  it('keeps a quad wholly outside the clip rect', () => {
    const quad: Array<[number, number, number]> = [
      [0, 0, 0], [10, 0, 0], [10, 10, 5], [0, 10, 5],
    ];
    const out = clipPolyToRectXY(quad, { x: 100, y: 100, w: 5, h: 5 });
    expect(out.length).toBe(1);
    expect(out[0].pts).toEqual(quad);
  });

  it('splits a quad the clip rect bites into (corner bite still covers uncut cells)', () => {
    // Quad [0..10]x[0..10]; clip out the [5..10]x[5..10] corner.
    const quad: Array<[number, number, number]> = [
      [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0],
    ];
    const out = clipPolyToRectXY(quad, { x: 5, y: 5, w: 5, h: 5 });
    // A cell center in the bitten corner is NOT covered; elsewhere still covered.
    expect(coveredBySomePlane(7, 7, out)).toBe(false);
    expect(coveredBySomePlane(2, 2, out)).toBe(true);
    expect(coveredBySomePlane(7, 2, out)).toBe(true);
    expect(coveredBySomePlane(2, 7, out)).toBe(true);
  });

  it('clips a TRIANGLE and preserves the source plane z on the pieces', () => {
    // Hip west end triangle (5,5,0),(15,15,10),(5,25,0) → plane z = x − 5.
    const tri: Array<[number, number, number]> = [
      [5, 5, 0], [15, 15, 10], [5, 25, 0],
    ];
    const out = clipPolyToRectXY(tri, { x: 0, y: 0, w: 10, h: 10 });
    // (6,8) was inside the triangle AND inside the rect → uncovered now.
    expect(coveredBySomePlane(6, 8, out)).toBe(false);
    // (7,12) inside the triangle, outside the rect → covered, z = x−5 = 2.
    expect(coveredBySomePlane(7, 12, out)).toBe(true);
    const piece = out.find((p) => pointInPolyXY(7, 12, p.pts))!;
    expect(planeZAt(piece, 7, 12)).toBeCloseTo(2, 4);
  });
});

// ── The T-shape valley fixture (hand-derived) ────────────────────────────────
//
// Main mass: cells x[0,8) y[0,4) → feet x∈[0,40], y∈[0,20]. Shorter extent = y
// (20 ft) so the ridge runs along x at y=10, z=pitchRiseFt=10. Pitch slope
// s = 10/10 = 1.0. Main SOUTH plane (y∈[10,20]): z = s*(20 - y) = 20 - y.
//
// Wing: cells x[3,6) y[3,7) → feet x∈[15,30], y∈[15,35]; protrudes SOUTH past
// y=20, overlaps the main's last row (y 15..20). Wing width 15 ft, half 7.5,
// ridge along y at x=22.5, z = s*7.5 = 7.5 (slope matches the main).
//   Wing WEST plane (x∈[15,22.5]):  z = s*(x - 15) = x - 15.
//   Wing EAST plane (x∈[22.5,30]):  z = s*(30 - x) = 30 - x.
//
// VALLEYS = wing slope plane == main south plane:
//   West: (x-15) = (20-y) ⇒ y = 35 - x.
//         x=15 → y=20, z=0        → (15, 20)
//         x=22.5 → y=12.5, z=7.5  → (22.5, 12.5)   [ridge junction]
//   East: (30-x) = (20-y) ⇒ y = x - 10.
//         x=30 → y=20, z=0        → (30, 20)
//         x=22.5 → y=12.5, z=7.5  → (22.5, 12.5)   [ridge junction]
const T_MAIN: FootprintMass = { kind: 'main', x: 0, y: 0, w: 8, h: 4 };
const T_WING: FootprintMass = { kind: 'wing', x: 3, y: 3, w: 3, h: 4 };

describe('T-shape valley fixture', () => {
  const input = mkInput({
    masses: [T_MAIN, T_WING],
    style: { roofForm: 'gable', pitchRiseFt: 10, eaveOverhangFt: 0 },
  });
  const plan = solveRoof(input);

  it('emits exactly 2 valleys with hand-computed endpoints (±0.1 ft)', () => {
    expect(plan.valleys.length).toBe(2);
    // Normalize each valley so the outer (larger |x-22.5|) endpoint is first.
    const norm = plan.valleys.map((v) => {
      const d1 = Math.abs(v.x1 - 22.5), d2 = Math.abs(v.x2 - 22.5);
      return d1 >= d2
        ? { ox: v.x1, oy: v.y1, ix: v.x2, iy: v.y2 }
        : { ox: v.x2, oy: v.y2, ix: v.x1, iy: v.y1 };
    });
    const west = norm.find((v) => v.ox < 22.5)!;
    const east = norm.find((v) => v.ox > 22.5)!;
    expect(west).toBeDefined();
    expect(east).toBeDefined();

    expect(west.ox).toBeCloseTo(15, 1);
    expect(west.oy).toBeCloseTo(20, 1);
    expect(west.ix).toBeCloseTo(22.5, 1);
    expect(west.iy).toBeCloseTo(12.5, 1);

    expect(east.ox).toBeCloseTo(30, 1);
    expect(east.oy).toBeCloseTo(20, 1);
    expect(east.ix).toBeCloseTo(22.5, 1);
    expect(east.iy).toBeCloseTo(12.5, 1);
  });
});

// ── Wide-wing (PARALLEL-ridge) valley fixture (hand-derived) ─────────────────
//
// Main: cells x[0,8) y[0,4) → feet x∈[0,40], y∈[0,20]; ridge along x at y=10,
// s = pitchRiseFt/10 = 1. Main SOUTH plane: z = 20 − y.
//
// Wing: cells x[1,6) y[3,6) → feet x∈[5,30], y∈[15,30]. w=25 ≥ h=15 ⇒
// gablePrism puts the ridge along X (the SAME rule the solver must use) at
// y=22.5, ridgeZ = s·7.5 = 7.5 — PARALLEL to the crossed south eave, NOT along
// the protrusion axis. Wing INNER (north) plane: z = s·(y − 15) = y − 15.
//
// Crease (wing inner plane == main south plane):
//   20 − y = y − 15  ⇒  y* = 17.5, z* = 2.5.
// A HORIZONTAL valley across the wing width x∈[5,30] at y=17.5, PLUS two stubs
// where each wing sidewall meets the main slope, descending from
// (x_end, 17.5, 2.5) to the main mass edge (x_end, 20, 0):
//   (5,17.5)–(30,17.5);  (5,17.5)–(5,20);  (30,17.5)–(30,20).
describe('wide-wing (parallel-ridge) valley fixture', () => {
  const masses: FootprintMass[] = [
    { kind: 'main', x: 0, y: 0, w: 8, h: 4 },
    { kind: 'wing', x: 1, y: 3, w: 5, h: 3 },
  ];
  const plan = solveRoof(mkInput({
    masses,
    style: { roofForm: 'gable', pitchRiseFt: 10, eaveOverhangFt: 0 },
  }));

  it('emits the horizontal crease + 2 stubs with hand-computed endpoints (±0.1 ft)', () => {
    expect(plan.valleys.length).toBe(3);
    const isH = (v: typeof plan.valleys[number]): boolean => Math.abs(v.y1 - v.y2) < 0.1;
    const crease = plan.valleys.find(isH)!;
    expect(crease).toBeDefined();
    expect(Math.min(crease.x1, crease.x2)).toBeCloseTo(5, 1);
    expect(Math.max(crease.x1, crease.x2)).toBeCloseTo(30, 1);
    expect(crease.y1).toBeCloseTo(17.5, 1);
    expect(crease.y2).toBeCloseTo(17.5, 1);

    const stubs = plan.valleys.filter((v) => !isH(v));
    expect(stubs.length).toBe(2);
    const west = stubs.find((v) => Math.min(v.x1, v.x2) < 17.5)!;
    const east = stubs.find((v) => Math.max(v.x1, v.x2) > 17.5)!;
    expect(west.x1).toBeCloseTo(5, 1);
    expect(west.x2).toBeCloseTo(5, 1);
    expect(Math.min(west.y1, west.y2)).toBeCloseTo(17.5, 1);
    expect(Math.max(west.y1, west.y2)).toBeCloseTo(20, 1);
    expect(east.x1).toBeCloseTo(30, 1);
    expect(east.x2).toBeCloseTo(30, 1);
    expect(Math.min(east.y1, east.y2)).toBeCloseTo(17.5, 1);
    expect(Math.max(east.y1, east.y2)).toBeCloseTo(20, 1);
  });

  it('no phantom junction north of the main ridge (regression: valleys stayed south of y=10... i.e. ≥ 10)', () => {
    for (const v of plan.valleys) {
      expect(v.y1).toBeGreaterThanOrEqual(10);
      expect(v.y2).toBeGreaterThanOrEqual(10);
    }
  });
});

// ── Hip + corner tower regression (reviewer's repro) ─────────────────────────
//
// Main cells (1,1,8,4) → feet x∈[5,45], y∈[5,25]; hip, pitch 10 ⇒ s=1; ridge
// along x from (15,15) to (35,15) at z=10. West hip end triangle plane through
// (5,5,0),(15,15,10),(5,25,0): z = x − 5 (z depends only on x). North trapezoid
// plane: z = y − 5. Tower cells (0,0,2,2) → feet x∈[0,10], y∈[0,10], overlapping
// the main's corner cell.
// Probes: (7,12) inside the west end triangle, OUTSIDE the tower → must stay
// covered at z = 2 exactly. (12,7) inside the north trapezoid, outside the
// tower → z = 2. Tower-interior probes (6,8),(9,6),(8,9) → NO plane may cover
// them (the cap does).
describe('hip + corner tower regression', () => {
  const masses: FootprintMass[] = [
    { kind: 'main', x: 1, y: 1, w: 8, h: 4 },
    { kind: 'tower', x: 0, y: 0, w: 2, h: 2 },
  ];
  const plan = solveRoof(mkInput({ masses, style: baseStyle('hip') }));

  it('no plane covers any tower-interior probe point', () => {
    for (const [px, py] of [[6, 8], [9, 6], [8, 9], [2, 2]] as const) {
      expect(coveredBySomePlane(px, py, plan.planes)).toBe(false);
    }
    expect(plan.towerCaps.length).toBe(1);
    const cap = plan.towerCaps[0];
    expect(cap.x).toBeCloseTo(0, 3);
    expect(cap.y).toBeCloseTo(0, 3);
    expect(cap.w).toBeCloseTo(10, 3);
    expect(cap.d).toBeCloseTo(10, 3);
  });

  it('z at probes inside end triangles / trapezoids matches the analytic hip surface ±0.1', () => {
    const zAt = (px: number, py: number): number => {
      const covering = plan.planes.filter((p) => pointInPolyXY(px, py, p.pts));
      expect(covering.length).toBeGreaterThan(0);
      return Math.max(...covering.map((p) => planeZAt(p, px, py)));
    };
    // West end triangle probe (was z=7 with the bbox-strip bug; true z=2).
    expect(zAt(7, 12)).toBeCloseTo(2, 1);
    // North trapezoid probe near the clipped corner.
    expect(zAt(12, 7)).toBeCloseTo(2, 1);
    // Sanity far from the tower: ridge-height center.
    expect(zAt(25, 15)).toBeCloseTo(10, 1);
  });
});

// ── Coverage sweep ───────────────────────────────────────────────────────────
const TYPES: BuildingType[] = ['cottage', 'shop', 'tavern', 'manor', 'temple'];

describe('coverage: every footprint cell center lies under a plane or tower cap', () => {
  for (const roofForm of ['gable', 'hip', 'steep'] as const) {
    it(`${roofForm}: 100 seeds × 5 types`, () => {
      for (let seed = 1; seed <= 100; seed++) {
        for (const type of TYPES) {
          const fp = genFootprint(rootSeedPath(seed), type);
          const input = mkInput({ masses: fp.masses, style: baseStyle(roofForm) });
          const plan = solveRoof(input);
          for (const c of fp.cells) {
            const px = c.cx * CELL_FT + CELL_FT / 2;
            const py = c.cy * CELL_FT + CELL_FT / 2;
            const underPlane = coveredBySomePlane(px, py, plan.planes);
            const underCap = plan.towerCaps.some(
              (t) => px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.d,
            );
            if (!underPlane && !underCap) {
              throw new Error(
                `seed ${seed} ${type} ${roofForm}: cell (${c.cx},${c.cy}) center (${px},${py}) uncovered`,
              );
            }
          }
        }
      }
    });
  }
});

// ── Hearth chimneys ──────────────────────────────────────────────────────────
describe('hearth chimneys', () => {
  it('every hearth gets a chimney whose topFt clears the local roof', () => {
    const masses: FootprintMass[] = [{ kind: 'main', x: 0, y: 0, w: 8, h: 4 }];
    const hearths = [{ x: 12, y: 7 }, { x: 27, y: 13 }];
    const input = mkInput({ masses, hearths, style: baseStyle('gable') });
    const plan = solveRoof(input);
    expect(plan.chimneys.length).toBe(2);
    for (const h of hearths) {
      const chim = plan.chimneys.find(
        (c) => Math.abs(c.x - h.x) < 0.01 && Math.abs(c.y - h.y) < 0.01,
      );
      expect(chim).toBeDefined();
      const roofZ = Math.max(
        0,
        ...plan.planes
          .filter((p) => pointInPolyXY(h.x, h.y, p.pts))
          .map((p) => planeZAt(p, h.x, h.y)),
      );
      expect(chim!.topFt).toBeGreaterThan(roofZ);
      expect(chim!.topFt).toBeCloseTo(roofZ + 3, 3);
    }
  });

  it('merges hearths within 5 ft into one stack', () => {
    const masses: FootprintMass[] = [{ kind: 'main', x: 0, y: 0, w: 8, h: 4 }];
    const hearths = [{ x: 20, y: 10 }, { x: 22, y: 11 }];
    const input = mkInput({ masses, hearths, style: baseStyle('gable') });
    const plan = solveRoof(input);
    expect(plan.chimneys.length).toBe(1);
  });

  it('flat style: chimney tops 3 ft above wall top', () => {
    const masses: FootprintMass[] = [{ kind: 'main', x: 0, y: 0, w: 6, h: 4 }];
    const hearths = [{ x: 15, y: 10 }];
    const input = mkInput({ masses, hearths, style: baseStyle('flat') });
    const plan = solveRoof(input);
    expect(plan.chimneys.length).toBe(1);
    expect(plan.chimneys[0].topFt).toBeCloseTo(3, 3);
  });
});

// ── Towers ───────────────────────────────────────────────────────────────────
describe('tower exclusion and caps', () => {
  it('tower cells are excluded from main planes and capped', () => {
    // Main x[0,8) y[0,4); tower at NE corner x[7,10) y[-2,1) → normalized later,
    // but build directly in normalized frame: tower x[7,9) y[0,2).
    const masses: FootprintMass[] = [
      { kind: 'main', x: 0, y: 0, w: 8, h: 4 },
      { kind: 'tower', x: 7, y: 0, w: 2, h: 2 },
    ];
    const input = mkInput({ masses, style: baseStyle('gable') });
    const plan = solveRoof(input);
    // A cap exists over the tower.
    expect(plan.towerCaps.length).toBe(1);
    const cap = plan.towerCaps[0];
    expect(cap.x).toBeCloseTo(35, 3);
    expect(cap.y).toBeCloseTo(0, 3);
    expect(cap.form).toBe('pyramid');
    expect(cap.apexFt).toBeCloseTo(16, 3); // pitchRiseFt(10) * 1.6

    // Interior tower cell center (feet 37.5, 2.5) is NOT under a main plane.
    expect(coveredBySomePlane(37.5, 2.5, plan.planes)).toBe(false);
    // But it IS under the cap footprint.
    expect(37.5 >= cap.x && 37.5 <= cap.x + cap.w).toBe(true);
    expect(2.5 >= cap.y && 2.5 <= cap.y + cap.d).toBe(true);
  });

  it('steep roofForm gives cone caps', () => {
    const masses: FootprintMass[] = [
      { kind: 'main', x: 0, y: 0, w: 8, h: 4 },
      { kind: 'tower', x: 7, y: 0, w: 2, h: 2 },
    ];
    const input = mkInput({ masses, style: baseStyle('steep') });
    const plan = solveRoof(input);
    expect(plan.towerCaps[0].form).toBe('cone');
  });
});

// ── Flat style ───────────────────────────────────────────────────────────────
describe('flat style', () => {
  it('yields no sloped planes and no dormers', () => {
    const masses: FootprintMass[] = [{ kind: 'main', x: 0, y: 0, w: 6, h: 4 }];
    const input = mkInput({
      masses,
      windowlessUpperRooms: [{ cx: 1, cy: 1 }],
      style: baseStyle('flat'),
    });
    const plan = solveRoof(input);
    expect(plan.planes.length).toBe(0);
    expect(plan.dormers.length).toBe(0);
    // One ridge record marks the parapet line at z 0.
    expect(plan.ridges.length).toBe(1);
    expect(plan.ridges[0].zFt).toBe(0);
  });
});

// ── Dormers ──────────────────────────────────────────────────────────────────
describe('dormers', () => {
  it('one dormer per windowless upper room, snapped to a sloped plane, outward normal', () => {
    const masses: FootprintMass[] = [{ kind: 'main', x: 0, y: 0, w: 8, h: 4 }];
    const input = mkInput({
      masses,
      windowlessUpperRooms: [{ cx: 2, cy: 0 }, { cx: 2, cy: 3 }],
      style: baseStyle('gable'),
    });
    const plan = solveRoof(input);
    expect(plan.dormers.length).toBe(2);
    for (const d of plan.dormers) {
      // Normal is a unit-ish outward vector (one axis dominant), not zero.
      expect(Math.abs(d.nx) + Math.abs(d.ny)).toBeGreaterThan(0);
    }
    // North room dormer faces north (−y); south room faces south (+y).
    const north = plan.dormers.find((d) => d.y < 10)!;
    const south = plan.dormers.find((d) => d.y > 10)!;
    expect(north.ny).toBeLessThan(0);
    expect(south.ny).toBeGreaterThan(0);
  });
});

// ── Purity ───────────────────────────────────────────────────────────────────
describe('purity', () => {
  it('deep-equals across identical calls (RNG-free)', () => {
    const build = (): ReturnType<typeof solveRoof> => {
      const fp = genFootprint(rootSeedPath(42), 'manor');
      return solveRoof(mkInput({ masses: fp.masses, hearths: [{ x: 10, y: 10 }], style: baseStyle('hip') }));
    };
    expect(build()).toEqual(build());
  });

  it('does not mutate its input', () => {
    const fp = genFootprint(rootSeedPath(7), 'tavern');
    const input = mkInput({ masses: fp.masses, style: baseStyle('gable') });
    const snapshot = JSON.stringify(input);
    solveRoof(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// ── Roof-solver determinism sweep (BGv2 Phase 1B Task 8) ─────────────────────
//
// The solver is RNG-FREE, so the same input MUST reduce to a byte-identical
// RoofPlan every time. This sweep is the durable guard on that guarantee at
// scale: 200 seeds × the 5 roof-BEARING types (the types genFootprint gives
// wings and/or towers — manor/temple/keep get a corner tower + wings, tavern/inn
// always get a wing), each solved TWICE and deep-equal-compared, under all three
// sloped forms. It also asserts every emitted coordinate is finite (no NaN /
// Infinity leaking out of a degenerate mass or a divide-by-near-zero) and that
// coverage still holds (every footprint cell center sits under a plane or a
// tower cap — the same oracle the smaller coverage sweep above uses).
const ROOF_BEARING_TYPES: BuildingType[] = ['manor', 'temple', 'keep', 'tavern', 'inn'];

// Every finite-number coordinate the RoofPlan carries, flattened for scanning.
const allRoofCoords = (plan: ReturnType<typeof solveRoof>): number[] => {
  const out: number[] = [];
  for (const p of plan.planes) for (const [x, y, z] of p.pts) out.push(x, y, z);
  for (const r of plan.ridges) out.push(r.x1, r.y1, r.x2, r.y2, r.zFt);
  for (const v of plan.valleys) out.push(v.x1, v.y1, v.x2, v.y2);
  for (const c of plan.chimneys) out.push(c.x, c.y, c.topFt);
  for (const d of plan.dormers) out.push(d.x, d.y, d.nx, d.ny);
  for (const t of plan.towerCaps) out.push(t.x, t.y, t.w, t.d, t.apexFt);
  out.push(plan.pitchRiseFt, plan.eaveOverhangFt);
  return out;
};

describe('roof-solver determinism sweep: 200 seeds × 5 roof-bearing types', () => {
  for (const roofForm of ['gable', 'hip', 'steep'] as const) {
    it(`${roofForm}: double-solve deep-equal, all coords finite, coverage holds`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        for (const type of ROOF_BEARING_TYPES) {
          const fp = genFootprint(rootSeedPath(seed), type);
          // Feed hearths + a dormer candidate so chimneys/dormers exercise the
          // finite-coordinate scan too (both are style-independent geometry).
          const mkOne = (): ReturnType<typeof solveRoof> =>
            solveRoof(mkInput({
              masses: fp.masses,
              hearths: [{ x: fp.cols * CELL_FT * 0.5, y: fp.rows * CELL_FT * 0.5 }],
              windowlessUpperRooms: [{ cx: 0, cy: 0 }],
              style: baseStyle(roofForm),
            }));
          const a = mkOne();
          const b = mkOne();

          // 1. Determinism: identical input ⇒ byte-identical plan.
          expect(a, `seed ${seed} ${type} ${roofForm}`).toEqual(b);

          // 2. No NaN / Infinity in ANY emitted coordinate.
          for (const n of allRoofCoords(a)) {
            if (!Number.isFinite(n)) {
              throw new Error(
                `seed ${seed} ${type} ${roofForm}: non-finite roof coord ${n}`,
              );
            }
          }

          // 3. Coverage oracle (reused): every footprint cell center is under a
          //    roof plane or a tower cap.
          for (const c of fp.cells) {
            const px = c.cx * CELL_FT + CELL_FT / 2;
            const py = c.cy * CELL_FT + CELL_FT / 2;
            const underPlane = coveredBySomePlane(px, py, a.planes);
            const underCap = a.towerCaps.some(
              (t) => px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.d,
            );
            if (!underPlane && !underCap) {
              throw new Error(
                `seed ${seed} ${type} ${roofForm}: cell (${c.cx},${c.cy}) center ` +
                `(${px},${py}) uncovered by plane or cap`,
              );
            }
          }
        }
      }
    }, 30_000);
  }
});

// smoke: private helpers surface exists
describe('__private', () => {
  it('exposes tested helpers', () => {
    expect(typeof __private.pitchSlope).toBe('function');
  });
});
