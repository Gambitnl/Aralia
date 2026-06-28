/**
 * @file interiorBuild.test.ts — `buildInterior` generates a plot's interior ONCE
 * and derives both the wall envelope and the 3D parts from it (the 3D bake used
 * to call generateInterior twice per plot). The envelope must match the plan's
 * dims and the parts must match a standalone `buildInteriorParts` call.
 */
import { describe, it, expect } from 'vitest';
import { buildInterior, buildInteriorParts } from '../interiorParts';
import { generateInterior, type InteriorPlotInput } from '../../interior/generateInterior';
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
  it('derives the envelope from the plan and matches a standalone parts build', () => {
    const h = 6;
    const plan = generateInterior(plot(), SEED_PATH);
    const combined = buildInterior(plot(), SEED_PATH, h);
    expect(combined.envelope).toEqual({ wallWidthM: plan.widthFt * FT, wallDepthM: plan.depthFt * FT });
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
