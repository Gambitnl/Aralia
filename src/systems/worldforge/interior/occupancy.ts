// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 11:37:56
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, devtools/buildingIdentityLab/BuildingIdentityLab.tsx, devtools/buildingIdentityLab/PreviewBuilding3D.tsx, systems/world3d/buildingSceneModel.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/interior/renderBlueprintSvg.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
 *     room takes an untagged bedded room if one is standing empty, and only
 *     then the MAIN room — the visible-misfit rule. Named servants share
 *     the purpose-built servant room even though ground program slots do not
 *     carry bedroom-style `forSlot` tags.
 *   - STATIONS: a fixed medieval day per member, a deterministic scan (no RNG):
 *     sleep 22–06 at the claimed room's bed; meals 07 & 18 at the largest table
 *     in the kitchen/main room; work 08–17 (worksAtHome heads/spouses at the
 *     trade room's workstation, everyone else `out`); children alternate
 *     chores/out by day; servants serve meals and do daytime household chores
 *     AT a real service workstation (kitchen/pantry/stockroom) when the plan
 *     has one; evenings 19–21 hearthside; the rest home idle.
 *   - VISITORS: a public house (a plan with a `common-room`, i.e. the tavern
 *     and inn headline) also seats evening patrons in that room. They are a
 *     parallel table, not household members — see {@link BuildingVisitor}.
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
  /** Index into household.members — or, on a visitor row, the visitor index. */
  memberIndex: number;
  /** 0–23. */
  hour: number;
  where: 'home' | 'out';
  /** Set when where === 'home'. */
  level?: number;
  roomId?: number;
  /** Index into plan.floors[levelIdx].furnishings when standing at a piece. */
  furnishingIndex?: number;
  activity: 'sleeping' | 'meal' | 'work' | 'hearthside' | 'chores' | 'out' | 'visiting';
}

/**
 * A non-resident body who occupies a PUBLIC common room for part of the day.
 *
 * Visitors are deliberately NOT household members: they own no bed, hold no
 * room claim, and never appear in `stationsByHour` (which is contractually one
 * row per household member and is indexed by member index all the way down to
 * the render packet). They ride a parallel table so an inn's common room is
 * populated without corrupting the family's identity join.
 */
export interface BuildingVisitor {
  /** Position in the visitor list — the index into `visitorStationsByHour`. */
  visitorIndex: number;
  /** Deterministic given name, derived from the plan, never from RNG. */
  name: string;
  /** Always 'adult': patrons are drawn as grown travellers, not children. */
  ageBand: 'adult';
}

export interface BuildingOccupancy {
  claims: RoomClaim[];
  /** stationsByHour[hour] = one entry per household member. */
  stationsByHour: OccupantStation[][];
  /** The public-house patrons, empty for every building with no common room. */
  visitors: BuildingVisitor[];
  /** visitorStationsByHour[hour] = one entry per entry in `visitors`. */
  visitorStationsByHour: OccupantStation[][];
  flags: { abandoned: boolean; hearthLitHours: boolean[] };
}

/** Room purposes a member can be given as a private sleeping room when the
 *  programmer left one untagged. Excludes the shared servant room, which the
 *  servant pass owns, and every non-sleeping purpose. */
const SLEEPING_ROOM_PURPOSES = new Set([
  'bedroom', 'private-room', 'solar', 'guest-room',
]);

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
 * Pieces a live-in servant actually WORKS at during the day. Before this list
 * existed a servant simply stood on the meal room's anchor cell all day — a
 * body in the right room but at no station, which read as loitering. The scan
 * order is intent order: a service workstation first, then the counter/table a
 * servant lays and clears, then the hearth they tend.
 */
const SERVICE_STATION_KINDS = new Set([
  'workbench', 'counter', 'table', 'hearth',
]);

/** Rooms a household servant is put to work in, best first. The kitchen is the
 *  real service room; the pantry and stockroom are the stores they fetch from. */
const SERVICE_ROOM_PURPOSES: readonly string[] = [
  'kitchen', 'pantry', 'stockroom', 'brewhouse', 'servant-room',
];

/**
 * Only a true PUBLIC house gets patrons. 'common-room' is the headline purpose
 * program.ts stamps on exactly the tavern and the inn, so keying on it keeps a
 * manor's great-hall and a cottage's hall private without needing the building
 * type threaded down into this pure pass.
 */
