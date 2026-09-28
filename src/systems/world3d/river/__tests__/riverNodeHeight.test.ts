/**
 * THE NODE HEIGHTS (2026-09-29): each control point of the live river editor
 * can raise (+) or lower (-) the channel's bed on its own (Remy: "make it so
 * that i can make the river nodes be able to go up and down individually").
 *
 * What must hold:
 * - the height along the course is 0 with no edit, equals the point's height
 *   at the point, never overshoots, and is 0 past a lone point's neighbors;
 * - the mound across the channel is 1 at the thalweg and 0 in the outer 30 %
 *   of the half width (the side channels keep the judged bed);
 * - an edit with all heights 0 is the judged river (clamps to null), and a
 *   height survives the address key;
 * - on the live river: a lowered point drops the bed only between its
 *   neighbors, the same edit gives the same bed each time, and a return to
 *   the judged river is bit for bit;
 * - the node report names what a height does to the water: deeper,
 *   shallower (a riffle), split (a dry hump with water beside it) or block
 *   (a pond upstream that spills over the lowest point).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  RIVER_COURSE_POINTS, RIVER_EDIT_LIMITS, RIVER_MOUND_WIDTH, RIVER_SHAPE_DEFAULT, clampRiverCourseEdit,
  defaultRiverCourse, designLevelAt, parseRiverCourseEdit, riverCourseEditKey, riverHeightAt, riverMoundAt,
  setRiverCourseEdit, setRiverShape, type RiverCourseEdit,
} from '../riverReach';
import { LiveRiver } from '../riverLive';

afterEach(() => {
  setRiverShape(null);
  setRiverCourseEdit(null);
});

const N = RIVER_COURSE_POINTS.length;
/** An edit that changes only the heights: `hs` maps a point to its height. */
const heightsEdit = (hs: Record<number, number>): RiverCourseEdit => ({
  offsets: Array.from({ length: N }, () => [0, 0] as [number, number]),
  widths: new Array(N).fill(1),
  heights: Array.from({ length: N }, (_, k) => hs[k] ?? 0),
});
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let m = 0;
  for (let i = 0; i < a.length; i += 1) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};

