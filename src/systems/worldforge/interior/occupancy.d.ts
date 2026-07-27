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
 *     room claims the MAIN room — the visible-misfit rule. Named servants share
 *     the purpose-built servant room even though ground program slots do not
 *     carry bedroom-style `forSlot` tags.
 *   - STATIONS: a fixed medieval day per member, a deterministic scan (no RNG):
 *     sleep 22–06 at the claimed room's bed; meals 07 & 18 at the largest table
 *     in the kitchen/main room; work 08–17 (worksAtHome heads/spouses at the
 *     trade room's workstation, everyone else `out`); children alternate
 *     chores/out by day; servants serve meals and do daytime household chores;
 *     evenings 19–21 hearthside; the rest home idle.
 *   - FLAGS: abandoned (zero members) and the 24-hour hearth-lit schedule.
 *
 * Determinism: identical (plan, household) always yields identical occupancy —
 * every pick is a stable scan in furnishing/room order.
 */
import type { BlueprintPlan } from './blueprintTypes';
import type { Household } from '../town/household';
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
    flags: {
        abandoned: boolean;
        hearthLitHours: boolean[];
    };
}
export declare const HEARTH_KINDS: Set<string>;
/**
 * Compute the living overlay for a building: room claims, an hourly station per
 * member, and the abandoned/hearth-lit flags. RNG-FREE and deterministic.
 */
export declare function computeOccupancy(plan: BlueprintPlan, household: Household, opts: {
    worksAtHome: boolean;
}): BuildingOccupancy;
