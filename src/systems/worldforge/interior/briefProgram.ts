/**
 * @file briefProgram.ts — turn a HouseholdBrief into demanded rooms.
 *
 * Task 6 of the Building Generator v2. A pure, RNG-FREE mapping from a family
 * description to (a) extra ground-floor program slots (trade rooms + wealth
 * extras + a shared servant room) and (b) the bedroom list with sharing rules
 * applied, each bedroom tagged with the member slots that share it.
 *
 * The demand is a function of the family, not of luck: identical briefs yield
 * deep-equal outputs. All `groundExtra` slots are min === max (zero RNG draws)
 * so callers that never brief a building consume an unchanged program stream;
 * the wealthy counting-room is emitted deterministically as {min:1,max:1}
 * (see the plan constraint: "keep all extra slots min === max"), not the
 * {min:0,max:1} the spec sketch names.
 *
 * Sharing rules (the spec's, exactly):
 *   - head + spouse share bedroom 1.
 *   - children share 2 per room, grouped in tag order.
 *   - elders and kin get single rooms.
 *   - lodgers get single rooms, assigned LAST (so they land in attic/back
 *     positions when the placement consumes bedrooms).
 *   - servants get NO bedroom — they share one `servant-room` groundExtra slot
 *     emitted when any servant slots exist.
 */
import type { BuildingType, HouseholdBrief, RoomPurpose } from './blueprintTypes';
import { HEADLINE, type ProgramSlot } from './program';
import { tradeRoomsFor, type TradeRoomDemand } from './tradeRooms';

/** Who shares one bedroom (the member slot tags). */
export interface BedroomAssignment { slotTags: string[]; }

export interface BriefProgram {
  /** Slots appended to the type's ground program (trade + wealth extras). */
  groundExtra: ProgramSlot[];
  /** Trade demands carrying placement constraints (streetFacing/adjacentTo). */
  tradeDemands: TradeRoomDemand[];
  /** Every bedroom the family needs, in assignment priority order. */
  bedrooms: BedroomAssignment[];
}

/** A deterministic min===max slot (zero RNG draws). */
const fixedSlot = (purpose: RoomPurpose): ProgramSlot => ({ purpose, min: 1, max: 1 });

/**
 * Design the extra program and bedroom list for a briefed household.
 *
 * @param type the building type; its HEADLINE room already provides one
 *   purpose, so a trade demand for that same purpose is dropped as redundant
 *   (e.g. a smithy's main room IS the forge — a works-at-home blacksmith gets
 *   no second forge).
 * @param brief the family description.
 * @returns the extra ground slots, trade demands, and shared bedroom list.
 */
export function programForBrief(type: BuildingType, brief: HouseholdBrief): BriefProgram {
  // --- Trade rooms (only when the family runs THIS building). ---
  // Drop any demand the building's headline room already satisfies — the main
  // room provides that purpose, so a duplicate slot would double it up.
  const headline = HEADLINE[type];
  const tradeDemands: TradeRoomDemand[] = brief.worksAtHome
    ? tradeRoomsFor(brief.trade).filter((d) => d.purpose !== headline)
    : [];

  const groundExtra: ProgramSlot[] = [];
  // Trade rooms map into ground slots; their placement constraints ride
  // separately in tradeDemands for Task 7's placer.
  for (const demand of tradeDemands) groundExtra.push(fixedSlot(demand.purpose));

  // --- Wealth extras. ---
  if (brief.wealth === 'wealthy') {
    groundExtra.push(fixedSlot('solar'));
    // Deterministic (min===max) per the "zero extra draws" constraint — the
    // spec sketch's {min:0,max:1} would introduce an RNG draw.
    groundExtra.push(fixedSlot('counting-room'));
  }

  // --- Servants share ONE room (a ground slot, never a bedroom). ---
  if (brief.slots.some((s) => s.role === 'servant')) {
    groundExtra.push(fixedSlot('servant-room'));
  }

  // --- Bedrooms, in assignment priority order. ---
  const bedrooms: BedroomAssignment[] = [];

  // 1. head + spouse share bedroom 1 (either alone if the other is absent).
  const couple = brief.slots.filter((s) => s.role === 'head' || s.role === 'spouse').map((s) => s.tag);
  if (couple.length > 0) bedrooms.push({ slotTags: couple });

  // 2. children share 2 per room, grouped in tag order.
  const children = brief.slots.filter((s) => s.role === 'child').map((s) => s.tag);
  for (let i = 0; i < children.length; i += 2) {
    bedrooms.push({ slotTags: children.slice(i, i + 2) });
  }

  // 3. elders and kin get single rooms.
  for (const s of brief.slots) {
    if (s.role === 'elder' || s.role === 'kin') bedrooms.push({ slotTags: [s.tag] });
  }

  // 4. lodgers get single rooms LAST (they land in attic/back positions).
  for (const s of brief.slots) {
    if (s.role === 'lodger') bedrooms.push({ slotTags: [s.tag] });
  }

  return { groundExtra, tradeDemands, bedrooms };
}
