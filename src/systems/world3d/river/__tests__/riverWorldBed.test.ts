/**
 * The world's river as the live river's bed (ADR 0009 step 6, slice 10).
 * The frame's turn, the lattice's triangles and the reach built on a world bed.
 */
import { describe, expect, it, afterEach } from 'vitest';
import {
  buildWorldTerrainLattice, carryRiverWater, latticeHeightAt, riverLocalCourse, riverLocalToWorld, riverWorldFrameNear, worldDirToRiverLocal,
  worldToRiverLocal, type RiverWorldBedInit, type RiverWorldCarry, type RiverWorldFrame,
} from '../riverWorldBed';
import { buildRiverReach, courseKeyAt, designLevelAt, defaultRiverCourse, getRiverShape, getRiverWorldBed, setRiverWorldBed, RIVER_GRID } from '../riverReach';
import { reachInflow, reachStartState } from '../riverFlowField';
import { LiveRiver } from '../riverLive';

afterEach(() => setRiverWorldBed(null));

describe('the river frame', () => {
  const f: RiverWorldFrame = { x: 100, z: 200, yaw: Math.PI / 6, datum: 5 };

  it('turns local +x to the bearing yaw and back', () => {
    const [xw, zw] = riverLocalToWorld(f, 10, 0);
    expect(xw).toBeCloseTo(100 + 10 * Math.cos(Math.PI / 6), 9);
    expect(zw).toBeCloseTo(200 + 10 * Math.sin(Math.PI / 6), 9);
    const [xl, zl] = worldToRiverLocal(f, xw, zw);
    expect(xl).toBeCloseTo(10, 9);
    expect(zl).toBeCloseTo(0, 9);
    const [dx, dz] = worldDirToRiverLocal(f, Math.cos(Math.PI / 6), Math.sin(Math.PI / 6));
    expect(dx).toBeCloseTo(1, 9);
    expect(dz).toBeCloseTo(0, 9);
  });

  it('anchors the nearest point of a world line at the given local point, flowing +x', () => {
    // A line running toward -x and +z (the river window's bearing).
    const line = Array.from({ length: 40 }, (_, k) => ({ x: 800 - k * 14.3, z: 300 + k * 5.3 }));
    const near = { x: 457, z: 457 };
    const r = riverWorldFrameNear(line, near, [115, 70], 0);
    // Local +x points downstream (toward later points).
    const [dx, dz] = riverLocalToWorld({ ...r.frame, x: 0, z: 0 }, 1, 0);
    expect(dx).toBeCloseTo(-14.3 / Math.hypot(14.3, 5.3), 6);
    expect(dz).toBeCloseTo(5.3 / Math.hypot(14.3, 5.3), 6);
    // The anchor sits at local (115, 70), and the spawn beside it.
    const [ax, az] = worldToRiverLocal(r.frame, r.anchor.x, r.anchor.z);
    expect(ax).toBeCloseTo(115, 6);
    expect(az).toBeCloseTo(70, 6);
    const [, nz] = worldToRiverLocal(r.frame, near.x, near.z);
    expect(Math.abs(nz - 70)).toBeCloseTo(r.distanceM, 6);
  });

  it('keeps the course points that cross the reach plus one past each end, upstream first', () => {
    const line = Array.from({ length: 60 }, (_, k) => ({ x: k * 20, z: 0 }));
    const f: RiverWorldFrame = { x: 500, z: -70, yaw: 0, datum: 0 };
    const pts = riverLocalCourse(f, line, -330, 560);
    expect(pts[0][0]).toBeLessThan(-330);
    expect(pts[pts.length - 1][0]).toBeGreaterThan(560);
    expect(pts[1][0]).toBeGreaterThanOrEqual(-330);
    for (let k = 1; k < pts.length; k += 1) expect(pts[k][0]).toBeGreaterThan(pts[k - 1][0]);
    expect(pts.every((p) => Math.abs(p[1] - 70) < 1e-9)).toBe(true);
  });
});

