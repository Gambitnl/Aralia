import { clipPolylineToChunk } from '../polylineClip';
import { chunkGridAABB } from '../coords';

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

it('owns a boundary-coincident polyline by exactly one of two vertically-adjacent chunks (half-open max edge)', () => {
  // A horizontal polyline lying exactly on the shared edge between chunk (0,0)
  // and chunk (0,1): (0,0).maxGY === (0,1).minGY. With a half-open max edge it
  // must belong to (0,1) (its inclusive min edge), not (0,0).
  const sharedY = chunkGridAABB(0, 0).maxGY;
  expect(sharedY).toBe(chunkGridAABB(0, 1).minGY);

  const points = [{ x: 0.01, y: sharedY }, { x: 0.05, y: sharedY }];
  const width = [1, 1];

  const inLower = clipPolylineToChunk(points, width, 0, 0); // touches its max edge
  const inUpper = clipPolylineToChunk(points, width, 0, 1); // sits on its min edge

  expect(inLower).toEqual([]); // max edge is half-open → excluded
  expect(inUpper).toHaveLength(1);
  expect(inUpper[0].points).toHaveLength(2);
});

it('still admits a polyline lying exactly on the inclusive min edge', () => {
  const minY = chunkGridAABB(0, 0).minGY;
  const out = clipPolylineToChunk(
    [{ x: 0.01, y: minY }, { x: 0.05, y: minY }],
    [1, 1],
    0,
    0,
  );
  expect(out).toHaveLength(1);
});
