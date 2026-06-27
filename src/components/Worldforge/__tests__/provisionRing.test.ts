import { describe, it, expect } from 'vitest';
import { buildProvisionRingPath } from '../atlasSvg';
import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';

/**
 * The provisioning ring is the boundary of the in-range cell set: the contour
 * separating cells you can reach on current supplies from those you can't. It is
 * extracted exactly like state borders — an edge is on the ring iff the cell
 * across it is NOT in range (or is the map edge). Interior edges (both sides in
 * range) must be excluded so the result reads as one clean outline, not a mesh.
 *
 * Synthetic mesh: three unit squares in a row sharing vertical edges.
 *   v0(0,0) v1(1,0) v4(2,0) v6(3,0)
 *   v3(0,1) v2(1,1) v5(2,1) v7(3,1)
 *   cell0 = 0,1,2,3   cell1 = 1,4,5,2   cell2 = 4,6,7,5
 */
function mesh(): FmgAtlasResult {
  return {
    pack: {
      cells: {
        v: [
          [0, 1, 2, 3],
          [1, 4, 5, 2],
          [4, 6, 7, 5],
        ],
        c: [[1], [0, 2], [1]],
        h: [50, 50, 50], // all land (above threshold), value unused by the ring
      },
      vertices: {
        p: [
          [0, 0], [1, 0], [1, 1], [0, 1],
          [2, 0], [2, 1], [3, 0], [3, 1],
        ],
      },
    },
  } as unknown as FmgAtlasResult;
}

describe('buildProvisionRingPath', () => {
  it('traces the outer boundary of the in-range cells', () => {
    const path = buildProvisionRingPath(mesh(), [0, 1]);
    // The shared edge between cell1 and the out-of-range cell2 (x=2 line) is on the ring.
    expect(path).toContain('M2,0L2,1');
  });

  it('excludes interior edges shared by two in-range cells', () => {
    const path = buildProvisionRingPath(mesh(), [0, 1]);
    // The edge between cell0 and cell1 (x=1 line) is interior — must NOT appear.
    expect(path).not.toContain('M1,0L1,1');
    expect(path).not.toContain('M1,1L1,0');
  });

  it('returns an empty path for an empty in-range set', () => {
    expect(buildProvisionRingPath(mesh(), [])).toBe('');
  });
});
