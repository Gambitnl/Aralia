/**
 * This file proves Wave 3 live coordinates and hidden pins remain attached to
 * the exact Wave 2 Atlas address.
 *
 * The fixtures are compact JSON objects so failures identify schema/lineage
 * regressions without invoking the procedural generator already covered by the
 * restore tests.
 */
import { describe, expect, it } from 'vitest';
import type { AtlasGroundAddress } from '../atlasGroundDrilldown';
import {
  atlasGroundPositionForAddress,
  atlasGroundSpawnForAddress,
  atlasHiddenSiteForAddress,
  discoveredSiteBelongsToWorld,
  normalizeAtlasGroundPosition,
  normalizeDiscoveredHiddenSite,
} from '../atlasGroundContinuity';

// ============================================================================
// Canonical address fixture
// ============================================================================

const address: AtlasGroundAddress = {
  schemaVersion: 1,
  worldSeed: 91,
  atlasCellId: 23,
  regionSeedPath: '91/region:23',
  regionBounds: { x: 0, y: 0, width: 25_000, height: 25_000 },
  localSeedPath: '91/region:23/local:1000,2000',
  localBounds: { x: 1000, y: 2000, width: 3000, height: 3000 },
  focus: { kind: 'site', id: 8, xFt: 1200, yFt: 2300 },
  returnTier: 'local',
};

describe('Atlas ground current-position continuity', () => {
  it('restores interior and combat round trips only from the exact same Local', () => {
    const insideBusiness = atlasGroundPositionForAddress(address, 80, 120);
    expect(insideBusiness).not.toBeNull();
    expect(atlasGroundSpawnForAddress(address, insideBusiness, [20, 30])).toEqual({
      xM: 80,
      zM: 120,
      source: 'saved-position',
    });

    // The same cell id is insufficient: a foreign Local lineage must return to
    // the selected focus rather than reopening at its stale interior/combat spot.
    const foreign = { ...insideBusiness!, localSeedPath: '91/region:23/local:9000,9000' };
    expect(atlasGroundSpawnForAddress(address, foreign, [20, 30])).toEqual({
      xM: 20,
      zM: 30,
      source: 'selected-focus',
    });
  });

  it('rejects out-of-bounds and future-version current positions', () => {
    expect(atlasGroundPositionForAddress(address, 5000, 10)).toBeNull();
    expect(normalizeAtlasGroundPosition({
      ...atlasGroundPositionForAddress(address, 10, 10),
      schemaVersion: 2,
    }, address)).toBeNull();
  });
});

describe('Atlas hidden-place provenance', () => {
  it('namespaces identical generator source ids by world and Local lineage', () => {
    const first = atlasHiddenSiteForAddress({
      address,
      sourceId: 'hp:0',
      sourceKind: 'hidden-site',
      name: 'Whisper Cave',
      kind: 'cave',
      xM: 30.48,
      zM: 60.96,
    });
    const second = atlasHiddenSiteForAddress({
      address: { ...address, localSeedPath: `${address.localSeedPath}:east` },
      sourceId: 'hp:0',
      sourceKind: 'hidden-site',
      name: 'Sunken Shrine',
      xM: 30.48,
      zM: 60.96,
    });

    expect(first?.id).not.toBe(second?.id);
    expect(first?.atlasGround).toMatchObject({
      worldSeed: 91,
      atlasCellId: 23,
      regionSeedPath: address.regionSeedPath,
      localSeedPath: address.localSeedPath,
      source: { kind: 'hidden-site', id: 'hp:0' },
      xM: 30.48,
      zM: 60.96,
      xFt: 1100,
      yFt: 2200,
    });
  });

  it('keeps legacy pins compatible but fails closed on corrupt versioned provenance', () => {
    expect(normalizeDiscoveredHiddenSite({ id: 'legacy-cave', cellId: 4, name: 'Old Cave' }))
      .toEqual({ id: 'legacy-cave', cellId: 4, name: 'Old Cave' });

    const valid = atlasHiddenSiteForAddress({
      address,
      sourceId: 'hp:1',
      sourceKind: 'hidden-site',
      xM: 20,
      zM: 30,
    })!;
    expect(normalizeDiscoveredHiddenSite({
      ...valid,
      atlasGround: { ...valid.atlasGround!, schemaVersion: 99 },
    })).toBeNull();
    expect(discoveredSiteBelongsToWorld(valid, 91)).toBe(true);
    expect(discoveredSiteBelongsToWorld(valid, 92)).toBe(false);
  });
});
