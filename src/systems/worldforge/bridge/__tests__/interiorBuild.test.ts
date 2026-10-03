/**
 * This file proves the 3D interior bridge derives its envelope and parts from
 * one canonical building blueprint. It guards against reintroducing the old
 * synthetic InteriorPlan injection path, which lost irregular rooms, windows,
 * and basements.
 *
 * Called by: the focused Worldforge bridge test suite.
 * Depends on: buildInterior, buildingOccupancy, and blueprintForPlot.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildInterior, buildInteriorParts } from '../interiorParts';
import { occupancyScheduleForPlot } from '../buildingOccupancy';
import {
  blueprintForPlot,
  type InteriorPlotInput,
} from '../../interior/generateInterior';
import { rootSeedPath } from '../../seedPath';
import type { TownPlotPopulation } from '../../town/townEngine';

// Wrap the real resolver with a counter. The bridge sees this same binding, so
// the regression detects hidden second or third resolutions while retaining
// the production generator's real deterministic behavior.
const resolverProbe = vi.hoisted(() => ({ blueprintForPlot: vi.fn() }));
vi.mock('../../interior/generateInterior', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../interior/generateInterior')
  >();
  resolverProbe.blueprintForPlot.mockImplementation(actual.blueprintForPlot);
  return { ...actual, blueprintForPlot: resolverProbe.blueprintForPlot };
});

const FT = 0.3048;
const SEED_PATH = rootSeedPath(42);

/** Build a stable two-storey plot used by both bridge entry points. */
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
  beforeEach(() => {
    // Each assertion starts with a clean count while the wrapper continues to
    // delegate every requested plan to the real generator.
    resolverProbe.blueprintForPlot.mockClear();
  });

  it('derives the envelope and parts from the exact same BlueprintPlan', () => {
    const shellHeightM = 6;
    const blueprint = blueprintForPlot(plot(), SEED_PATH);
    const combined = buildInterior(plot(), SEED_PATH, shellHeightM);

    expect(combined.envelope).toEqual({
      wallWidthM: blueprint.widthFt * FT,
      wallDepthM: blueprint.depthFt * FT,
    });
    expect(combined.parts).toEqual(
      buildInteriorParts(plot(), SEED_PATH, shellHeightM, [], blueprint),
    );
  });

  it('uses an injected BlueprintPlan without a legacy-plan fallback', () => {
    const shellHeightM = 6;
    const blueprint = blueprintForPlot(plot(), SEED_PATH);
    const parts = buildInteriorParts(
      plot(),
      SEED_PATH,
      shellHeightM,
      [],
      blueprint,
    );

    // The canonical structure carries real window panes whenever the generator
    // emits windows; no fixed-fraction fake-window branch is available.
    const windowCount = blueprint.floors.reduce(
      (total, floor) => total + floor.windows.length,
      0,
    );
    expect(parts.filter((part) => part.lightRole === 'window')).toHaveLength(
      windowCount,
    );
  });

  it('does not resolve or rebuild a digest key when the load packet supplies its blueprint', () => {
    const input = plot();
    const shellHeightM = 6;

    // The production load boundary performs the one allowed resolution.
    const blueprint = blueprintForPlot(input, SEED_PATH);
    expect(resolverProbe.blueprintForPlot).toHaveBeenCalledTimes(1);

    // Occupancy is the first consumer in the live loop. It projects its whole
    // day from the supplied plan without asking the resolver for the same key.
    const population: TownPlotPopulation = {
      residential: true,
      buildingType: 'cottage',
      occupants: 3,
      homeId: 'b7',
      district: 'common',
    };
    expect(
      occupancyScheduleForPlot(
        population,
        [population],
        input,
        SEED_PATH,
        SEED_PATH,
        blueprint,
      ),
    ).toBeDefined();
    expect(resolverProbe.blueprintForPlot).toHaveBeenCalledTimes(1);

    // Rendering is the second consumer and receives the same plan. Any extra
    // resolver call would rebuild household/style/history digests even though
    // geometry is memoized.
    const combined = buildInterior(
      input,
      SEED_PATH,
      shellHeightM,
      [],
      false,
      false,
      blueprint,
    );
    expect(resolverProbe.blueprintForPlot).toHaveBeenCalledTimes(1);
    expect(combined.envelope).toEqual({
      wallWidthM: blueprint.widthFt * FT,
      wallDepthM: blueprint.depthFt * FT,
    });

    // A genuinely different seed remains a different cache identity and gets
    // exactly one fresh resolution; the optimization never merges buildings.
    const otherBlueprint = blueprintForPlot(input, rootSeedPath(43));
    expect(resolverProbe.blueprintForPlot).toHaveBeenCalledTimes(2);
    expect(otherBlueprint).not.toBe(blueprint);
  });
});
