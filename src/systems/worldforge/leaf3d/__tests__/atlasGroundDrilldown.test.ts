import { describe, expect, it } from 'vitest';
import type { LocalArtifact, RegionArtifact } from '../../artifacts';
import { buildAtlasGroundDrilldown, groundFocusesForLocal, groundStartForFocus } from '../atlasGroundDrilldown';

/**
 * These tests prove that Atlas hands ground 3D an exact, deterministic location receipt.
 * They protect seed lineage, coordinates, destination ownership, and the feet-to-meters
 * boundary that makes the visible map selection correspond to the streamed scene.
 */

const region = { seedPath: '42/region:9' } as RegionArtifact;
// The receipt builder reads identity, bounds, features, and optional town data only. This
// deliberately narrow fixture avoids inventing unrelated terrain and simulation content.
const local = {
  seedPath: '42/region:9/local:1200,900',
  bounds: { x: 1000, y: 500, width: 3000, height: 3000 },
  features: [{ id: 7, kind: 'poi', x: 1300, y: 1100, data: { name: 'Ash Shrine' } }],
} as unknown as LocalArtifact;

describe('Atlas ground drilldown', () => {
  it('preserves exact seed lineage, cell identity, coordinates, and selected site', () => {
    const focus = groundFocusesForLocal(local)[0];
    const receipt = buildAtlasGroundDrilldown({ worldSeed: 42, atlasCellId: 9, region, local, focus });

    expect(receipt).toEqual({
      worldSeed: 42,
      atlasCellId: 9,
      regionSeedPath: '42/region:9',
      localSeedPath: '42/region:9/local:1200,900',
      localBounds: { x: 1000, y: 500, width: 3000, height: 3000 },
      focus: { kind: 'site', id: 7, label: 'Ash Shrine', xFt: 1300, yFt: 1100 },
    });
    expect(groundStartForFocus(local, focus)).toEqual([91.44, 182.88]);
  });

  it('rejects a focus from a different local artifact instead of approximating it', () => {
    expect(() => buildAtlasGroundDrilldown({
      worldSeed: 42,
      atlasCellId: 9,
      region,
      local,
      focus: { kind: 'site', id: 99, label: 'Foreign site', xFt: 0, yFt: 0 },
    })).toThrow(/does not belong/);
  });

  it('offers a deterministic wilderness center when a local has no town or site', () => {
    const empty = { ...local, features: [] } as LocalArtifact;
    expect(groundFocusesForLocal(empty)).toEqual([{
      kind: 'local',
      id: empty.seedPath,
      label: 'Local wilderness',
      xFt: 2500,
      yFt: 2000,
    }]);
  });

  it('derives a town entry from the exact authored building footprint', () => {
    // Two deliberately uneven plots prove the focus uses the artifact geometry rather
    // than a generic Local center or a separately generated burg approximation.
    const townLocal = {
      ...local,
      features: [],
      townPlan: {
        burgId: 12,
        plots: [
          { footprint: [[1100, 700], [1300, 700]] },
          { footprint: [[1500, 900]] },
        ],
      },
    } as unknown as LocalArtifact;

    expect(groundFocusesForLocal(townLocal)).toEqual([{
      kind: 'town',
      id: 12,
      label: 'Town 12',
      xFt: 1300,
      yFt: 2300 / 3,
    }]);
  });
});
