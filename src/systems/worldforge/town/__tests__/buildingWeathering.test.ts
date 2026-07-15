/**
 * These tests prove weathering varies individual old buildings without breaking
 * a district's shared architectural exposure recipe.
 *
 * They sample several families, climates, ages, and lot identities through the
 * pure resolver. Geometry is tested elsewhere because this module returns data
 * only and must never be allowed to redesign a building.
 */

import { describe, expect, it } from 'vitest';
import type { BuildingAgeBand } from '../../interior/blueprintTypes';
import { resolveBuildingConstruction } from '../buildingMaterials';
import { resolveBuildingWeathering } from '../buildingWeathering';

// ============================================================================
// Shared Fixtures
// ============================================================================
// One approved construction kit is enough to isolate weathering behavior from
// the separate material-selection resolver.
// ============================================================================

const construction = resolveBuildingConstruction({
  familyId: 'temperateFrame',
  wealth: 'common',
  standaloneKey: 'weathering-test',
});

function resolve(
  ageBand: BuildingAgeBand,
  buildingKey: string,
  districtKey = 'district:market',
) {
  return resolveBuildingWeathering({
    familyId: 'temperateFrame',
    climate: 'temperate',
    ageBand,
    construction,
    architecture: {
      settlementKey: 'burg:17',
      districtKey,
      buildingKey,
    },
    standaloneKey: buildingKey,
  });
}

// ============================================================================
// District Coherence And Building Variation
// ============================================================================

describe('resolveBuildingWeathering', () => {
  it('keeps one patina recipe across a district while varying every lot token', () => {
    const street = Array.from({ length: 80 }, (_, index) =>
      resolve('old', `plot:${index}`));

    expect(new Set(street.map((item) => item.weatheringSignature)).size).toBe(1);
    expect(new Set(street.map((item) => item.wallPatina))).toEqual(new Set(['rain-streaks']));
    expect(new Set(street.map((item) => item.roofPatina))).toEqual(new Set(['soot-darkening']));
    expect(new Set(street.map((item) => item.weatheringVariant)).size).toBe(80);
    expect(new Set(street.map((item) => item.coverage)).size).toBeGreaterThan(50);
  });

  it('makes intensity strictly age-led and leaves new construction clean', () => {
    const ages: BuildingAgeBand[] = ['new', 'aged', 'old', 'ancient'];
    const results = ages.map((age) => resolve(age, 'plot:9'));

    expect(results.map((item) => item.intensity)).toEqual([0, 1, 2, 3]);
    expect(results[0].wallPatina).toBe('none');
    expect(results[0].roofPatina).toBe('none');
    expect(results[0].coverage).toBe(0);
    expect(results.slice(1).map((item) => item.coverage)).toEqual(
      [...results.slice(1).map((item) => item.coverage)].sort((a, b) => a - b),
    );
  });

  it('chooses climate- and family-compatible district exposure recipes', () => {
    const cases = [
      ['coastalTimber', 'temperate', 'salt-bloom', 'salt-fade'],
      ['highlandStone', 'cold', 'lichen', 'lichen-speckle'],
      ['roughLog', 'arid', 'dust-veil', 'sun-bleach'],
      ['riverHalfTimber', 'marsh', 'lichen', 'moss'],
    ] as const;

    for (const [familyId, climate, wallPatina, roofPatina] of cases) {
      const kit = resolveBuildingConstruction({
        familyId,
        wealth: 'common',
        standaloneKey: `${familyId}:kit`,
      });
      const result = resolveBuildingWeathering({
        familyId,
        climate,
        ageBand: 'ancient',
        construction: kit,
        standaloneKey: `${familyId}:building`,
      });
      expect(result.wallPatina).toBe(wallPatina);
      expect(result.roofPatina).toBe(roofPatina);
    }
  });

  it('changes district signatures without changing deterministic replay', () => {
    const first = resolve('old', 'plot:4', 'district:harbor');
    const replay = resolve('old', 'plot:4', 'district:harbor');
    const market = resolve('old', 'plot:4', 'district:market');

    expect(replay).toEqual(first);
    expect(market.weatheringSignature).not.toBe(first.weatheringSignature);
    expect(market.weatheringVariant).toBe(first.weatheringVariant);
  });
});
