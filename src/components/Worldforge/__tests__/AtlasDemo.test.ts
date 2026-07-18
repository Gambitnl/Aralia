/**
 * This file protects Atlas layout helpers and the Atlas-to-PLAYING return path.
 *
 * The navigation proof stays at the pure hierarchy boundary so it can assert
 * exact Region/Local object identity without mounting the expensive FMG canvas.
 */
import { describe, expect, it } from 'vitest';
import type { LocalArtifact, RegionArtifact } from '../../../systems/worldforge/artifacts';
import {
  atlasGroundAddressFromDrilldown,
  buildAtlasGroundDrilldown,
  groundFocusesForLocal,
} from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import { restoreAtlasGroundDrilldown } from '../../../systems/worldforge/leaf3d/atlasGroundRestore';
import {
  getBridgeAtlas,
  getWorldforgeLocalForCell,
} from '../../../systems/worldforge/bridge/legacySubmapBridge';
import {
  atlasDiscoveryMarkersForWorld,
  atlasHierarchyCrumbs,
  atlasHierarchyForGroundReturn,
  atlasDemoBreadcrumbClassName,
  atlasDemoBreadcrumbHintClassName,
  atlasDemoBreadcrumbIdentityClassName,
  measureAtlasDemoMapSize,
} from '../AtlasDemo';
import { atlasHiddenSiteForAddress } from '../../../systems/worldforge/leaf3d/atlasGroundContinuity';
import type { AtlasGroundAddress } from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';

// ============================================================================
// Responsive layout helpers
// ============================================================================
// These checks keep the large cartographic canvas usable at narrow widths.

describe('AtlasDemo sizing', () => {
  it('fits the atlas canvas to a phone-width workspace instead of forcing 480px overflow', () => {
    expect(measureAtlasDemoMapSize({ width: 320, height: 640 })).toEqual({
      width: 320,
      height: 640,
    });
  });

  it('keeps a minimal nonzero canvas for hidden or not-yet-measured workspaces', () => {
    expect(measureAtlasDemoMapSize({ width: 0, height: 0 })).toEqual({
      width: 1,
      height: 260,
    });
  });
});

describe('AtlasDemo breadcrumb layout', () => {
  it('bounds and wraps the breadcrumb strip on phone-width map views', () => {
    expect(atlasDemoBreadcrumbClassName).toContain('left-2');
    expect(atlasDemoBreadcrumbClassName).toContain('right-2');
    expect(atlasDemoBreadcrumbClassName).toContain('top-20');
    expect(atlasDemoBreadcrumbClassName).toContain('max-w-[calc(100%-1rem)]');
    expect(atlasDemoBreadcrumbClassName).toContain('sm:left-auto');
    expect(atlasDemoBreadcrumbIdentityClassName).toContain('flex-wrap');
    expect(atlasDemoBreadcrumbHintClassName).toContain('items-start');
  });

  it('keeps canonical town identity continuous while current-tier state advances to Ground', () => {
    const local = {
      bounds: { x: 1000, y: 2000, width: 3000, height: 3000 },
      townPlan: {
        burgId: 31,
        identity: {
          kind: 'town',
          sourceKind: 'atlas-burg',
          sourceId: 31,
          name: 'Alderwatch',
          settlementType: 'port',
          biomeId: 6,
          hasRoadAccess: true,
          hasRiverAccess: true,
          isCoastal: true,
        },
      },
    } as unknown as LocalArtifact;

    const localCrumbs = atlasHierarchyCrumbs({
      viewMode: 'local',
      selectedCellId: 3122,
      local,
    });
    expect(localCrumbs.map((crumb) => crumb.label)).toEqual([
      'World',
      'Cell #3122',
      'Region',
      'Local',
      'Alderwatch',
    ]);
    expect(localCrumbs.find((crumb) => crumb.current)?.tier).toBe('town');

    const groundCrumbs = atlasHierarchyCrumbs({
      viewMode: 'ground',
      selectedCellId: 3122,
      local,
      groundFocus: { kind: 'town', id: 31, label: 'Alderwatch', xFt: 1400, yFt: 2400 },
    });
    expect(groundCrumbs.at(-2)?.label).toBe('Alderwatch');
    expect(groundCrumbs.at(-1)).toEqual({
      tier: 'ground',
      label: 'Ground: Alderwatch',
      current: true,
    });
  });
});

