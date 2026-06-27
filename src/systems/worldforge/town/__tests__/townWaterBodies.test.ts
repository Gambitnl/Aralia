import { describe, it, expect } from 'vitest';
import {
  bufferPolylineToChannel,
  edgeApronQuad,
  buildTownWaterBodies,
} from '../townWaterBodies';

describe('bufferPolylineToChannel', () => {
  it('buffers a straight segment into a rectangular channel polygon', () => {
    const poly = bufferPolylineToChannel([[0, 0], [0, 10]], 1);
    // Closed quad spanning x ∈ [-1, 1], y ∈ [0, 10].
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(-1, 6);
    expect(Math.max(...xs)).toBeCloseTo(1, 6);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(10, 6);
    expect(poly.length).toBe(4); // left(2) + right(2)
  });

  it('returns empty for a degenerate (single-point) line', () => {
    expect(bufferPolylineToChannel([[5, 5]], 1)).toEqual([]);
  });
});

describe('edgeApronQuad', () => {
  it('extrudes a shore edge outward, away from the town centre', () => {
    // edge along x-axis, town centre above (+y) → apron extends downward (−y).
    const quad = edgeApronQuad([0, 0], [10, 0], [5, 5], 3);
    expect(quad).toHaveLength(4);
    expect(quad[0]).toEqual([0, 0]);
    expect(quad[1]).toEqual([10, 0]);
    expect(quad[2][1]).toBeCloseTo(-3, 6);
    expect(quad[3][1]).toBeCloseTo(-3, 6);
  });
});

describe('buildTownWaterBodies', () => {
  it('produces a channel per river and an apron per coast edge', () => {
    const bodies = buildTownWaterBodies({
      rivers: [[[0, 0], [0, 10]]],
      coast: [[[20, 0], [30, 0]]],
      centroid: [15, 15],
      channelHalfWidth: 1,
      apronDepth: 4,
    });
    expect(bodies.length).toBe(2);
    // every body is a fillable polygon
    for (const b of bodies) expect(b.length).toBeGreaterThanOrEqual(3);
  });

  it('drops degenerate inputs', () => {
    const bodies = buildTownWaterBodies({
      rivers: [[[1, 1]]],
      coast: [],
      centroid: [0, 0],
      channelHalfWidth: 1,
      apronDepth: 4,
    });
    expect(bodies).toEqual([]);
  });
});