const PUBLIC_ROOM_PURPOSE = 'common-room';

/** Seats a patron can occupy. Benches and chairs first, tables as the fallback
 *  for a taproom furnished with standing tables only. */
const PATRON_SEAT_KINDS = new Set(['bench', 'chair']);
const PATRON_TABLE_KINDS = new Set(['table']);

/** The hours a public house holds patrons (inclusive). Matches the evening
 *  hearth band, so the taproom fills exactly while its fire is lit. */
export const VISITOR_START_HOUR = 17;
export const VISITOR_END_HOUR = 22;

/**
 * A crowded taproom is a render cost as well as a fiction. Five patrons fill a
 * common room visibly while staying inside the interior body budget
 * (MAX_LIVE_INTERIOR_BODIES = 10) alongside the resident family.
 */
export const MAX_COMMON_ROOM_VISITORS = 5;

/**
 * Patron given names. Local and deliberately small: a visitor is a passing
 * body, not a roster person, so this must not pull in the household namer and
 * accidentally imply a tracked identity. Picked by a stable hash, never RNG.
 */
const PATRON_NAMES: readonly string[] = [
  'Aldo', 'Bevin', 'Corin', 'Dell', 'Eadric', 'Fenn', 'Gerd', 'Hald',
  'Ilsa', 'Jarl', 'Kesta', 'Lund', 'Mirek', 'Nyle', 'Orin', 'Perrin',
];

/** FNV-1a over a string — a deterministic, RNG-free index source. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

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
  const tagByMember = new Map<number, string>();
  for (const [tag, idx] of tagMap) tagByMember.set(idx, tag);

  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (!room.forSlot) continue;
      for (const tag of room.forSlot.split(',')) {
        const t = tag.trim();
        if (!t) continue;
        const memberIdx = tagMap.get(t);
        if (memberIdx === undefined) continue;
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

  // Ground program slots do not carry bedroom assignment tags. Bind every
  // named servant to the first purpose-built servant room so the shared room
  // is visibly occupied instead of falling through to the family hall.
  const servantRoom = plan.floors
    .flatMap((floor) => floor.rooms.map((room) => ({ floor, room })))
    .find(({ room }) => room.purpose === 'servant-room');
  if (servantRoom) {
    household.members.forEach((member, memberIdx) => {
      if (member.role !== 'servant' || roomByMember[memberIdx] !== undefined) return;
      roomByMember[memberIdx] = servantRoom.room.id;
      levelByMember[memberIdx] = servantRoom.floor.level;
      claims.push({
        slotTag: tagByMember.get(memberIdx) ?? `servant:${memberIdx}`,
        memberName: member.name,
        level: servantRoom.floor.level,
        roomId: servantRoom.room.id,
      });
    });
  }

  // Second pass: a member with no tagged room takes an EMPTY sleeping room
  // before falling through to the hall.
  //
  // Why this exists: the programmer can build more bedrooms than it stamps
  // `forSlot` tags for (an extra room from the filler purpose, or a tag whose
  // member the household generator never produced). Those rooms used to stand
  // furnished and permanently empty while the untagged member slept in the
  // main hall — a blueprint with a bed nobody ever lay in. Claiming the empty
  // bed first is strictly closer to the programmer's intent; the main-room
  // fallback below is preserved for the genuinely over-full house.
  const claimedRooms = new Set<string>();
  household.members.forEach((_, i) => {
    if (roomByMember[i] !== undefined) {
      claimedRooms.add(`${levelByMember[i]}:${roomByMember[i]}`);
    }
  });
  const spareSleepRooms = plan.floors
    .flatMap((floor) => floor.rooms.map((room) => ({ floor, room })))
    .filter(({ floor, room }) =>
      SLEEPING_ROOM_PURPOSES.has(room.purpose) &&
      !claimedRooms.has(`${floor.level}:${room.id}`) &&
      furnishingIndexInRoom(floor, room.id, BED_KINDS) >= 0);
  let spareCursor = 0;
  household.members.forEach((member, i) => {
    if (roomByMember[i] !== undefined) return;
    const spare = spareSleepRooms[spareCursor];
    if (!spare) return;
    spareCursor += 1;
    roomByMember[i] = spare.room.id;
    levelByMember[i] = spare.floor.level;
    claims.push({
      slotTag: tagByMember.get(i) ?? member.role,
      memberName: member.name,
      level: spare.floor.level,
      roomId: spare.room.id,
    });
  });

  // Misfit rule: any member still without a room claims the main room.
  const { floor: mainFloor, room: mainRoom } = findMain(plan);
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

/**
 * The hour the household cook lays the fire and starts the morning pottage.
 *
 * Why this exists: `findMealStation` picks the LARGEST table-bearing meal room,
 * which is nearly always the hall — so a purpose-built kitchen could be
 * furnished with a hearth and a work table and then never be stood in by
 * anyone, all day, in any house. One early riser fixes that without disturbing
 * a single other station: at 06:00 every member is inside the sleep band
 * anyway, so moving the cook costs no street-schedule handoff.
 */
