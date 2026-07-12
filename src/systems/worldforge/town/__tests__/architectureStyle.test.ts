/**
 * This file proves the rules that make generated towns look related without
 * making their buildings identical.
 *
 * It covers the culture-family tables, frame-stable 2D/3D palette picks, the
 * climate and wealth resolver, and the layered settlement/district/building
 * identity rules. These tests call only pure functions, so failures identify a
 * style-rule regression without involving React or three.js rendering.
 */
import { describe, it, expect } from 'vitest';
import {
  styleFamilyForCultureType, styledWallColor, styledRoof, styleFrameOf, hash01,
  STYLE_FAMILIES, resolveStyle, resolveArchitectureVariant,
  climateForBiomeId, BIOME_TO_CLIMATE,
} from '../architectureStyle';
import type { ResolveStyleInput } from '../architectureStyle';
import { makeSeedPath } from '../../seedPath';

// ============================================================================
// Culture Families And Frame-Stable Town Map Styling
// ============================================================================
// These checks protect the broad architectural vocabulary shared by the 2D
// town map and the 3D building pipeline.
// ============================================================================

describe('architectureStyle', () => {
  it('maps every FMG culture type to a family', () => {
    for (const t of ['Generic', 'River', 'Lake', 'Naval', 'Nomadic', 'Hunting', 'Highland']) {
      expect(styleFamilyForCultureType(t).id).toBeTruthy();
    }
    expect(styleFamilyForCultureType('Highland').id).toBe('highlandStone');
    expect(styleFamilyForCultureType('Naval').id).toBe('coastalTimber');
    expect(styleFamilyForCultureType('Lake').id).toBe('coastalTimber');
    expect(styleFamilyForCultureType('River').id).toBe('riverHalfTimber');
    expect(styleFamilyForCultureType('Hunting').id).toBe('roughLog');
    expect(styleFamilyForCultureType('Generic').id).toBe('temperateFrame');
  });

  it('THROWS on an unknown culture type (no-fallback directive)', () => {
    expect(() => styleFamilyForCultureType('Astral')).toThrow(/no architecture style/i);
  });

  it('every family is fully populated', () => {
    for (const fam of Object.values(STYLE_FAMILIES)) {
      expect(fam.wallPalette.length).toBeGreaterThanOrEqual(2);
      expect(fam.roofPalette.length).toBeGreaterThanOrEqual(1);
      expect(fam.roofForms.length).toBeGreaterThanOrEqual(1);
      expect(fam.facadePatterns.length).toBeGreaterThanOrEqual(2);
      expect(fam.gatehouseForms.length).toBeGreaterThanOrEqual(1);
      expect(fam.deckDetail.pilingSpacingM).toBeGreaterThan(0);
    }
  });

  it('per-plot picks are deterministic from the polygon + frame', () => {
    const poly: Array<[number, number]> = [[10, 10], [40, 10], [40, 30], [10, 30]];
    const frame = styleFrameOf([[0, 0], [100, 0], [100, 100], [0, 100]]);
    const fam = styleFamilyForCultureType('River');
    expect(styledWallColor(fam, poly, frame)).toBe(styledWallColor(fam, poly, frame));
    expect(styledRoof(fam, poly, frame)).toEqual(styledRoof(fam, poly, frame));
    expect(fam.wallPalette).toContain(styledWallColor(fam, poly, frame));
  });

  it('picks are invariant under a shared scale+translate of polygon and frame (2D↔3D frames)', () => {
    // The 2D map hashes in the NORMALIZED engine frame; the 3D bake hashes
    // AFTER transformTownPlan scales/translates to region feet. Same affine on
    // polygon AND footprint must yield the same picks.
    const footprint: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const polys: Array<Array<[number, number]>> = [
      [[10, 10], [40, 10], [40, 30], [10, 30]],
      [[55.5, 62.25], [78.5, 62.25], [78.5, 90], [55.5, 90]],
      [[3, 97], [9, 97], [9, 99.5], [3, 99.5]],
    ];
    const k = 3.7, dx = 1234, dy = 567; // deliberately non-integer scale
    const xf = (p: Array<[number, number]>) => p.map(([x, y]) => [x * k + dx, y * k + dy] as [number, number]);
    const frameA = styleFrameOf(footprint);
    const frameB = styleFrameOf(xf(footprint));
    for (const fam of Object.values(STYLE_FAMILIES)) {
      for (const poly of polys) {
        expect(styledWallColor(fam, xf(poly), frameB)).toBe(styledWallColor(fam, poly, frameA));
        expect(styledRoof(fam, xf(poly), frameB)).toEqual(styledRoof(fam, poly, frameA));
      }
    }
  });

  it('hash01 stays in [0,1) and differs across inputs', () => {
    const a = hash01(3, 7), b = hash01(4, 7);
    expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(1);
    expect(a).not.toBe(b);
  });
});

