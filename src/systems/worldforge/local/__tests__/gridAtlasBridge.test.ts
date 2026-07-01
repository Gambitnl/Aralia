import { describe, it, expect } from 'vitest';
import { spreadColocatedPoints } from '../gridAtlasBridge';

// Grid retirement (Cell-Native World): the square-grid ↔ atlas-cell coordinate
// bridge (gridCellToGraphPoint / legacyGridToAtlasCell / atlasCellToLegacyGrid /
// gridCellToAtlasSite) has been deleted along with the 30×20 world grid. The
// only remaining atlas-space helper here that carries behaviour worth pinning is
// spreadColocatedPoints; snapToLandCell / entry3DAnchorForCell are covered via
// the map/travel tests that exercise them end-to-end.

describe('gridAtlasBridge', () => {
  it('spreadColocatedPoints leaves unique points untouched', () => {
    const pts = [{ x: 10, y: 10, label: 'a' }, { x: 50, y: 50, label: 'b' }];
    expect(spreadColocatedPoints(pts)).toEqual(pts);
  });

  it('spreadColocatedPoints fans out points sharing a location, preserving labels and count', () => {
    const pts = [
      { x: 30, y: 30, label: 'a' },
      { x: 30, y: 30, label: 'b' },
      { x: 30, y: 30, label: 'c' },
    ];
    const out = spreadColocatedPoints(pts, 6);
    expect(out).toHaveLength(3);
    // Labels preserved, in order.
    expect(out.map((p) => p.label)).toEqual(['a', 'b', 'c']);
    // No two pins remain at the same coordinate.
    const coords = new Set(out.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(coords.size).toBe(3);
    // Each fanned pin sits on the ring (radius 6) around the shared origin.
    for (const p of out) {
      expect(Math.hypot(p.x - 30, p.y - 30)).toBeCloseTo(6, 5);
    }
  });

  it('spreadColocatedPoints is deterministic (frame-safe)', () => {
    const pts = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    expect(spreadColocatedPoints(pts)).toEqual(spreadColocatedPoints(pts));
  });
});
