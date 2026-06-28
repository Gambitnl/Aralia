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

/** Every 5 points over the DC adds one more resource-day. */
const MARGIN_STEP = 5;
/** A single forage attempt never yields more than this many resource-days. */
export const MAX_FORAGE_DAYS = 6;
/** Base time an attempt costs, before the biome's difficulty surcharge. */
const FORAGE_BASE_MINUTES = 180;
/** Extra minutes per point of DC (harsher ground takes longer to work). */
const FORAGE_MINUTES_PER_DC = 6;

/**
 * Forage profiles keyed by FMG biome name (see fmg/biomes.ts). Forest/grassland
 * forgiving, desert/glacier harsh; tropics and wetland are abundant but more
 * hazardous (toxic plants, spoilage, disease).
 */
const BIOME_FORAGE_PROFILES: Record<string, ForageProfile> = {
  'Marine': { foodDC: 13, waterDC: 19, foodAbundance: 2, waterAbundance: 0, hazardThreshold: 2 },
  'Hot desert': { foodDC: 18, waterDC: 20, foodAbundance: 1, waterAbundance: 1, hazardThreshold: 5 },
  'Cold desert': { foodDC: 17, waterDC: 16, foodAbundance: 1, waterAbundance: 1, hazardThreshold: 4 },
  'Savanna': { foodDC: 12, waterDC: 14, foodAbundance: 2, waterAbundance: 2, hazardThreshold: 3 },
  'Grassland': { foodDC: 11, waterDC: 13, foodAbundance: 3, waterAbundance: 2, hazardThreshold: 2 },
  'Tropical seasonal forest': { foodDC: 10, waterDC: 11, foodAbundance: 3, waterAbundance: 3, hazardThreshold: 3 },
  'Temperate deciduous forest': { foodDC: 10, waterDC: 10, foodAbundance: 3, waterAbundance: 3, hazardThreshold: 2 },
  'Tropical rainforest': { foodDC: 9, waterDC: 9, foodAbundance: 4, waterAbundance: 4, hazardThreshold: 4 },
  'Temperate rainforest': { foodDC: 10, waterDC: 9, foodAbundance: 3, waterAbundance: 4, hazardThreshold: 2 },
  'Taiga': { foodDC: 13, waterDC: 11, foodAbundance: 2, waterAbundance: 3, hazardThreshold: 2 },
  'Tundra': { foodDC: 16, waterDC: 13, foodAbundance: 1, waterAbundance: 2, hazardThreshold: 3 },
  'Glacier': { foodDC: 19, waterDC: 14, foodAbundance: 0, waterAbundance: 2, hazardThreshold: 4 },
  'Wetland': { foodDC: 11, waterDC: 10, foodAbundance: 3, waterAbundance: 3, hazardThreshold: 4 },
};

/** A middling profile for unmapped biome names (keeps the loop honest, never 0-DC). */
const DEFAULT_FORAGE_PROFILE: ForageProfile = {
  foodDC: 13, waterDC: 13, foodAbundance: 2, waterAbundance: 2, hazardThreshold: 3,
};

/** Forage profile for a biome name, falling back to a sane default when unknown. */
export function forageProfileForBiome(biome: string): ForageProfile {
  return BIOME_FORAGE_PROFILES[biome] ?? DEFAULT_FORAGE_PROFILE;
}

/**
 * Resource-days a clean success yields: base abundance + one day per `MARGIN_STEP`
 * points of margin + a party-size bonus (more foragers gather more), floored at
 * one day (a success always finds *something*) and capped at `MAX_FORAGE_DAYS`.
 */
export function computeForageYield(margin: number, abundance: number, partySize: number): number {
  const marginDays = Math.floor(Math.max(0, margin) / MARGIN_STEP);
  const partyBonus = Math.floor(Math.max(0, partySize) / 2);
  const raw = abundance + marginDays + partyBonus;
  return Math.min(MAX_FORAGE_DAYS, Math.max(1, raw));
}

/**
 * Pure forage resolution from the two pre-rolled dice. `d20` drives the Survival
 * check; `hazardRoll` (also a d20) drives the bad-forage hazard. A tripped hazard
 * yields nothing — a poisonous/spoiled find on a success ("tainted"), or a bad
 * outing on a failure ("wasted").
 */
export function resolveForage(
  d20: number,
  hazardRoll: number,
  attempt: ForageAttempt,
  profile: ForageProfile,
): ForageOutcome {
  const water = attempt.resource === 'water';
  const dc = water ? profile.waterDC : profile.foodDC;
  const abundance = water ? profile.waterAbundance : profile.foodAbundance;
  const total = d20 + attempt.survivalModifier;
  const success = total >= dc;
  const margin = total - dc;
  const hazardTripped = hazardRoll <= profile.hazardThreshold;

  let resourceDaysGained = 0;
  let hazard: ForageHazard | null = null;
  if (hazardTripped) {
    hazard = success ? 'tainted' : 'wasted';
  } else if (success) {
    resourceDaysGained = computeForageYield(margin, abundance, attempt.partySize);
  }

  return {
    resource: attempt.resource,
    resourceDaysGained,
    timeCostMinutes: FORAGE_BASE_MINUTES + dc * FORAGE_MINUTES_PER_DC,
    hazard,
    check: { d20, total, dc, success, margin },
  };
}

/**
 * Roll and resolve a forage attempt. Rolls the Survival d20 first, then the
 * hazard d20 (fixed order for deterministic replay), against the biome's profile.
 */
export function forage(attempt: ForageAttempt, rng: SeededRandom): ForageOutcome {
  const d20 = rng.nextInt(1, 21);
  const hazardRoll = rng.nextInt(1, 21);
  return resolveForage(d20, hazardRoll, attempt, forageProfileForBiome(attempt.biome));
}