// ============================================================================
// Full Building Dress
// ============================================================================
// Culture, climate, and wealth turn a family into one concrete building dress.
// Legacy calls intentionally omit architecture identity so their old stream
// choices remain pinned while the new layer stays opt-in.
// ============================================================================

describe('resolveStyle', () => {
  const path = makeSeedPath(1337, 'cell:71-8', 'local:2-1', 'bldg:14');
  const base: ResolveStyleInput = {
    cultureType: 'Highland', climate: 'temperate', wealth: 'common',
    buildingType: 'cottage',
  };

  it('THROWS on an unknown culture type (no-fallback directive)', () => {
    expect(() => resolveStyle({ ...base, cultureType: 'Astral' }, path))
      .toThrow(/no architecture style/i);
  });

  it('is deterministic — same input + path deep-equals', () => {
    expect(resolveStyle(base, path)).toEqual(resolveStyle(base, path));
  });

  it('cold prefers a steep roof (family offers it) and deepens eaves', () => {
    // Highland family roofForms include 'steep'.
    const cold = resolveStyle({ ...base, climate: 'cold' }, path);
    expect(cold.roofForm).toBe('steep');
    expect(cold.eaveOverhangFt).toBe(2); // snow shed
    // pitch: steep base 8 × cold 1.4
    expect(cold.pitchRiseFt).toBeCloseTo(8 * 1.4);
  });

  it('arid flattens the roof when the family offers flat, and shrinks eaves', () => {
    // roughLog (Hunting) offers 'flat'.
    const arid = resolveStyle(
      { ...base, cultureType: 'Hunting', climate: 'arid' }, path);
    expect(arid.roofForm).toBe('flat');
    expect(arid.pitchRiseFt).toBe(0);
    expect(arid.eaveOverhangFt).toBe(0.5);
  });

  it('wealthy and poor pick different palettes for the same seed', () => {
    const wealthy = resolveStyle({ ...base, wealth: 'wealthy' }, path);
    const poor = resolveStyle({ ...base, wealth: 'poor' }, path);
    expect(wealthy.wallColor).not.toBe(poor.wallColor);
    expect(wealthy.finishTier).toBe('wealthy');
    expect(poor.finishTier).toBe('poor');
    expect(wealthy.ornament).toBe(true);
    expect(poor.ornament).toBe(false);
  });

  it('climate consumes no draws — same tier yields same palette indices across climates', () => {
    // If climate consumed rng draws, the wall/roof colors would shift. They must not.
    const a = resolveStyle({ ...base, climate: 'temperate' }, path);
    const b = resolveStyle({ ...base, climate: 'cold' }, path);
    const c = resolveStyle({ ...base, climate: 'arid' }, path);
    expect(a.wallColor).toBe(b.wallColor);
    expect(a.wallColor).toBe(c.wallColor);
    expect(a.roofColor).toBe(b.roofColor);
    expect(a.roofColor).toBe(c.roofColor);
  });

  it('a temple is never flat over 50 seeds', () => {
    for (let i = 0; i < 50; i++) {
      const p = makeSeedPath(i, 'cell:1-1', `bldg:${i}`);
      // roughLog offers flat — force the family that could produce it.
      const s = resolveStyle(
        { cultureType: 'Hunting', climate: 'arid', wealth: 'common', buildingType: 'temple' }, p);
      expect(s.roofForm).not.toBe('flat');
    }
  });

  it('marsh raises the plinth', () => {
    expect(resolveStyle({ ...base, climate: 'marsh' }, path).raisedPlinth).toBe(true);
    expect(resolveStyle({ ...base, climate: 'temperate' }, path).raisedPlinth).toBe(false);
  });

  it('passes familyId through from the culture mapping', () => {
    expect(resolveStyle(base, path).familyId).toBe('highlandStone');
  });

  it('resolves type-recognition motifs as part of the shared dress', () => {
    const architecture = {
      settlementKey: 'burg:17',
      districtKey: 'district:2',
      buildingKey: 'plot:9',
    };
    const shop = resolveStyle({ ...base, buildingType: 'shop', architecture }, path);
    const keep = resolveStyle({ ...base, buildingType: 'keep', architecture }, path);

    expect(shop.motifs).toContain('hanging-sign');
    expect(keep.motifs).toContain('battlements');
    expect(shop.motifSignature).not.toBe(keep.motifSignature);
    expect([0, 1, 2]).toContain(shop.motifVariant);
  });
});

