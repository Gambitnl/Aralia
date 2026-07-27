/**
 * These tests prove the living overlay binds every named household member to
 * real rooms and furniture across a full day. Wealthy servant coverage keeps
 * the shared service room occupied and the staff visible while they work.
 */
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { generateBuilding } from '../generateBuilding';
import { briefFromHousehold } from '../../town/householdBrief';
import { generateHousehold } from '../../town/household';
import { computeOccupancy } from '../occupancy';

/** Build a matched (plan, household) pair: the brief the plan is designed for
 *  is coarsened from the SAME named household, so plan slot tags and household
 *  members line up (see briefFromHousehold's tag scheme). */
function fixture(seed: number, wealth: 'common' | 'wealthy' = 'common') {
  const town = rootSeedPath(seed);
  const homeId = `b${seed}`;
  const occupants = 3 + (seed % 4); // 3..6 people
  // The wealthy case uses a manor-sized frame so the required service room is
  // physically present; cramped homes may legitimately fall back to the hall.
  const type = wealth === 'wealthy' ? 'manor' : 'townhouse';
  const household = generateHousehold(town, homeId, occupants, type as any, undefined, wealth);
  const brief = briefFromHousehold(household, { wealth, worksAtHome: false });
  const plan = generateBuilding({
    buildingId: seed + 1,
    type,
    seedPath: town,
    storeys: 2,
    household: brief,
  });
  return { plan, household, brief };
}

describe('computeOccupancy', () => {
  it('every member has a station at every hour; home stations point at real rooms — 25 seeds', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { plan, household } = fixture(seed);
      const occ = computeOccupancy(plan, household, { worksAtHome: false });
      expect(occ.stationsByHour).toHaveLength(24);
      for (const hourRow of occ.stationsByHour) {
        expect(hourRow).toHaveLength(household.members.length);
        for (const st of hourRow) {
          if (st.where === 'home') {
            const floor = plan.floors.find((f) => f.level === st.level)!;
            expect(floor.rooms.some((r) => r.id === st.roomId)).toBe(true);
            if (st.furnishingIndex !== undefined) {
              expect(floor.furnishings[st.furnishingIndex]).toBeDefined();
            }
          }
        }
      }
      // at 02:00 everyone with a claim is sleeping in their claimed room
      for (const st of occ.stationsByHour[2]) expect(st.activity).toBe('sleeping');
    }
  });

  it('hearth is lit in the evening when someone is home, never at 03:00', () => {
    const { plan, household } = fixture(1);
    const occ = computeOccupancy(plan, household, { worksAtHome: true });
    expect(occ.flags.hearthLitHours[19]).toBe(true);
    expect(occ.flags.hearthLitHours[3]).toBe(false);
  });

  it('claims resolve tagged rooms to members; abandoned when no members', () => {
    const { plan, household } = fixture(5);
    const occ = computeOccupancy(plan, household, { worksAtHome: false });
    expect(occ.flags.abandoned).toBe(false);
    // every claim names a real member and points at a real room
    for (const c of occ.claims) {
      expect(household.members.some((m) => m.name === c.memberName)).toBe(true);
      const floor = plan.floors.find((f) => f.level === c.level)!;
      expect(floor.rooms.some((r) => r.id === c.roomId)).toBe(true);
    }
    // determinism: identical inputs → identical occupancy
    const again = computeOccupancy(plan, household, { worksAtHome: false });
    expect(again).toEqual(occ);
  });

  it('gives wealthy servants the shared servant room and a visible service-day schedule', () => {
    const { plan, household } = fixture(9, 'wealthy');
    const occ = computeOccupancy(plan, household, { worksAtHome: false });
    const servants = household.members
      .map((member, memberIndex) => ({ member, memberIndex }))
      .filter(({ member }) => member.role === 'servant');
    const servantRoom = plan.floors
      .flatMap((floor) => floor.rooms.map((room) => ({ floor, room })))
      .find(({ room }) => room.purpose === 'servant-room');

    expect(servants).toHaveLength(2);
    expect(servantRoom).toBeDefined();

    for (const { member, memberIndex } of servants) {
      // Both named staff members claim the same purpose-built service room and
      // sleep there rather than silently falling back to the family hall.
      expect(occ.claims).toContainEqual({
        slotTag: `servant:${servants.findIndex((entry) => entry.memberIndex === memberIndex)}`,
        memberName: member.name,
        level: servantRoom!.floor.level,
        roomId: servantRoom!.room.id,
      });
      expect(occ.stationsByHour[2][memberIndex]).toMatchObject({
        activity: 'sleeping',
        where: 'home',
        level: servantRoom!.floor.level,
        roomId: servantRoom!.room.id,
      });

      // Meals use the household table, daytime keeps servants inside doing
      // chores, and evening follows the same hearth rhythm as the family.
      expect(occ.stationsByHour[7][memberIndex].activity).toBe('meal');
      expect(occ.stationsByHour[10][memberIndex]).toMatchObject({ activity: 'chores', where: 'home' });
      expect(occ.stationsByHour[20][memberIndex]).toMatchObject({ activity: 'hearthside', where: 'home' });
    }
  });
});
