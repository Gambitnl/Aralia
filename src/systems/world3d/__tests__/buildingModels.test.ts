import { describe, it, expect } from 'vitest';
import { buildRoofGeometry, buildRoofMeshData } from '../buildingModels';
import type { RoofPlan } from '../../worldforge/interior/blueprintTypes';

const maxY = (g: { positions: Float32Array }) => {
  let m = -Infinity;
  for (let i = 1; i < g.positions.length; i += 3) m = Math.max(m, g.positions[i]);
  return m;
};

describe('buildRoofGeometry', () => {
  for (const form of ['gable', 'hip', 'steep', 'flat'] as const) {
    it(`${form} roof geometry is well-formed`, () => {
      const g = buildRoofGeometry(form, 8, 6, 2);
      expect(g.positions.length).toBeGreaterThan(0);
      expect(g.positions.length % 3).toBe(0);
      expect(g.normals.length).toBe(g.positions.length);
      expect(Math.max(...Array.from(g.indices))).toBeLessThan(g.positions.length / 3);
      expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
    });
  }

  it('gable peaks at the given rise; flat stays low', () => {
    expect(maxY(buildRoofGeometry('gable', 8, 6, 2))).toBeCloseTo(2, 5);
    expect(maxY(buildRoofGeometry('flat', 8, 6, 2))).toBeLessThan(1);
  });

  it('steep is taller than gable for the same rise', () => {
    expect(maxY(buildRoofGeometry('steep', 8, 6, 2))).toBeGreaterThan(maxY(buildRoofGeometry('gable', 8, 6, 2)));
  });
});

// ── Task 12: pure blueprint → 3D mesh data ──────────────────────────────
import {
  buildBuildingMeshData,
  BLUEPRINT_STOREY_FT,
  type MeshBox,
} from '../buildingModels';
import { generateBuilding } from '../../worldforge/interior/generateBuilding';
import { rootSeedPath, childSeedPath } from '../../worldforge/seedPath';
import { cellKey } from '../../worldforge/interior/blueprintTypes';

