// src/systems/worldforge/region/__tests__/riverCourse.test.ts
import { describe, it, expect } from 'vitest';
import { generateRiverCourse, type RiverCourseOptions } from '../riverCourse';

/** Flat terrain — isolates resampling and attraction from relaxation. */
const FLAT: RiverCourseOptions = {
  sampleHeight: () => 0.5,
  attractors: [],
  targetSegmentFt: 500,
  widthFt: 200,
};

/** A V-shaped valley whose floor runs along x = 5000. */
const valley = (x: number): number => Math.min(1, Math.abs(x - 5000) / 5000);

describe('generateRiverCourse', () => {
  it('resamples a long chord into segments no longer than the target', () => {
    const course = generateRiverCourse([[0, 0], [0, 25000]], FLAT);
    expect(course.length).toBeGreaterThan(40);
    for (let i = 0; i < course.length - 1; i++) {
      const d = Math.hypot(course[i + 1][0] - course[i][0], course[i + 1][1] - course[i][1]);
      expect(d).toBeLessThanOrEqual(FLAT.targetSegmentFt * 1.5);
    }
  });

  it('bends toward a burg without collapsing its own spacing', () => {
    // The defect this guards (found 2026-07-29 via the Epicea bake): pulling
    // each point toward the burg individually makes the nearest ones converge
    // on the SAME spot. The course cusps, adjacent points land on top of each
    // other, and the channel buffered from that centerline degenerates — 129 of
    // 213 points ended up under their own carved bed. Measured then: minimum
    // segment 0.00 ft against a 125 ft median. A bend must move the river, not
    // crush its parameterization.
    const anchors: Array<[number, number]> = [[0, 0], [0, 20000]];
    const burg = { x: 4045, y: 10000, radiusFt: 8090 };

    const plain = generateRiverCourse(anchors, FLAT);
    const bent = generateRiverCourse(anchors, { ...FLAT, attractors: [burg] });

    const segments = (c: Array<[number, number]>): number[] => {
      const out: number[] = [];
      for (let i = 0; i < c.length - 1; i++) {
        out.push(Math.hypot(c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1]));
      }
      return out;
    };

    const plainMin = Math.min(...segments(plain));
    const bentSegs = segments(bent);
    // No point may be swallowed by its neighbor: the bend keeps segments within
    // a factor of two of what the undisturbed course already had.
    expect(Math.min(...bentSegs)).toBeGreaterThan(plainMin / 2);
    // And nothing may be stretched into a gap the channel cannot fill.
    expect(Math.max(...bentSegs)).toBeLessThanOrEqual(FLAT.targetSegmentFt * 1.5);
  });

  it('keeps the endpoints exactly where the world put them', () => {
    // Seam purity: these are shared with the adjacent window and river segment.
    const course = generateRiverCourse([[100, 200], [8000, 9000]], FLAT);
    expect(course[0]).toEqual([100, 200]);
    expect(course[course.length - 1]).toEqual([8000, 9000]);
  });

  it('is deterministic', () => {
    const a = generateRiverCourse([[0, 0], [4000, 9000], [9000, 12000]], FLAT);
    const b = generateRiverCourse([[0, 0], [4000, 9000], [9000, 12000]], FLAT);
    expect(a).toEqual(b);
  });

  it('bends toward a burg whose cell carries the river', () => {
    // The Epicea case: the cell-center chord passes ~4,000 ft from the town.
    const anchors: Array<[number, number]> = [[0, 0], [0, 20000]];
    const burg = { x: 4045, y: 10000, radiusFt: 8000 };
    const straight = generateRiverCourse(anchors, FLAT);
    const bent = generateRiverCourse(anchors, { ...FLAT, attractors: [burg] });

    const nearest = (course: Array<[number, number]>): number =>
      Math.min(...course.map((p) => Math.hypot(p[0] - burg.x, p[1] - burg.y)));

    expect(nearest(straight)).toBeGreaterThan(4000);
    // The whole point: the course now reaches the settlement.
    expect(nearest(bent)).toBeLessThan(500);
  });

  it('does not drag distant burgs off their own rivers', () => {
    const anchors: Array<[number, number]> = [[0, 0], [0, 20000]];
    // Outside its radius, an attractor must have no effect at all.
    const far = { x: 60000, y: 10000, radiusFt: 8000 };
    expect(generateRiverCourse(anchors, { ...FLAT, attractors: [far] }))
      .toEqual(generateRiverCourse(anchors, FLAT));
  });

  it('relaxes toward the valley floor instead of cutting across it', () => {
    // Anchors sit on the valley walls; the course between them should sag
    // toward x = 5000 rather than running straight down the wall.
    const anchors: Array<[number, number]> = [[2000, 0], [2000, 20000]];
    const opts = { ...FLAT, sampleHeight: (x: number) => valley(x) };
    const course = generateRiverCourse(anchors, opts);
    const mid = course[Math.floor(course.length / 2)];
    expect(mid[0]).toBeGreaterThan(2000);
  });
});