describe('the height along the course', () => {
  const pS = defaultRiverCourse().pointS;

  it('is 0 with no edit', () => {
    setRiverCourseEdit(null);
    for (let s = pS[4]; s <= pS[22]; s += 3.7) expect(riverHeightAt(s)).toBe(0);
  });

  it('equals the height at the point, stays between its neighbors and ends at them', () => {
    setRiverCourseEdit(heightsEdit({ 9: 2 }));
    expect(riverHeightAt(pS[9])).toBe(2);
    expect(riverHeightAt(pS[8])).toBe(0);
    expect(riverHeightAt(pS[10])).toBe(0);
    // Past the neighbors: 0 (a lone raised point is local).
    for (let s = pS[4]; s <= pS[8]; s += 0.5) expect(riverHeightAt(s)).toBe(0);
    for (let s = pS[10]; s <= pS[22]; s += 0.5) expect(riverHeightAt(s)).toBe(0);
    // Between them: no overshoot, and it climbs to the point and falls after it.
    let prev = -Infinity;
    for (let s = pS[8]; s <= pS[9]; s += 0.25) {
      const h = riverHeightAt(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(2);
      expect(h).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = h;
    }
    prev = Infinity;
    for (let s = pS[9]; s <= pS[10]; s += 0.25) {
      const h = riverHeightAt(s);
      expect(h).toBeLessThanOrEqual(prev + 1e-12);
      prev = h;
    }
  });

  it('makes no dip between a raised point and a lowered one', () => {
    setRiverCourseEdit(heightsEdit({ 9: 2, 10: -1 }));
    for (let s = pS[9]; s <= pS[10]; s += 0.25) {
      const h = riverHeightAt(s);
      expect(h).toBeGreaterThanOrEqual(-1);
      expect(h).toBeLessThanOrEqual(2);
    }
  });
});

describe('the mound across the channel', () => {
  it('is 1 at the thalweg and 0 in the outer 30 % of the half width', () => {
    expect(riverMoundAt(0)).toBe(1);
    expect(riverMoundAt(RIVER_MOUND_WIDTH)).toBe(0);
    for (let t = RIVER_MOUND_WIDTH; t <= 1; t += 0.01) expect(riverMoundAt(t)).toBe(0);
  });

  it('falls without a step and meets the judged bed with a flat slope', () => {
    let prev = 1;
    for (let t = 0; t <= RIVER_MOUND_WIDTH; t += 0.005) {
      const m = riverMoundAt(t);
      expect(m).toBeLessThanOrEqual(prev + 1e-12);
      prev = m;
    }
    // Near the edge the slope is near 0: (1 - u^2)^2 has a double root at u = 1.
    expect(riverMoundAt(RIVER_MOUND_WIDTH * 0.99)).toBeLessThan(1e-3);
  });
});

describe('the height in the edit', () => {
  it('clamps an edit with all heights 0 to the judged river', () => {
    expect(clampRiverCourseEdit(heightsEdit({}))).toBeNull();
    expect(setRiverCourseEdit(heightsEdit({}))).toBeNull();
    expect(riverHeightAt(defaultRiverCourse().pointS[9])).toBe(0);
  });

  it('keeps a height inside its limits and only on the editable points', () => {
    const e = clampRiverCourseEdit(heightsEdit({ 9: 9, 12: -7, 2: 3 }));
    expect(e).not.toBeNull();
    expect(e!.heights![9]).toBe(RIVER_EDIT_LIMITS.height[1]);
    expect(e!.heights![12]).toBe(RIVER_EDIT_LIMITS.height[0]);
    // Point 2 is outside the solver grid: it keeps the judged bed.
    expect(e!.heights![2]).toBe(0);
  });

  it('round-trips a height through the address key', () => {
    const e = clampRiverCourseEdit(heightsEdit({ 9: -1.58, 17: 4.65 }));
    const k = riverCourseEditKey(e);
    expect(k).toBe('h9:-1.58_h17:4.65');
    const back = parseRiverCourseEdit(k);
    expect(back!.heights![9]).toBe(-1.58);
    expect(back!.heights![17]).toBe(4.65);
    expect(riverCourseEditKey(back)).toBe(k);
  });
});

describe('the node heights on the live river', () => {
  // One river for the tests below: its build is about 3 s.
  const live = new LiveRiver();
  live.startCold();
  live.advance(400);
  const pS = defaultRiverCourse().pointS;

  it('drops the bed only between the neighbors of a lowered point', () => {
    const p = live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: heightsEdit({ 9: -1.5 }) });
    // THE GROUND (no boulders): lowered only, and only between the neighbors.
    // (The patch keeps the judged outside fields: a height moves nothing
    // outside its mound, not even by the refresh's 120 m cut.)
    let deepest = 0;
    let outside = 0;
    let raised = 0;
    for (let c = 0; c < live.ground.length; c += 1) {
      const d = live.ground[c] - live.reach.ground[c];
      if (d > 0) raised += 1;
      if (d < deepest) deepest = d;
      const s = live.cellS[c];
      if (d !== 0 && (s < pS[8] || s > pS[10])) outside += 1;
    }
    // The middle of the channel at the point drops by about the full 1.5 m.
    expect(deepest).toBeLessThan(-1.3);
    expect(deepest).toBeGreaterThanOrEqual(-1.5);
    expect(outside).toBe(0);
    expect(raised).toBe(0);
    // THE SOLVER'S BED: the ground and the boulder tops. A boulder in the
    // span rides the ground's change, and its footprint reaches a few meters
    // past the span.
    let bedOutside = 0;
    for (let c = 0; c < live.solver.bed.length; c += 1) {
      const s = live.cellS[c];
      if (live.solver.bed[c] !== live.reach.bed[c] && (s < pS[8] - 4 || s > pS[10] + 4)) bedOutside += 1;
    }
    expect(bedOutside).toBe(0);
    expect(p.nodeReports.map((r) => r.kind)).toEqual(['deeper']);
    expect(p.nodeReports[0].point).toBe(9);
    // A lowered bed under standing water adds water (the surface stays).
    expect(p.volumeChange).toBeGreaterThanOrEqual(0);
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
  }, 60000);

  it('draws the same bed each time for the same heights, and returns to the judged bed bit for bit', () => {
    const e = heightsEdit({ 9: 1.6, 17: -0.8 });
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: e });
    const first = live.solver.bed.slice();
    const firstGround = live.ground.slice();
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
    expect(maxDiff(live.ground, live.reach.ground)).toBe(0);
    expect(maxDiff(live.solver.bed, live.reach.bed)).toBe(0);
    // The judged design level again (no pond table).
    expect(live.levelAt(pS[9] - 10)).toBe(designLevelAt(pS[9] - 10));
    const off = live.boulders.filter((b, k) => {
      const d = live.reach.boulders[k];
      return b.x !== d.x || b.y !== d.y || b.z !== d.z;
    });
    expect(off.length).toBe(0);
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: e });
    expect(maxDiff(live.solver.bed, first)).toBe(0);
    expect(maxDiff(live.ground, firstGround)).toBe(0);
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
  }, 60000);

  it('names a raised point a riffle, a dry hump with water beside it, or a block', () => {
    // Point 17 +2 m: the middle stays under the water (a riffle).
    const riffle = live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: heightsEdit({ 17: 2 }) }).nodeReports[0];
    expect(riffle.kind).toBe('shallower');
    expect(riffle.center).toBeLessThan(riffle.base);
    // Point 17 +4.5 m: the middle stands out of the water, and the side channels stay low.
    const split = live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: heightsEdit({ 17: 4.5 }) }).nodeReports[0];
    expect(split.kind).toBe('split');
    expect(split.center).toBeGreaterThan(split.base);
    expect(split.pass).toBeLessThan(split.base);
    expect(split.pondM).toBe(0);
    expect(split.level).toBeCloseTo(split.base, 2);
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
  }, 60000);

  it('ponds the water upstream of a full block, to the lowest point over it', () => {
    const p = live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: heightsEdit({ 9: 1.6 }) });
    const r = p.nodeReports[0];
    expect(r.kind).toBe('block');
    expect(r.noPass).toBe(false);
    // The pass is over the old level, and the new level stands over the pass.
    expect(r.pass).toBeGreaterThan(r.base);
    expect(r.level).toBeGreaterThan(r.pass);
    expect(r.passSide === 'left' || r.passSide === 'right' || r.passSide === 'middle').toBe(true);
    expect(r.pondM).toBeGreaterThan(5);
    // Upstream the level rises; far downstream it keeps the judged level.
    expect(live.levelAt(pS[9] - 5)).toBeGreaterThan(designLevelAt(pS[9] - 5) + 0.1);
    // (At a whole meter of s the table holds designLevelAt's own value.)
    const sDown = Math.round(pS[12]);
    expect(live.levelAt(sDown)).toBe(designLevelAt(sDown));
    live.applyEdit({ shape: RIVER_SHAPE_DEFAULT, course: null });
    expect(live.levelAt(pS[9] - 5)).toBe(designLevelAt(pS[9] - 5));
  }, 60000);
});