describe('buildBuildingMeshData', () => {
  // A 2-storey manor with a basement: 3 levels, 2 stair joins, and (for
  // seed 4) an irregular, non-rectangular footprint.
  const plan = () =>
    generateBuilding({
      buildingId: 1,
      type: 'manor',
      seedPath: rootSeedPath(4),
      storeys: 2,
      basement: true,
    });

  it('counts outer wall RUNS per floor, matching the plan (irregular shell)', () => {
    const p = plan();
    const data = buildBuildingMeshData(p);
    expect(data.floors.length).toBe(p.floors.length);
    for (let i = 0; i < p.floors.length; i++) {
      const outerRuns = p.floors[i].wallRuns.filter((r) => r.kind === 'outer').length;
      const innerRuns = p.floors[i].wallRuns.filter((r) => r.kind === 'inner').length;
      expect(data.floors[i].outerWallSegments).toBe(outerRuns);
      expect(data.floors[i].innerWallSegments).toBe(innerRuns);
    }
    // Irregular shell sanity: the footprint is NOT a full rectangle, so the
    // outer shell needs more than a box's 4 runs (minus the door break).
    const cols = p.widthFt / 5;
    const rows = p.depthFt / 5;
    expect(p.footprintCells.length).toBeLessThan(cols * rows);
  });

  it('emits a floor slab per level at level*storeyHeight (basement below ground)', () => {
    const p = plan();
    const data = buildBuildingMeshData(p);
    for (const floor of data.floors) {
      const slabs = floor.boxes.filter((b) => b.kind === 'floor');
      expect(slabs.length).toBeGreaterThan(0);
      expect(floor.baseZFt).toBe(floor.level * BLUEPRINT_STOREY_FT);
      for (const s of slabs) expect(s.z0).toBe(floor.level * BLUEPRINT_STOREY_FT);
      // Slab covers the footprint minus this level's stair holes.
      expect(slabs.length).toBe(p.footprintCells.length - floor.stairHoleCells.length);
    }
    const basement = data.floors.find((f) => f.level === -1)!;
    expect(basement.baseZFt).toBe(-BLUEPRINT_STOREY_FT);
    // Only the top level gets a ceiling; lower ceilings ARE the next slab.
    const top = Math.max(...data.floors.map((f) => f.level));
    for (const floor of data.floors) {
      const ceilings = floor.boxes.filter((b) => b.kind === 'ceiling');
      expect(ceilings.length).toBe(floor.level === top ? p.footprintCells.length : 0);
    }
  });

  it('cuts a stair hole through each joined slab, matching plan.stairs', () => {
    const p = plan();
    const data = buildBuildingMeshData(p);
    expect(p.stairs.length).toBe(2); // basement→ground, ground→first
    for (const floor of data.floors) {
      const joining = p.stairs.filter((s) => s.fromLevel === floor.level - 1);
      expect(floor.stairHoleCells.map((c) => cellKey(c.cx, c.cy)).sort()).toEqual(
        joining
          .map((s) => cellKey(Math.floor(s.x / 5), Math.floor(s.y / 5)))
          .sort(),
      );
      // The holed cells really are absent from the slab boxes.
      for (const c of floor.stairHoleCells) {
        const at = floor.boxes.find(
          (b) => b.kind === 'floor' && b.x === (c.cx + 0.5) * 5 && b.y === (c.cy + 0.5) * 5,
        );
        expect(at).toBeUndefined();
      }
      // And a stair flight rises FROM every joined lower level. Fix A emits a
      // stepped flight (many step boxes) per join, so count distinct flights by
      // the shaft cell each step box falls in, not raw box count.
      const stepBoxes = floor.boxes.filter((b) => b.kind === 'stair');
      const shafts = new Set(stepBoxes.map((b) => cellKey(Math.floor(b.x / 5), Math.floor(b.y / 5))));
      expect(shafts.size).toBe(p.stairs.filter((s) => s.fromLevel === floor.level).length);
    }
  });

  it('window and door opening counts match the plan per floor', () => {
    const p = plan();
    const data = buildBuildingMeshData(p);
    for (let i = 0; i < p.floors.length; i++) {
      expect(data.floors[i].windowOpenings).toBe(p.floors[i].windows.length);
      expect(data.floors[i].doorOpenings).toBe(p.floors[i].doors.length);
      // Each window contributes a sill + head + pane triple; each door two
      // jamb reveals + one lintel.
      const boxes = data.floors[i].boxes;
      expect(boxes.filter((b) => b.kind === 'sill').length).toBe(p.floors[i].windows.length);
      expect(boxes.filter((b) => b.kind === 'window-head').length).toBe(p.floors[i].windows.length);
      expect(boxes.filter((b) => b.kind === 'window-pane').length).toBe(p.floors[i].windows.length);
      expect(boxes.filter((b) => b.kind === 'jamb').length).toBe(p.floors[i].doors.length * 2);
      expect(boxes.filter((b) => b.kind === 'door-lintel').length).toBe(p.floors[i].doors.length);
    }
  });

  it('grows every outer wall OUTWARD: the cell across the normal is outside', () => {
    const p = plan();
    const data = buildBuildingMeshData(p);
    const inside = new Set(p.footprintCells.map((c) => cellKey(c.cx, c.cy)));
    const outerBoxes = data.floors
      .flatMap((f) => f.boxes)
      .filter((b): b is MeshBox & { nx: number; ny: number } =>
        b.wallKind === 'outer' && b.nx !== undefined && b.ny !== undefined);
    expect(outerBoxes.length).toBeGreaterThan(0);
    for (const b of outerBoxes) {
      // Box center sits t/2 OUTWARD of the grid line; step half a cell more
      // along the normal and the sampled cell must be outside the footprint.
      const px = b.x + b.nx * 2.5;
      const py = b.y + b.ny * 2.5;
      expect(inside.has(cellKey(Math.floor(px / 5), Math.floor(py / 5)))).toBe(false);
    }
  });

  it('is deterministic on repeat', () => {
    expect(buildBuildingMeshData(plan())).toEqual(buildBuildingMeshData(plan()));
  });

  // ── Regressions: door frames derive from the door's OWN edge, never a
  // borrowed collinear run (Task 12 review fixes, 2026-07-06).

  it('builds the workshop whose door consumes a whole one-cell run (was: throw)', () => {
    // Reviewer repro: door at (15, 2.5) axis 'y' with ZERO wall runs on x=15.
    const p = generateBuilding({
      buildingId: 3,
      type: 'workshop',
      seedPath: childSeedPath(rootSeedPath(3), 'interior:3'),
      storeys: 1,
      maxWidthFt: 60,
      maxDepthFt: 60,
    });
    const floor0 = p.floors.find((f) => f.level === 0)!;
    const door = floor0.doors.find((d) => d.x === 15 && d.y === 2.5 && d.axis === 'y');
    expect(door).toBeDefined();
    expect(floor0.wallRuns.some((r) => r.axis === 'y' && r.x1 === 15)).toBe(false);

    const data = buildBuildingMeshData(p); // must NOT throw
    const level0 = data.floors.find((f) => f.level === 0)!;
    // The orphan door still gets a full frame on the x=15 line: two 1 ft jamb
    // reveals flanking the 3 ft clear opening, plus a lintel over it. It is
    // an inner door (both flanking cells in the footprint) → 0.5 ft thick,
    // centered 0.25 ft off the grid line along +x (the inner-wall rule).
    const onLine = level0.boxes.filter(
      (b) => (b.kind === 'jamb' || b.kind === 'door-lintel') && Math.abs(b.x - 15.25) < 1e-9,
    );
    const jambs = onLine.filter((b) => b.kind === 'jamb');
    const lintels = onLine.filter((b) => b.kind === 'door-lintel');
    expect(jambs.map((b) => b.y).sort((a, b) => a - b)).toEqual([0.5, 4.5]);
    for (const j of jambs) {
      expect(j.d).toBeCloseTo(1, 9); // 1 ft reveal each side → 3 ft clear opening
      expect(j.w).toBeCloseTo(0.5, 9); // inner thickness
      expect(j.wallKind).toBe('inner');
    }
    expect(lintels.length).toBe(1);
    expect(lintels[0].y).toBeCloseTo(2.5, 9);
    expect(lintels[0].d).toBeCloseTo(3, 9); // spans the clear opening
    expect(lintels[0].z0).toBeGreaterThan(0); // sits above the door head
  });

  it('builds ~100 production-shaped plans (interior:<id> seeds, lot caps) throw-free', () => {
    const types = ['cottage', 'shop', 'workshop', 'tavern', 'manor'] as const;
    let built = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (const type of types) {
        const p = generateBuilding({
          buildingId: seed,
          type,
          seedPath: childSeedPath(rootSeedPath(seed), `interior:${seed}`),
          storeys: 1 + (seed % 2),
          maxWidthFt: 60,
          maxDepthFt: 60,
        });
        expect(() => buildBuildingMeshData(p)).not.toThrow();
        built++;
      }
    }
    expect(built).toBe(100);
  });

  it('never extends a door frame inward past the wall line by more than t/2', () => {
    // Independent math: re-derive each door's line, kind, and outward side
    // from the plan footprint (NOT the implementation's normals), then check
    // every jamb/lintel box near that door stays within [line - t/2 inward,
    // line + t/2 + t outward] across the wall line. Outer frames must also
    // sample OUTSIDE the footprint half a cell across the wall line.
    const types = ['cottage', 'shop', 'workshop', 'tavern', 'manor'] as const;
    for (let seed = 1; seed <= 12; seed++) {
      for (const type of types) {
        const p = generateBuilding({
          buildingId: seed,
          type,
          seedPath: childSeedPath(rootSeedPath(seed), `interior:${seed}`),
          storeys: 2,
          maxWidthFt: 60,
          maxDepthFt: 60,
        });
        const data = buildBuildingMeshData(p);
        const inside = new Set(p.footprintCells.map((c) => cellKey(c.cx, c.cy)));
        for (let i = 0; i < p.floors.length; i++) {
          const pf = p.floors[i];
          const frames = data.floors[i].boxes.filter(
            (b) => b.kind === 'jamb' || b.kind === 'door-lintel',
          );
          for (const door of pf.doors) {
            const line = door.axis === 'y' ? door.x : door.y;
            const along = door.axis === 'y' ? door.y : door.x;
            const cL = Math.round(line / 5);
            const cA = Math.floor(along / 5);
            const inNeg = inside.has(door.axis === 'y' ? cellKey(cL - 1, cA) : cellKey(cA, cL - 1));
            const inPos = inside.has(door.axis === 'y' ? cellKey(cL, cA) : cellKey(cA, cL));
            const outer = inNeg !== inPos;
            const t = outer ? 1.5 : 0.5;
            // Expected side of the line, from footprint membership alone:
            // outer → toward the outside cell; inner → +axis (emission rule).
            const sExp = outer ? (inNeg ? 1 : -1) : 1;
            const near = frames.filter((b) => {
              const alongC = door.axis === 'y' ? b.y : b.x;
              const lineC = door.axis === 'y' ? b.x : b.y;
              return (
                Math.abs(alongC - along) <= 2.01 &&
                Math.abs(lineC - (line + (sExp * t) / 2)) <= 1e-6
              );
            });
            expect(near.length).toBeGreaterThanOrEqual(3); // 2 jambs + lintel
            for (const b of near) {
              const lineC = door.axis === 'y' ? b.x : b.y;
              const half = (door.axis === 'y' ? b.w : b.d) / 2;
              const lo = lineC - half;
              const hi = lineC + half;
              if (outer) {
                // One face ON the wall line, thickness fully on the outward
                // side: neither face may cross the line into the interior.
                const inwardNeg = inNeg; // interior on the -side ⇒ box on +side
                if (inwardNeg) expect(lo).toBeGreaterThanOrEqual(line - 1e-9);
                else expect(hi).toBeLessThanOrEqual(line + 1e-9);
                // ...and never past line +/- t/2 + t/2 = full t outward.
                expect(Math.max(Math.abs(lo - line), Math.abs(hi - line))).toBeLessThanOrEqual(t + 1e-9);
              } else {
                // Inner frames may straddle, but never beyond t/2 past the line.
                expect(Math.abs(lo - line)).toBeLessThanOrEqual(t + 1e-9);
                expect(Math.abs(hi - line)).toBeLessThanOrEqual(t + 1e-9);
              }
            }
          }
        }
      }
    }
  });

  // ── Fix A: stepped stair flights (2026-07-06). The stair is no longer one
  // solid full-height box — it climbs as N stacked step boxes from floor level
  // to the next slab, within the stair cell footprint, ascending toward the
  // largest free extent inside the room that owns the stair cell.
  describe('stepped stair flights (Fix A)', () => {
    it('replaces the solid monolith with a climbing stack of steps', () => {
      const p = plan();
      const data = buildBuildingMeshData(p);
      // Every join emits a flight from the level below.
      for (const s of p.stairs) {
        const floor = data.floors.find((f) => f.level === s.fromLevel)!;
        const steps = floor.boxes.filter((b) => b.kind === 'stair');
        // A real flight = many steps, not one monolith.
        expect(steps.length).toBeGreaterThanOrEqual(8);
        // Each step is a thin tread slice along the ascent axis — never the old
        // monolith's full ~4 ft × 4 ft footprint on both axes.
        for (const st of steps) {
          expect(Math.min(st.w, st.d)).toBeLessThan(2);
        }
        // Only the topmost tread reaches the full storey; the rest are shorter.
        expect(steps.filter((st) => st.h < BLUEPRINT_STOREY_FT - 1e-6).length)
          .toBeGreaterThanOrEqual(steps.length - 1);
        // Steps climb: their top surfaces are strictly increasing, from floor
        // level up to (about) the next slab.
        const tops = steps.map((st) => st.z0 + st.h).sort((a, b) => a - b);
        for (let i = 1; i < tops.length; i++) {
          expect(tops[i]).toBeGreaterThan(tops[i - 1]);
        }
        const baseZ = s.fromLevel * BLUEPRINT_STOREY_FT;
        expect(Math.min(...steps.map((st) => st.z0))).toBeCloseTo(baseZ, 6);
        // The top tread reaches (near) the next floor slab.
        expect(Math.max(...tops)).toBeCloseTo(baseZ + BLUEPRINT_STOREY_FT, 6);
      }
    });

    it('keeps every step box inside the stair cell footprint', () => {
      const p = plan();
      const data = buildBuildingMeshData(p);
      for (const s of p.stairs) {
        const floor = data.floors.find((f) => f.level === s.fromLevel)!;
        const cx = Math.floor(s.x / 5);
        const cy = Math.floor(s.y / 5);
        const cellLoX = cx * 5, cellHiX = (cx + 1) * 5;
        const cellLoY = cy * 5, cellHiY = (cy + 1) * 5;
        for (const st of floor.boxes.filter((b) => b.kind === 'stair')) {
          expect(st.x - st.w / 2).toBeGreaterThanOrEqual(cellLoX - 1e-6);
          expect(st.x + st.w / 2).toBeLessThanOrEqual(cellHiX + 1e-6);
          expect(st.y - st.d / 2).toBeGreaterThanOrEqual(cellLoY - 1e-6);
          expect(st.y + st.d / 2).toBeLessThanOrEqual(cellHiY + 1e-6);
        }
      }
    });

    it('is deterministic across 20 seeds', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const p = generateBuilding({
          buildingId: seed, type: 'manor',
          seedPath: rootSeedPath(seed), storeys: 2, basement: true,
        });
        expect(buildBuildingMeshData(p)).toEqual(buildBuildingMeshData(p));
      }
    });
  });
});

