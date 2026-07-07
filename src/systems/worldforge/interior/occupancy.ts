/**
 * @file occupancy.ts — the living overlay's first layer: who lives where, and
 * where each family member stands hour by hour.
 *
 * Pure and RNG-FREE. Given a finished {@link BlueprintPlan} and the named
 * {@link Household} it was designed for, this derives:
 *   - CLAIMS: which room each member sleeps in. Rooms carry `forSlot` tags
 *     (comma-joined MemberSlot tags, e.g. 'head,spouse' or 'child:0,child:1')
 *     stamped by the programmer; we resolve those tags back to members using
 *     the SAME tag scheme briefFromHousehold used (members in order, counting
 *     per role: 'head', 'spouse', then '<role>:<n>'). A member with no tagged
 *     room claims the MAIN room — the visible-misfit rule. Servant tags have no
 *     named member and resolve to no claim.
 *   - STATIONS: a fixed medieval day per member, a deterministic scan (no RNG):
 *     sleep 22–06 at the claimed room's bed; meals 07 & 18 at the largest table
 *     in the kitchen/main room; work 08–17 (worksAtHome heads/spouses at the
 *     trade room's workstation, everyone else `out`); children alternate
 *     chores/out by day; evenings 19–21 hearthside; the rest home idle.
 *   - FLAGS: abandoned (zero members) and the 24-hour hearth-lit schedule.
 *
 * Determinism: identical (plan, household) always yields identical occupancy —
 * every pick is a stable scan in furnishing/room order.
 */
import type {
  BlueprintFloor,
  BlueprintFurnishing,
  BlueprintPlan,
  BlueprintRoom,
} from './blueprintTypes';
import type { Household } from '../town/household';
import { memberTag } from '../town/householdBrief';

export interface RoomClaim {
  slotTag: string;
  memberName: string;
  level: number;
  roomId: number;
}

export interface OccupantStation {
  /** Index into household.members. */
  memberIndex: number;
  /** 0–23. */
  hour: number;
  where: 'home' | 'out';
  /** Set when where === 'home'. */
  level?: number;
  roomId?: number;
  /** Index into plan.floors[levelIdx].furnishings when standing at a piece. */
  furnishingIndex?: number;
  activity: 'sleeping' | 'meal' | 'work' | 'hearthside' | 'chores' | 'out';
}

export interface BuildingOccupancy {
  claims: RoomClaim[];
  /** stationsByHour[hour] = one entry per household member. */
  stationsByHour: OccupantStation[][];
  flags: { abandoned: boolean; hearthLitHours: boolean[] };
}

/** Kinds a family member can stand AT for a given activity. */
const BED_KINDS = new Set(['bed']);
const TABLE_KINDS = new Set(['table']);
export const HEARTH_KINDS = new Set(['hearth', 'forge-hearth']);
const TRADE_STATION_KINDS = new Set([
  'workbench', 'counter', 'anvil', 'forge-hearth',
]);
const TRADE_PURPOSES = new Set([
  'forge', 'workshop', 'shopfront', 'counting-room', 'brewhouse',
]);
const MEAL_ROOM_PURPOSES = new Set([
  'kitchen', 'hall', 'common-room', 'great-hall',
]);

/**
 * Recover the tag → member-index map the brief used: iterate members in order,
 * counting per role; 'head'/'spouse' keep the bare role, everything else gets
 * '<role>:<n>'. This is the inverse of briefFromHousehold's slot scheme.
 */
function tagToMember(household: Household): Map<string, number> {
  const counters = new Map<string, number>();
  const map = new Map<string, number>();
  household.members.forEach((m, i) => {
    const role = m.role;
    const n = counters.get(role) ?? 0;
    counters.set(role, n + 1);
    const tag = memberTag(role, n);
    map.set(tag, i);
  });
  return map;
}

/** The ground floor's main room, and its floor — the fallback claim + hub. */
function findMain(plan: BlueprintPlan): { floor: BlueprintFloor; room: BlueprintRoom } {
  const ground = plan.floors.find((f) => f.level === 0) ?? plan.floors[0];
  const room = ground.rooms.find((r) => r.isMain) ?? ground.rooms[0];
  return { floor: ground, room };
}

/** First furnishing of one of `kinds` in a given room, as an index into the
 *  floor's furnishings array; -1 if none. Stable furnishing-order scan. */
