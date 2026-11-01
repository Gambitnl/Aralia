import { describe, expect, it, vi } from 'vitest';
import { riverSourceMapProjection } from '../riverSourceMapProjection';
import { defaultRiverCourse } from '@/systems/world3d/river/riverReach';
import { WATERFALL } from '@/systems/world3d/river/riverHeadwaters';

describe('approach map course coordinates', () => {
  const grid = { x0: -13.5, z0: 6.2, dx: 0.7, nx: 7, nz: 9 };
  const crest = { x: -3, z: 4, tx: 0.6, tz: 0.8 };
  const makeCourse = () => ({
    project: vi.fn((x: number, z: number) => ({ s: x * 0.6 + z * 0.8, n: x * 0.8 - z * 0.6 })),
    at: vi.fn((s: number) => ({ tx: Math.cos(s), tz: Math.sin(s) })),
  });
  it('retains every original double exactly and avoids repeated projection', () => {
    const owner = {}, course = makeCourse();
    const actual = riverSourceMapProjection(owner, course, grid, crest);
    for (let c = 0; c < grid.nx * grid.nz; c++) {
      const x = grid.x0 + (c % grid.nx + 0.5) * grid.dx;
      const z = grid.z0 + (Math.floor(c / grid.nx) + 0.5) * grid.dx;
      const pr = course.project(x, z), p = course.at(pr.s);
      expect(Array.from(actual.subarray(c * 5, c * 5 + 5))).toEqual([
        pr.s, pr.n, p.tx, p.tz, (x - crest.x) * crest.tx + (z - crest.z) * crest.tz,
      ]);
    }
    course.project.mockClear(); course.at.mockClear();
    expect(riverSourceMapProjection(owner, course, { ...grid }, { ...crest })).toBe(actual);
    expect(course.project).not.toHaveBeenCalled(); expect(course.at).not.toHaveBeenCalled();
  });
  it('rebuilds for course, grid and crest edits and keeps owners independent', () => {
    const owner = {}, course = makeCourse();
    const initial = riverSourceMapProjection(owner, course, grid, crest);
    expect(riverSourceMapProjection({}, course, grid, crest)).not.toBe(initial);
    const changed = riverSourceMapProjection(owner, makeCourse(), grid, crest);
    expect(changed).not.toBe(initial);
    const moved = riverSourceMapProjection(owner, course, { ...grid, x0: 2 }, crest);
    expect(moved).not.toEqual(initial);
    expect(riverSourceMapProjection(owner, course, grid, { ...crest, tx: 0.8 })).not.toEqual(initial);
  });
  it('matches every stored bit for the actual 128 by 128 approach grid', () => {
    const course = defaultRiverCourse(), crest = course.at(WATERFALL.crestS);
    const grid = { x0: crest.x - 64, z0: crest.z - 64, dx: 1, nx: 128, nz: 128 };
    const expected = new Float64Array(grid.nx * grid.nz * 5);
    for (let c = 0; c < grid.nx * grid.nz; c++) {
      const x = grid.x0 + (c % grid.nx + 0.5) * grid.dx;
      const z = grid.z0 + (Math.floor(c / grid.nx) + 0.5) * grid.dx;
      const pr = course.project(x, z), p = course.at(pr.s);
      expected.set([pr.s, pr.n, p.tx, p.tz, (x - crest.x) * crest.tx + (z - crest.z) * crest.tz], c * 5);
    }
    const actual = riverSourceMapProjection({}, course, grid, crest);
    expect(new Uint8Array(actual.buffer)).toEqual(new Uint8Array(expected.buffer));
  });
});
