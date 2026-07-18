/**
 * These tests prove material dressing remains valid across generated geometry.
 *
 * Sixty production buildings cover different types, cultures, storey counts,
 * footprints, windows, and district alternatives. The tests independently
 * inspect rendered boxes for finite bounds, target-safe wall courses, paired
 * shutters, deterministic output, and a strict no-op on unstyled legacy plans.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBuildingMaterialParts,
  dressingContrastTone,
  MATERIAL_PART_TAG,
} from '../buildingMaterialParts';
import { buildBlueprintParts, PERIMETER_WALL_COLORS } from '../interiorParts';
import { generateBuilding } from '../../interior/generateBuilding';
import type { BuildingType, StyleContext } from '../../interior/blueprintTypes';
import { rootSeedPath } from '../../seedPath';
import { STYLE_FAMILIES } from '../../town/architectureStyle';

// ============================================================================
// Production Sample
// ============================================================================
// Cycling closed vocabularies avoids choosing a specially convenient manor or
// culture while keeping the sample deterministic and quick enough for CI.
// ============================================================================

const TYPES: BuildingType[] = [
  'cottage',
  'townhouse',
  'shop',
  'smithy',
  'workshop',
  'inn',
  'tavern',
  'storehouse',
  'manor',
  'temple',
  'keep',
  'civic',
];

const CULTURES = ['Highland', 'Naval', 'River', 'Hunting', 'Generic'] as const;

function styledBuilding(seed: number) {
  const cultureType = CULTURES[seed % CULTURES.length];
  const style: StyleContext = {
    cultureType,
    climate: 'temperate',
    wealth: (['poor', 'common', 'wealthy'] as const)[seed % 3],
    ageBand: 'new',
    architecture: {
      settlementKey: `burg:${seed % 5}`,
      districtKey: `district:${seed % 7}`,
      buildingKey: `plot:${seed}`,
    },
  };
  return generateBuilding({
    buildingId: seed + 1,
    type: TYPES[seed % TYPES.length],
    seedPath: rootSeedPath(9000 + seed),
    storeys: 1 + (seed % 3),
    basement: seed % 4 === 0,
    style,
  });
}

/** A two-sided row member exposes both possible ownership directions. */
function styledRowBuilding(owner: 'earlier-frontage-member' | 'later-frontage-member') {
  const blueprint = styledBuilding(73);
  blueprint.ensemble = {
    blockKey: 'ward:1:edge:3',
    kind: 'row',
    partyWallLeft: true,
    partyWallRight: true,
    partyWallOwner: owner,
    eaveStoreys: 2,
    ensembleSignature: 'material-party-wall-proof',
  };
  return blueprint;
}

// ============================================================================
// Geometry And Target Invariants
// ============================================================================