function furnishingIndexInRoom(
  floor: BlueprintFloor, roomId: number, kinds: ReadonlySet<string>,
): number {
  for (let i = 0; i < floor.furnishings.length; i++) {
    const fu = floor.furnishings[i];
    if (fu.roomId === roomId && kinds.has(fu.kind)) return i;
  }
  return -1;
}

/** Resolve every member's sleeping room. Rooms with `forSlot` claim their
 *  tagged members; members with no tagged room fall back to the main room. */
function resolveClaims(
  plan: BlueprintPlan, household: Household, tagMap: Map<string, number>,
): { claims: RoomClaim[]; roomByMember: (number | undefined)[]; levelByMember: (number | undefined)[] } {
  const claims: RoomClaim[] = [];
  const roomByMember: (number | undefined)[] = new Array(household.members.length).fill(undefined);
  const levelByMember: (number | undefined)[] = new Array(household.members.length).fill(undefined);

  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (!room.forSlot) continue;
      for (const tag of room.forSlot.split(',')) {
        const t = tag.trim();
        if (!t) continue;
        const memberIdx = tagMap.get(t);
        if (memberIdx === undefined) continue; // servant tags have no named member
        // A member already seated keeps their first-scanned room (stable order).
        if (roomByMember[memberIdx] !== undefined) continue;
        roomByMember[memberIdx] = room.id;
        levelByMember[memberIdx] = floor.level;
        claims.push({
          slotTag: t,
          memberName: household.members[memberIdx].name,
          level: floor.level,
          roomId: room.id,
        });
      }
    }
  }

  // Misfit rule: any member without a tagged room claims the main room.
  const { floor: mainFloor, room: mainRoom } = findMain(plan);
  const rebuiltTags = tagToMember(household);
  const tagByMember = new Map<number, string>();
  for (const [tag, idx] of rebuiltTags) tagByMember.set(idx, tag);
  household.members.forEach((m, i) => {
    if (roomByMember[i] !== undefined) return;
    roomByMember[i] = mainRoom.id;
    levelByMember[i] = mainFloor.level;
    claims.push({
      slotTag: tagByMember.get(i) ?? m.role,
      memberName: m.name,
      level: mainFloor.level,
      roomId: mainRoom.id,
    });
  });

  return { claims, roomByMember, levelByMember };
}

/** Where the family eats: the largest table-bearing meal room, its floor, and
 *  the furnishing index of that table. Falls back to the main room anchor. */
function findMealStation(plan: BlueprintPlan): {
  level: number; roomId: number; furnishingIndex?: number;
} {
  let best: { level: number; roomId: number; furnishingIndex: number; area: number } | undefined;
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (!MEAL_ROOM_PURPOSES.has(room.purpose)) continue;
      const fi = furnishingIndexInRoom(floor, room.id, TABLE_KINDS);
      if (fi < 0) continue;
      if (!best || room.area > best.area) {
        best = { level: floor.level, roomId: room.id, furnishingIndex: fi, area: room.area };
      }
    }
  }
  if (best) return { level: best.level, roomId: best.roomId, furnishingIndex: best.furnishingIndex };
  const { floor, room } = findMain(plan);
  return { level: floor.level, roomId: room.id };
}

/** The hearth-bearing room families gather in of an evening: the largest room
 *  with a hearth, its floor, and that hearth's furnishing index. Undefined if
 *  the building has no hearth at all. */
function findHearthStation(plan: BlueprintPlan): {
  level: number; roomId: number; furnishingIndex: number;
} | undefined {
  let best: { level: number; roomId: number; furnishingIndex: number; area: number } | undefined;
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      const fi = furnishingIndexInRoom(floor, room.id, HEARTH_KINDS);
      if (fi < 0) continue;
      if (!best || room.area > best.area) {
        best = { level: floor.level, roomId: room.id, furnishingIndex: fi, area: room.area };
      }
    }
  }
  return best ? { level: best.level, roomId: best.roomId, furnishingIndex: best.furnishingIndex } : undefined;
}

/** The trade workstation heads/spouses work at: the first workstation piece in
 *  the first trade room, in floor/furnishing order. Undefined if none. */
function findTradeStation(plan: BlueprintPlan): {
  level: number; roomId: number; furnishingIndex: number;
} | undefined {
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (!TRADE_PURPOSES.has(room.purpose)) continue;
      const fi = furnishingIndexInRoom(floor, room.id, TRADE_STATION_KINDS);
      if (fi >= 0) return { level: floor.level, roomId: room.id, furnishingIndex: fi };
    }
  }
  return undefined;
}

