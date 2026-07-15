/**
 * These tests prove resolved age and exposure become bounded, valid 3D detail.
 *
 * The sample uses production building generation so weathering must survive the
 * full style pipeline before the bridge projects it onto canonical outer walls.
 * New and legacy buildings remain strict no-ops.
 */

import { describe, expect, it } from 'vitest';
import type { BuildingAgeBand, BuildingType, StyleContext } from '../../interior/blueprintTypes';
import { generateBuilding } from '../../interior/generateBuilding';
import { rootSeedPath } from '../../seedPath';
import {
  buildBuildingWeatheringParts,
  WEATHERING_PART_TAG,
} from '../buildingWeatheringParts';
import { buildBlueprintParts, PERIMETER_WALL_COLORS } from '../interiorParts';

// ============================================================================
// Production Fixture
// ============================================================================

function styledBuilding(seed: number, ageBand: BuildingAgeBand) {
  const types: BuildingType[] = ['cottage', 'shop', 'smithy', 'inn', 'manor', 'temple'];
  const style: StyleContext = {
    cultureType: 'Generic',
    climate: 'temperate',
    wealth: 'common',
    ageBand,
    architecture: {
      settlementKey: 'burg:22',
      districtKey: 'district:market',
      buildingKey: `plot:${seed}`,
    },
  };
  return generateBuilding({
    buildingId: seed + 1,
    type: types[seed % types.length],
    seedPath: rootSeedPath(4700 + seed),
    storeys: 1 + (seed % 3),
    style,
  });
}

/** Attach a row receipt after generation; weathering reads only its ownership. */
function styledRowBuilding(owner: 'earlier-frontage-member' | 'later-frontage-member') {
  const blueprint = styledBuilding(29, 'ancient');
  blueprint.ensemble = {
    blockKey: 'ward:1:edge:3',
    kind: 'row',
    partyWallLeft: true,
    partyWallRight: true,
    partyWallOwner: owner,
    eaveStoreys: 3,
    ensembleSignature: 'weathering-party-wall-proof',
  };
  return blueprint;
}

// ============================================================================
// Projection Invariants
// ============================================================================

describe('buildBuildingWeatheringParts', () => {
  it('is deterministic, finite, tagged, and bounded across older buildings', () => {
    for (let seed = 0; seed < 48; seed++) {
      const blueprint = styledBuilding(seed, seed % 2 === 0 ? 'old' : 'ancient');
      const first = buildBuildingWeatheringParts(blueprint, 3);
      const replay = buildBuildingWeatheringParts(blueprint, 3);

      expect(replay).toEqual(first);
      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBeLessThanOrEqual(9);
      expect(first.every((part) =>
        part.tag === WEATHERING_PART_TAG
        && part.weatheringDetailKind.length > 0
        && Number.isFinite(part.x)
        && Number.isFinite(part.z)
        && Number.isFinite(part.baseY)
        && part.w > 0
        && part.d > 0
        && part.h > 0)).toBe(true);
      expect(first.some((part) => part.weatheringDetailKind === 'wall-patina-band')).toBe(true);
      expect(first.some((part) => part.weatheringDetailKind === 'roof-patina-edge')).toBe(true);
    }
  }, 20000);

  it('reaches the shared blueprint-to-3D bridge with semantic tags intact', () => {
    const blueprint = styledBuilding(9, 'ancient');
    const output = buildBlueprintParts(blueprint, 3, PERIMETER_WALL_COLORS.house, false);
    const weathering = output.parts.filter((part) => part.tag === WEATHERING_PART_TAG);

    expect(weathering).toEqual(buildBuildingWeatheringParts(blueprint, 3));
    expect(weathering.length).toBeGreaterThan(0);
  });

  it('is a strict no-op for new construction and unstyled legacy plans', () => {
    expect(buildBuildingWeatheringParts(styledBuilding(1, 'new'), 3)).toEqual([]);
    const legacy = generateBuilding({
      buildingId: 1,
      type: 'cottage',
      seedPath: rootSeedPath(1),
    });
    expect(buildBuildingWeatheringParts(legacy, 3)).toEqual([]);
  });

  it('never places ground patina on the neighbor-owned party wall', () => {
    for (const owner of ['earlier-frontage-member', 'later-frontage-member'] as const) {
      const blueprint = styledRowBuilding(owner);
      const hiddenSign = owner === 'earlier-frontage-member' ? -1 : 1;
      const sidePatina = buildBuildingWeatheringParts(blueprint, 3).filter((part) =>
        part.weatheringDetailKind === 'wall-patina-band' && part.w < part.d);

      expect(sidePatina.every((part) => Math.sign(part.x) !== hiddenSign)).toBe(true);
    }
  });
});
