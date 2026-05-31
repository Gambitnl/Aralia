import { clipPolylineToChunk } from '../polylineClip';

it('returns empty when the polyline does not intersect the chunk', () => {
  const out = clipPolylineToChunk(
    [{ x: 50, y: 50 }, { x: 51, y: 51 }],
    [1, 1],
    0,
    0,
  );
  expect(out).toEqual([]);
});

it('keeps a polyline fully inside the chunk', () => {
  const out = clipPolylineToChunk(
    [{ x: 0.01, y: 0.01 }, { x: 0.02, y: 0.02 }],
    [2, 2],
    0,
    0,
  );
  expect(out).toHaveLength(1);
  expect(out[0].points).toHaveLength(2);
  expect(out[0].width).toEqual([2, 2]);
});

it('clips a polyline that enters and exits the chunk into an inside segment', () => {
  const out = clipPolylineToChunk(
    [{ x: -1, y: 0.05 }, { x: 10, y: 0.05 }],
    [1, 1],
    0,
    0,
  );
  expect(out.length).toBeGreaterThanOrEqual(1);
  for (const seg of out) {
    for (const p of seg.points) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(0.125 + 1e-6);
    }
  }
});