// ============================================================================
// Layered Settlement, District, And Building Identity
// ============================================================================
// These checks encode the user's central balance: a district must repeat a
// recognizable dialect, but neighboring lots still need visible variation.
// ============================================================================

describe('resolveArchitectureVariant', () => {
  const family = STYLE_FAMILIES.temperateFrame;
  const identity = (buildingKey: string, districtKey = 'wealth:common') => ({
    settlementKey: 'burg:17',
    districtKey,
    buildingKey,
  });

  it('is deterministic for the same three-scope identity', () => {
    const a = resolveArchitectureVariant(family, 'common', identity('plot:8'));
    const b = resolveArchitectureVariant(family, 'common', identity('plot:8'));
    expect(a).toEqual(b);
  });

  it('keeps one district signature while giving every sampled building an individual token', () => {
    // A long street sample makes the intended majority/minority rules visible
    // without depending on one specially chosen pair of building ids.
    const variants = Array.from({ length: 120 }, (_, index) =>
      resolveArchitectureVariant(family, 'common', identity(`plot:${index}`)));

    expect(new Set(variants.map((variant) => variant.districtSignature)).size).toBe(1);
    expect(new Set(variants.map((variant) => variant.buildingVariant)).size).toBe(120);
    expect(new Set(variants.map((variant) => variant.pitchScale)).size).toBeGreaterThan(100);

    // Districts offer at most a dominant and one related alternative for each
    // trait. At least one sampled exception must appear, or the street clones.
    for (const values of [
      variants.map((variant) => variant.wallColor),
      variants.map((variant) => variant.roofColor),
      variants.map((variant) => variant.roofForm),
      variants.map((variant) => variant.facadePattern),
    ]) {
      expect(new Set(values).size).toBeGreaterThanOrEqual(2);
      expect(new Set(values).size).toBeLessThanOrEqual(2);
      const counts = values.reduce<Record<string, number>>((tally, value) => {
        tally[value] = (tally[value] ?? 0) + 1;
        return tally;
      }, {});
      expect(Math.max(...Object.values(counts)) / values.length).toBeGreaterThan(0.6);
    }
  });

  it('lets districts differ visibly while keeping the same town culture family', () => {
    const common = resolveArchitectureVariant(
      family,
      'common',
      identity('plot:4', 'wealth:common'),
    );
    const harbor = resolveArchitectureVariant(
      family,
      'common',
      identity('plot:4', 'harbor'),
    );

    expect(common.districtSignature).not.toBe(harbor.districtSignature);
    expect([
      common.wallColor,
      common.roofColor,
      common.roofForm,
      common.facadePattern,
    ]).not.toEqual([
      harbor.wallColor,
      harbor.roofColor,
      harbor.roofForm,
      harbor.facadePattern,
    ]);
    expect(family.wallPalette).toContain(common.wallColor);
    expect(family.wallPalette).toContain(harbor.wallColor);
  });

  it('does not repeat the same district recipe across two towns of one culture', () => {
    const first = resolveArchitectureVariant(family, 'common', identity('plot:1'));
    const second = resolveArchitectureVariant(family, 'common', {
      ...identity('plot:1'),
      settlementKey: 'burg:18',
    });
    expect(first.districtSignature).not.toBe(second.districtSignature);
  });

  it('keeps one structural dialect across wealth while finishes respect each tier', () => {
    const poor = resolveArchitectureVariant(family, 'poor', identity('plot:11', 'district:2'));
    const wealthy = resolveArchitectureVariant(family, 'wealthy', identity('plot:11', 'district:2'));

    // Wealth changes the available material slice, not the builders' shared
    // district grammar or the stable identity of this individual building.
    expect(poor.districtSignature).toBe(wealthy.districtSignature);
    expect(poor.buildingVariant).toBe(wealthy.buildingVariant);
    expect(poor.roofForm).toBe(wealthy.roofForm);
    expect(poor.facadePattern).toBe(wealthy.facadePattern);
    expect(poor.pitchScale).toBe(wealthy.pitchScale);
    expect(poor.eaveOffsetFt).toBe(wealthy.eaveOffsetFt);
    expect(family.wallPalette.slice(0, 2)).toContain(poor.wallColor);
    expect(family.wallPalette.slice(2)).toContain(wealthy.wallColor);
  });
});