export const MEAL_PREP_HOUR = 6;

/**
 * The kitchen work point: its hearth, else its work table, else the room
 * anchor. Undefined when the plan has no kitchen at all.
 */
function findKitchenStation(plan: BlueprintPlan): {
  level: number; roomId: number; furnishingIndex?: number;
} | undefined {
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (room.purpose !== 'kitchen') continue;
      const hearthIndex = furnishingIndexInRoom(floor, room.id, HEARTH_KINDS);
      const fi = hearthIndex >= 0
        ? hearthIndex
        : furnishingIndexInRoom(floor, room.id, TABLE_KINDS);
      return {
        level: floor.level,
        roomId: room.id,
        ...(fi >= 0 ? { furnishingIndex: fi } : {}),
      };
    }
  }
  return undefined;
}

/**
 * Who cooks: the first live-in servant, else the spouse, else the head, else
 * the first member. A stable scan over members in order — no RNG, and it
 * degrades sensibly for a one-person household.
 */
function findCookIndex(household: Household): number | undefined {
  const members = household.members;
  if (members.length === 0) return undefined;
  const byRole = (role: string): number => members.findIndex(
    (m) => m.role === role && m.ageBand !== 'child',
  );
  const servant = byRole('servant');
  if (servant >= 0) return servant;
  const spouse = byRole('spouse');
  if (spouse >= 0) return spouse;
  const head = byRole('head');
  if (head >= 0) return head;
  return 0;
}

/**
 * Where a live-in servant works during the day: the first service workstation
 * in the best-ranked service room, scanned in SERVICE_ROOM_PURPOSES order then
 * floor/room order. Undefined when the plan has no service room with a piece to
 * work at — the caller then keeps the historical meal-room-anchor placement, so
 * cramped houses behave exactly as they did before.
 */
function findServiceStation(plan: BlueprintPlan): {
  level: number; roomId: number; furnishingIndex: number;
} | undefined {
  for (const purpose of SERVICE_ROOM_PURPOSES) {
    for (const floor of plan.floors) {
      for (const room of floor.rooms) {
        if (room.purpose !== purpose) continue;
        const fi = furnishingIndexInRoom(floor, room.id, SERVICE_STATION_KINDS);
        if (fi >= 0) return { level: floor.level, roomId: room.id, furnishingIndex: fi };
      }
    }
  }
  return undefined;
}

/** Every furnishing index of `kinds` in a room, in stable furnishing order. */
function furnishingIndicesInRoom(
  floor: BlueprintFloor, roomId: number, kinds: ReadonlySet<string>,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < floor.furnishings.length; i++) {
    const fu = floor.furnishings[i];
    if (fu.roomId === roomId && kinds.has(fu.kind)) out.push(i);
  }
  return out;
}

/**
 * The public taproom and the seats in it, or undefined for a private building.
 * Seat pieces are preferred; a taproom with no bench seats its patrons at the
 * tables instead, and one with neither seats them on the room anchor.
 */
function findPublicRoom(plan: BlueprintPlan): {
  level: number; roomId: number; seatIndices: number[];
} | undefined {
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (room.purpose !== PUBLIC_ROOM_PURPOSE) continue;
      const seats = furnishingIndicesInRoom(floor, room.id, PATRON_SEAT_KINDS);
      const seatIndices = seats.length > 0
        ? seats
        : furnishingIndicesInRoom(floor, room.id, PATRON_TABLE_KINDS);
      return { level: floor.level, roomId: room.id, seatIndices };
    }
  }
  return undefined;
}

