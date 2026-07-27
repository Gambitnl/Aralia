/**
 * This file tests the town-plot adapter that now returns only the canonical
 * BlueprintPlan. It protects lot fitting, deterministic identity, explicit
 * role/type resolution, population and style pass-through, and retention of
 * rich geometry such as windows and basements.
 *
 * The retired InteriorPlan collapse is deliberately absent: no test may lock
 * bounding-box rooms, fake windows, or basement loss back into the system.
 *
 * Called by: the focused Worldforge interior test suite.
 * Depends on: blueprintForPlot, building type resolution, and seeded generation.
 */
import { describe, expect, it } from 'vitest';
import { styleFamilyForCultureType } from '../../town/architectureStyle';
import { childSeedPath, rootSeedPath } from '../../seedPath';
import type { HouseholdBrief, StyleContext } from '../blueprintTypes';
import {
  blueprintForPlot,
  buildingTypeForRole,
  rollBasement,
  type InteriorPlotInput,
} from '../generateInterior';

const SEED_PATH = rootSeedPath(42);
const QUAD_40X30: Array<[number, number]> = [
  [0, 0],
  [40, 0],
  [40, 30],
  [0, 30],
];

/** Build a plain town house while allowing one test to override its context. */
function house(overrides: Partial<InteriorPlotInput> = {}): InteriorPlotInput {
  return {
    id: 7,
    footprint: QUAD_40X30,
    role: 'house',
    storeys: 2,
    ...overrides,
  };
}

describe('blueprintForPlot canonical contract', () => {
  it('is deterministic and returns the memoized BlueprintPlan instance', () => {
    const first = blueprintForPlot(house(), SEED_PATH);
    const second = blueprintForPlot(house(), SEED_PATH);

    expect(second).toBe(first);
    expect(first.buildingId).toBe(7);
  });

  it('fits the generated envelope inside the snapped town lot', () => {
    const plan = blueprintForPlot(house(), SEED_PATH);

    expect(plan.widthFt).toBeLessThanOrEqual(40);
    expect(plan.depthFt).toBeLessThanOrEqual(30);
    expect(plan.widthFt % 5).toBe(0);
    expect(plan.depthFt % 5).toBe(0);
  });

  it('keeps the requested above-ground storey count in blueprint floors', () => {
    const plan = blueprintForPlot(house({ storeys: 3 }), SEED_PATH);
    const aboveGroundLevels = plan.floors
      .filter((floor) => floor.level >= 0)
      .map((floor) => floor.level);

    expect(aboveGroundLevels).toEqual([0, 1, 2]);
  });

  it('keeps real windows and cell-shaped rooms instead of a lossy room collapse', () => {
    const plan = blueprintForPlot(house(), SEED_PATH);
    const ground = plan.floors.find((floor) => floor.level === 0);

    expect(ground).toBeDefined();
    expect(ground!.windows.length).toBeGreaterThan(0);
    expect(ground!.rooms.every((room) => room.cells.length > 0)).toBe(true);
    expect(
      ground!.rooms.every((room) => room.bbox.w > 0 && room.bbox.d > 0),
    ).toBe(true);
  });

  it('retains a generated basement and its connecting stair in the same plan', () => {
    // Find one deterministic cottage seed whose isolated basement roll succeeds;
    // the assertion stays independent of future changes to other random streams.
    let selectedId = -1;
    for (let id = 0; id < 100; id += 1) {
      const interiorPath = childSeedPath(SEED_PATH, `interior:${id}`);
      if (rollBasement('cottage', interiorPath)) {
        selectedId = id;
        break;
      }
    }
    expect(selectedId).toBeGreaterThanOrEqual(0);

    const plan = blueprintForPlot(house({ id: selectedId }), SEED_PATH);
    expect(plan.floors.some((floor) => floor.level === -1)).toBe(true);
    expect(plan.stairs.some((stair) => stair.fromLevel === -1)).toBe(true);
  });
});

describe('town role and population wiring', () => {
  const family: HouseholdBrief = {
    homeId: 'b7',
    slots: [
      { tag: 'head', role: 'head', ageBand: 'adult' },
      { tag: 'spouse', role: 'spouse', ageBand: 'adult' },
      { tag: 'child:0', role: 'child', ageBand: 'child' },
    ],
    trade: 'blacksmith',
    worksAtHome: true,
    wealth: 'common',
  };

  it('uses the closed role table and rejects an unknown role', () => {
    expect(buildingTypeForRole('house')).toBe('cottage');
    expect(buildingTypeForRole('market')).toBe('shop');
    expect(() => buildingTypeForRole('aviary')).toThrow(
      /no BuildingType mapping/,
    );
  });

  it('lets a population-authored building type win and carries its household brief', () => {
    const plan = blueprintForPlot(
      house({ buildingType: 'smithy', household: family }),
      rootSeedPath(11),
    );

    expect(plan.type).toBe('smithy');
    expect(plan.household).toEqual(family);
  });
});

describe('style wiring', () => {
  const highlandStyle: StyleContext = {
    cultureType: 'Highland',
    climate: 'cold',
    wealth: 'common',
    ageBand: 'new',
  };

  it('adds a solved regional roof without moving the permanent floor plan', () => {
    const plain = blueprintForPlot(house({ id: 9 }), rootSeedPath(11));
    const styled = blueprintForPlot(
      house({ id: 9, style: highlandStyle }),
      rootSeedPath(11),
    );

    expect(styled.roof).toBeDefined();
    expect(styled.styleResolved?.familyId).toBe(
      styleFamilyForCultureType('Highland').id,
    );
    expect(styled.style).toEqual(highlandStyle);
    expect(styled.floors).toEqual(plain.floors);
    expect(styled.stairs).toEqual(plain.stairs);
  });

  it('keeps style-less plans honestly roofless', () => {
    const plan = blueprintForPlot(house({ id: 10 }), rootSeedPath(11));

    expect(plan.roof).toBeUndefined();
    expect(plan.styleResolved).toBeUndefined();
    expect(plan.style).toBeUndefined();
  });
});
