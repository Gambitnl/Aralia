/**
 * @file constants.ts — Living-world town sim tuning constants.
 *
 * Part of the life-event core (LIVING_WORLD_SIM_SPEC.md §5 item 1). Pure data,
 * no behaviour. See lifespans.ts for the per-race curves these feed.
 */

/**
 * Days per game year for sim age math. The game calendar is Date-based
 * (~365.25 days/yr); the sim uses a fixed 365 for deterministic integer age
 * arithmetic (bornDay → age). Approximation is intentional and documented.
 */
export const DAYS_PER_YEAR = 365;

/** Tiny baseline daily death chance in youth (illness / accident). */
export const BASELINE_DAILY_DEATH = 0.00002;

/** Max number of children a couple will produce in the sim. */
export const MAX_CHILDREN = 6;

/** Annual probability a fertile married couple produces a child. */
export const ANNUAL_BIRTH_CHANCE = 0.22;

/**
 * How many years of chronicle to retain. Old events (and dead villagers no
 * longer connected to the living) beyond this window are pruned to bound save
 * size — readers only look back ~2–3 years, and cumulative totals survive
 * pruning for invariants. Comfortably above the backstory backfill (3y).
 */
export const RETENTION_YEARS = 6;

/** Baseline starting wealth meter for a pre-existing adult villager. */
export const BASELINE_WEALTH = 50;

/** Annual probability an eligible single villager begins a courtship. */
export const ANNUAL_COURTSHIP_CHANCE = 0.4;

/** Days a couple courts before marrying (affinity grows over the courtship). */
export const COURTSHIP_DAYS = 200;
