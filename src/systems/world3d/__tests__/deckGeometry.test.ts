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

// Chunk with flat terrain at 0 m — decks that carry detail (pilings, abutments,
// rail clipping) read the chunk heightfield, so their tests need terrain that
// sits BELOW the deck the way a real anchored crossing does.
const flatChunk = (): ChunkData => ({
  ...baseChunk(),
  heights: new Float32Array(16).fill(0),
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
  const bare = buildDeckMesh({ ...flatChunk(), decks: [{ points: pierRect, topY: 5, kind: 'dock' }] });
  const detailed = buildDeckMesh({
    ...flatChunk(),
    decks: [{ points: pierRect, topY: 5, kind: 'dock', detail: { pilingSpacingM: 2, railing: false, archRiseM: 0 } }],
  });
  expect(detailed.positions.length).toBeGreaterThan(bare.positions.length);
  const ys: number[] = [];
  for (let i = 1; i < detailed.positions.length; i += 3) ys.push(detailed.positions[i]);
  // Posts descend below the slab underside — well below topY - 1.
  expect(Math.min(...ys)).toBeLessThan(5 - 1.0);
  expect(detailed.colors).toHaveLength(detailed.positions.length);
});

it('bridge pilings reach the sampled terrain instead of a fixed drop', () => {
  // Terrain is flat at 0 m; the deck top rides at 6 m. A fixed 3 m drop from
  // the underside (5.55 m) would leave post feet dangling at 2.55 m over the
  // channel — the feet must instead plant into the ground below 0 m.
  const mesh = buildDeckMesh({
    ...flatChunk(),
    decks: [{ points: pierRect, topY: 6, kind: 'bridge', detail: { pilingSpacingM: 3, railing: false, archRiseM: 1.5 } }],
  });
  const ys: number[] = [];
  for (let i = 1; i < mesh.positions.length; i += 3) ys.push(mesh.positions[i]);
  expect(Math.min(...ys)).toBeLessThan(-0.5); // embedded into the terrain
  expect(Math.min(...ys)).toBeGreaterThan(-3); // not runaway-deep either
});

it('a bridge end resting on the ground gets a stone abutment block', () => {
  // Deck top at 0.4 m over flat 0 m terrain = the anchored crossing case where
  // both ends land on their banks. The abutment is the only geometry allowed
  // to extend beyond the deck ends along the span (x < -0.5 here).
  const mesh = buildDeckMesh({
    ...flatChunk(),
    decks: [{ points: pierRect, topY: 0.4, kind: 'bridge', detail: { pilingSpacingM: 0, railing: false, archRiseM: 0.5 } }],
  });
  const beyondEndYs: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i] < -0.5) beyondEndYs.push(mesh.positions[i + 1]);
  }
  expect(beyondEndYs.length).toBeGreaterThan(0);
  // Masonry runs from just under the deck top down into the ground.
  expect(Math.max(...beyondEndYs)).toBeGreaterThan(0.3);
  expect(Math.min(...beyondEndYs)).toBeLessThan(-0.8);
});

it('no abutment when the bridge end floats high above the ground', () => {
  const mesh = buildDeckMesh({
    ...flatChunk(),
    decks: [{ points: pierRect, topY: 6, kind: 'bridge', detail: { pilingSpacingM: 3, railing: false, archRiseM: 1.5 } }],
  });
  for (let i = 0; i < mesh.positions.length; i += 3) {
    expect(mesh.positions[i]).toBeGreaterThan(-0.5);
  }
});

it('arched side skirt keeps slab thickness instead of walling down to the flat underside', () => {
  // Mid-span the arch lifts the top by ~archRiseM; the side skirt must follow
  // as a constant-thickness band, not drop to the flat underside (a bare wall).
  const mesh = buildDeckMesh({
    ...flatChunk(),
    decks: [{ points: pierRect, topY: 6, kind: 'bridge', detail: { pilingSpacingM: 0, railing: false, archRiseM: 1.5 } }],
  });
  // pierRect spans local x 0..10.24 m; inspect the middle third of the span.
  const midYs: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i];
    if (x > 3.4 && x < 6.8) midYs.push(mesh.positions[i + 1]);
  }
  expect(midYs.length).toBeGreaterThan(0);
  // Old behavior: skirt bottoms at topY - 0.45 = 5.55 all along the span.
  // Constant thickness: nothing mid-span dips below top + lift(1/3) - 0.45 ≈ 6.9.
  expect(Math.min(...midYs)).toBeGreaterThan(6.5);
});

it('rail segments buried by a rising bank are clipped', () => {
  // Terrain climbs along the span (0 m at the near end, ~5.2 m where the deck
  // enters the far bank) while the deck top rides at 2 m: the far-end rail
  // segments are underground and must be skipped, the near-end ones kept.
  const climb = flatChunk();
  // Column i encodes i*1.2 → 0 m, 21.6 m, 43.2 m, 64.8 m at x=0/42.7/85.3/128.
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) climb.heights[j * 4 + i] = i * 1.2;
  const mesh = buildDeckMesh({
    ...climb,
    decks: [{ points: pierRect, topY: 2, kind: 'bridge', detail: { pilingSpacingM: 0, railing: true, archRiseM: 1.5 } }],
  });
  let maxFarY = -Infinity;
  let maxNearY = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    if (x > 8.9) maxFarY = Math.max(maxFarY, y);
    if (x < 1.5) maxNearY = Math.max(maxNearY, y);
  }
  // A surviving far-end rail would top out at ~3.35 m; deck + abutment stay under 3.
  expect(maxFarY).toBeLessThan(3.0);
  // The near end keeps its rail (top ≈ base 2.35 + 1.0 rail height).
  expect(maxNearY).toBeGreaterThan(3.2);
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
    ...flatChunk(),
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
    ...flatChunk(),
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

