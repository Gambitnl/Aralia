import { describe, expect, it } from 'vitest';
import { generateRegion } from '../generateRegion';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { FEET_PER_FMG_PIXEL } from '../../adapter/atlasArtifact';
import { rootSeedPath } from '../../seedPath';

describe('survey windows preserve water', () => {
  it('opts out of a camera-centered settlement floor while preserving all existing entry defaults', () => {
    const atlas = getBridgeAtlas(42);
    const cell = Array.from(atlas.pack.cells.h).findIndex(h => h > 0 && h < 15);
    expect(cell).toBeGreaterThanOrEqual(0);
    const center = atlas.pack.cells.p[cell];
    const options = { feetPerPixel: FEET_PER_FMG_PIXEL, windowCenterPx: center, resolutionFt: 100, world: atlas };
    const original = generateRegion(atlas, cell, rootSeedPath(42), options);
    const explicit = generateRegion(atlas, cell, rootSeedPath(42), { ...options, applySettlementFloor: true });
    const survey = generateRegion(atlas, cell, rootSeedPath(42), { ...options, applySettlementFloor: false });
    expect(explicit.heightfield.samples).toEqual(original.heightfield.samples);
    const x = Math.round((center[0] * FEET_PER_FMG_PIXEL - survey.bounds.x) / survey.heightfield.resolutionFt);
    const y = Math.round((center[1] * FEET_PER_FMG_PIXEL - survey.bounds.y) / survey.heightfield.resolutionFt);
    const index = y * survey.heightfield.width + x;
    expect(original.heightfield.samples[index]).toBeGreaterThan(0.2);
    expect(survey.heightfield.samples[index]).toBeLessThan(0.2);
    expect(survey.rivers).toEqual(original.rivers);
    expect(survey.roads).toEqual(original.roads);
    expect(survey.crossings).toEqual(original.crossings);
    expect(survey.townSites).toEqual(original.townSites);
  }, 120000);
});
