/**
 * These tests prove material dressing remains valid across generated geometry.
 *
 * Sixty production buildings cover different types, cultures, storey counts,
 * footprints, windows, and district alternatives. The tests independently
 * inspect rendered boxes for finite bounds, target-safe wall courses, paired
 * shutters, Dressing-2 joinery and motifs, deterministic output, and a strict
 * no-op on unstyled legacy plans.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBuildingMaterialParts,
  dressingContrastTone,
  MATERIAL_PART_TAG,
  WINDOW_HALF_FT,
  WINDOW_HEAD_FT,
  WINDOW_MARGIN_FT,
  WINDOW_SILL_FT,
} from '../buildingMaterialParts';
import {
  buildBuildingMotifParts,
  MOTIF_PART_TAG,
} from '../buildingMotifParts';
import { buildBlueprintParts, PERIMETER_WALL_COLORS } from '../interiorParts';
import { generateBuilding } from '../../interior/generateBuilding';
import {
  blueprintSiteOrigin,
  type BuildingType,
  type StyleContext,
} from '../../interior/blueprintTypes';
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

/** Find a real generated fixture that carries one exact resolved receipt. */
function findStyledBuilding(
  predicate: (blueprint: ReturnType<typeof styledBuilding>) => boolean,
) {
  for (let seed = 0; seed < 500; seed += 1) {
    const blueprint = styledBuilding(seed);
    if (predicate(blueprint)) return blueprint;
  }
  throw new Error('Dressing-2 test fixture could not find the required resolved style');
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
      // Dressing-2 adds two real joinery bars per window. The measured maximum
      // in this 60-building corpus is 515, so 600 preserves a meaningful cap
      // without deleting detail from the window-rich three-storey fixture.
      expect(first.length, `seed ${seed} material part count`).toBeLessThan(600);
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
      const mullions = owned.filter((part) =>
        part.materialDetailKind === 'window-mullion');
      const origin = blueprintSiteOrigin(blueprint);
      const leftEnvelopeM = -origin.x * 0.3048;
      const rightEnvelopeM = (blueprint.widthFt - origin.x) * 0.3048;
      const inOutsideBand = (x: number, sign: -1 | 1): boolean => sign < 0
        ? x < leftEnvelopeM && x > leftEnvelopeM - 0.8
        : x > rightEnvelopeM && x < rightEnvelopeM + 0.8;

      expect(owned.length).toBeLessThan(legacyParts.length);
      expect(sideParts.length).toBeGreaterThan(0);
      expect(sideParts.every((part) => Math.sign(part.x) !== hiddenSign)).toBe(true);
      // Uprights and transoms have different width/depth orientations. Their
      // center outside the canonical side envelope is the unambiguous proof:
      // none occupy the neighbour-owned side, while the owned side still reads.
      expect(mullions.some((part) => inOutsideBand(part.x, hiddenSign))).toBe(false);
      expect(mullions.some((part) => inOutsideBand(
        part.x,
        (hiddenSign * -1) as -1 | 1,
      ))).toBe(true);
    }
  });
});

// ============================================================================
// Dressing-2 Joinery And Recognition Motifs
// ============================================================================
// These checks pin the new boxes to existing resolved receipts. They prove the
// visual kit cannot invent wealth, ornament, or role decisions of its own.
// ============================================================================

