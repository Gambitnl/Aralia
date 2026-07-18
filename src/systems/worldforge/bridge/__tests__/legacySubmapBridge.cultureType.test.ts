/**
 * @file legacySubmapBridge.cultureType.test.ts
 * Task 2: getBurgCultureType — the FMG culture TYPE string for a burg
 * ('Highland' | 'Naval' | 'River' | 'Lake' | 'Nomadic' | 'Hunting' |
 * 'Generic'), used to select an architecture style family per town.
 *
 * No-fallback posture (project directive): resolution failures THROW,
 * mirroring getBurgNamer's contract in the same file.
 */
import { describe, it, expect } from 'vitest';
import { getBurgCultureType, getBridgeAtlas, getBurgBiomeId } from '../legacySubmapBridge';

// Canonical seed reused across bridge tests (e.g. townTiles.test.ts,
// cellAddressedEntry.test.ts) — the atlas build is expensive and cached
// per seed, so reusing 42 avoids paying for a second world.
const WORLD_SEED = 42;

describe('getBurgCultureType', () => {
  it('returns the FMG culture type string for a real burg', () => {
    const atlas = getBridgeAtlas(WORLD_SEED);
    const burg = (atlas.pack.burgs as Array<{ i?: number; cell?: number }>).find(
      (b) => b && b.i && b.cell,
    );
    expect(burg).toBeDefined();

    const t = getBurgCultureType(WORLD_SEED, burg!.i!);
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });

  it('throws for an unknown burg (no fallback)', () => {
    expect(() => getBurgCultureType(WORLD_SEED, 999999)).toThrow();
  });
});

// ============================================================================
// Burg Biome ID Tests
// ============================================================================
// This section verifies that we can retrieve a valid biome ID (an integer
// between 0 and 12) for a real burg in the FMG world, and that we throw an
// error for any unknown/invalid burg IDs.
// ============================================================================
describe('getBurgBiomeId', () => {
  it('returns the FMG biome id for a real burg', () => {
    const atlas = getBridgeAtlas(WORLD_SEED);
    const burg = (atlas.pack.burgs as Array<{ i?: number; cell?: number }>).find(
      (b) => b && b.i && b.cell,
    );
    expect(burg).toBeDefined();

    const biomeId = getBurgBiomeId(WORLD_SEED, burg!.i!);
    expect(typeof biomeId).toBe('number');
    expect(biomeId).toBeGreaterThanOrEqual(0);
    expect(biomeId).toBeLessThanOrEqual(12);
  });

  it('throws for an unknown burg (no fallback)', () => {
    expect(() => getBurgBiomeId(WORLD_SEED, 999999)).toThrow();
  });
});