describe('the terrain lattice', () => {
  it('reads the plane of the anti-diagonal triangle under a point', () => {
    const l = buildWorldTerrainLattice({ x: 0, z: 0, yaw: 0, datum: 0 }, { x0: 0, z0: 0, x1: 16, z1: 16 }, 8, (x, z) => x * 0.5 + (z >= 8 && x >= 8 ? 10 : 0));
    // On a plane the triangles reproduce it exactly.
    expect(latticeHeightAt(l, 3, 2)).toBeCloseTo(1.5, 12);
    // In the quad (8..16, 8..16) the corners are 4, 8, 14, 18 (+10 at the two far corners).
    // Lower triangle (fx + fz <= 1): h00 + (h10 - h00) fx + (h01 - h00) fz with h00 = 4 + 0? No: h(8,8) = 14, h(16,8) = 18, h(8,16) = 14, h(16,16) = 18.
    expect(latticeHeightAt(l, 10, 9)).toBeCloseTo(14 + (18 - 14) * 0.25 + (14 - 14) * 0.125, 12);
    // Upper triangle (fx + fz > 1): h11 + (h01 - h11)(1 - fx) + (h10 - h11)(1 - fz).
    expect(latticeHeightAt(l, 15, 15)).toBeCloseTo(18 + (14 - 18) * (1 - 0.875) + (18 - 18) * (1 - 0.875), 12);
  });

  it('covers the turned box with a margin vertex', () => {
    const f: RiverWorldFrame = { x: 1000, z: 1000, yaw: 0.7, datum: 0 };
    const l = buildWorldTerrainLattice(f, { x0: -260, z0: -220, x1: 480, z1: 360 }, 8, () => 1);
    for (const [x, z] of [[-260, -220], [480, -220], [-260, 360], [480, 360]] as const) {
      const [xw, zw] = riverLocalToWorld(f, x, z);
      expect(xw).toBeGreaterThan(l.x0 + 8);
      expect(xw).toBeLessThan(l.x0 + (l.nx - 1) * 8 - 8);
      expect(zw).toBeGreaterThan(l.z0 + 8);
      expect(zw).toBeLessThan(l.z0 + (l.nz - 1) * 8 - 8);
    }
    expect(l.x0 % 8).toBe(0);
    expect(l.z0 % 8).toBe(0);
  });
});

