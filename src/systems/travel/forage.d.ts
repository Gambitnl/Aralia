/**
 * @file forage.ts — biome-yield forage loop (travel provisioning R2).
 *
 * Foraging en route is a real survival sub-loop, not a flat offset: a Survival
 * (Wisdom) check is rolled against a biome-yield DC; on success it returns
 * `0..N` resource-days scaled by the margin and the party size, at a time cost,
 * with a bad-forage hazard roll (a poisonous/spoiled find, or a wasted outing).
 * Food and water share the mechanic against per-biome food/water profiles.
 *
 * The yield + hazard math is a PURE core (`resolveForage` takes the two dice as
 * arguments) so it is exhaustively unit-testable without seed-guessing; `forage`
 * just rolls a d20 for the check and a d20 for the hazard, then delegates. No
 * React, no game-state mutation — the caller applies the result (add resource
 * days, advance time, apply a condition on a tainted find).
 */
import type { SeededRandom } from '@/utils/random';
import type { ProvisionResource } from './provisioning';
/** Per-biome forage difficulty + abundance for each resource. */
export interface ForageProfile {
    /** Survival DC to find food here (lower = easier). */
    foodDC: number;
    /** Survival DC to find drinkable water here. */
    waterDC: number;
    /** Resource-days a clean (margin-0) success yields for food. */
    foodAbundance: number;
    /** Resource-days a clean success yields for water. */
    waterAbundance: number;
    /**
     * Bad-forage hazard threshold: a separate d20 hazard roll at or below this
     * trips a hazard (poisonous/spoiled find on a success, a bad outing on a
     * failure). Lush/toxic and barren/dangerous biomes run higher.
     */
    hazardThreshold: number;
}
/** What a forage attempt knows about its situation (the caller resolves these). */
export interface ForageAttempt {
    resource: ProvisionResource;
    /** FMG biome name at the foraging location (e.g. "Hot desert"). */
    biome: string;
    /** Number of able foragers (the party); more hands gather more. */
    partySize: number;
    /** The best forager's Survival check modifier (ability + proficiency). */
    survivalModifier: number;
}
/** A bad-forage outcome the caller turns into a condition / lost time. */
export type ForageHazard = 'tainted' | 'wasted';
export interface ForageOutcome {
    resource: ProvisionResource;
    /** Resource-days actually gathered (0 on failure or hazard). */
    resourceDaysGained: number;
    /** Minutes the attempt consumed (slows the day even when it fails). */
    timeCostMinutes: number;
    /** A bad-forage hazard, or null. */
    hazard: ForageHazard | null;
    check: {
        d20: number;
        /** d20 + survival modifier. */
        total: number;
        dc: number;
        success: boolean;
        /** total − dc (negative on a failure). */
        margin: number;
    };
}
/** A single forage attempt never yields more than this many resource-days. */
export declare const MAX_FORAGE_DAYS = 6;
/** Forage profile for a biome name, falling back to a sane default when unknown. */
export declare function forageProfileForBiome(biome: string): ForageProfile;
/**
 * Resource-days a clean success yields: base abundance + one day per `MARGIN_STEP`
 * points of margin + a party-size bonus (more foragers gather more), floored at
 * one day (a success always finds *something*) and capped at `MAX_FORAGE_DAYS`.
 */
export declare function computeForageYield(margin: number, abundance: number, partySize: number): number;
/**
 * Pure forage resolution from the two pre-rolled dice. `d20` drives the Survival
 * check; `hazardRoll` (also a d20) drives the bad-forage hazard. A tripped hazard
 * yields nothing — a poisonous/spoiled find on a success ("tainted"), or a bad
 * outing on a failure ("wasted").
 */
export declare function resolveForage(d20: number, hazardRoll: number, attempt: ForageAttempt, profile: ForageProfile): ForageOutcome;
/**
 * Roll and resolve a forage attempt. Rolls the Survival d20 first, then the
 * hazard d20 (fixed order for deterministic replay), against the biome's profile.
 */
export declare function forage(attempt: ForageAttempt, rng: SeededRandom): ForageOutcome;
