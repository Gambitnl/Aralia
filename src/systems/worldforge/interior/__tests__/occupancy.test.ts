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
import {
  computeOccupancy,
  MAX_COMMON_ROOM_VISITORS,
  VISITOR_END_HOUR,
  VISITOR_START_HOUR,
} from '../occupancy';

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

  it('puts working servants AT a service workstation, not on a bare room anchor', () => {
    // The regression this guards: servants used to be parked on the meal
    // room's anchor cell all day, which rendered as a body standing in the
    // middle of the hall doing nothing. They must now hold a real piece.
    const { plan, household } = fixture(9, 'wealthy');
    const occ = computeOccupancy(plan, household, { worksAtHome: false });
    const servantIndices = household.members
      .map((member, memberIndex) => ({ member, memberIndex }))
      .filter(({ member }) => member.role === 'servant')
      .map(({ memberIndex }) => memberIndex);

    expect(servantIndices.length).toBeGreaterThan(0);

    for (const memberIndex of servantIndices) {
      for (let hour = 8; hour <= 17; hour++) {
        const st = occ.stationsByHour[hour][memberIndex];
        expect(st).toMatchObject({ where: 'home', activity: 'chores' });
        // A real furnishing index, resolving to a real piece on a real floor.
        expect(st.furnishingIndex).toBeTypeOf('number');
        const floor = plan.floors.find((f) => f.level === st.level)!;
        const piece = floor.furnishings[st.furnishingIndex!];
        expect(piece).toBeDefined();
        expect(piece.roomId).toBe(st.roomId);
        // And it is a working room, not the family's sitting hall.
        const room = floor.rooms.find((r) => r.id === st.roomId)!;
        expect(['kitchen', 'pantry', 'stockroom', 'brewhouse', 'servant-room'])
          .toContain(room.purpose);
      }
    }
  });

  it('seats evening patrons in a public house common room, and nowhere else', () => {
    const town = rootSeedPath(31);
    const household = generateHousehold(town, 'tavern-home', 4, 'tavern' as any, {
      role: 'proprietor', workplaceType: 'tavern',
    });
    const brief = briefFromHousehold(household, { wealth: 'common', worksAtHome: true });
    const tavern = generateBuilding({
      buildingId: 77, type: 'tavern', seedPath: town, storeys: 2, household: brief,
    });
    const occ = computeOccupancy(tavern, household, { worksAtHome: true });

    const common = tavern.floors
      .flatMap((floor) => floor.rooms.map((room) => ({ floor, room })))
      .find(({ room }) => room.purpose === 'common-room');
    expect(common).toBeDefined();

    expect(occ.visitors.length).toBeGreaterThan(0);
    expect(occ.visitors.length).toBeLessThanOrEqual(MAX_COMMON_ROOM_VISITORS);
    expect(occ.visitorStationsByHour).toHaveLength(24);

    for (let hour = 0; hour < 24; hour++) {
      const row = occ.visitorStationsByHour[hour];
      expect(row).toHaveLength(occ.visitors.length);
      const inBand = hour >= VISITOR_START_HOUR && hour <= VISITOR_END_HOUR;
      for (const st of row) {
        if (!inBand) {
          expect(st).toMatchObject({ where: 'out', activity: 'out' });
          continue;
        }
        // Patrons sit in the taproom itself, at a real piece of furniture.
        expect(st).toMatchObject({
          where: 'home',
          activity: 'visiting',
          level: common!.floor.level,
          roomId: common!.room.id,
        });
      }
    }

    // Visitors never displace or duplicate the household's own station table.
    expect(occ.stationsByHour[20]).toHaveLength(household.members.length);

    // A private home is not a public house: no patrons at all.
    const { plan: house, household: family } = fixture(4);
    const priv = computeOccupancy(house, family, { worksAtHome: false });
    expect(priv.visitors).toEqual([]);
    expect(priv.visitorStationsByHour.every((row) => row.length === 0)).toBe(true);

    // RNG-free: the same inn always draws the same crowd.
    expect(computeOccupancy(tavern, household, { worksAtHome: true })).toEqual(occ);
  });

  it('covers every USED room across the day: claims, kitchen, hall and hearth', () => {
    // "Placement covers all rooms" as the generator can actually guarantee it.
    //
    // A plan may hold MORE bedrooms than the household has members — the room
    // programmer uses 'bedroom' as its filler purpose, so a roomy townhouse for
    // three can end up with eight of them. Demanding a body in every bedroom
    // would be demanding a bigger family, not better placement. What placement
    // must guarantee is: every claimed room is stood in, every member is home
    // at some hour, and the rooms the day is BUILT around (kitchen, main hall
    // and hearth room) are all used.
    for (const wealth of ['common', 'wealthy'] as const) {
      for (let seed = 0; seed < 8; seed++) {
        const { plan, household } = fixture(seed, wealth);
        const occ = computeOccupancy(plan, household, { worksAtHome: true });

        const visited = new Set<string>();
        const homeHoursByMember = new Map<number, number>();
        for (const row of occ.stationsByHour) {
          for (const st of row) {
            if (st.where !== 'home') continue;
            visited.add(`${st.level}:${st.roomId}`);
            homeHoursByMember.set(
              st.memberIndex, (homeHoursByMember.get(st.memberIndex) ?? 0) + 1,
            );
          }
        }

        // Every member has a real day inside the house.
        household.members.forEach((_, i) => {
          expect(homeHoursByMember.get(i) ?? 0,
            `seed ${seed} (${wealth}): member ${i} is never home`).toBeGreaterThan(0);
        });

        // Every claimed room is a room somebody actually stands in.
        for (const claim of occ.claims) {
          expect(visited.has(`${claim.level}:${claim.roomId}`),
            `seed ${seed} (${wealth}): claimed room ${claim.roomId} on level ` +
            `${claim.level} was never occupied`).toBe(true);
        }

        // The three rooms the daily rhythm is built around.
        for (const purpose of ['kitchen', 'hall'] as const) {
          const rooms = plan.floors.flatMap((floor) =>
            floor.rooms.filter((room) => room.purpose === purpose)
              .map((room) => `${floor.level}:${room.id}`));
          if (rooms.length === 0) continue; // not every plan programs one
          expect(rooms.some((key) => visited.has(key)),
            `seed ${seed} (${wealth}): no ${purpose} was ever occupied`).toBe(true);
        }
        // The hearth room fills every evening.
        expect(occ.stationsByHour[20].some((st) => st.activity === 'hearthside'))
          .toBe(true);
      }
    }
  });

  it('seats an untagged member in a spare bedded room before the hall', () => {
    // Regression: the programmer can leave a furnished bedroom untagged. Such
    // a member used to sleep in the main hall while the bed stood empty.
    const { plan, household } = fixture(0);
    const occ = computeOccupancy(plan, household, { worksAtHome: false });

    const bedded = (level: number, roomId: number): boolean => {
      const floor = plan.floors.find((f) => f.level === level)!;
      return floor.furnishings.some((fu) => fu.roomId === roomId && fu.kind === 'bed');
    };
    const claimedKeys = new Set(occ.claims.map((c) => `${c.level}:${c.roomId}`));
    const spareBedded = plan.floors.some((floor) =>
      floor.rooms.some((room) =>
        room.purpose === 'bedroom' &&
        !claimedKeys.has(`${floor.level}:${room.id}`) &&
        bedded(floor.level, room.id)));

    // While an unclaimed bedded room exists, nobody may be sleeping in a
    // bedless room — the spare-room pass must have run first.
    if (spareBedded) {
      for (const st of occ.stationsByHour[2]) {
        expect(st.where).toBe('home');
        expect(bedded(st.level!, st.roomId!),
          `member ${st.memberIndex} sleeps in bedless room ${st.roomId} ` +
          `while a spare bedded room is free`).toBe(true);
      }
    }
    expect(occ.claims).toHaveLength(household.members.length);
  });
});