describe('a reach on a world bed', () => {
  /** A flat valley at 20 m with a 10 m wide, 2 m deep trench along world x (bearing 0.3), falling 1 m over 500 m. */
  function makeBed(): RiverWorldBedInit {
    const frame: RiverWorldFrame = { x: 2000, z: 3000, yaw: 0.3, datum: 17 };
    const centerline = Array.from({ length: 80 }, (_, k) => {
      const [x, z] = riverLocalToWorld(frame, -400 + k * 15, 70);
      return { x, z };
    });
    const heightAt = (xw: number, zw: number): number => {
      const [xl, zl] = worldToRiverLocal(frame, xw, zw);
      const n = Math.abs(zl - 70);
      const floor = 18 - (xl + 400) / 500;
      return n < 5 ? floor : n < 7 ? floor + (n - 5) * 1 : 20;
    };
    const lattice = buildWorldTerrainLattice(frame, { x0: -260, z0: -220, x1: 480, z1: 360 }, 8, heightAt);
    const course = riverLocalCourse(frame, centerline, -330, 560);
    return {
      frame, lattice, course, halfW: 5, channelDepthM: 0.5, manning: 0.04, levelRangeX: [RIVER_GRID.x0, RIVER_GRID.x0 + RIVER_GRID.nx * RIVER_GRID.dx],
      // One water (2026-10-30): the world's flow at the west edge, no tributaries.
      dischargeM3S: 1.5, tributaries: [],
    };
  }

  it('builds the course, the ground and the keys from the world bed, and the inflow stands in the trench', () => {
    const bed = makeBed();
    setRiverWorldBed(bed);
    expect(getRiverWorldBed()).toBe(bed);
    const course = defaultRiverCourse();
    // The course runs along local z = 70, downstream +x.
    const p = course.at(100);
    expect(p.z).toBeCloseTo(70, 3);
    expect(p.tx).toBeGreaterThan(0.99);
    expect(courseKeyAt(50).halfW).toBe(5);
    expect(courseKeyAt(50).manning).toBe(0.04);
    const reach = buildRiverReach(20260928, RIVER_GRID);
    expect(reach.boulders.length).toBe(0);
    const { nx, dx, x0, z0 } = reach.grid;
    // The ground at a trench cell is the world's drawn height less the datum.
    const i = 200;
    const j = 140;
    const c = j * nx + i;
    const xl = x0 + (i + 0.5) * dx;
    const zl = z0 + (j + 0.5) * dx;
    expect(reach.ground[c]).toBeCloseTo(latticeHeightAt(bed.lattice, ...riverLocalToWorld(bed.frame, xl, zl)) - 17, 9);
    expect(reach.ground[c]).toBeLessThan(1.1);
    // A bank cell stands at the valley floor (20 - 17 = 3 m), away from the lattice's smeared trench edge.
    expect(reach.ground[j * nx + i + 0] ).toBeLessThan(reach.ground[(j + 40) * nx + i]);
    expect(reach.ground[(j + 40) * nx + i]).toBeCloseTo(3, 6);
    // The design level is the channel depth over the bed and never rises downstream.
    const l0 = designLevelAt(0);
    const l1 = designLevelAt(200);
    expect(l1).toBeLessThanOrEqual(l0 + 1e-9);
    // The level stands the channel depth over the bed under the course, less
    // the running minimum's hold where the lattice's triangles make the
    // trench floor bumpy: between 0 and the channel depth over the bed here.
    const over = l0 - (latticeHeightAt(bed.lattice, ...riverLocalToWorld(bed.frame, course.at(0).x, course.at(0).z)) - 17);
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThanOrEqual(0.5 + 1e-9);
    // The start state wets the trench and the west edge has inflow cells.
    const st = reachStartState(reach.grid, reach.bed, reach.cellS, reach.cellN, reach.course, reach.dischargeM3S);
    let wet = 0;
    for (let k = 0; k < st.h0.length; k += 1) if (st.h0[k] > 0.02) wet += 1;
    expect(wet).toBeGreaterThan(5000);
    const inf = reachInflow(reach.grid, st.h0, reach.cellS, reach.cellN, reach.course, reach.dischargeM3S, reach.bed);
    expect(inf.inflow.length).toBeGreaterThan(10);
    expect(inf.dir[0]).toBeGreaterThan(0.99);
  });

  it('feeds the world flow, and a tributary joins at its own mouth with its own share (one water)', () => {
    const tributary = { x: 100, z: 70, halfW: 3, dir: [0, -1] as [number, number], speedMS: 0.5, dischargeM3S: 0.5 };
    setRiverWorldBed({ ...makeBed(), dischargeM3S: 2, tributaries: [tributary] });
    // The build's default shape carries all the water that enters the box.
    const live = new LiveRiver(20260928);
    expect(getRiverShape().dischargeM3S).toBe(2.5);
    expect(live.shape.dischargeM3S).toBe(2.5);
    const solver = (live as unknown as { solver: { inflow: ReadonlyArray<{ c: number; share: number; velocityMS?: readonly [number, number] }> } }).solver;
    const shares = solver.inflow.reduce((s, c) => s + c.share, 0);
    expect(shares).toBeCloseTo(1, 9);
    const mouth = solver.inflow.filter((c) => c.velocityMS);
    expect(mouth.length).toBeGreaterThan(0);
    // The tributary's cells carry its 0.5 of the 2.5 m^3/s, moving along it.
    expect(mouth.reduce((s, c) => s + c.share, 0)).toBeCloseTo(0.5 / 2.5, 9);
    for (const c of mouth) {
      expect(c.velocityMS![1]).toBeCloseTo(-0.5, 9);
      const { nx, dx, x0, z0 } = RIVER_GRID;
      const cx = x0 + ((c.c % nx) + 0.5) * dx;
      const cz = z0 + (Math.floor(c.c / nx) + 0.5) * dx;
      expect(Math.hypot(cx - tributary.x, cz - tributary.z)).toBeLessThanOrEqual(tributary.halfW);
    }
  });

  it('clears the world bed and gives the page its own course back', () => {
    setRiverWorldBed(makeBed());
    const worldS = defaultRiverCourse().at(0).z;
    setRiverWorldBed(null);
    expect(getRiverWorldBed()).toBeNull();
    const pageZ = defaultRiverCourse().at(0).z;
    expect(pageZ).not.toBeCloseTo(worldS, 0);
    expect(courseKeyAt(50).halfW).toBe(12);
  });
});