/**
 * Fill a public house's common room with evening patrons.
 *
 * RNG-FREE: the count comes from the seats the furnisher actually placed and
 * the names from a stable hash of the household's `homeId` plus the seat index,
 * so the same inn always draws the same crowd. Patrons occupy one seat each
 * (cycled when the room has fewer seats than the cap) and are absent — a plain
 * OUT row — outside the evening band, which keeps the visitor table the same
 * 24-row shape as the member table for every downstream consumer.
 */
function computeVisitors(
  plan: BlueprintPlan,
  household: Household,
): { visitors: BuildingVisitor[]; visitorStationsByHour: OccupantStation[][] } {
  const empty = {
    visitors: [] as BuildingVisitor[],
    visitorStationsByHour: Array.from({ length: 24 }, () => [] as OccupantStation[]),
  };
  const room = findPublicRoom(plan);
  // An abandoned public house has nobody to keep the taproom; a shut inn should
  // read as shut rather than staffing itself with strangers.
  if (!room || household.members.length === 0) return empty;

  const seatCount = room.seatIndices.length;
  const count = Math.min(
    MAX_COMMON_ROOM_VISITORS,
    Math.max(1, seatCount > 0 ? seatCount : 1),
  );

  const visitors: BuildingVisitor[] = [];
  for (let v = 0; v < count; v++) {
    const nameIndex = stableHash(`${household.homeId}:patron:${v}`) % PATRON_NAMES.length;
    visitors.push({ visitorIndex: v, name: PATRON_NAMES[nameIndex], ageBand: 'adult' });
  }

  const visitorStationsByHour: OccupantStation[][] = [];
  for (let hour = 0; hour < 24; hour++) {
    const inHouse = hour >= VISITOR_START_HOUR && hour <= VISITOR_END_HOUR;
    visitorStationsByHour.push(
      visitors.map((visitor) => {
        if (!inHouse) return outStation(visitor.visitorIndex, hour);
        const furnishingIndex = seatCount > 0
          ? room.seatIndices[visitor.visitorIndex % seatCount]
          : undefined;
        return homeStation(visitor.visitorIndex, hour, 'visiting', {
          level: room.level,
          roomId: room.roomId,
          furnishingIndex,
        });
      }),
    );
  }

  return { visitors, visitorStationsByHour };
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
  // Servants work at a real piece when the house has one. Falling back to the
  // meal room's anchor preserves the pre-existing placement exactly, so a
  // cramped home never regresses to no station at all.
  const service = findServiceStation(plan);
  // The kitchen would otherwise be a furnished room nobody ever enters; one
  // early-rising cook makes it a used room. See MEAL_PREP_HOUR.
  const kitchen = findKitchenStation(plan);
  const cookIndex = findCookIndex(household);
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
      const isServant = m.role === 'servant';
      const worksTrade = opts.worksAtHome && (m.role === 'head' || m.role === 'spouse');

      // The cook rises an hour early to work the kitchen. Placed BEFORE the
      // sleep band so it only ever replaces a sleeping station — never a work
      // or out slot the street simulation owns.
      if (hour === MEAL_PREP_HOUR && i === cookIndex && kitchen) {
        row.push(homeStation(i, hour, 'chores', kitchen));
        continue;
      }
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
        // Live-in servants remain visible doing household work in the shared
        // meal-room area; street-agent routing must not send them to a fake job.
        if (isServant) {
          row.push(homeStation(i, hour, 'chores',
            service ?? { level: meal.level, roomId: meal.roomId }));
          continue;
        }
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

  // Patrons are computed AFTER the family so the visitor pass can read the
  // finished plan but can never change a member's station or the hearth flags
  // above — a visiting crowd must not silently re-time a household's day.
  const { visitors, visitorStationsByHour } = computeVisitors(plan, household);

  return {
    claims,
    stationsByHour,
    visitors,
    visitorStationsByHour,
    flags: { abandoned: members.length === 0, hearthLitHours },
  };
}
