/**
 * Focused contracts for the standalone Building Identity Lab model.
 *
 * These tests prove the debugging page uses deterministic production data and
 * that its main pass/fail signal reflects real district and building receipts.
 */

import { describe, expect, it } from 'vitest';
import {
  blueprintForHarnessPlot,
  buildHarnessTown,
  compareBuildingFacts,
} from '../buildingIdentityLabModel';

const OPTIONS = {
  seed: 792767481,
  population: 450,
  styleId: 'temperateFrame' as const,
  climate: 'temperate' as const,
  withRiver: true,
};

describe('building identity lab model', () => {
  it('rebuilds the same district and building receipts for the same controls', () => {
    const first = buildHarnessTown(OPTIONS);
    const second = buildHarnessTown(OPTIONS);

    // The lab is useful for bug reports only when a shared seed reproduces every receipt.
    // districts now embeds the verification data (sampledPlots, factMismatches,
    // verified), so this deep-equal also proves the cross-check is deterministic.
    // crossCheckMs is wall-clock timing and deliberately excluded from the claim.
    expect(second.districts).toEqual(first.districts);
    expect(second.factMismatches).toEqual(first.factMismatches);
    expect(second.artifactPlan.plots.map((plot) => ({
      id: plot.id,
      district: plot.architecture?.districtSignature,
      variant: plot.architecture?.buildingVariant,
      ensemble: plot.ensemble?.ensembleSignature,
    }))).toEqual(first.artifactPlan.plots.map((plot) => ({
      id: plot.id,
      district: plot.architecture?.districtSignature,
      variant: plot.architecture?.buildingVariant,
      ensemble: plot.ensemble?.ensembleSignature,
    })));
  });

  it('reports one shared signature per district while retaining local variants', () => {
    const model = buildHarnessTown(OPTIONS);

    // A coherent district repeats one grammar; at least one populated district
    // should still contain multiple building variants beneath that grammar.
    expect(model.districts.length).toBeGreaterThan(1);
    expect(model.districts.every((district) => district.coherent)).toBe(true);
    expect(model.districts.some((district) => district.variants > 1)).toBe(true);
    expect(Object.keys(model.ensembleCounts).length).toBeGreaterThan(1);
  });

  it('builds the selected specimen through the matching production style path', () => {
    const model = buildHarnessTown(OPTIONS);
    const plot = model.artifactPlan.plots[0];
    const blueprint = blueprintForHarnessPlot(model, plot.id);

    // Artifact stamps and the blueprint resolver must agree, or the 2D town and
    // selected 3D specimen would present contradictory architecture evidence.
    expect(blueprint.styleResolved?.familyId).toBe('temperateFrame');
    expect(blueprint.styleResolved?.districtSignature).toBe(plot.architecture?.districtSignature);
    expect(blueprint.styleResolved?.buildingVariant).toBe(plot.architecture?.buildingVariant);
    expect(blueprint.ensemble?.ensembleSignature).toBe(plot.ensemble?.ensembleSignature);
  });

  it('projects an occupied multi-storey town hearth through its solved roof', () => {
    const model = buildHarnessTown(OPTIONS);
    const plot = model.artifactPlan.plots.find((candidate) => candidate.id === 7)!;
    const blueprint = blueprintForHarnessPlot(model, plot.id);
    const groundHearths = blueprint.floors
      .find((floor) => floor.level === 0)!
      .furnishings.filter((item) => item.kind === 'hearth' || item.kind === 'forge-hearth');

    // Plot 7 is a deterministic population-backed, two-storey cottage. Its
    // ground hearth must still reach the roof above the sleeping floor.
    expect(plot.pop).toBeDefined();
    expect(plot.storeys).toBe(2);
    expect(groundHearths).toHaveLength(1);
    expect(blueprint.roof?.chimneys).toHaveLength(1);
    expect(blueprint.roof?.chimneys[0]).toMatchObject({
      x: groundHearths[0].x,
      y: groundHearths[0].y,
    });
  });

  it('verifies every district by rebuilding sampled production blueprints', () => {
    const model = buildHarnessTown(OPTIONS);

    // The badge's claim on the canonical temperate seed: every district passes
    // the rendered-fact cross-check, not merely signature-string equality.
    expect(model.districts.every((district) => district.verified)).toBe(true);
    expect(model.factMismatches).toEqual([]);

    // The sample is bounded (cheap) but real: first/middle/last plot by id,
    // which is min(buildings, 3) distinct plots for every district.
    for (const district of model.districts) {
      expect(district.sampledPlots).toHaveLength(Math.min(district.buildings, 3));
      expect(district.factMismatches).toEqual([]);
    }
  });

  it('keeps cold highland districts verified end to end (climate parity regression)', () => {
    // Critic finding 3 (2026-07-17): under cold the blueprint resolved "steep"
    // while the artifact strip said "gable", and the old badge stayed green.
    // The climate-aware variant fix landed in architectureStyle; this test is
    // the tripwire that keeps both resolution paths agreeing forever after.
    const model = buildHarnessTown({ ...OPTIONS, styleId: 'highlandStone', climate: 'cold' });

    expect(model.factMismatches).toEqual([]);
    expect(model.districts.every((district) => district.verified)).toBe(true);
  });

  it('detects a doctored receipt instead of trusting signature equality', () => {
    const model = buildHarnessTown(OPTIONS);
    const plot = model.artifactPlan.plots[0];
    const style = blueprintForHarnessPlot(model, plot.id).styleResolved;

    // Honest baseline: the genuine pair agrees on every cross-checked fact.
    expect(compareBuildingFacts(plot, style)).toEqual([]);

    // Doctor the ARTIFACT side only (production code untouched): flip the roof
    // form and replace the variant token, then require the detector to name
    // the plot, the field, and both conflicting values in comparison order.
    const doctoredRoofForm = plot.roofForm === 'steep' ? 'gable' as const : 'steep' as const;
    const doctored = {
      ...plot,
      roofForm: doctoredRoofForm,
      architecture: plot.architecture
        ? { ...plot.architecture, buildingVariant: 'doctored-variant' }
        : undefined,
    };
    expect(compareBuildingFacts(doctored, style)).toEqual([
      {
        plotId: plot.id,
        field: 'roofForm',
        townPlanValue: doctoredRoofForm,
        blueprintValue: style?.roofForm,
      },
      {
        plotId: plot.id,
        field: 'buildingVariant',
        townPlanValue: 'doctored-variant',
        blueprintValue: style?.buildingVariant,
      },
    ]);

    // A blueprint that carries no resolved dress can never verify silently:
    // every cross-checked fact must surface as a structured mismatch.
    expect(compareBuildingFacts(plot, undefined)).toHaveLength(5);
  });
});