// ── Task 5 (BGv2 Phase 1B): raise the solved roof. buildRoofMeshData turns a
// RoofPlan into pure tri geometry (planes + tower cap fans) plus chimney/dormer
// boxes, all in PLAN FEET with z lifted by wallTopFt. No three.js.
describe('buildRoofMeshData', () => {
  const WALL_TOP = 20;

  // A hand-built RoofPlan exercising every feature: a gable's two slopes, a
  // valley, a chimney, a dormer, and a pyramid tower cap. z is ABOVE wall-top.
  const roof = (): RoofPlan => ({
    planes: [
      // North slope quad: eave (z=0) up to ridge (z=6).
      { pts: [[0, 0, 0], [30, 0, 0], [30, 15, 6], [0, 15, 6]] },
      // South slope quad: ridge (z=6) down to eave (z=0).
      { pts: [[0, 15, 6], [30, 15, 6], [30, 30, 0], [0, 30, 0]] },
    ],
    ridges: [{ x1: 0, y1: 15, x2: 30, y2: 15, zFt: 6 }],
    valleys: [{ x1: 5, y1: 15, x2: 10, y2: 20 }],
    chimneys: [{ x: 8, y: 8, topFt: 9 }],
    dormers: [{ x: 20, y: 8, nx: 0, ny: -1 }],
    towerCaps: [{ x: 24, y: 22, w: 6, d: 6, apexFt: 10, form: 'pyramid' }],
    pitchRiseFt: 6,
    eaveOverhangFt: 1,
  });

  it('emits at least one triangle per plane, well-formed', () => {
    const md = buildRoofMeshData(roof(), WALL_TOP);
    const g = md.tris;
    expect(g.positions.length % 3).toBe(0);
    expect(g.normals.length).toBe(g.positions.length);
    // A fan of an n-gon = (n-2) tris ⇒ each quad plane ≥ 2 tris ⇒ ≥ 4 tris for
    // two quads, plus the pyramid cap's 4 side tris ⇒ well over 6 verts.
    const triCount = g.indices.length / 6; // fromTris pushes both windings
    expect(triCount).toBeGreaterThanOrEqual(2 * 2 + 4);
    expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
    expect(Math.max(...Array.from(g.indices))).toBeLessThan(g.positions.length / 3);
  });

  it('lifts every roof vertex to at least the wall top (z above wall-top ≥ 0)', () => {
    const md = buildRoofMeshData(roof(), WALL_TOP);
    for (let i = 1; i < md.tris.positions.length; i += 3) {
      // Y is the vertical axis in the emitted mesh; every roof point sits at
      // wallTopFt + (plane z ≥ 0), so no vertex may dip below the wall top.
      expect(md.tris.positions[i]).toBeGreaterThanOrEqual(WALL_TOP - 1e-6);
    }
  });

  it('raises a chimney box from its local plane up to topFt (above the roof there)', () => {
    const md = buildRoofMeshData(roof(), WALL_TOP);
    expect(md.chimneyBoxes.length).toBe(1);
    const c = md.chimneyBoxes[0];
    expect(c.kind).toBe('chimney');
    expect(c.x).toBeCloseTo(8, 6);
    expect(c.y).toBeCloseTo(8, 6);
    // ~2 ft square flue.
    expect(c.w).toBeCloseTo(2, 6);
    expect(c.d).toBeCloseTo(2, 6);
    // Top reaches wallTop + topFt; base sits on (below) that so it rises above.
    expect(c.z0 + c.h).toBeCloseTo(WALL_TOP + 9, 6);
    expect(c.h).toBeGreaterThan(0);
    expect(c.z0).toBeLessThan(c.z0 + c.h);
  });

  it('seats a dormer box on the roof carrying its outward normal', () => {
    const md = buildRoofMeshData(roof(), WALL_TOP);
    expect(md.dormerBoxes.length).toBe(1);
    const d = md.dormerBoxes[0];
    expect(d.kind).toBe('dormer');
    expect(d.x).toBeCloseTo(20, 6);
    expect(d.y).toBeCloseTo(8, 6);
    expect(d.nx).toBe(0);
    expect(d.ny).toBe(-1);
    // Seated on the roof surface (above the wall top), a small mass.
    expect(d.z0).toBeGreaterThanOrEqual(WALL_TOP - 1e-6);
    expect(d.h).toBeGreaterThan(0);
  });

  it('the tower cap apex reaches wallTop + apexFt', () => {
    const md = buildRoofMeshData(roof(), WALL_TOP);
    let maxY = -Infinity;
    for (let i = 1; i < md.tris.positions.length; i += 3) {
      maxY = Math.max(maxY, md.tris.positions[i]);
    }
    // The pyramid apexFt (10) is the tallest feature above wall-top (ridge is 6).
    expect(maxY).toBeCloseTo(WALL_TOP + 10, 5);
  });

  it('is deterministic (deep-equal on repeat)', () => {
    expect(buildRoofMeshData(roof(), WALL_TOP)).toEqual(buildRoofMeshData(roof(), WALL_TOP));
  });

  it('raises a real roof from a styled generateBuilding plan', () => {
    const p = generateBuilding({
      buildingId: 7, type: 'manor', seedPath: rootSeedPath(7),
      storeys: 2, basement: false,
      style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
    });
    expect(p.roof).toBeDefined();
    const md = buildRoofMeshData(p.roof!, p.floors.length * BLUEPRINT_STOREY_FT);
    expect(md.tris.positions.length).toBeGreaterThan(0);
    expect(Array.from(md.tris.positions).every(Number.isFinite)).toBe(true);
  });

  // ── Fix B: corner joints (2026-07-06). At every convex corner where two
  // perpendicular OUTER runs meet, the outward diagonal quadrant must be
  // filled by some wall box — no open notch into the wall from outside.
  describe('outer wall corner joints (Fix B)', () => {
    const T = 1.5; // OUTER_THICKNESS_FT

    // Sample the corner's OUTWARD diagonal cell-corner point, offset half a
    // thickness along each outward axis, and assert it lies inside some outer
    // wall box on the same floor.
    const cornerFilled = (
      wallBoxes: MeshBox[],
      px: number,
      py: number,
    ): boolean =>
      wallBoxes.some(
        (b) =>
          px >= b.x - b.w / 2 - 1e-6 && px <= b.x + b.w / 2 + 1e-6 &&
          py >= b.y - b.d / 2 - 1e-6 && py <= b.y + b.d / 2 + 1e-6,
      );

    it('fills every convex outer corner quadrant (50 seeds x 3 types)', () => {
      const types = ['cottage', 'shop', 'manor'] as const;
      let cornersChecked = 0;
      for (let seed = 1; seed <= 50; seed++) {
        for (const type of types) {
          const p = generateBuilding({
            buildingId: seed, type,
            seedPath: childSeedPath(rootSeedPath(seed), `interior:${seed}`),
            storeys: 1 + (seed % 2),
            maxWidthFt: 60, maxDepthFt: 60,
          });
          const data = buildBuildingMeshData(p);
          for (let fi = 0; fi < p.floors.length; fi++) {
            const runs = p.floors[fi].wallRuns.filter((r) => r.kind === 'outer');
            const wallBoxes = data.floors[fi].boxes.filter(
              (b) => b.wallKind === 'outer' && (b.kind === 'wall' || b.kind === 'sill' || b.kind === 'window-head'),
            );
            const xRuns = runs.filter((r) => r.axis === 'x');
            const yRuns = runs.filter((r) => r.axis === 'y');
            // Every shared endpoint between an x-run and a y-run is a corner.
            for (const xr of xRuns) {
              const xEnds = [{ x: xr.x1, y: xr.y1 }, { x: xr.x2, y: xr.y1 }];
              for (const yr of yRuns) {
                const yEnds = [{ x: yr.x1, y: yr.y1 }, { x: yr.x1, y: yr.y2 }];
                for (const xe of xEnds) {
                  for (const ye of yEnds) {
                    if (Math.abs(xe.x - ye.x) > 1e-6 || Math.abs(xe.y - ye.y) > 1e-6) continue;
                    // Shared corner. Its OUTWARD diagonal = xr.ny (y outward) and
                    // yr.nx (x outward). Sample a point half a thickness outward
                    // on BOTH axes from the corner: the classic notch location.
                    const px = xe.x + yr.nx * (T / 2);
                    const py = xe.y + xr.ny * (T / 2);
                    cornersChecked++;
                    expect(
                      cornerFilled(wallBoxes, px, py),
                      `${type} seed ${seed} floor ${p.floors[fi].level} corner (${xe.x},${xe.y}) notch unfilled`,
                    ).toBe(true);
                  }
                }
              }
            }
          }
        }
      }
      expect(cornersChecked).toBeGreaterThan(0); // not vacuous
    });

    it('does not double-fill concave corners (no wall box crosses inward)', () => {
      // Extending a run at a corner must never push a box into the interior:
      // every outer wall box must still sample OUTSIDE the footprint half a cell
      // across its own wall line (the pre-existing outward invariant, unchanged).
      const p = generateBuilding({
        buildingId: 4, type: 'manor', seedPath: rootSeedPath(4), storeys: 2, basement: true,
      });
      const data = buildBuildingMeshData(p);
      const inside = new Set(p.footprintCells.map((c) => cellKey(c.cx, c.cy)));
      const outer = data.floors.flatMap((f) => f.boxes).filter(
        (b): b is MeshBox & { nx: number; ny: number } =>
          b.wallKind === 'outer' && b.nx !== undefined && b.ny !== undefined,
      );
      for (const b of outer) {
        const px = b.x + b.nx * 2.5;
        const py = b.y + b.ny * 2.5;
        expect(inside.has(cellKey(Math.floor(px / 5), Math.floor(py / 5)))).toBe(false);
      }
    });
  });
});
