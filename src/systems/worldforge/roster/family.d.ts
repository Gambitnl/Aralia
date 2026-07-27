/**
 * @file family.ts — kinship + ages for a town roster.
 *
 * `generateTownRoster` groups occupants into households by home plot but says
 * nothing about who is related to whom. This pass adds it, deterministically:
 * every villager gets a concrete age, and households resolve into believable
 * families — a married couple with children, a single parent, siblings sharing a
 * roof. Whoever has NO close kin in town either has relatives in ANOTHER town or
 * is genuinely alone in the world. Pure: same roster + seed → identical families.
 */
import type { Occupant } from './types';
import { type SeedPath } from '../seedPath';
export type KinRelation = 'parent' | 'child' | 'sibling' | 'spouse' | 'cousin' | 'aunt/uncle';
/** A relative who lives in a DIFFERENT town (no presence in this roster). */
export interface DistantKin {
    town: string;
    relation: KinRelation;
    name: string;
}
/** One villager's age + family ties (ids reference fellow in-town occupants). */
export interface FamilyTies {
    occupantId: number;
    age: number;
    /** Ancestry (a `RACE_GROUPS` name). Blood relatives share it; a married-in
     *  spouse may differ — the only intra-family exception. */
    race: string;
    spouseId?: number;
    parentIds: number[];
    childIds: number[];
    siblingIds: number[];
    distantKin: DistantKin[];
    /** True when the villager has no known family anywhere — in town or beyond. */
    alone: boolean;
}
export declare const TOWNSFOLK_RACES: readonly string[];
/**
 * Resolve ages + family structure for a roster. Returns a map keyed by occupant
 * id. Deterministic over a sorted traversal so household decisions never depend
 * on input order.
 */
export declare function assignFamilies(occupants: Occupant[], seedPath: SeedPath): Map<number, FamilyTies>;
/** One-line family summary for UI, resolving in-town ids to names. */
export declare function familySummary(ties: FamilyTies, nameOf: (id: number) => string): string;
