/**
 * @file interiorBuild.test.ts — `buildInterior` generates a plot's interior ONCE
 * and derives both the wall envelope and the 3D parts from it (the 3D bake used
 * to call generateInterior twice per plot). Behaviour must be identical to the
 * separate `interiorEnvelopeM` + `buildInteriorParts` calls.
 */
import { describe, it, expect } from 'vitest';
import { buildInterior, buildInteriorParts, interiorEnvelopeM } from '../interiorParts';
import { type InteriorPlotInput } from '../../interior/generateInterior';
import type { InteriorPlan } from '../../interior/types';
import { rootSeedPath } from '../../seedPath';

const FT = 0.3048;
const SEED_PATH = rootSeedPath(42);
const plot = (): InteriorPlotInput => ({
  id: 7,
  footprint: [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ],
  role: 'house',
  storeys: 2,
});

describe('buildInterior', () => {
  it('matches interiorEnvelopeM + buildInteriorParts (one generation, same result)', () => {
    const h = 6;
    const combined = buildInterior(plot(), SEED_PATH, h);
    expect(combined.envelope).toEqual(interiorEnvelopeM(plot(), SEED_PATH));
    expect(combined.parts).toEqual(buildInteriorParts(plot(), SEED_PATH, h));
  });
});

describe('buildInteriorParts with a precomputed plan', () => {
  it('uses the supplied plan instead of regenerating', () => {
    // A distinctive envelope the real generator would never produce for this plot.
    const fakePlan: InteriorPlan = {
      plotId: 7,
      widthFt: 5,
      depthFt: 5,
      storeys: 1,
      rooms: [],
      doorways: [],
      furnishings: [],
      upperFloors: [],
      stairs: [],
    };
    const parts = buildInteriorParts(plot(), SEED_PATH, 6, [], fakePlan);
    // The first part is the full-envelope floor slab → dims come from the plan.
    expect(parts[0].w).toBeCloseTo(5 * FT, 6);
    expect(parts[0].d).toBeCloseTo(5 * FT, 6);
  });
});
