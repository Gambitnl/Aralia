/**
 * This file proves household capacity counts sleeping rooms on every
 * above-ground BlueprintPlan floor. The blueprint is now the roster's direct
 * source, so upstairs guest rooms and private rooms count while cellar rooms
 * do not accidentally expand a household.
 *
 * Called by: the focused Worldforge roster test suite.
 * Depends on: blueprintForPlot and houseBedroomCount.
 */
import { describe, expect, it } from 'vitest';
import {
  blueprintForPlot,
  type InteriorPlotInput,
} from '../../interior/generateInterior';
import type { RoomPurpose } from '../../interior/blueprintTypes';
import { rootSeedPath } from '../../seedPath';
import { houseBedroomCount } from '../generateTownRoster';

const SEED = rootSeedPath(42);
const SLEEPING_PURPOSES = new Set<RoomPurpose>([
  'bedroom',
  'guest-room',
  'private-room',
  'solar',
  'servant-room',
]);

/** Build one house plot at the requested identity and height. */
function house(id: number, storeys: number): InteriorPlotInput {
  return {
    id,
    footprint: [
      [1000, 2000],
      [1060, 2000],
      [1060, 2045],
      [1000, 2045],
    ],
    role: 'house',
    storeys,
  };
}

/** Count sleeping rooms on one named blueprint floor. */
function bedroomsOnLevel(id: number, storeys: number, level: number): number {
  const plan = blueprintForPlot(house(id, storeys), SEED);
  return (
    plan.floors
      .find((floor) => floor.level === level)
      ?.rooms.filter((room) => SLEEPING_PURPOSES.has(room.purpose)).length ?? 0
  );
}

describe('houseBedroomCount', () => {
  it('counts ground and every upper floor directly from the blueprint', () => {
    const plan = blueprintForPlot(house(0, 2), SEED);
    const expected = plan.floors
      .filter((floor) => floor.level >= 0)
      .reduce(
        (total, floor) =>
          total +
          floor.rooms.filter((room) => SLEEPING_PURPOSES.has(room.purpose))
            .length,
        0,
      );

    expect(houseBedroomCount(plan)).toBe(expected);
  });

  it('single-storey houses match their ground-floor sleeping rooms', () => {
    const plan = blueprintForPlot(house(3, 1), SEED);

    expect(houseBedroomCount(plan)).toBe(bedroomsOnLevel(3, 1, 0));
  });

  it('counts upstairs bedrooms that a ground-only read misses', () => {
    let sawUpstairsBedroom = false;
    for (let id = 0; id < 6; id += 1) {
      const plan = blueprintForPlot(house(id, 2), SEED);
      const groundOnly = bedroomsOnLevel(id, 2, 0);
      if (houseBedroomCount(plan) > groundOnly) sawUpstairsBedroom = true;
      expect(houseBedroomCount(plan)).toBeGreaterThanOrEqual(groundOnly);
    }

    expect(sawUpstairsBedroom).toBe(true);
  });

  it('does not count basement storage as sleeping capacity', () => {
    const plan = blueprintForPlot(house(0, 2), SEED);
    const basementRoomCount = plan.floors
      .filter((floor) => floor.level < 0)
      .reduce((total, floor) => total + floor.rooms.length, 0);

    expect(basementRoomCount).toBeGreaterThanOrEqual(0);
    expect(houseBedroomCount(plan)).toBe(
      plan.floors
        .filter((floor) => floor.level >= 0)
        .flatMap((floor) => floor.rooms)
        .filter((room) => SLEEPING_PURPOSES.has(room.purpose)).length,
    );
  });
});
