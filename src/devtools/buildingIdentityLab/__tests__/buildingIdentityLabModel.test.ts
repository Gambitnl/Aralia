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
    expect(second.districts).toEqual(first.districts);
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
});
