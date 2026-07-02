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
    { points: [{ x: 0.0, y: 0.0 }, { x: 0.1, y: 0.0 }, { x: 0.1, y: 0.1 }, { x: 0.0, y: 0.1 }], topY: 5, kind: 'dock' },
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
  // One color triple per vertex, parallel to positions.
  expect(mesh.colors).toHaveLength(mesh.positions.length);
});

it('tints docks and bridges with distinct vertex colors (TG5)', () => {
  const square = [{ x: 0.0, y: 0.0 }, { x: 0.1, y: 0.0 }, { x: 0.1, y: 0.1 }, { x: 0.0, y: 0.1 }];
  const dock = buildDeckMesh({ ...baseChunk(), decks: [{ points: square, topY: 5, kind: 'dock' }] });
  const bridge = buildDeckMesh({ ...baseChunk(), decks: [{ points: square, topY: 5, kind: 'bridge' }] });
  // Same geometry, different first-vertex color → a quay and a bridge span differ.
  expect(Array.from(dock.colors.slice(0, 3))).not.toEqual(Array.from(bridge.colors.slice(0, 3)));
  // Bridge tint is lighter (sum of channels) than the weathered dock timber.
  const sum = (a: Float32Array) => a[0] + a[1] + a[2];
  expect(sum(bridge.colors)).toBeGreaterThan(sum(dock.colors));
});

// pierQuad-wound rectangle (base→along-dir): long axis on edge 0→1, ~10.24 m
// long × ~4.1 m wide at METERS_PER_CELL=1024. Small enough to keep post counts sane.
const pierRect = [
  { x: 0.0, y: 0.0 },   // nearL
  { x: 0.01, y: 0.0 },  // farL (along dir → long edge)
  { x: 0.01, y: 0.004 }, // farR
  { x: 0.0, y: 0.004 },  // nearR
];

it('emits pilings below the deck when detail is present', () => {
  const bare = buildDeckMesh({ ...baseChunk(), decks: [{ points: pierRect, topY: 5, kind: 'dock' }] });
  const detailed = buildDeckMesh({
    ...baseChunk(),
    decks: [{ points: pierRect, topY: 5, kind: 'dock', detail: { pilingSpacingM: 2, railing: false, archRiseM: 0 } }],
  });
  expect(detailed.positions.length).toBeGreaterThan(bare.positions.length);
  const ys: number[] = [];
  for (let i = 1; i < detailed.positions.length; i += 3) ys.push(detailed.positions[i]);
  // Posts descend PILING_DEPTH below the slab underside — well below topY - 1.
  expect(Math.min(...ys)).toBeLessThan(5 - 1.0);
  expect(detailed.colors).toHaveLength(detailed.positions.length);
});

it('adds railing geometry above the deck when detail.railing', () => {
  const noRail = buildDeckMesh({
    ...baseChunk(),
    decks: [{ points: pierRect, topY: 5, kind: 'dock', detail: { pilingSpacingM: 2, railing: false, archRiseM: 0 } }],
  });
  const railed = buildDeckMesh({
    ...baseChunk(),
    decks: [{ points: pierRect, topY: 5, kind: 'dock', detail: { pilingSpacingM: 2, railing: true, archRiseM: 0 } }],
  });
  expect(railed.positions.length).toBeGreaterThan(noRail.positions.length);
  const ys: number[] = [];
  for (let i = 1; i < railed.positions.length; i += 3) ys.push(railed.positions[i]);
  expect(Math.max(...ys)).toBeGreaterThan(5 + 0.5);
});

it('arches a bridge: mid-span top exceeds topY by ~archRiseM', () => {
  const mesh = buildDeckMesh({
    ...baseChunk(),
    decks: [{ points: pierRect, topY: 5, kind: 'bridge', detail: { pilingSpacingM: 3, railing: false, archRiseM: 1.5 } }],
  });
  const ys: number[] = [];
  for (let i = 1; i < mesh.positions.length; i += 3) ys.push(mesh.positions[i]);
  expect(Math.max(...ys)).toBeGreaterThanOrEqual(5 + 1.0);
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});

it('railing on an arched bridge follows the arch instead of staying flat', () => {
  // river/coastal/temperate styles pair railing:true with archRiseM>0, so this
  // combo is the NORMAL case — a flat rail at topY would clip through the arch.
  const topY = 5, archRiseM = 1.5;
  const mesh = buildDeckMesh({
    ...baseChunk(),
    decks: [{ points: pierRect, topY, kind: 'bridge', detail: { pilingSpacingM: 3, railing: true, archRiseM } }],
  });
  const ys: number[] = [];
  for (let i = 1; i < mesh.positions.length; i += 3) ys.push(mesh.positions[i]);
  // Rail top near mid-span rides the lifted deck: >= topY + railHeight + ~0.8·rise.
  expect(Math.max(...ys)).toBeGreaterThanOrEqual(topY + 1.0 + archRiseM * 0.8);
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});

it('ignores degenerate decks with fewer than 3 corners', () => {
  const data = baseChunk();
  data.decks = [{ points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }], topY: 5, kind: 'dock' }];
  expect(buildDeckMesh(data).positions).toHaveLength(0);
});