// ============================================================================
// PLAYING return hierarchy
// ============================================================================
// TransitionController unmounts Atlas during ground play. This receipt must
// restore the exact Local object and its parent Region when Atlas remounts.
describe('AtlasDemo PLAYING ground return', () => {
  it('returns to the same selected Local artifact and Atlas cell', () => {
    const region = { seedPath: '77/region:14' } as RegionArtifact;
    const local = {
      seedPath: '77/region:14/local:3000,6000',
      bounds: { x: 3000, y: 6000, width: 3000, height: 3000 },
      features: [{ id: 5, kind: 'poi', x: 3600, y: 6600, data: { name: 'Old Well' } }],
    } as unknown as LocalArtifact;
    const receipt = buildAtlasGroundDrilldown({
      worldSeed: 77,
      atlasCellId: 14,
      region,
      local,
      focus: { kind: 'site', id: 5, label: 'Old Well', xFt: 3600, yFt: 6600 },
    });

    const restored = atlasHierarchyForGroundReturn(receipt);

    expect(restored.viewMode).toBe('local');
    expect(restored.selectedCellId).toBe(14);
    expect(restored.regionArtifact).toBe(region);
    expect(restored.localArtifact).toBe(local);
  });

  it('returns a JSON-restored receipt to its exact reconstructed Local hierarchy', () => {
    const atlas = getBridgeAtlas(42);
    const atlasCellId = Array.from(atlas.pack.cells.h).findIndex((height) => height >= 20);
    const generated = getWorldforgeLocalForCell(42, atlasCellId);
    const originalReceipt = buildAtlasGroundDrilldown({
      worldSeed: 42,
      atlasCellId,
      region: generated.region,
      local: generated.local,
      focus: groundFocusesForLocal(generated.local)[0],
    });
    const restoredReceipt = restoreAtlasGroundDrilldown(
      JSON.parse(JSON.stringify(atlasGroundAddressFromDrilldown(originalReceipt))),
      42,
    );

    expect(restoredReceipt.status).toBe('ready');
    if (restoredReceipt.status !== 'ready') return;
    const hierarchy = atlasHierarchyForGroundReturn(restoredReceipt.drilldown);
    expect(hierarchy.viewMode).toBe('local');
    expect(hierarchy.selectedCellId).toBe(atlasCellId);
    expect(hierarchy.regionArtifact).toBe(restoredReceipt.drilldown.region);
    expect(hierarchy.localArtifact).toBe(restoredReceipt.drilldown.local);
  }, 30_000);

  it('projects a saved hidden place at its exact feet and excludes foreign worlds', () => {
    const address: AtlasGroundAddress = {
      schemaVersion: 1,
      worldSeed: 77,
      atlasCellId: 14,
      regionSeedPath: '77/region:14',
      regionBounds: { x: 0, y: 0, width: 25_000, height: 25_000 },
      localSeedPath: '77/region:14/local:3000,6000',
      localBounds: { x: 3000, y: 6000, width: 3000, height: 3000 },
      focus: { kind: 'local', id: 'local', xFt: 3300, yFt: 6300 },
      returnTier: 'local',
    };
    const site = atlasHiddenSiteForAddress({
      address,
      sourceId: 'hp:0',
      sourceKind: 'hidden-site',
      name: 'Moonwell',
      xM: 30.48,
      zM: 60.96,
    })!;

    expect(atlasDiscoveryMarkersForWorld([site], 77)).toEqual([{
      kind: 'quest',
      x: 3100,
      y: 6200,
      label: 'Discovered: Moonwell',
    }]);
    expect(atlasDiscoveryMarkersForWorld([site], 78)).toEqual([]);
  });
});
