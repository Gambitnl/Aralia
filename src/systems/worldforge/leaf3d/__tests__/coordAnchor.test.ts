import { describe, it, expect } from 'vitest';
import { leafAtlasAnchor, groundToAtlas, atlasToGround } from '../coordAnchor';
import { buildLeaf3DHandoff, type LeafContext } from '../leafHandoff';
import { rootSeedPath } from '../../seedPath';
import type { Pt } from '../../submap/submapEngine';

const square: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]]; // center (50,50)

describe('leafAtlasAnchor', () => {
  it('centers on the leaf bounds', () => {
    const a = leafAtlasAnchor(square, 2);
    expect(a.atlasCenter).toEqual([50, 50]);
    expect(a.unitScale).toBe(2);
  });
});

describe('ground ↔ atlas mapping', () => {
  it('atlasToGround matches the handoff re-centering', () => {
    const a = leafAtlasAnchor(square, 1);
    expect(atlasToGround(a, [60, 40])).toEqual({ x: 10, z: -10 });
  });

  it('groundToAtlas is the inverse of atlasToGround (round-trip)', () => {
    const a = leafAtlasAnchor(square, 2);
    const atlasPt: Pt = [73, 21];
    const g = atlasToGround(a, atlasPt);
    const back = groundToAtlas(a, g);
    expect(back[0]).toBeCloseTo(73, 9);
    expect(back[1]).toBeCloseTo(21, 9);
  });

  it('agrees with buildLeaf3DHandoff: a burg maps back to its atlas position', () => {
    const leaf: LeafContext = {
      polygon: square,
      seedPath: rootSeedPath(42),
      features: [{ kind: 'burg', x: 60, y: 40, id: 7, name: 'Bomnogorvan' }],
    };
    const handoff = buildLeaf3DHandoff(leaf, { unitScale: 3 });
    const anchor = leafAtlasAnchor(square, 3);
    const burgGround = handoff.setPieces.find((s) => s.kind === 'burg')!;
    const atlas = groundToAtlas(anchor, { x: burgGround.x, z: burgGround.z });
    expect(atlas[0]).toBeCloseTo(60, 6); // back to the burg's atlas x
    expect(atlas[1]).toBeCloseTo(40, 6); // back to the burg's atlas y
  });
});
