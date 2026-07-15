/**
 * These tests prove that permanent building history is deterministic, bounded
 * by age, and compatible with a coherent district material vocabulary.
 *
 * They use the production building generator so every asserted wear target is
 * backed by real footprint masses, wall runs, roof planes, and ridges.
 */

import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import {
  finishPaletteForTier,
  STYLE_FAMILIES,
} from '../../town/architectureStyle';
import { generateBuilding } from '../generateBuilding';
import type {
  BlueprintPlan,
  BuildingAgeBand,
  BuildingWearKind,
  StyleContext,
} from '../blueprintTypes';

// ============================================================================
// Production Fixture
// ============================================================================
// A manor always has a tower mass and a solved roof, giving every history kind
// a legitimate target while retaining the normal generation path.
// ============================================================================

function styledManor(seed: number, ageBand: BuildingAgeBand): BlueprintPlan {
  const style: StyleContext = {
    cultureType: 'Generic',
    climate: 'temperate',
    wealth: 'common',
    ageBand,
    architecture: {
      settlementKey: 'burg:17',
      districtKey: 'district:2',
      buildingKey: `plot:${seed}`,
    },
  };
  return generateBuilding({
    buildingId: 7,
    type: 'manor',
    seedPath: rootSeedPath(seed),
    storeys: 2,
    basement: true,
    style,
  });
}

function structuralBones(plan: BlueprintPlan): string {
  return JSON.stringify({
    footprintCells: plan.footprintCells,
    floors: plan.floors,
    stairs: plan.stairs,
    masses: plan.masses,
    roof: plan.roof,
  });
}

describe('building backstory generation', () => {
  it('is byte-deterministic and records one replayable signature', () => {
    const first = styledManor(411, 'ancient').backstory!;
    const second = styledManor(411, 'ancient').backstory!;

    expect(second).toEqual(first);
    expect(first.historySignature).toMatch(/^[0-9a-z]+$/);
    expect(first.features.length).toBeGreaterThan(0);
  });

  it('scales visible wear with construction age without changing structure', () => {
    const ages: BuildingAgeBand[] = ['new', 'aged', 'old', 'ancient'];
    const plans = ages.map((age) => styledManor(912, age));

    expect(plans.map((plan) => plan.backstory!.wear.length))
      .toEqual([0, 1, 2, 3]);
    expect(plans.every((plan) => structuralBones(plan) === structuralBones(plans[0])))
      .toBe(true);
  });

  it('keeps repair and extension materials inside the family finish vocabulary', () => {
    const plan = styledManor(37, 'ancient');
    const family = STYLE_FAMILIES.temperateFrame;
    const wallMaterials = new Set([
      ...finishPaletteForTier(family.wallPalette, 'common'),
      plan.styleResolved!.trimColor,
    ]);
    const roofMaterials = new Set([
      ...finishPaletteForTier(family.roofPalette, 'common'),
      plan.styleResolved!.trimColor,
    ]);

    for (const feature of plan.backstory!.features) {
      if (feature.kind === 'fire-scar') {
        expect(feature.colorHex).toBe('#34251f');
      } else if (feature.kind === 're-roofed' || feature.kind === 'sagging-ridge') {
        expect(roofMaterials.has(feature.colorHex)).toBe(true);
      } else {
        expect(wallMaterials.has(feature.colorHex)).toBe(true);
      }
    }
  });

  it('targets real masses, outer walls, roof planes, and ridges', () => {
    for (let seed = 0; seed < 80; seed++) {
      const plan = styledManor(seed, 'ancient');
      for (const feature of plan.backstory!.features) {
        if (feature.kind === 'later-phase') {
          expect(plan.masses[feature.massIndex]).toBeDefined();
        } else if (feature.kind === 're-roofed') {
          expect(plan.roof!.planes[feature.planeIndex]).toBeDefined();
        } else if (feature.kind === 'sagging-ridge') {
          expect(plan.roof!.ridges[feature.ridgeIndex]).toBeDefined();
        } else {
          const floor = plan.floors.find((candidate) =>
            candidate.level === feature.floorLevel)!;
          const run = floor.wallRuns[feature.wallRunIndex];
          expect(run.kind).toBe('outer');

          // Stored wall evidence must fit the exact run it names. Door edges
          // are absent from wall runs, while windows need an explicit 0.3 ft
          // margin beyond their 3 ft opening.
          const [runLo, runHi] = run.axis === 'x'
            ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
            : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
          const featureLo = feature.alongFt - feature.widthFt / 2;
          const featureHi = feature.alongFt + feature.widthFt / 2;
          expect(featureLo).toBeGreaterThan(runLo);
          expect(featureHi).toBeLessThan(runHi);

          for (const window of floor.windows) {
            if (window.axis !== run.axis) continue;
            const fixedFt = run.axis === 'x' ? window.y : window.x;
            const wallLineFt = run.axis === 'x' ? run.y1 : run.x1;
            if (Math.abs(fixedFt - wallLineFt) > 1e-6) continue;
            const centerFt = run.axis === 'x' ? window.x : window.y;
            expect(featureHi <= centerFt - 1.8 || featureLo >= centerFt + 1.8)
              .toBe(true);
          }

          for (const door of floor.doors) {
            if (door.axis !== run.axis) continue;
            const fixedFt = run.axis === 'x' ? door.y : door.x;
            const wallLineFt = run.axis === 'x' ? run.y1 : run.x1;
            if (Math.abs(fixedFt - wallLineFt) > 1e-6) continue;
            const centerFt = run.axis === 'x' ? door.x : door.y;
            expect(featureHi <= centerFt - 2.5 || featureLo >= centerFt + 2.5)
              .toBe(true);
          }
        }
      }
    }
  }, 20000);

  it('uses the full bounded history vocabulary across many distinct buildings', () => {
    const histories = Array.from({ length: 120 }, (_, seed) =>
      styledManor(seed + 1000, 'ancient').backstory!);
    const wear = new Set(histories.flatMap((history) => history.wear));
    const expected: BuildingWearKind[] = [
      'sealed-door',
      're-roofed',
      'sagging-ridge',
      'patched-wall',
      'fire-scar',
    ];

    expect(wear).toEqual(new Set(expected));
    expect(new Set(histories.map((history) => history.historySignature)).size)
      .toBeGreaterThan(110);
    expect(histories.some((history) =>
      history.features.some((feature) => feature.kind === 'later-phase')))
      .toBe(true);
  }, 20000);

  it('rejects a replay whose age contradicts the style context', () => {
    const ancient = styledManor(18, 'ancient');
    expect(() => generateBuilding({
      buildingId: 7,
      type: 'manor',
      seedPath: rootSeedPath(18),
      style: {
        cultureType: 'Generic',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'new',
      },
      backstory: ancient.backstory,
    })).toThrow(/backstory age ancient conflicts with style age new/i);
  });
});
