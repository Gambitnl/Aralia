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
    for (const b of bodies) expect(b.points.length).toBeGreaterThanOrEqual(3);
  });

  it('says which bodies are river and which are sea', () => {
    // Without the label, the height pass cannot tell a river from the sea and
    // gives both one flat height — which drew a town's river at sea level.
    const bodies = buildTownWaterBodies({
      rivers: [[[0, 0], [0, 10]]],
      coast: [[[20, 0], [30, 0]], [[30, 0], [40, 0]]],
      centroid: [15, 15],
      channelHalfWidth: 1,
      apronDepth: 4,
    });

    expect(bodies.filter((b) => b.kind === 'river')).toHaveLength(1);
    expect(bodies.filter((b) => b.kind === 'sea')).toHaveLength(2);
  });

  it('gives every river ring vertex a centerline point to take its height from', () => {
    const centerline: [number, number][] = [[0, 0], [0, 10], [0, 22]];
    const [river] = buildTownWaterBodies({
      rivers: [centerline],
      coast: [],
      centroid: [50, 50],
      channelHalfWidth: 2,
      apronDepth: 4,
    });

    expect(river.kind).toBe('river');
    expect(river.centerline).toEqual(centerline);
    expect(river.sourceIndex).toHaveLength(river.points.length);
    for (const idx of river.sourceIndex!) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(centerline.length);
    }
    // Both banks of the same centerline point must map back to it, so the two
    // sides of the channel end up at the same water height.
    const n = centerline.length;
    expect(river.sourceIndex!.slice(0, n)).toEqual([0, 1, 2]);
    expect(river.sourceIndex!.slice(n)).toEqual([2, 1, 0]);
  });

  it('leaves sea aprons without centerline data', () => {
    const [apron] = buildTownWaterBodies({
      rivers: [],
      coast: [[[0, 0], [10, 0]]],
      centroid: [5, 5],
      channelHalfWidth: 1,
      apronDepth: 3,
    });
    expect(apron.kind).toBe('sea');
    expect(apron.sourceIndex).toBeUndefined();
    expect(apron.centerline).toBeUndefined();
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
