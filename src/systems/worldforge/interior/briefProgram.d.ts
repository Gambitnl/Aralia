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
import type { BuildingType, HouseholdBrief } from './blueprintTypes';
import { type ProgramSlot } from './program';
import { type TradeRoomDemand } from './tradeRooms';
/** Who shares one bedroom (the member slot tags). */
export interface BedroomAssignment {
    slotTags: string[];
}
export interface BriefProgram {
    /** Slots appended to the type's ground program (trade + wealth extras). */
    groundExtra: ProgramSlot[];
    /** Trade demands carrying placement constraints (streetFacing/adjacentTo). */
    tradeDemands: TradeRoomDemand[];
    /** Every bedroom the family needs, in assignment priority order. */
    bedrooms: BedroomAssignment[];
}
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
export declare function programForBrief(type: BuildingType, brief: HouseholdBrief): BriefProgram;
