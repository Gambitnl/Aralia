/**
 * These tests prove that construction materials create controlled variety.
 *
 * They inspect the closed family tables independently, then sample long streets
 * to verify that one district repeats a dominant kit while still producing a
 * bounded minority alternative. They also prove wealth improves finish quality
 * without changing the district's physical construction vocabulary.
 */

import { describe, expect, it } from 'vitest';
import type { BriefWealth } from '../../interior/blueprintTypes';
import {
  CONSTRUCTION_KITS,
  constructionKitsForFamily,
  resolveBuildingConstruction,
  type ArchitectureFamilyId,
} from '../buildingMaterials';

// ============================================================================
// Shared Sampling Helpers
// ============================================================================
// A fixed family list makes table coverage explicit and catches an added family
// that forgot to receive material kits once the type is extended.
// ============================================================================

const FAMILY_IDS: ArchitectureFamilyId[] = [
  'highlandStone',
  'coastalTimber',
  'riverHalfTimber',
  'roughLog',
  'temperateFrame',
];

function identified(
  familyId: ArchitectureFamilyId,
  buildingKey: string,
  wealth: BriefWealth = 'common',
  districtKey = 'district:2',
) {
  return resolveBuildingConstruction({
    familyId,
    wealth,
    architecture: {
      settlementKey: 'burg:17',
      districtKey,
      buildingKey,
    },
    standaloneKey: 'unused-for-identified-buildings',
  });
}

// ============================================================================
// Closed Family Tables
// ============================================================================
// These checks stop missing dimensions, duplicate ids, or cross-family kit
// leakage before any renderer gets involved.
// ============================================================================

describe('construction kit vocabulary', () => {
  it('gives every architecture family three complete, uniquely named kits', () => {
    const allIds: string[] = [];

    for (const familyId of FAMILY_IDS) {
      const kits = constructionKitsForFamily(familyId);
      expect(kits).toHaveLength(3);
      expect(new Set(kits.map((kit) => kit.id)).size).toBe(3);

      for (const kit of kits) {
        allIds.push(kit.id);
        expect(kit.wallCourseFt).toBeGreaterThan(0);
        expect(kit.timberWidthFt).toBeGreaterThan(0);
        expect(kit.glazingByWealth).toHaveLength(3);
        expect(kit.shutters.length).toBeGreaterThanOrEqual(1);
        expect(kit.ornamentByWealth).toHaveLength(3);
      }
    }

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(Object.keys(CONSTRUCTION_KITS).sort()).toEqual([...FAMILY_IDS].sort());
  });

  it('returns deterministic complete materials for standalone previews', () => {
    const input = {
      familyId: 'coastalTimber' as const,
      wealth: 'common' as const,
      standaloneKey: 'wf:77/building:4',
    };
    const first = resolveBuildingConstruction(input);
    const second = resolveBuildingConstruction(input);

    expect(second).toEqual(first);
    expect(constructionKitsForFamily('coastalTimber').map((kit) => kit.id))
      .toContain(first.kitId);
    expect(first.constructionSignature).toBe('coastalTimber:standalone');
  });
});

// ============================================================================
// District Cohesion And Building Variation
// ============================================================================
// The sample is intentionally larger than one street pair. It proves the
// majority/minority rule statistically while bounding every trait to the
// district's dominant answer plus one related exception.
// ============================================================================

describe('resolveBuildingConstruction', () => {
  it('is byte-deterministic for one three-scope identity', () => {
    expect(identified('riverHalfTimber', 'plot:8'))
      .toEqual(identified('riverHalfTimber', 'plot:8'));
  });

  it('repeats one district recipe with at most two material answers per trait', () => {
    for (const familyId of FAMILY_IDS) {
      const street = Array.from({ length: 160 }, (_, index) =>
        identified(familyId, `plot:${index}`));

      expect(new Set(street.map((entry) => entry.constructionSignature)).size).toBe(1);

      const traitRows = [
        street.map((entry) => entry.kitId),
        street.map((entry) => entry.wallMaterial),
        street.map((entry) => entry.roofCovering),
        street.map((entry) => entry.foundation),
        street.map((entry) => entry.shutters),
      ];

      for (const values of traitRows) {
        expect(new Set(values).size).toBeGreaterThanOrEqual(1);
        expect(new Set(values).size).toBeLessThanOrEqual(2);
        const counts = values.reduce<Record<string, number>>((tally, value) => {
          tally[value] = (tally[value] ?? 0) + 1;
          return tally;
        }, {});
        expect(Math.max(...Object.values(counts)) / values.length)
          .toBeGreaterThan(0.65);
      }
    }
  });

  it('never selects a kit outside the settlement culture family', () => {
    for (const familyId of FAMILY_IDS) {
      const allowed = new Set(constructionKitsForFamily(familyId).map((kit) => kit.id));
      for (let district = 0; district < 20; district++) {
        for (let building = 0; building < 20; building++) {
          expect(allowed.has(identified(
            familyId,
            `plot:${building}`,
            'common',
            `district:${district}`,
          ).kitId)).toBe(true);
        }
      }
    }
  });

  it('lets districts establish different construction recipes inside one family', () => {
    const districts = Array.from({ length: 24 }, (_, index) =>
      identified('temperateFrame', 'plot:4', 'common', `district:${index}`));

    expect(new Set(districts.map((entry) => entry.constructionSignature)).size)
      .toBe(24);
    expect(new Set(districts.map((entry) => entry.kitId)).size)
      .toBeGreaterThan(1);
    expect(new Set(districts.map((entry) => entry.shutters)).size)
      .toBeGreaterThan(1);
  });

  it('uses wealth for glazing and ornament, not for structural kit identity', () => {
    for (const familyId of FAMILY_IDS) {
      const poor = identified(familyId, 'plot:11', 'poor');
      const wealthy = identified(familyId, 'plot:11', 'wealthy');

      expect(wealthy.kitId).toBe(poor.kitId);
      expect(wealthy.wallMaterial).toBe(poor.wallMaterial);
      expect(wealthy.roofCovering).toBe(poor.roofCovering);
      expect(wealthy.foundation).toBe(poor.foundation);
      expect(wealthy.shutters).toBe(poor.shutters);
      expect(wealthy.constructionSignature).toBe(poor.constructionSignature);
      expect(wealthy.glazing).not.toBe(poor.glazing);
      expect(wealthy.ornamentKit).not.toBe(poor.ornamentKit);
    }
  });
});
