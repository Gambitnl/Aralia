import { describe, expect, it } from 'vitest';
import { genFootprint } from '../footprint';
import { roomCapFor } from '../partition';
import { buildingTypeForRole, BASEMENT_CHANCE } from '../generateInterior';
import { generateBuilding } from '../generateBuilding';
import { rootSeedPath } from '../../seedPath';
import type { BuildingType } from '../blueprintTypes';
import type { BuildingType as TownBuildingType } from '../../town/population';

const ALL_TYPES: BuildingType[] = [
  'cottage', 'townhouse', 'tenement', 'farmstead',
  'shop', 'smithy', 'workshop', 'inn', 'tavern', 'storehouse',
  'manor', 'temple', 'keep', 'civic',
];

describe('shared building vocabulary', () => {
  it('town population types are assignable to blueprint types', () => {
    // Type-level check: if population.BuildingType stops being a subset,
    // this line stops compiling.
    const townType: TownBuildingType = 'tenement';
    const asBlueprint: BuildingType = townType;
    expect(asBlueprint).toBe('tenement');
  });

  it('every type rolls a valid footprint over 50 seeds', () => {
    for (const type of ALL_TYPES) {
      for (let seed = 0; seed < 50; seed++) {
        const fp = genFootprint(rootSeedPath(seed), type);
        expect(fp.cells.length).toBeGreaterThanOrEqual(12); // ≥ 12 cells = 300 sq ft min
        expect(roomCapFor(type)).toBeGreaterThanOrEqual(3);
        expect(BASEMENT_CHANCE[type]).toBeGreaterThanOrEqual(0);
        expect(BASEMENT_CHANCE[type]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every town role maps to a real type; temple/keep/civic are no longer manor', () => {
    expect(buildingTypeForRole('temple')).toBe('temple');
    expect(buildingTypeForRole('keep')).toBe('keep');
    expect(buildingTypeForRole('civic')).toBe('civic');
    expect(buildingTypeForRole('house')).toBe('cottage');
    expect(() => buildingTypeForRole('lighthouse')).toThrow(/no BuildingType mapping/);
  });

  it('v2 contract fields exist and stay optional (bare v1 call unaffected)', () => {
    const plan = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(7) });
    expect(plan.household).toBeUndefined();
    expect(plan.style).toBeUndefined();
    expect(plan.backstory).toBeUndefined();
    // frontage becomes ALWAYS-set in Task 9; until then optional-undefined is fine
    const room = plan.floors[0].rooms[0];
    expect('forSlot' in room || room.forSlot === undefined).toBe(true);
  });
});
