import { buildDeckMesh } from '../deckGeometry';
import type { ChunkData } from '../types';

const baseChunk = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(50),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

it('returns empty geometry when there are no decks', () => {
  const mesh = buildDeckMesh(baseChunk());
  expect(mesh.positions).toHaveLength(0);
  expect(mesh.indices).toHaveLength(0);
});

it('builds a slab with a flat top at topY and a skirt below it', () => {
  const data = baseChunk();
  data.decks = [
    { points: [{ x: 0.0, y: 0.0 }, { x: 0.1, y: 0.0 }, { x: 0.1, y: 0.1 }, { x: 0.0, y: 0.1 }], topY: 5 },
  ];
  const mesh = buildDeckMesh(data);
  expect(mesh.positions.length).toBeGreaterThan(0);
  expect(mesh.indices.length).toBeGreaterThan(0);
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
  // Collect all Y values; the deck top is exactly topY, the skirt drops below it.
  const ys: number[] = [];
  for (let i = 1; i < mesh.positions.length; i += 3) ys.push(mesh.positions[i]);
  expect(Math.max(...ys)).toBeCloseTo(5, 6);
  expect(Math.min(...ys)).toBeLessThan(5);
});

it('ignores degenerate decks with fewer than 3 corners', () => {
  const data = baseChunk();
  data.decks = [{ points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }], topY: 5 }];
  expect(buildDeckMesh(data).positions).toHaveLength(0);
});
