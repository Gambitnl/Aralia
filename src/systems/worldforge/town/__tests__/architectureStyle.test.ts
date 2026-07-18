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
  climateForBiomeId, BIOME_TO_CLIMATE, finishPaletteForTier,
  CLIMATE_KIT_FITNESS, applyClimateKitFitness,
} from '../architectureStyle';
import type { ClimateClass, ResolveStyleInput } from '../architectureStyle';
import { constructionKitsForFamily } from '../buildingMaterials';
import type {
  BriefWealth,
  BuildingConstruction,
  BuildingEnsemble,
} from '../../interior/blueprintTypes';
import { fnv1a, makeSeedPath } from '../../seedPath';

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

  it('shares one wealth-tier palette rule with later repairs and additions', () => {
    const palette = ['rough', 'plain', 'dressed', 'carved'];
    expect(finishPaletteForTier(palette, 'poor')).toEqual(['rough', 'plain']);
    expect(finishPaletteForTier(palette, 'common')).toEqual(palette);
    expect(finishPaletteForTier(palette, 'wealthy')).toEqual(['dressed', 'carved']);
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

  it('resolves one complete material kit from the same architecture identity', () => {
    const architecture = {
      settlementKey: 'burg:17',
      districtKey: 'district:2',
      buildingKey: 'plot:9',
    };
    const style = resolveStyle({ ...base, architecture }, path);
    const allowed = constructionKitsForFamily('highlandStone')
      .map((kit) => kit.id);

    expect(allowed).toContain(style.construction.kitId);
    expect(style.construction.constructionSignature)
      .toMatch(/^highlandStone:[0-9a-z]+$/);
    expect(style.construction.wallCourseFt).toBeGreaterThan(0);
    expect(style.construction.timberWidthFt).toBeGreaterThan(0);
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
  const row = (blockKey: string, kind: 'row' | 'market-arcade' = 'row') => ({
    blockKey,
    kind,
    partyWallLeft: true,
    partyWallRight: true,
    eaveStoreys: 2 as const,
    ensembleSignature: `ensemble:${blockKey}`,
  });

  it('is deterministic for the same three-scope identity', () => {
    const a = resolveArchitectureVariant(family, 'temperate', 'common', identity('plot:8'));
    const b = resolveArchitectureVariant(family, 'temperate', 'common', identity('plot:8'));
    expect(a).toEqual(b);
  });

  it('coordinates row roof form, pitch, and eaves without cloning building dress', () => {
    const variants = Array.from({ length: 120 }, (_, index) =>
      resolveArchitectureVariant(
        family,
        'temperate',
        'common',
        identity(`plot:${index}`),
        row('ward:2:edge:4'),
      ));

    expect(new Set(variants.map((variant) => variant.roofForm)).size).toBe(1);
    expect(new Set(variants.map((variant) => variant.pitchScale)).size).toBe(1);
    expect(new Set(variants.map((variant) => variant.eaveOffsetFt)).size).toBe(1);
    expect(new Set(variants.map((variant) => variant.buildingVariant)).size).toBe(120);
    expect(new Set(variants.map((variant) => variant.wallColor)).size).toBeGreaterThan(1);
    expect(new Set(variants.map((variant) => variant.roofColor)).size).toBeGreaterThan(1);
    expect(new Set(variants.map((variant) => variant.facadePattern)).size).toBeGreaterThan(1);
  });

  it('keeps detached roofs individual and gives different row blocks distinct rhythms', () => {
    const detached = Array.from({ length: 80 }, (_, index) =>
      resolveArchitectureVariant(family, 'temperate', 'common', identity(`plot:${index}`), {
        ...row('detached-lots'),
        kind: 'detached' as const,
        partyWallLeft: false,
        partyWallRight: false,
      }));
    const blocks = Array.from({ length: 40 }, (_, index) =>
      resolveArchitectureVariant(
        family,
        'temperate',
        'common',
        identity(`plot:${index}`),
        row(`ward:${index}:edge:0`, index % 3 === 0 ? 'market-arcade' : 'row'),
      ));

    expect(new Set(detached.map((variant) => variant.pitchScale)).size).toBeGreaterThan(70);
    expect(new Set(blocks.map((variant) => variant.pitchScale)).size).toBeGreaterThan(30);
    expect(new Set(blocks.map((variant) => variant.roofForm)).size).toBeGreaterThan(1);
  });

  it('keeps one district signature while giving every sampled building an individual token', () => {
    // A long street sample makes the intended majority/minority rules visible
    // without depending on one specially chosen pair of building ids.
    const variants = Array.from({ length: 120 }, (_, index) =>
      resolveArchitectureVariant(family, 'temperate', 'common', identity(`plot:${index}`)));

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
      variants.map((variant) => variant.construction.kitId),
      variants.map((variant) => variant.construction.shutters),
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
      'temperate',
      'common',
      identity('plot:4', 'wealth:common'),
    );
    const harbor = resolveArchitectureVariant(
      family,
      'temperate',
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
    const first = resolveArchitectureVariant(family, 'temperate', 'common', identity('plot:1'));
    const second = resolveArchitectureVariant(family, 'temperate', 'common', {
      ...identity('plot:1'),
      settlementKey: 'burg:18',
    });
    expect(first.districtSignature).not.toBe(second.districtSignature);
  });

  it('keeps one structural dialect across wealth while finishes respect each tier', () => {
    const poor = resolveArchitectureVariant(family, 'temperate', 'poor', identity('plot:11', 'district:2'));
    const wealthy = resolveArchitectureVariant(family, 'temperate', 'wealthy', identity('plot:11', 'district:2'));

    // Wealth changes the available material slice, not the builders' shared
    // district grammar or the stable identity of this individual building.
    expect(poor.districtSignature).toBe(wealthy.districtSignature);
    expect(poor.buildingVariant).toBe(wealthy.buildingVariant);
    expect(poor.roofForm).toBe(wealthy.roofForm);
    expect(poor.facadePattern).toBe(wealthy.facadePattern);
    expect(poor.pitchScale).toBe(wealthy.pitchScale);
    expect(poor.eaveOffsetFt).toBe(wealthy.eaveOffsetFt);
    expect(poor.construction.kitId).toBe(wealthy.construction.kitId);
    expect(poor.construction.wallMaterial).toBe(wealthy.construction.wallMaterial);
    expect(poor.construction.roofCovering).toBe(wealthy.construction.roofCovering);
    expect(poor.construction.constructionSignature)
      .toBe(wealthy.construction.constructionSignature);
    expect(poor.construction.glazing).not.toBe(wealthy.construction.glazing);
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

// ============================================================================
// Climate-Constrained Construction Kits
// ============================================================================
// Operator decision 2026-07-18: a construction kit must survive its climate.
// Arid bans reed/sod coverings, marsh bans mud walls, cold bans reed thatch
// and remaps toward the family's heaviest covering. Temperate is the pinned
// byte-identical baseline; a ban remaps deterministically to ONE specific
// sibling kit of the same family — it never rerolls a named-hash draw.
// ============================================================================

describe('climate-constrained construction kits', () => {
  const ALL_CLIMATES: ClimateClass[] = ['temperate', 'arid', 'cold', 'marsh'];
  const WEALTH_TIERS: BriefWealth[] = ['poor', 'common', 'wealthy'];
  const CULTURE_TYPES = ['Highland', 'Naval', 'River', 'Hunting', 'Generic'];
  const identityOf = (districtKey: string, buildingKey: string) => ({
    settlementKey: 'burg:17',
    districtKey,
    buildingKey,
  });
  const rowEnsemble = (blockKey: string): BuildingEnsemble => ({
    blockKey,
    kind: 'row',
    partyWallLeft: true,
    partyWallRight: true,
    eaveStoreys: 2,
    ensembleSignature: `ensemble:${blockKey}`,
  });
  /** Rebuild one family kit as a resolved construction for direct fitness calls. */
  const constructionFromKit = (
    familyId: keyof typeof STYLE_FAMILIES,
    covering: string,
    wealth: BriefWealth = 'common',
  ): BuildingConstruction => {
    const kit = constructionKitsForFamily(familyId)
      .find((candidate) => candidate.roofCovering === covering);
    if (!kit) throw new Error(`${familyId} offers no ${covering} kit`);
    const wealthIndex = wealth === 'poor' ? 0 : wealth === 'wealthy' ? 2 : 1;
    return {
      kitId: kit.id,
      wallMaterial: kit.wallMaterial,
      wallCourseFt: kit.wallCourseFt,
      timberWidthFt: kit.timberWidthFt,
      roofCovering: kit.roofCovering,
      foundation: kit.foundation,
      glazing: kit.glazingByWealth[wealthIndex],
      shutters: kit.shutters[0],
      ornamentKit: kit.ornamentByWealth[wealthIndex],
      constructionSignature: `${familyId}:test`,
    };
  };

  // The exact 270-sample recipe frozen BEFORE the climate-kit change landed
  // (identified variants across all families/wealths/districts, one row
  // ensemble each, plus identified and standalone resolveStyle calls). The
  // digest below was captured from the pre-change code; the temperate branch
  // of the fitness table bans nothing, so this byte surface must never move.
  // Re-freezing this digest is only legitimate alongside proof that every
  // changed byte comes from a NEW additive field, never a shifted existing one.
  function sampleClimateOutputs(climate: ClimateClass): unknown[] {
    const out: unknown[] = [];
    for (const fam of Object.values(STYLE_FAMILIES)) {
      for (const wealth of WEALTH_TIERS) {
        for (let d = 0; d < 3; d++) {
          for (let b = 0; b < 5; b++) {
            out.push(resolveArchitectureVariant(
              fam, climate, wealth, identityOf(`district:${d}`, `plot:${b}`)));
          }
        }
        out.push(resolveArchitectureVariant(
          fam, climate, wealth,
          identityOf('district:0', 'plot:9'),
          rowEnsemble('ward:2:edge:4'),
        ));
      }
    }
    for (const cultureType of CULTURE_TYPES) {
      for (const wealth of WEALTH_TIERS) {
        const seedPath = makeSeedPath(1337, 'cell:71-8', 'local:2-1', `bldg:${cultureType}:${wealth}`);
        out.push(resolveStyle({
          cultureType, climate, wealth, buildingType: 'cottage', ageBand: 'old',
          architecture: identityOf('district:1', 'plot:3'),
        }, seedPath));
        out.push(resolveStyle({ cultureType, climate, wealth, buildingType: 'shop' }, seedPath));
      }
    }
    return out;
  }

  it('temperate output is byte-identical to the pre-change baseline (digest pin)', () => {
    const samples = sampleClimateOutputs('temperate');
    expect(samples).toHaveLength(270);
    expect(fnv1a(JSON.stringify(samples, null, 1)).toString(36)).toBe('4ckbfw');
  });

  it('an allowed kit passes through as the SAME object — the fitness pass adds nothing', () => {
    const slate = constructionFromKit('highlandStone', 'slate');
    for (const climate of ALL_CLIMATES) {
      expect(applyClimateKitFitness('highlandStone', climate, 'common', slate)).toBe(slate);
    }
    const thatch = constructionFromKit('temperateFrame', 'reed-thatch');
    expect(applyClimateKitFitness('temperateFrame', 'temperate', 'common', thatch)).toBe(thatch);
  });

  it('arid never resolves a thatch/reed (or sod) covering across 200 sampled resolutions', () => {
    let resolutions = 0;
    for (const fam of Object.values(STYLE_FAMILIES)) {
      for (let b = 0; b < 40; b++) {
        const variant = resolveArchitectureVariant(
          fam, 'arid', WEALTH_TIERS[b % 3], identityOf(`district:${b % 4}`, `plot:${b}`));
        expect(variant.construction.roofCovering).not.toBe('reed-thatch');
        expect(variant.construction.roofCovering).not.toBe('sod');
        resolutions += 1;
      }
    }
    expect(resolutions).toBe(200);
    // The standalone preview path shares the same rule.
    for (const cultureType of CULTURE_TYPES) {
      const style = resolveStyle(
        { cultureType, climate: 'arid', wealth: 'common', buildingType: 'cottage' },
        makeSeedPath(9, 'cell:1-1', `bldg:${cultureType}`));
      expect(style.construction.roofCovering).not.toBe('reed-thatch');
      expect(style.construction.roofCovering).not.toBe('sod');
    }
  });

  it('marsh never resolves a banned (mud/earth) wall material', () => {
    for (const fam of Object.values(STYLE_FAMILIES)) {
      for (let b = 0; b < 40; b++) {
        const variant = resolveArchitectureVariant(
          fam, 'marsh', WEALTH_TIERS[b % 3], identityOf(`district:${b % 4}`, `plot:${b}`));
        for (const banned of CLIMATE_KIT_FITNESS.marsh.bannedWallMaterials) {
          expect(variant.construction.wallMaterial).not.toBe(banned);
        }
      }
    }
    // wattle-daub is today's only mud/earth wall — pin it explicitly so a
    // table edit cannot silently drop the operator's minimum ban.
    expect(CLIMATE_KIT_FITNESS.marsh.bannedWallMaterials).toContain('wattle-daub');
  });

  it('cold bans reed thatch and remaps a banned pick to the family HEAVIEST covering', () => {
    expect(CLIMATE_KIT_FITNESS.cold.bannedCoverings).toContain('reed-thatch');
    // roughLog offers sod + wood-shingle beyond its banned thatch kit; sod is
    // the heavier covering and must win the remap.
    const roughSwap = applyClimateKitFitness(
      'roughLog', 'cold', 'common', constructionFromKit('roughLog', 'reed-thatch'));
    expect(roughSwap.kitId).toBe('rough-round-log-sod');
    expect(roughSwap.roofCovering).toBe('sod');
    // temperateFrame offers clay-tile + wood-shingle; clay tile is heavier.
    const frameSwap = applyClimateKitFitness(
      'temperateFrame', 'cold', 'common', constructionFromKit('temperateFrame', 'reed-thatch'));
    expect(frameSwap.kitId).toBe('temperate-brick-tile');
    expect(frameSwap.roofCovering).toBe('clay-tile');
    // coastalTimber's two remaining kits share wood-shingle; declaration order
    // breaks the tie so the remap still names ONE exact kit.
    const coastSwap = applyClimateKitFitness(
      'coastalTimber', 'cold', 'common', constructionFromKit('coastalTimber', 'reed-thatch'));
    expect(coastSwap.kitId).toBe('coastal-weatherboard-shingle');
  });

  it('a swap is deterministic and remaps to one specific sibling — never a reroll', () => {
    // Find identities whose TEMPERATE pick is arid-banned; the arid resolution
    // of the same identity must be the family's single arid-fit kit.
    let swappedCases = 0;
    for (let b = 0; b < 60; b++) {
      const identity = identityOf(`district:${b % 5}`, `plot:${b}`);
      const temperate = resolveArchitectureVariant(STYLE_FAMILIES.roughLog, 'temperate', 'common', identity);
      const arid = resolveArchitectureVariant(STYLE_FAMILIES.roughLog, 'arid', 'common', identity);
      const arid2 = resolveArchitectureVariant(STYLE_FAMILIES.roughLog, 'arid', 'common', identity);
      expect(arid).toEqual(arid2); // same inputs twice → deep-equal
      if (['reed-thatch', 'sod'].includes(temperate.construction.roofCovering)) {
        swappedCases += 1;
        // roughLog keeps exactly one arid-legal kit; every banned pick lands there.
        expect(arid.construction.kitId).toBe('rough-hewn-log-shingle');
        expect(arid.construction.wallMaterial).toBe('hewn-log');
        expect(arid.construction.roofCovering).toBe('wood-shingle');
        // Operator's exact complaint: desert timber piles left with the thatch.
        expect(arid.construction.foundation).toBe('fieldstone');
      }
      // Scope pin: ONLY kit-selection facts may move. Identity, coordination,
      // and every non-kit trait must match the temperate resolution.
      expect(arid.construction.constructionSignature).toBe(temperate.construction.constructionSignature);
      expect(arid.construction.shutters).toBe(temperate.construction.shutters);
      expect(arid.districtSignature).toBe(temperate.districtSignature);
      expect(arid.buildingVariant).toBe(temperate.buildingVariant);
      expect(arid.wallColor).toBe(temperate.wallColor);
      expect(arid.roofColor).toBe(temperate.roofColor);
      expect(arid.facadePattern).toBe(temperate.facadePattern);
      expect(arid.pitchScale).toBe(temperate.pitchScale);
      expect(arid.eaveOffsetFt).toBe(temperate.eaveOffsetFt);
    }
    expect(swappedCases).toBeGreaterThan(0); // the sample genuinely exercised bans
  });

  it('cross-family leakage remains zero under every climate', () => {
    for (const fam of Object.values(STYLE_FAMILIES)) {
      const kits = constructionKitsForFamily(fam.id);
      const kitIds = new Set(kits.map((kit) => kit.id));
      const walls = new Set(kits.map((kit) => kit.wallMaterial));
      const coverings = new Set(kits.map((kit) => kit.roofCovering));
      const foundations = new Set(kits.map((kit) => kit.foundation));
      for (const climate of ALL_CLIMATES) {
        for (let b = 0; b < 25; b++) {
          const variant = resolveArchitectureVariant(
            fam, climate, WEALTH_TIERS[b % 3], identityOf(`district:${b % 3}`, `plot:${b}`));
          expect(kitIds.has(variant.construction.kitId)).toBe(true);
          expect(walls.has(variant.construction.wallMaterial)).toBe(true);
          expect(coverings.has(variant.construction.roofCovering)).toBe(true);
          expect(foundations.has(variant.construction.foundation)).toBe(true);
        }
      }
    }
  });

  it('every family keeps at least one buildable kit under every climate (table invariant)', () => {
    // Guards future fitness-table edits: applyClimateKitFitness throws (no
    // fallback) if a climate bans a family's entire vocabulary, so the data
    // must never reach that state.
    for (const fam of Object.values(STYLE_FAMILIES)) {
      for (const climate of ALL_CLIMATES) {
        const fitness = CLIMATE_KIT_FITNESS[climate];
        const allowed = constructionKitsForFamily(fam.id).filter((kit) =>
          !fitness.bannedCoverings.includes(kit.roofCovering)
          && !fitness.bannedWallMaterials.includes(kit.wallMaterial));
        expect(allowed.length, `${fam.id} in ${climate}`).toBeGreaterThan(0);
      }
    }
  });
});
