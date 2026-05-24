import { describe, expect, it } from 'vitest';
import { getCellOverlayPercentRect, worldNormalizedToOverlayNormalized } from '../worldMapOverlayMath';

/**
 * These tests protect the world-map precision overlay math.
 *
 * MapPane uses these helpers to draw travel-cell highlights over the Azgaar iframe.
 * The tests cover the untransformed fallback, the pan/zoom projection, and a simple
 * full-grid sanity case so future map changes do not silently desync click targeting
 * from the visible overlay.
 */

describe('worldMapOverlayMath', () => {
  it('returns identity mapping when transform is unavailable', () => {
    // Before the iframe bridge is ready, the overlay should match the plain grid.
    expect(worldNormalizedToOverlayNormalized(0.25, 'x', null)).toBe(0.25);
    expect(worldNormalizedToOverlayNormalized(0.75, 'y', undefined)).toBe(0.75);
  });

  it('maps cell corners through pan/zoom transform', () => {
    // A non-default transform proves the helper applies both the view offset and
    // the zoom scale instead of assuming the atlas fills the overlay unchanged.
    const transform = {
      graphWidth: 1000,
      graphHeight: 800,
      viewX: 100,
      viewY: 50,
      scale: 2,
    };

    const rect = getCellOverlayPercentRect(1, 2, 4, 8, transform);
    expect(rect.left).toBeCloseTo(60, 5);
    expect(rect.top).toBeCloseTo(56.25, 5);
    expect(rect.width).toBeCloseTo(50, 5);
    expect(rect.height).toBeCloseTo(25, 5);
  });

  it('covers the expected grid cells at default transform', () => {
    // With no pan or zoom, a 10x10 grid should give each cell exactly 10 percent
    // of the overlay in both directions.
    const transform = {
      graphWidth: 1000,
      graphHeight: 1000,
      viewX: 0,
      viewY: 0,
      scale: 1,
    };

    const topLeft = getCellOverlayPercentRect(0, 0, 10, 10, transform);
    expect(topLeft.left).toBe(0);
    expect(topLeft.top).toBe(0);
    expect(topLeft.width).toBe(10);
    expect(topLeft.height).toBe(10);

    const bottomRight = getCellOverlayPercentRect(9, 9, 10, 10, transform);
    expect(bottomRight.left).toBe(90);
    expect(bottomRight.top).toBe(90);
    expect(bottomRight.width).toBe(10);
    expect(bottomRight.height).toBe(10);
  });
});