describe('Dressing-2 additive detail kit', () => {
  it('adds exactly one upright and one crossbar to every generated window', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const blueprint = styledBuilding(seed);
      const windowCount = blueprint.floors
        .filter((floor) => floor.level >= 0)
        .reduce((total, floor) => total + floor.windows.length, 0);
      const mullions = buildBuildingMaterialParts(blueprint, 3)
        .filter((part) => part.materialDetailKind === 'window-mullion');

      expect(mullions).toHaveLength(windowCount * 2);
      expect(mullions.every((part) =>
        part.tag === MATERIAL_PART_TAG
        && part.w > 0
        && part.d > 0
        && part.h > 0
        && Number.isFinite(part.baseY))).toBe(true);
    }
  }, 20000);

  it('gates bargeboards and ridge cresting to the resolved wealthy ornament roof', () => {
    const blueprint = findStyledBuilding((candidate) => {
      const style = candidate.styleResolved!;
      return style.finishTier === 'wealthy'
        && style.ornament
        && style.construction.ornamentKit === 'carved-bargeboards'
        && (style.roofForm === 'gable' || style.roofForm === 'steep')
        && Boolean(candidate.roof?.ridges.some((ridge) =>
          Math.min(Math.abs(ridge.x2 - ridge.x1), Math.abs(ridge.y2 - ridge.y1)) <= 0.2));
    });
    const first = buildBuildingMaterialParts(blueprint, 3);
    const second = buildBuildingMaterialParts(blueprint, 3);
    const crest = first.filter((part) => part.materialDetailKind === 'ridge-crest');
    const bargeboards = first.filter((part) => part.materialDetailKind === 'bargeboard');
    const primary = [...blueprint.roof!.ridges].sort((a, b) =>
      Math.hypot(b.x2 - b.x1, b.y2 - b.y1)
      - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))[0];
    const ridgeLengthFt = Math.hypot(primary.x2 - primary.x1, primary.y2 - primary.y1);
    const expectedPosts = Math.max(3, Math.min(7, Math.ceil(ridgeLengthFt / 4) + 1));

    expect(second).toEqual(first);
    expect(crest).toHaveLength(expectedPosts + 1);
    expect(bargeboards.length).toBeGreaterThanOrEqual(4);
    expect(bargeboards.length).toBeLessThanOrEqual(20);
    expect([...crest, ...bargeboards].every((part) =>
      part.tag === MATERIAL_PART_TAG
      && (part.materialDetailKind === 'ridge-crest'
        || part.materialDetailKind === 'bargeboard')
      && part.w > 0
      && part.d > 0
      && part.h > 0
      && Number.isFinite(part.x)
      && Number.isFinite(part.z)
      && Number.isFinite(part.baseY))).toBe(true);

    // Each receipt is independently necessary. Removing any one must produce
    // no wealthy roof joinery, without changing canonical roof geometry.
    const predicateBreakers = [
      (candidate: typeof blueprint) => { candidate.styleResolved!.finishTier = 'common'; },
      (candidate: typeof blueprint) => { candidate.styleResolved!.ornament = false; },
      (candidate: typeof blueprint) => {
        candidate.styleResolved!.construction.ornamentKit = 'painted-timber';
      },
      (candidate: typeof blueprint) => { candidate.roof!.ridges = []; },
    ];
    for (const breakPredicate of predicateBreakers) {
      const candidate = structuredClone(blueprint);
      breakPredicate(candidate);
      const details = buildBuildingMaterialParts(candidate, 3);
      expect(details.some((part) =>
        part.materialDetailKind === 'ridge-crest'
        || part.materialDetailKind === 'bargeboard')).toBe(false);
    }
  });

  it('broadens the existing jetty motif and adds a bounded corbel rhythm', () => {
    const blueprint = findStyledBuilding((candidate) => {
      if (!candidate.styleResolved!.motifs.includes('jettied-bay')) return false;
      const topFloor = [...candidate.floors]
        .filter((floor) => floor.level >= 0)
        .sort((a, b) => b.level - a.level)[0];
      if (!topFloor || topFloor.level < 1) return false;
      const frontRunYFt = Math.min(...topFloor.wallRuns
        .filter((run) => run.kind === 'outer' && run.axis === 'x')
        .map((run) => run.y1));
      return topFloor.windows.some((window) =>
        window.axis === 'x' && Math.abs(window.y - frontRunYFt) <= 1e-6);
    });
    const style = blueprint.styleResolved!;
    const jetty = buildBuildingMotifParts(blueprint, 3)
      .filter((part) => part.motifKind === 'jettied-bay');
    const widthM = blueprint.widthFt * 0.3048;
    const bayWidthM = Math.min(widthM * 0.9, Math.max(2.4, widthM * 0.76));
    const expectedCorbels = Math.max(3, Math.min(7, Math.ceil(bayWidthM / 0.8)));
    const topFloor = [...blueprint.floors]
      .filter((floor) => floor.level >= 0)
      .sort((a, b) => b.level - a.level)[0];
    const frontRunYFt = Math.min(...topFloor.wallRuns
      .filter((run) => run.kind === 'outer' && run.axis === 'x')
      .map((run) => run.y1));
    const frontWindows = topFloor.windows.filter((window) =>
      window.axis === 'x' && Math.abs(window.y - frontRunYFt) <= 1e-6);
    const origin = blueprintSiteOrigin(blueprint);
    const shellParts = jetty.filter((part) => part.colorHex === style.wallColor);
    const openingBaseY = topFloor.level * 3 + WINDOW_SILL_FT * 0.3048;
    const openingTopY = topFloor.level * 3 + WINDOW_HEAD_FT * 0.3048;
    const openingHalfM = (WINDOW_HALF_FT + WINDOW_MARGIN_FT) * 0.3048;

    expect(jetty.length).toBeLessThan(20);
    expect(jetty.every((part) =>
      part.tag === MOTIF_PART_TAG
      && part.motifKind === 'jettied-bay'
      && part.w > 0
      && part.d > 0
      && part.h > 0)).toBe(true);
    expect(Math.max(...jetty.map((part) => part.w))).toBeGreaterThanOrEqual(widthM * 0.7);
    expect(jetty.filter((part) => part.colorHex === style.trimColor)).toHaveLength(1 + expectedCorbels);
    expect(shellParts.length).toBeGreaterThan(1);
    expect(frontWindows.length).toBeGreaterThan(0);

    // No wall-coloured jetty box may occupy a real top-floor window interval
    // during the canonical sill-to-head band. This catches the opaque shell
    // regression that the first rendered proof exposed.
    for (const window of frontWindows) {
      const windowCenterX = (window.x - origin.x) * 0.3048;
      const overlapsOpening = shellParts.some((part) => {
        const partBaseY = part.baseY ?? 0;
        const overlapsX = part.x + part.w / 2 > windowCenterX - openingHalfM + 1e-6
          && part.x - part.w / 2 < windowCenterX + openingHalfM - 1e-6;
        const overlapsY = partBaseY + part.h > openingBaseY + 1e-6
          && partBaseY < openingTopY - 1e-6;
        return overlapsX && overlapsY;
      });
      expect(overlapsOpening, `window at x=${window.x}ft remains open`).toBe(false);
    }
    expect(buildBuildingMotifParts(blueprint, 3)
      .filter((part) => part.motifKind === 'jettied-bay')).toEqual(jetty);
  });

  it('builds the hanging sign from a bracket, board, twin hangers, and inset face', () => {
    const shelterKinds = new Set([
      'front-canopy',
      'shop-awning',
      'covered-gallery',
      'entry-portico',
      'log-porch',
    ]);
    const blueprint = findStyledBuilding((candidate) => {
      const motifs = candidate.styleResolved!.motifs;
      return motifs.includes('hanging-sign')
        && motifs.some((motif) => shelterKinds.has(motif));
    });
    const sign = buildBuildingMotifParts(blueprint, 3)
      .filter((part) => part.motifKind === 'hanging-sign');
    const shelter = buildBuildingMotifParts(blueprint, 3)
      .filter((part) => shelterKinds.has(part.motifKind));
    const board = sign.find((part) =>
      part.colorHex === blueprint.styleResolved!.roofColor
      && part.d > part.w
      && part.h > 0.5);
    const bracket = sign.find((part) =>
      part.colorHex === blueprint.styleResolved!.trimColor
      && part.d > 0.7
      && part.h < 0.2);
    const insetFaces = sign.filter((part) =>
      part.colorHex === blueprint.styleResolved!.wallColor
      && part.d > 0.6
      && part.h > 0.5);

    expect(sign).toHaveLength(6);
    expect(sign.every((part) =>
      part.tag === MOTIF_PART_TAG
      && part.motifKind === 'hanging-sign'
      && Number.isFinite(part.x)
      && Number.isFinite(part.z)
      && part.w > 0
      && part.d > 0
      && part.h > 0)).toBe(true);
    expect(board).toBeDefined();
    expect(board!.d).toBeGreaterThanOrEqual(0.85);
    expect(board!.h).toBeGreaterThanOrEqual(0.85);
    expect(board!.d / board!.w).toBeGreaterThan(4.5);
    expect(bracket).toBeDefined();
    expect(bracket!.w).toBeGreaterThanOrEqual(0.16);
    expect(insetFaces).toHaveLength(2);
    expect(shelter.length).toBeGreaterThan(0);
    const shelterOuterEdgeZ = Math.min(...shelter.map((part) => part.z - part.d / 2));
    const boardInnerEdgeZ = board!.z + board!.d / 2;
    expect(boardInnerEdgeZ).toBeLessThanOrEqual(shelterOuterEdgeZ - 0.2);
  });

  it('keeps an unstyled legacy blueprint free of Dressing-2 motifs', () => {
    const bare = generateBuilding({
      buildingId: 1,
      type: 'cottage',
      seedPath: rootSeedPath(1),
    });
    expect(buildBuildingMotifParts(bare, 3)).toEqual([]);
  });
});
