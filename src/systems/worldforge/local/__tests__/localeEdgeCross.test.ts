import { detectEdgeCross, entryFeetAfterCross } from '../localeEdgeCross';

const EXTENT = { x: 3000, y: 3000 }; // a 3000ft Locale (600 cells × 5ft)

describe('detectEdgeCross (Stage 5 S5.3 — edge detection, pure)', () => {
  it('returns null while inside the extent', () => {
    expect(detectEdgeCross({ x: 1500, y: 1500 }, EXTENT)).toBeNull();
    expect(detectEdgeCross({ x: 0, y: 0 }, EXTENT)).toBeNull(); // on the corner = still in
    expect(detectEdgeCross({ x: 3000, y: 3000 }, EXTENT)).toBeNull();
  });

  it('detects each cardinal exit with the correct world direction', () => {
    expect(detectEdgeCross({ x: 3001, y: 1500 }, EXTENT)).toEqual({ dx: 1, dy: 0 }); // east
    expect(detectEdgeCross({ x: -1, y: 1500 }, EXTENT)).toEqual({ dx: -1, dy: 0 }); // west
    expect(detectEdgeCross({ x: 1500, y: 3001 }, EXTENT)).toEqual({ dx: 0, dy: 1 }); // south
    expect(detectEdgeCross({ x: 1500, y: -1 }, EXTENT)).toEqual({ dx: 0, dy: -1 }); // north
  });

  it('detects a corner exit as a combined diagonal', () => {
    expect(detectEdgeCross({ x: 3050, y: -20 }, EXTENT)).toEqual({ dx: 1, dy: -1 }); // NE
  });
});

describe('entryFeetAfterCross (Stage 5 S5.3 — opposite-edge entry, pure)', () => {
  it('enters the new Locale on the OPPOSITE edge, preserving the tangential coord', () => {
    // Exited east → enter the neighbour at its WEST edge, same y.
    expect(entryFeetAfterCross({ x: 3001, y: 1800 }, { dx: 1, dy: 0 }, EXTENT, 5)).toEqual({ x: 5, y: 1800 });
    // Exited west → enter at the EAST edge.
    expect(entryFeetAfterCross({ x: -1, y: 1800 }, { dx: -1, dy: 0 }, EXTENT, 5)).toEqual({ x: 2995, y: 1800 });
    // Exited south → enter at the NORTH edge.
    expect(entryFeetAfterCross({ x: 1200, y: 3001 }, { dx: 0, dy: 1 }, EXTENT, 5)).toEqual({ x: 1200, y: 5 });
  });

  it('clamps the preserved tangential coordinate inside the extent', () => {
    const e = entryFeetAfterCross({ x: 3001, y: 99999 }, { dx: 1, dy: 0 }, EXTENT, 5);
    expect(e.x).toBe(5);
    expect(e.y).toBe(2995); // clamped to extent - inset
  });
});