// ============================================================================
// Atlas Biome To Architectural Climate
// ============================================================================
// This closed map prevents unknown world biomes from silently becoming a
// generic temperate building style.
// ============================================================================

describe('climateForBiomeId (BGv2 Task 7 — burg biome → ClimateClass)', () => {
  // The closed FMG biome vocabulary is the 13 entries of Biomes.getDefault().name
  // (ids 0-12): 0 Marine, 1 Hot desert, 2 Cold desert, 3 Savanna, 4 Grassland,
  // 5 Tropical seasonal forest, 6 Temperate deciduous forest, 7 Tropical
  // rainforest, 8 Temperate rainforest, 9 Taiga, 10 Tundra, 11 Glacier,
  // 12 Wetland. BIOME_TO_CLIMATE must cover every one.
  it('covers every FMG biome id 0..12 with no gaps', () => {
    for (let id = 0; id <= 12; id++) {
      expect(BIOME_TO_CLIMATE[id], `biome id ${id} is mapped`).toBeDefined();
      expect(climateForBiomeId(id)).toBe(BIOME_TO_CLIMATE[id]);
    }
    expect(Object.keys(BIOME_TO_CLIMATE)).toHaveLength(13);
  });

  it('cold biomes (Cold desert, Taiga, Tundra, Glacier) → cold', () => {
    for (const id of [2, 9, 10, 11]) expect(climateForBiomeId(id)).toBe('cold');
  });

  it('Hot desert → arid', () => {
    expect(climateForBiomeId(1)).toBe('arid');
  });

  it('Wetland → marsh', () => {
    expect(climateForBiomeId(12)).toBe('marsh');
  });

  it('everything else → temperate (Marine, Savanna, Grassland, forests)', () => {
    for (const id of [0, 3, 4, 5, 6, 7, 8]) expect(climateForBiomeId(id)).toBe('temperate');
  });

  it('THROWS on an unknown biome id (no-fallback directive, mirrors culture throw)', () => {
    expect(() => climateForBiomeId(13)).toThrow(/biome/i);
    expect(() => climateForBiomeId(-1)).toThrow(/biome/i);
    expect(() => climateForBiomeId(99)).toThrow(/biome/i);
  });
});
