/**
 * @file thresholds.ts — the numbers the placement refinement loop judges by.
 *
 * Method source: arXiv 2608.05248 ("WorldClaw", Tencent Hunyuan). The paper
 * specifies the LOOP — score, correct, re-score, stop at a budget — and calls
 * every threshold implementation-dependent. So every number below is a choice
 * made here, and every number carries the reason it holds that value.
 *
 * Units: FEET. Worldforge is feet-canon (units.ts). No meters appear here.
 */

/** One D&D combat cell in feet. Mirrors units.ts CELL_FT; kept local for clarity. */
const CELL_FT = 5;

/**
 * The judged thresholds. One struct so a surface can carry its own profile
 * (a battle map is stricter than a 25,000 ft region) without forking the code.
 */
export interface PlacementThresholds {
  /**
   * Vertical distance from ground at which a footprint sample counts as
   * TOUCHING.
   *
   * 0.25 ft = 3 inches = 5% of a combat cell. A 3 in gap under a crate is
   * below the pixel budget of the closest camera the game uses (chest height,
   * ~6 ft away). Tighter than this and honest terrain tessellation noise on a
   * 5 ft grid starts to fail placements that look perfect.
   */
  contactToleranceFt: number;

  /**
   * Fraction of footprint samples that must touch. Below this the object is a
   * FLOATER.
   *
   * 0.6 = a clear majority. Real ground is rutted, so a barrel on soil
   * legitimately meets it over about two thirds of its base. Demanding 0.9
   * would fail correct placements on any non-flat pad; accepting 0.4 lets an
   * object balance on one corner and still pass.
   */
  minContactRatio: number;

  /**
   * Deepest allowed ground intrusion of the object's lower hull. Above this
   * the object is SUNKEN.
   *
   * 0.5 ft = 6 inches = one wagon rut. Props legitimately bed into soil by a
   * few inches, and a rock reads WRONG when it sits perfectly on the surface.
   * Past 6 in the base of a crate disappears and the object reads as buried.
   */
  maxPenetrationFt: number;

  /**
   * Highest allowed variance of ground slope under the footprint, rad^2.
   * Above this the ground CANNOT HOLD the object.
   *
   * 0.03 rad^2 = a standard deviation of 0.173 rad = 9.9 degrees. A rigid flat
   * base spanning a 10 degree spread of slope already lifts one corner by more
   * than the 3 in contact tolerance on an M-class footprint. So 0.03 is the
   * exact point where the contact check and the support check agree.
   */
  maxSupportSlopeVarianceRad2: number;

  /**
   * Fractional slack on a species' expected height range before SCALE fails.
   *
   * 0.15 = the same +/-15% the prop schema already grants seed-derived scale
   * jitter (propSchema.ts: "uniform scale multiplier, ~0.85..1.15"). Anything
   * inside the jitter band the generator itself produces must not be called a
   * scale error.
   */
  scaleSlack: number;

  /**
   * Most ground the corrector may move in ONE iteration, feet.
   *
   * 1 ft = one fifth of a combat cell. A single large co-deformation tears the
   * normals of the patch it writes and produces a visible cliff at the feather
   * edge. Moving in 1 ft steps keeps the surface continuous and forces a
   * re-score between steps, so overshoot is caught instead of shipped.
   */
  maxGroundLiftPerIterationFt: number;

  /**
   * Iteration budget per instance.
   *
   * 6 = two full Phase A + Phase B cycles, plus a margin of two. A transform
   * correction converges in 1 iteration on flat ground and 2 on slope; a
   * ground co-deformation needs 1 more. 6 therefore clears every case the
   * loop CAN fix, and bounds a 2,000 instance town scene to 12,000 scoring
   * passes, which stays inside a single frame budget of headless work.
   */
  iterationBudget: number;
}

/**
 * The default profile. Tuned for the town surface, which holds the tightest
 * mix of hand-authored pads and generated ground.
 */
export const DEFAULT_THRESHOLDS: PlacementThresholds = {
  contactToleranceFt: 0.25,
  minContactRatio: 0.6,
  maxPenetrationFt: 0.5,
  maxSupportSlopeVarianceRad2: 0.03,
  scaleSlack: 0.15,
  maxGroundLiftPerIterationFt: 1,
  iterationBudget: 6,
};

/**
 * Battle map profile — the player stands 5 ft from every prop here, so the
 * contact tolerance halves to 1.5 in and the contact ratio rises to 0.75.
 * The budget rises to 8 because a battle map holds tens of instances, not
 * thousands, so extra iterations cost nothing.
 */
export const BATTLEMAP_THRESHOLDS: PlacementThresholds = {
  ...DEFAULT_THRESHOLDS,
  contactToleranceFt: 0.125,
  minContactRatio: 0.75,
  maxPenetrationFt: 0.35,
  iterationBudget: 8,
};

/**
 * Region profile — instances sit hundreds of feet from the camera and the
 * heightfield itself is coarse. The tolerance widens to 1 ft (one fifth of a
 * cell) and the contact ratio drops to 0.5, because a distant tree on real
 * relief cannot meet a 3 in bar and does not need to. The budget drops to 4
 * because a region scatter holds tens of thousands of instances.
 */
export const REGION_THRESHOLDS: PlacementThresholds = {
  ...DEFAULT_THRESHOLDS,
  contactToleranceFt: 1,
  minContactRatio: 0.5,
  maxPenetrationFt: 1.5,
  maxSupportSlopeVarianceRad2: 0.06,
  iterationBudget: 4,
};

/** Town profile — the default. Named so call sites read alike on all three surfaces. */
export const TOWN_THRESHOLDS: PlacementThresholds = DEFAULT_THRESHOLDS;

/**
 * Expected upright height range per species/prop key, FEET.
 *
 * Creature rows copy `SIZE_HEIGHT_FT` in entities3d/creatureProfiles.ts, the
 * value the entity generator already builds to, with a +/-40% band because a
 * quadruped carries its height at the shoulder and a serpent barely rises.
 * Prop rows copy the strawman catalog's size classes: an S prop fits one 5 ft
 * cell, an M prop spans up to two, an L prop spans three or more.
 */
export interface SpeciesHeightRange {
  minFt: number;
  maxFt: number;
}

export const DEFAULT_HEIGHT_RANGES: Readonly<Record<string, SpeciesHeightRange>> = Object.freeze({
  // Creature size categories (entities3d/creatureProfiles.ts nominals).
  Tiny: { minFt: 0.9, maxFt: 2.1 },
  Small: { minFt: 1.8, maxFt: 4.2 },
  Medium: { minFt: 3.3, maxFt: 7.7 },
  Large: { minFt: 5.4, maxFt: 12.6 },
  Huge: { minFt: 9, maxFt: 21 },
  Gargantuan: { minFt: 15, maxFt: 35 },
  // Prop size classes (props/propSchema.ts PropSizeClass).
  'prop-S': { minFt: 0.5, maxFt: CELL_FT },
  'prop-M': { minFt: CELL_FT * 0.5, maxFt: CELL_FT * 2 },
  'prop-L': { minFt: CELL_FT, maxFt: CELL_FT * 6 },
});
