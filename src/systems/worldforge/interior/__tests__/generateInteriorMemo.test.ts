/**
 * This file proves blueprintForPlot reuses generateBuilding's canonical memo.
 * Roster sizing, the 3D bake, occupancy, and chunk reloads may request the same
 * plot repeatedly; every caller must receive one rich BlueprintPlan without a
 * second legacy-adapter cache or cross-plot contamination.
 *
 * Called by: the focused Worldforge interior test suite.
 * Depends on: blueprintForPlot and deterministic seed paths.
 */
import { describe, expect, it } from 'vitest';
import { blueprintForPlot, type InteriorPlotInput } from '../generateInterior';
import { rootSeedPath } from '../../seedPath';

const SEED_PATH = rootSeedPath(99);

/** Build a stable house plot with optional identity or envelope changes. */
const house = (over: Partial<InteriorPlotInput> = {}): InteriorPlotInput => ({
  id: 3,
  footprint: [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ],
  role: 'house',
  storeys: 2,
  ...over,
});

describe('blueprintForPlot memoization', () => {
  it('returns the cached instance for identical plot and seed inputs', () => {
    const first = blueprintForPlot(house(), SEED_PATH);
    const second = blueprintForPlot(house(), SEED_PATH);

    expect(second).toBe(first);
  });

  it('does not collide across different seed paths or plot ids', () => {
    const first = blueprintForPlot(house({ id: 3 }), rootSeedPath(1));
    const differentSeed = blueprintForPlot(house({ id: 3 }), rootSeedPath(2));
    const differentPlot = blueprintForPlot(house({ id: 4 }), rootSeedPath(1));

    expect(differentSeed).not.toBe(first);
    expect(differentPlot).not.toBe(first);
    expect(first.buildingId).toBe(3);
    expect(differentPlot.buildingId).toBe(4);
  });

  it('keys on the footprint so a resized plot regenerates', () => {
    const small = blueprintForPlot(
      house({
        id: 9,
        footprint: [
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
        ],
      }),
      SEED_PATH,
    );
    const large = blueprintForPlot(
      house({
        id: 9,
        footprint: [
          [0, 0],
          [80, 0],
          [80, 60],
          [0, 60],
        ],
      }),
      SEED_PATH,
    );

    expect(large).not.toBe(small);
    expect(large.widthFt).toBeGreaterThan(small.widthFt);
  });

  it('does not alias negotiated lot profiles onto the plain ensemble', () => {
    const baseEnsemble = {
      blockKey: 'ward:2:edge:1',
      kind: 'row' as const,
      partyWallLeft: true,
      partyWallRight: true,
      eaveStoreys: 2 as const,
      ensembleSignature: 'memo-lot-proof',
    };
    const plain = blueprintForPlot(
      house({ id: 12, ensemble: baseEnsemble }),
      SEED_PATH,
    );
    const negotiated = blueprintForPlot(
      house({
        id: 12,
        ensemble: {
          ...baseEnsemble,
          lotProfile: 'rear-court',
          lotSignature: 'memo-rear-court',
        },
      }),
      SEED_PATH,
    );

    expect(negotiated).not.toBe(plain);
    expect(negotiated.floors).not.toEqual(plain.floors);
  });
});
