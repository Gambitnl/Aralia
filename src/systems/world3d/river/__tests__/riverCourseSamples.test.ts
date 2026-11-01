/** Authored waterfall stations must stay in place when indexed by the native
 * course, while ordinary courses keep their original construction path. */
import { afterEach, describe, expect, it } from 'vitest';
import { RiverCourse, type CourseSample } from '../riverReach';
import { setRiverHeadwaters } from '../riverHeadwaters';

const samples = (): CourseSample[] => [0, 2.3, 5.8].map(x => ({
  x, z: 0, s: 100 + x, tx: 1, tz: 0, curv: 0, stretch: 1,
}));
afterEach(() => setRiverHeadwaters(false));

describe('retained physical course samples', () => {
  it('keeps nonuniform positions, stations and nearest-station ties', () => {
    const input = samples(), course = RiverCourse.fromSamples(input);
    expect(course.samples).toEqual(input);
    expect(course.atCurve(101)).toEqual(input[0]);
    expect(course.atCurve(104)).toEqual(input[1]);
    expect(course.atCurve((input[1].s + input[2].s) / 2)).toEqual(input[1]);
    expect(course.atCurve(-1000)).toEqual(input[0]);
    expect(course.atCurve(1000)).toEqual(input[2]);
  });

  it('owns sample copies and retains native projection units', () => {
    const input = samples(), course = RiverCourse.fromSamples(input);
    input[1].x = 500;
    input.push({ ...input[2], s: 999 });
    expect(course.samples).toHaveLength(3);
    expect(course.samples[1].x).toBe(2.3);
    const p = course.project(4, 3);
    expect(p.k).toBe(1);
    expect(p.s).toBe(104);
    expect(p.n).toBe(-3);
    expect(p.d).toBe(Math.hypot(4 - 2.3, 3));
  });

  it.each(['empty', 'one', 'unordered', 'nonfinite', 'zero stretch', 'nonunit tangent'])('rejects invalid retained samples: %s', kind => {
    let input = samples();
    if (kind === 'empty') input = [];
    if (kind === 'one') input.length = 1;
    if (kind === 'unordered') input[1].s = input[0].s;
    if (kind === 'nonfinite') input[1].z = NaN;
    if (kind === 'zero stretch') input[1].stretch = 0;
    if (kind === 'nonunit tangent') input[1].tx = .5;
    expect(() => RiverCourse.fromSamples(input)).toThrow();
  });
});