describe('the water carried into a moved reach (one water, step 1, 2026-10-30)', () => {
  // An old reach: a 20 x 10 grid of 1 m cells on a flat bed 2 m over its datum,
  // water standing 0.5 m deep and running at 1 m/s along its +x, except the
  // last column, which is dry.
  const grid = { x0: 0, z0: 0, dx: 1, nx: 20, nz: 10 };
  const oldFrame: RiverWorldFrame = { x: 100, z: 50, yaw: 0, datum: 10 };
  const carryOf = (frame: RiverWorldFrame): RiverWorldCarry => {
    const n = grid.nx * grid.nz;
    const h = new Float32Array(n).fill(0.5);
    for (let j = 0; j < grid.nz; j += 1) h[j * grid.nx + grid.nx - 1] = 0;
    const hu = Float32Array.from(h, (d) => d * 1);
    return { frame, grid, h, hu, hv: new Float32Array(n), bed: new Float32Array(n).fill(2) };
  };
  const fresh = (n: number) => ({ h: new Float64Array(n).fill(9), u: new Float64Array(n).fill(9), v: new Float64Array(n).fill(9) });

  it('keeps the water surface where the boxes overlap, and the start values elsewhere', () => {
    // The new reach: 10 m further along, its datum 1 m higher, its bed 0.2 m
    // lower against the world (so 1.2 m over its own datum where the old bed was 2).
    const frame: RiverWorldFrame = { x: 110, z: 50, yaw: 0, datum: 11 };
    const n = grid.nx * grid.nz;
    const bed = new Float32Array(n).fill(0.8);
    const out = fresh(n);
    const taken = carryRiverWater(carryOf(oldFrame), frame, grid, bed, out);
    // Old surface: 10 + 2 + 0.5 = 12.5 world m. New bed: 11 + 0.8 = 11.8. Depth 0.7.
    const c = 3 * grid.nx + 2; // new local x 2.5 -> old local x 12.5: wet
    expect(out.h[c]).toBeCloseTo(0.7, 6);
    expect(out.u[c]).toBeCloseTo(1, 6);
    expect(out.v[c]).toBeCloseTo(0, 6);
    // New local x 9.5 -> old x 19.5: the old box's dry column, so dry here too.
    expect(out.h[3 * grid.nx + 9]).toBe(0);
    // New local x 10.5 and on lie past the old box: the start values stay.
    expect(out.h[3 * grid.nx + 10]).toBe(9);
    expect(taken).toBe(10 * grid.nz);
  });

  it('turns the velocity into the new reach axes', () => {
    // The new reach turned a quarter turn: old +x (world +x) is new -z.
    const frame: RiverWorldFrame = { x: 110, z: 55, yaw: Math.PI / 2, datum: 10 };
    const n = grid.nx * grid.nz;
    const out = fresh(n);
    carryRiverWater(carryOf(oldFrame), frame, grid, new Float32Array(n).fill(2), out);
    // New local (0.5, 0.5) -> world (109.5, 55.5) -> old (9.5, 5.5): wet.
    expect(out.h[0]).toBeCloseTo(0.5, 6);
    expect(out.u[0]).toBeCloseTo(0, 6);
    expect(out.v[0]).toBeCloseTo(-1, 6);
  });

  it('skips a new cell with no bed', () => {
    const n = grid.nx * grid.nz;
    const bed = new Float32Array(n).fill(2);
    bed[0] = Number.NaN;
    const out = fresh(n);
    carryRiverWater(carryOf(oldFrame), oldFrame, grid, bed, out);
    expect(out.h[0]).toBe(9);
    expect(out.h[1]).toBeCloseTo(0.5, 6);
  });
});
