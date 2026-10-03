/**
 * THE LIVE RIVER (2026-09-29): the edit model, the bed patch, the live solver
 * and the live flow map.
 *
 * What must hold:
 * - an edit that ends on the judged river leaves the judged ground, bed and
 *   rocks bit for bit;
 * - a drag and a jump to the same edit draw the same ground (within a few mm:
 *   the outside fields reach a little past a patch's box);
 * - a moved control point changes the course only on its four segments, and
 *   keeps the design s everywhere;
 * - a local width changes the half width only near its control point;
 * - the solver stays stable across a patch, and fills a moved channel;
 * - the live flow map's pieces agree with the judged ones (the sheet builder,
 *   the half-float packing).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { DataUtils } from 'three';
import {
  RIVER_COURSE_POINTS, RIVER_SHAPE_DEFAULT, RiverCourse, clampRiverCourseEdit, courseKeyAt, defaultRiverCourse, designLevelAt,
  parseRiverCourseEdit, riverCourseEditKey, riverCourseFor, riverWidthAt, setRiverCourseEdit, setRiverShape,
  type RiverCourseEdit,
} from '../riverReach';
import { LiveRiver } from '../riverLive';
import { buildWaterSheetArrays, toHalfArray } from '../riverWaterSheet';

afterEach(() => {
  setRiverShape(null);
  setRiverCourseEdit(null);
});

const N = RIVER_COURSE_POINTS.length;
const move = (p: number, dx: number, dz: number, widths?: number[]): RiverCourseEdit => ({
  offsets: Array.from({ length: N }, (_, k) => (k === p ? [dx, dz] as [number, number] : [0, 0] as [number, number])),
  widths: widths ?? new Array(N).fill(1),
});
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let m = 0;
  for (let i = 0; i < a.length; i += 1) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};

describe('the course edit', () => {
  it('moves only the four segments round a moved point and keeps the design s', () => {
    const def = defaultRiverCourse();
    setRiverCourseEdit(move(12, 10, 4));
    const c = riverCourseFor(move(12, 10, 4));
    expect(c.samples.length).toBe(def.samples.length);
    // Point 12 reads segments 10 to 13 (Catmull-Rom: points k - 1 .. k + 2).
    const sA = def.pointS[10];
    const sB = def.pointS[14];
    let movedOutside = 0;
    let movedInside = 0;
    for (let k = 0; k < def.samples.length; k += 1) {
      const a = def.samples[k];
      const b = c.samples[k];
      expect(b.s).toBe(a.s);
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (a.s < sA - 0.5 || a.s > sB + 0.5) { if (d > 1e-6) movedOutside += 1; } else if (d > 0.5) movedInside += 1;
    }
    expect(movedOutside).toBe(0);
    expect(movedInside).toBeGreaterThan(40);
    // The control points keep their design s.
    expect(c.pointS).toEqual(def.pointS);
  });

  it('keeps an edit inside its limits and round-trips its key', () => {
    const e = clampRiverCourseEdit(move(12, 90, 0, Array.from({ length: N }, (_, k) => (k === 15 ? 9 : 1))));
    expect(e).not.toBeNull();
    expect(Math.hypot(e!.offsets[12][0], e!.offsets[12][1])).toBeLessThanOrEqual(40 + 1e-9);
    expect(e!.widths[15]).toBe(2);
    // A point outside the solver grid does not move.
    expect(clampRiverCourseEdit(move(1, 10, 10))).toBeNull();
    const k = riverCourseEditKey(e);
    expect(k).toContain('c12:');
    const back = parseRiverCourseEdit(k);
    expect(riverCourseEditKey(back)).toBe(k);
  });

  it('widens the channel only near a widened point', () => {
    const def = defaultRiverCourse();
    const w = new Array(N).fill(1);
    w[15] = 1.6;
    setRiverCourseEdit({ offsets: move(0, 0, 0).offsets, widths: w });
    expect(riverWidthAt(def.pointS[15])).toBeCloseTo(1.6, 9);
    // Beyond the Catmull-Rom support (points 13 to 17) the width is the table's.
    expect(riverWidthAt(def.pointS[12])).toBe(1);
    expect(riverWidthAt(def.pointS[18])).toBe(1);
    const hw = courseKeyAt(def.pointS[15]).halfW;
    setRiverCourseEdit(null);
    expect(hw / courseKeyAt(def.pointS[15]).halfW).toBeCloseTo(1.6, 9);
  });

  it('builds the judged course by its own code path (no reference)', () => {
    const a = new RiverCourse();
    const b = defaultRiverCourse();
    expect(a.samples.map((s) => s.x)).toEqual(b.samples.map((s) => s.x));
    expect(a.samples.every((s) => s.stretch === 1)).toBe(true);
  });
});

describe('the live river', () => {
  // One river for the tests below: its build is about 3 s.
  const live = new LiveRiver();
  live.startCold();
  live.advance(400);

  it('returns to the judged ground, bed and rocks bit for bit', () => {
    live.applyEdit({ shape: { ...RIVER_SHAPE_DEFAULT, widthScale: 1.3 }, course: null });
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: move(12, 8, 3) });
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
    expect(maxDiff(live.ground, live.reach.ground)).toBe(0);
    expect(maxDiff(live.solver.bed, live.reach.bed)).toBe(0);
    const off = live.boulders.filter((b, k) => {
      const d = live.reach.boulders[k];
      return b.x !== d.x || b.y !== d.y || b.z !== d.z;
    });
    expect(off.length).toBe(0);
  }, 60000);

  it('draws the same ground after a drag as after a jump to the same edit', () => {
    const w = new Array(N).fill(1);
    w[15] = 1.5;
    for (let k = 1; k <= 4; k += 1) live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: move(12, 3 * k, 1.5 * k) });
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: move(12, 12, 6, w) });
    const other = new LiveRiver();
    other.startCold();
    other.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: move(12, 12, 6, w) });
    expect(maxDiff(live.ground, other.ground)).toBeLessThan(0.005);
    // The edit changed the ground (a lot) near the bend.
    expect(maxDiff(live.ground, live.reach.ground)).toBeGreaterThan(0.5);
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
  }, 120000);

  it('keeps the solver stable across a patch and fills the moved channel', () => {
    const bedBefore = live.solver.bed.slice();
    const hBefore = live.solver.h.slice();
    const p = live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: move(12, 14, 4) });
    expect(p.cells).toBeGreaterThan(1000);
    // THE NEW CHANNEL: cells the patch carved 0.3 m or more that held no water.
    // (Wet cells keep their surface across a patch, so a carve under standing
    // water adds water and a raised bed takes it: the volume is not kept.)
    // A film (under 2 cm) keeps its depth where the bed drops.
    const carved: number[] = [];
    for (let c = 0; c < bedBefore.length; c += 1) {
      // (Carved and under the design water level: the new channel itself, not
      // the lowered floodplain beside it, which stays dry at low water.)
      const under = live.solver.bed[c] < designLevelAt(live.cellS[c]) - 0.1;
      if (bedBefore[c] - live.solver.bed[c] > 0.3 && hBefore[c] < 0.02 && under) carved.push(c);
    }
    expect(carved.length).toBeGreaterThan(100);
    expect(carved.every((c) => live.solver.h[c] <= hBefore[c])).toBe(true);
    live.advance(8000, 30);
    const hl = live.solver.health();
    expect(hl.ok).toBe(true);
    expect(live.solver.breachCells()).toBe(0);
    expect(live.restores).toBe(0);
    // 30 s of flow later the water has run into the new channel.
    const wet = carved.filter((c) => live.solver.h[c] > 0.01).length;
    expect(wet / carved.length).toBeGreaterThan(0.6);
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
  }, 120000);

  it('makes a flow map and a sheet from its running field', () => {
    live.advance(300);
    const s1 = live.snapshot();
    live.advance(300);
    const s2 = live.snapshot();
    expect(s2.simTime).toBeGreaterThan(s1.simTime);
    expect(s2.mapStats.wetCells).toBeGreaterThan(8000);
    expect(s2.sheet.pos.length / 3).toBeGreaterThan(8000);
    expect(s2.readout.meanSpeed).toBeGreaterThan(0.1);
    expect(s2.t0h.length).toBe(s2.t0.length);
  }, 60000);
});

describe('the pieces the live map shares with the judged map', () => {
  it('packs half floats as three.js does', () => {
    const src = Float32Array.from([0, -0, 1, -1, 0.1, 3.14159, 1e-5, -65000, 70000, 1e-8, 123.456, -2.5]);
    const h = toHalfArray(src);
    for (let i = 0; i < src.length; i += 1) {
      const v = Math.max(-60000, Math.min(60000, src[i]));
      expect(h[i]).toBe(DataUtils.toHalfFloat(v));
    }
  });

  it('builds a sheet with a vertex per drawn cell and triangles over drawn quads', () => {
    const grid = { x0: 0, z0: 0, dx: 0.5, nx: 4, nz: 3 };
    const S = new Float32Array(12).fill(Number.NaN);
    for (const c of [0, 1, 2, 4, 5, 6, 8]) S[c] = 1;
    const sheet = buildWaterSheetArrays(grid, S);
    expect(sheet.pos.length / 3).toBe(7);
    // Quads (0,1,4,5) and (1,2,5,6) are whole (2 triangles each); (4,5,8,9) has three corners (1).
    expect(sheet.index.length / 3).toBe(5);
    for (let k = 0; k < sheet.nor.length; k += 3) expect(sheet.nor[k + 1]).toBeCloseTo(1, 9);
  });
});
