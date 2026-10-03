import { describe, it, expect } from 'vitest';
import { waterSurfaceYAt } from '../waterGeometry';
import type { ChunkData } from '../types';

type Body = NonNullable<ChunkData['lakes']>[number];

const seaBody = (): Body => ({
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  kind: 'sea',
  surfaceY: 0,
});

const lakeBody = (y: number): Body => ({
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  kind: 'lake',
  surfaceY: y,
});

/** A river running +x, dropping from 30 m down to 0 m. */
const riverBody = (): Body => ({
  points: [{ x: 0, y: -1 }, { x: 100, y: -1 }, { x: 100, y: 1 }, { x: 0, y: 1 }],
  kind: 'river',
  surfaceY: 0,
  centerline: [
    { x: 0, y: 0, surfaceY: 30 },
    { x: 50, y: 0, surfaceY: 15 },
    { x: 100, y: 0, surfaceY: 0 },
  ],
});

describe('waterSurfaceYAt', () => {
  it('keeps the sea flat at zero', () => {
    const sea = seaBody();
    for (const [x, y] of [[0, 0], [5, 5], [10, 0]]) {
      expect(waterSurfaceYAt(sea, x, y)).toBe(0);
    }
  });

  it('keeps a lake flat at its own elevation, not sea level', () => {
    // A mountain lake is flat, but 400 m up. Flat must not mean zero.
    const lake = lakeBody(400);
    for (const [x, y] of [[0, 0], [7, 3], [10, 10]]) {
      expect(waterSurfaceYAt(lake, x, y)).toBe(400);
    }
  });

  it('makes a river descend along its course', () => {
    // This is the property a single flat height cannot express, and the reason
    // a town 15 m above the sea had its river drawn at sea level.
    const river = riverBody();
    const upstream = waterSurfaceYAt(river, 0, 0);
    const middle = waterSurfaceYAt(river, 50, 0);
    const mouth = waterSurfaceYAt(river, 100, 0);

    expect(upstream).toBeCloseTo(30);
    expect(middle).toBeCloseTo(15);
    expect(mouth).toBeCloseTo(0);
    expect(upstream).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(mouth);
  });

  it('interpolates between centerline points', () => {
    const river = riverBody();
    // A quarter along the first segment: 30 → 15 over 0..50, so 25 at x=25.
    expect(waterSurfaceYAt(river, 25, 0)).toBeCloseTo(22.5);
    expect(waterSurfaceYAt(river, 75, 0)).toBeCloseTo(7.5);
  });

  it('gives both banks of a cross-section the same height', () => {
    // Otherwise the water surface would tilt sideways across the channel.
    const river = riverBody();
    expect(waterSurfaceYAt(river, 40, -1)).toBeCloseTo(waterSurfaceYAt(river, 40, 1));
  });

  it('clamps past either end instead of extrapolating', () => {
    const river = riverBody();
    // Vertices invented by chunk clipping can land beyond the centerline ends.
    expect(waterSurfaceYAt(river, -50, 0)).toBeCloseTo(30);
    expect(waterSurfaceYAt(river, 500, 0)).toBeCloseTo(0);
  });

  it('falls back to the flat height when a river has no centerline', () => {
    const broken: Body = { ...riverBody(), centerline: undefined, surfaceY: 12 };
    expect(waterSurfaceYAt(broken, 40, 0)).toBe(12);
  });

  it('treats a legacy body with no kind as flat', () => {
    const legacy: Body = { points: [{ x: 0, y: 0 }], surfaceY: 8 } as Body;
    expect(waterSurfaceYAt(legacy, 3, 3)).toBe(8);
  });
});