describe('buildBuildingMaterialParts', () => {
  it('is deterministic and bounded across sixty generated buildings', () => {
    for (let seed = 0; seed < 60; seed++) {
      const blueprint = styledBuilding(seed);
      const first = buildBuildingMaterialParts(blueprint, 3);
      const second = buildBuildingMaterialParts(blueprint, 3);

      expect(second).toEqual(first);
      expect(first.length).toBeGreaterThan(0);
      expect(first.length, `seed ${seed} material part count`).toBeLessThan(500);
      expect(first.every((part) =>
        part.tag === MATERIAL_PART_TAG
        && part.materialDetailKind.length > 0
        && Number.isFinite(part.x)
        && Number.isFinite(part.z)
        && Number.isFinite(part.baseY)
        && part.w > 0
        && part.d > 0
        && part.h > 0)).toBe(true);
      expect(first.some((part) => part.materialDetailKind === 'foundation')).toBe(true);
      expect(first.some((part) => part.materialDetailKind === 'roof-edge')).toBe(true);

      const windowCount = blueprint.floors
        .filter((floor) => floor.level >= 0)
        .reduce((total, floor) => total + floor.windows.length, 0);
      const panelCount = first.filter((part) =>
        part.materialDetailKind === 'shutter-panel').length;
      expect(panelCount).toBe(
        blueprint.styleResolved!.construction.shutters === 'none'
          ? 0
          : windowCount * 2,
      );
    }
  }, 20000);

  it('keeps every visible wall course clear of the canonical window opening', () => {
    for (let seed = 0; seed < 60; seed++) {
      const blueprint = styledBuilding(seed);
      const parts = buildBlueprintParts(
        blueprint,
        3,
        PERIMETER_WALL_COLORS.house,
        false,
      ).parts;
      const courses = parts.filter((part) =>
        part.tag === MATERIAL_PART_TAG
        && part.materialDetailKind === 'wall-course');
      const panes = parts.filter((part) => part.lightRole === 'window');

      for (const course of courses) {
        const courseRunsAlongX = course.w > course.d;
        for (const pane of panes) {
          const paneRunsAlongX = pane.w > pane.d;
          if (courseRunsAlongX !== paneRunsAlongX) continue;
          const sameWall = courseRunsAlongX
            ? Math.abs(course.z - pane.z) < 1
            : Math.abs(course.x - pane.x) < 1;
          if (!sameWall) continue;

          const courseAlong = courseRunsAlongX
            ? [course.x - course.w / 2, course.x + course.w / 2]
            : [course.z - course.d / 2, course.z + course.d / 2];
          const paneAlong = paneRunsAlongX
            ? [pane.x - pane.w / 2, pane.x + pane.w / 2]
            : [pane.z - pane.d / 2, pane.z + pane.d / 2];
          const overlapsAlong = courseAlong[0] < paneAlong[1] - 1e-6
            && courseAlong[1] > paneAlong[0] + 1e-6;
          const courseBaseY = course.baseY ?? 0;
          const paneBaseY = pane.baseY ?? 0;
          const overlapsVertically = courseBaseY < paneBaseY + pane.h - 1e-6
            && courseBaseY + course.h > paneBaseY + 1e-6;

          expect(overlapsAlong && overlapsVertically).toBe(false);
        }
      }
    }
  }, 20000);

  it('emits no material dressing for an unstyled legacy blueprint', () => {
    const bare = generateBuilding({
      buildingId: 1,
      type: 'cottage',
      seedPath: rootSeedPath(1),
    });
    expect(buildBuildingMaterialParts(bare, 3)).toEqual([]);
  });

  // ==========================================================================
  // Dressing Contrast (town-look-slice1)
  // ==========================================================================
  // The raw family trim (`fam.wallTint`) sits within a few luma points of the
  // same family's wall palette, which rendered courses/shutters invisible in
  // the streamed town. These tests pin the render-tone guarantee: every family
  // x wall-color pair yields dressing separated from its wall by the bounded
  // minimum, without inventing randomness.
  // ==========================================================================

  const luma01 = (hex: string): number => {
    const v = parseInt(hex.slice(1), 16);
    return (0.2126 * ((v >> 16) & 255)) / 255
      + (0.7152 * ((v >> 8) & 255)) / 255
      + (0.0722 * (v & 255)) / 255;
  };

  it('separates the dressing tone from every family wall color by the bounded minimum', () => {
    for (const family of Object.values(STYLE_FAMILIES)) {
      for (const wall of family.wallPalette) {
        const tone = dressingContrastTone(family.wallTint, wall);
        const separation = Math.abs(luma01(tone) - luma01(wall));
        expect(separation, `${family.id} wall ${wall} tone ${tone}`)
          .toBeGreaterThanOrEqual(0.22 - 1e-2);
        // Pure derivation: same inputs, same tone (no RNG anywhere).
        expect(dressingContrastTone(family.wallTint, wall)).toBe(tone);
      }
    }
  });

  it('preserves a trim that already carries enough contrast', () => {
    // Near-white trim on a dark wall is already separated well past the
    // minimum, so the family's exact authored tone must pass through.
    expect(dressingContrastTone('#e8e2d8', '#4a3a2c')).toBe('#e8e2d8');
  });

  it('lightens dressing on dark walls and darkens it on light walls', () => {
    // roughLog walls are dark: chinking must move toward limewash, not black.
    const logTone = dressingContrastTone('#6b5a43', '#6f5a41');
    expect(luma01(logTone)).toBeGreaterThan(luma01('#6f5a41'));
    // riverHalfTimber plaster is light: beams must move toward dark timber.
    const beamTone = dressingContrastTone('#a09680', '#cfc0a2');
    expect(luma01(beamTone)).toBeLessThan(luma01('#cfc0a2'));
  });

  it('paints wall dressing in the derived tone and roof edges in the covering color', () => {
    const blueprint = styledBuilding(11);
    const style = blueprint.styleResolved!;
    const parts = buildBuildingMaterialParts(blueprint, 3);
    const derived = dressingContrastTone(style.trimColor, style.wallColor);
    for (const part of parts) {
      expect(part.colorHex).toBe(
        part.materialDetailKind === 'roof-edge' ? style.roofColor : derived,
      );
    }
  });

  it('omits material courses and edges from the neighbor-owned party wall', () => {
    for (const owner of ['earlier-frontage-member', 'later-frontage-member'] as const) {
      const blueprint = styledRowBuilding(owner);
      const legacy = structuredClone(blueprint);
      delete legacy.ensemble!.partyWallOwner;
      const owned = buildBuildingMaterialParts(blueprint, 3);
      const legacyParts = buildBuildingMaterialParts(legacy, 3);
      const hiddenSign = owner === 'earlier-frontage-member' ? -1 : 1;
      const sideParts = owned.filter((part) =>
        part.w < part.d
        && (part.materialDetailKind === 'wall-course'
          || part.materialDetailKind === 'roof-edge'
          || part.materialDetailKind === 'foundation'));

      expect(owned.length).toBeLessThan(legacyParts.length);
      expect(sideParts.length).toBeGreaterThan(0);
      expect(sideParts.every((part) => Math.sign(part.x) !== hiddenSign)).toBe(true);
    }
  });
});