const homeStation = (
  memberIndex: number, hour: number,
  activity: OccupantStation['activity'],
  loc: { level: number; roomId: number; furnishingIndex?: number },
): OccupantStation => ({
  memberIndex, hour, where: 'home',
  level: loc.level, roomId: loc.roomId,
  ...(loc.furnishingIndex !== undefined && loc.furnishingIndex >= 0
    ? { furnishingIndex: loc.furnishingIndex }
    : {}),
  activity,
});

const outStation = (memberIndex: number, hour: number): OccupantStation => ({
  memberIndex, hour, where: 'out', activity: 'out',
});

/**
 * Compute the living overlay for a building: room claims, an hourly station per
 * member, and the abandoned/hearth-lit flags. RNG-FREE and deterministic.
 */
export function computeOccupancy(
  plan: BlueprintPlan,
  household: Household,
  opts: { worksAtHome: boolean },
): BuildingOccupancy {
  const members = household.members;
  const tagMap = tagToMember(household);
  const { claims, roomByMember, levelByMember } = resolveClaims(plan, household, tagMap);

  const meal = findMealStation(plan);
  const hearth = findHearthStation(plan);
  const trade = findTradeStation(plan);
  const { floor: mainFloor, room: mainRoom } = findMain(plan);

  // The bed a member sleeps at: their claimed room's first bed, else no piece.
  const bedStationForMember = (i: number): { level: number; roomId: number; furnishingIndex?: number } => {
    const level = levelByMember[i] ?? mainFloor.level;
    const roomId = roomByMember[i] ?? mainRoom.id;
    const floor = plan.floors.find((f) => f.level === level) ?? mainFloor;
    const fi = furnishingIndexInRoom(floor, roomId, BED_KINDS);
    return { level, roomId, furnishingIndex: fi >= 0 ? fi : undefined };
  };

  const stationsByHour: OccupantStation[][] = [];
  for (let hour = 0; hour < 24; hour++) {
    const row: OccupantStation[] = [];
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const isChild = m.ageBand === 'child';
      const worksTrade = opts.worksAtHome && (m.role === 'head' || m.role === 'spouse');

      // Sleep 22:00–06:59 at the claimed room's bed.
      if (hour >= 22 || hour < 7) {
        row.push(homeStation(i, hour, 'sleeping', bedStationForMember(i)));
        continue;
      }
      // Meals at 07 and 18 at the shared table.
      if (hour === 7 || hour === 18) {
        row.push(homeStation(i, hour, 'meal', meal));
        continue;
      }
      // Work band 08:00–17:59.
      if (hour >= 8 && hour <= 17) {
        if (isChild) {
          // Children alternate chores (even hours) at home and out (odd hours).
          if (hour % 2 === 0) {
            row.push(homeStation(i, hour, 'chores', { level: mainFloor.level, roomId: mainRoom.id }));
          } else {
            row.push(outStation(i, hour));
          }
          continue;
        }
        if (worksTrade && trade) {
          row.push(homeStation(i, hour, 'work', trade));
        } else if (worksTrade) {
          // Runs the trade but the building has no workstation: work in the main room.
          row.push(homeStation(i, hour, 'work', { level: mainFloor.level, roomId: mainRoom.id }));
        } else {
          row.push(outStation(i, hour));
        }
        continue;
      }
      // Evening 19:00–21:59 hearthside (or the main room when no hearth).
      row.push(hearth
        ? homeStation(i, hour, 'hearthside', hearth)
        : homeStation(i, hour, 'hearthside', { level: mainFloor.level, roomId: mainRoom.id }));
    }
    stationsByHour.push(row);
  }

  // Flags. hearthLitHours[h] = someone home at h AND h in 06–08 ∪ 17–22.
  const hearthLitHours: boolean[] = new Array(24).fill(false);
  for (let hour = 0; hour < 24; hour++) {
    const inWindow = (hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 22);
    if (!inWindow) continue;
    const anyoneHome = stationsByHour[hour].some((st) => st.where === 'home');
    hearthLitHours[hour] = anyoneHome;
  }

  return {
    claims,
    stationsByHour,
    flags: { abandoned: members.length === 0, hearthLitHours },
  };
}