// --- Dark-deck-top regression: each face must be emitted exactly once, wound
// so its geometric normal agrees with the authored normal. The old both-
// windings emission left coplanar reversed duplicates whose depth-tie winner
// was arbitrary; when the back-facing copy won, DoubleSide flipped the
// authored (0,1,0) normal and the deck top shaded downward — near-black from
// steep cameras (repro: ?phase=world3d&ground=1&dcell=1001&wfseed=42).

type DeckMesh = ReturnType<typeof buildDeckMesh>;

const triAt = (mesh: DeckMesh, t: number) => {
  const i = [mesh.indices[t * 3], mesh.indices[t * 3 + 1], mesh.indices[t * 3 + 2]];
  const at = (arr: Float32Array, k: number) => ({ x: arr[k * 3], y: arr[k * 3 + 1], z: arr[k * 3 + 2] });
  return { i, p: i.map((k) => at(mesh.positions, k)), n: i.map((k) => at(mesh.normals, k)) };
};

type V3 = { x: number; y: number; z: number };

/** Unnormalized geometric normal of a triangle (right-hand rule over winding). */
const geoNormal = (p: V3[]): V3 => {
  const ux = p[1].x - p[0].x, uy = p[1].y - p[0].y, uz = p[1].z - p[0].z;
  const vx = p[2].x - p[0].x, vy = p[2].y - p[0].y, vz = p[2].z - p[0].z;
  return { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx };
};

/**
 * Slab-face winding invariant for box-free meshes: triangles with authored
 * (0,1,0) normals (tops) must wind upward; triangles with horizontal authored
 * normals (skirts) must wind so their geometric normal matches the authored
 * one. pushBox faces are exempt (their sides share the (0,1,0) up-lit cheat),
 * so callers must pass meshes without pilings/railings/abutments.
 */
const expectSingleCorrectWinding = (mesh: DeckMesh) => {
  let tops = 0;
  let skirts = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const { p, n } = triAt(mesh, t);
    const g = geoNormal(p);
    if (n.every((v) => v.x === 0 && v.y === 1 && v.z === 0)) {
      expect(g.y).toBeGreaterThan(0);
      tops++;
    } else if (Math.abs(n[0].y) < 1e-6) {
      const len = Math.hypot(g.x, g.y, g.z) || 1;
      expect((g.x * n[0].x + g.y * n[0].y + g.z * n[0].z) / len).toBeGreaterThan(0.99);
      skirts++;
    }
  }
  expect(tops).toBeGreaterThan(0);
  expect(skirts).toBeGreaterThan(0);
};

describe('single-winding emission', () => {
  // Same square in both corner orders — producers do not agree on winding.
  const sq = [{ x: 0, y: 0 }, { x: 0, y: 0.01 }, { x: 0.01, y: 0.01 }, { x: 0.01, y: 0 }];
  const sqRev = [...sq].reverse();

  it('emits every triangle exactly once (no coplanar reversed duplicates)', () => {
    const mesh = buildDeckMesh({
      ...flatChunk(),
      decks: [{ points: pierRect, topY: 5, kind: 'dock', detail: { pilingSpacingM: 2, railing: true, archRiseM: 0 } }],
    });
    const seen = new Set<string>();
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const key = [...triAt(mesh, t).i].sort((a, b) => a - b).join(',');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  for (const [label, pts] of [['CCW', sq], ['CW', sqRev]] as const) {
    it(`flat top and skirt triangles wind with their normals for ${label} corners`, () => {
      const mesh = buildDeckMesh({ ...flatChunk(), decks: [{ points: pts, topY: 5, kind: 'dock' }] });
      expectSingleCorrectWinding(mesh);
    });

    it(`arch strip and skirt triangles wind with their normals for ${label} corners`, () => {
      // topY 6 over 0 m terrain floats both ends: no abutments, no posts —
      // strips and skirts only, so the box-free invariant applies.
      const mesh = buildDeckMesh({
        ...flatChunk(),
        decks: [{ points: pts, topY: 6, kind: 'bridge', detail: { pilingSpacingM: 0, railing: false, archRiseM: 1.5 } }],
      });
      expectSingleCorrectWinding(mesh);
    });
  }

  it('piling and railing box faces wind outward', () => {
    const mesh = buildDeckMesh({
      ...flatChunk(),
      decks: [{ points: pierRect, topY: 5, kind: 'dock', detail: { pilingSpacingM: 2, railing: true, archRiseM: 0 } }],
    });
    // Slab fan (4 verts) + skirts (4 edges x 4 verts) come first; every vertex
    // from 20 on belongs to an 8-vertex pushBox run.
    const boxOf = (idx: number) => (idx >= 20 ? Math.floor((idx - 20) / 8) : -1);
    let checked = 0;
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const { i, p } = triAt(mesh, t);
      const b = boxOf(i[0]);
      if (b < 0 || boxOf(i[1]) !== b || boxOf(i[2]) !== b) continue;
      const c0 = 20 + b * 8;
      const boxC = { x: 0, y: 0, z: 0 };
      for (let k = c0; k < c0 + 8; k++) {
        boxC.x += mesh.positions[k * 3] / 8;
        boxC.y += mesh.positions[k * 3 + 1] / 8;
        boxC.z += mesh.positions[k * 3 + 2] / 8;
      }
      const triC = {
        x: (p[0].x + p[1].x + p[2].x) / 3,
        y: (p[0].y + p[1].y + p[2].y) / 3,
        z: (p[0].z + p[1].z + p[2].z) / 3,
      };
      const g = geoNormal(p);
      const out = g.x * (triC.x - boxC.x) + g.y * (triC.y - boxC.y) + g.z * (triC.z - boxC.z);
      expect(out).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
