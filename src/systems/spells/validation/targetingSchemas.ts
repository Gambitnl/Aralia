// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/06/2026, 22:13:38
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';

/**
 * This file owns the Zod schemas for spell targeting.
 *
 * The main spell validator had grown into a single large file where each new
 * spell-mechanics bucket made targeting, effects, and top-level spell identity
 * harder to review together. This module keeps the targeting vocabulary in one
 * place while `spellValidator.ts` continues to compose the full spell schema.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or class data.
 */

// ============================================================================
// Targeting Units And Geometry
// ============================================================================
// This section defines the shared measurement vocabulary used by targeting.
// Keeping it near the targeting schemas makes future range/area migrations easier
// to review without touching unrelated effect validators.
// ============================================================================

const DistanceUnit = z.enum(["feet", "miles", "inches"]);
const SpatialMeasuredUnit = z.enum(["feet", "miles", "inches", "gallons", "minutes"]);
// `square` preserves spells that define a total covered floor area, such as
// Forbiddance, instead of forcing that value into an edge-length geometry.
const GeometrySizeType = z.enum(["radius", "diameter", "length", "edge", "side", "square"]);

// ============================================================================
// Area And Spatial Details
// ============================================================================
// These schemas preserve the footprint and placement facts that battle-map and
// spell-review tools need. They are separate from effect data: an area can exist
// even when the spell's actual damage, status, or utility effects are modeled
// elsewhere in the full spell schema.
// ============================================================================

const ScalableNumber = z.union([
  z.number(),
  // Some spell prose says "any number" rather than giving a finite cap. Keep
  // that as an explicit sentinel so runtime data does not rely on a fake number.
  z.literal("unlimited"),
  z.object({
    base: z.number(),
    scaling: z.object({
      type: z.enum(["character_level", "slot_level"]),
      thresholds: z.record(z.string(), z.number()), // e.g. {"5": 2, "11": 3, "17": 4}
    }),
  }),
]);

const TargetingAreaOfEffect = z.object({
  // Extended shape enum includes Circle because some spells affect a flat ground
  // footprint rather than a full sphere. Earthquake is the current Range/Area
  // driver: its rules text says "100-foot-radius circle", so the runtime JSON
  // needs a truthful shape instead of pretending the effect is spherical.
  shape: z.enum([
    "Cone", "Cube", "Cylinder", "Line", "Sphere", "Square",
    "Circle", "Emanation", "Wall", "Hemisphere", "Ring",
  ]),
  size: z.number(),
  sizeType: GeometrySizeType.optional(),
  sizeUnit: DistanceUnit.optional(),
  height: z.number().optional(),
  heightUnit: DistanceUnit.optional(),

  // Extended semantics (optional, shape-dependent)
  followsCaster: z.boolean().optional(),
  thickness: z.number().optional(),
  thicknessUnit: DistanceUnit.optional(),
  width: z.number().optional(),
  widthUnit: DistanceUnit.optional(),

  shapeVariant: z.object({
    options: z.array(z.enum(["Line", "Ring", "Hemisphere", "Sphere"])),
    default: z.string(),
  }).optional(),

  wallStats: z.object({
    ac: z.number(),
    hpPerSection: z.number(),
    sectionSize: z.number(),
  }).optional(),

  triggerZone: z.object({
    triggerDistance: z.number().optional(),
    triggerSide: z.enum(["one", "both", "inside"]).optional(),
  }).optional(),
});

const SpatialForm = z.object({
  label: z.string().optional(),
  shape: z.string(),
  size: z.number().optional(),
  sizeType: GeometrySizeType.optional(),
  sizeUnit: DistanceUnit.optional(),
  height: z.number().optional(),
  heightUnit: DistanceUnit.optional(),
  width: z.number().optional(),
  widthUnit: DistanceUnit.optional(),
  thickness: z.number().optional(),
  thicknessUnit: DistanceUnit.optional(),
  segmentCount: z.number().optional(),
  segmentWidth: z.number().optional(),
  segmentWidthUnit: DistanceUnit.optional(),
  segmentHeight: z.number().optional(),
  segmentHeightUnit: DistanceUnit.optional(),
  notes: z.string().optional(),
});

const SpatialMeasuredDetail = z.object({
  label: z.string(),
  kind: z.enum([
    "blocker",
    "opening",
    "diameter",
    "thickness",
    "depth",
    "size_change",
    "distance",
    "count",
    "volume",
    "time",
    "special",
  ]),
  subject: z.string().optional(),
  value: z.number().optional(),
  // Some pulled-apart spatial facts are not pure distances. Risky spells like
  // Create or Destroy Water and Bones of the Earth need gallons and minutes to
  // stay explicit instead of getting pushed back into prose-only notes.
  unit: SpatialMeasuredUnit.optional(),
  qualifier: z.string().optional(),
  notes: z.string().optional(),
});

const SpatialDetails = z.object({
  forms: z.array(SpatialForm).optional(),
  measuredDetails: z.array(SpatialMeasuredDetail).optional(),
});

// ============================================================================
// Target Eligibility
// ============================================================================
// These schemas describe what can be chosen before a spell resolves. They are
// intentionally distinct from effect conditions, which decide whether a specific
// effect applies after targets have already been selected.
// ============================================================================

const ValidTargetType = z.enum([
  "self", "creatures", "allies", "enemies", "objects", "point", "ground",
]);

const TargetWillingness = z.enum([
  "required",
  "not_applicable",
]);

const TargetObjectEligibility = z.object({
  // Object restrictions belong beside the other target filters. A spell can
  // target "objects" broadly while still needing runtime checks for worn,
  // carried, magical, fixed, size, or weight constraints.
  wornOrCarried: z.enum(["excluded", "not_applicable"]),
  magicalStatus: z.enum(["any", "nonmagical", "not_applicable"]),
  fixedToSurface: z.enum(["excluded", "not_applicable"]),
  maxSize: z.string(),
  maxWeightPounds: z.union([z.number(), z.literal("not_applicable")]),
  maxWeightScaling: z.string(),
});

const TargetCommunicationPrerequisites = z.object({
  // Some enchantments and message-like spells only work when the target can
  // perceive or understand the caster. These are target eligibility gates, not
  // line-of-sight geometry, so they live beside the other target filters.
  canHearCaster: z.enum(["required", "not_applicable"]),
  canUnderstandCaster: z.enum(["required", "not_applicable"]),
  canSeeCaster: z.enum(["required", "not_applicable"]),
});

const TargetAbilityThreshold = z.object({
  // Some spells exclude targets by ability score before the main effect ever
  // resolves. Keeping that rule in targeting prevents it from being mistaken for
  // an attack/save modifier or buried in description prose.
  ability: z.enum(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma", "not_applicable"]),
  operator: z.enum(["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "not_applicable"]),
  value: z.union([z.number(), z.literal("not_applicable")]),
});

const TargetSelfRelation = z.enum([
  "must_be_self",
  "must_be_other",
  "self_allowed",
  "not_applicable",
]);

const TargetPlacementEligibility = z.object({
  unoccupied: z.enum(["required", "not_applicable"]).optional(),
  surface: z.enum(["ground", "liquid", "any_solid", "not_applicable"]).optional(),
  destination: z.enum(["safest_nearby", "nearest_unoccupied", "caster_choice", "not_applicable"]).optional(),
  notes: z.string().optional(),
});

const TargetSpecialIdentity = z.object({
  corpseOrRemains: z.enum(["required", "not_applicable"]).optional(),
  reactionTriggeringCreature: z.enum(["required", "not_applicable"]).optional(),
  summonedByCaster: z.enum(["required", "not_applicable"]).optional(),
  notes: z.string().optional(),
});

export const TargetConditionFilter = z.object({
  // Target willingness is a targeting gate, not a target category. Keeping it
  // here lets willing-creature spells stay `creatures` while still preserving
  // the consent requirement for runtime targeting and later UI prompts.
  willing: TargetWillingness,
  objectEligibility: TargetObjectEligibility,
  placementEligibility: TargetPlacementEligibility.optional(),
  specialIdentity: TargetSpecialIdentity.optional(),
  communicationPrerequisites: TargetCommunicationPrerequisites,
  abilityThreshold: TargetAbilityThreshold,
  selfRelation: TargetSelfRelation,
  creatureTypes: z.array(z.string()),
  excludeCreatureTypes: z.array(z.string()),
  sizes: z.array(z.string()),
  alignments: z.array(z.string()),
  hasCondition: z.array(z.string()),
  isNativeToPlane: z.boolean(),
});

const AreaTargetSelection = z.object({
  // Area targeting and selected targets are separate mechanics. Fireball hits
  // all valid creatures in its area; Word of Radiance and Sleep let the caster
  // choose affected creatures inside the footprint. This keeps that exclusion
  // rule out of prose and avoids misusing `maxTargets` as a fake area cap.
  mode: z.enum(["all_valid_targets", "caster_choice", "random", "not_applicable"]),
  scope: z.enum(["creatures_in_area", "not_applicable"]),
  count: z.union([z.number(), z.literal("all_chosen"), z.literal("not_applicable")]),
  excludesUnchosen: z.boolean(),
  requiresLineOfSight: z.boolean().optional(),
  notes: z.string().optional(),
});

const TargetAllocationScaling = z.object({}).passthrough();

const TargetAllocation = z.object({
  // Allocation is the final pass after normal target eligibility. It exists for
  // spells whose affected set is not just "every valid candidate", such as a
  // rolled pool that spends itself across eligible creatures.
  type: z.enum(["all", "pool", "random", "choice"]),
  pool: z.object({
    // Pool allocation keeps the resource, dice, and ordering explicit so the
    // runtime allocator can select targets without rereading spell prose.
    resource: z.enum(["hp", "hit_dice"]),
    dice: z.string(),
    sortOrder: z.enum(["ascending", "descending"]),
    strictLimit: z.boolean().optional(),
    // Scaling formulas live in the broader spell contract. The targeting
    // validator intentionally allows the object through here so future data can
    // preserve the formula before the allocator's dice builder catches up.
    scaling: TargetAllocationScaling.optional(),
  }).optional(),
});

const TargetInstanceAllocation = z.object({
  // Magic Missile creates several assignable units that are not the same as
  // several independent spell casts. Keeping this in targeting preserves how the
  // caster distributes those units without forcing the damage effect to become
  // three hard-coded copies.
  instanceType: z.enum(["dart", "beam", "ray", "projectile", "light", "animated_tree", "controlled_undead", "not_applicable"]),
  baseCount: z.union([z.number(), z.literal("not_applicable")]),
  scalingRule: z.string().optional(),
  assignment: z.enum(["same_or_different_targets", "unique_targets", "single_target_only", "independent_positions", "not_applicable"]),
  resolution: z.enum(["simultaneous", "sequential", "persistent", "not_applicable"]),
  notes: z.string().optional(),
});

const TargetCluster = z.object({
  // Intellect Fortress-style scaling lets a spell affect more targets only
  // when every selected creature is close enough to the others. This keeps the
  // mutual-distance rule as targeting data instead of hiding it in scaling text.
  requirement: z.enum(["required", "not_applicable"]),
  maxDistance: z.union([z.number(), z.literal("not_applicable")]),
  distanceUnit: z.union([DistanceUnit, z.literal("not_applicable")]),
  scope: z.enum(["all_targets", "not_applicable"]),
  notes: z.string().optional(),
});

const PerTargetChoice = z.object({
  // Enhance Ability is the pilot: every selected target can receive a separate
  // ability choice when the spell is cast with a higher-level slot.
  choiceType: z.enum(["ability", "not_applicable"]),
  scope: z.enum(["each_target", "not_applicable"]),
  options: z.array(z.string()),
  differentChoicesAllowed: z.boolean(),
  required: z.boolean(),
  notes: z.string().optional(),
});

const TargetParticipation = z.object({
  // Prayer of Healing is the pilot for long-casting participation: the targets
  // are chosen, but they only qualify if they stay within range until the
  // ten-minute casting is complete.
  requiresWithinRangeForFullCasting: z.union([z.boolean(), z.literal("not_applicable")]),
  notes: z.string().optional(),
});

// ============================================================================
// Full Targeting Shape
// ============================================================================
// This is the runtime targeting block used by every spell JSON file. It combines
// where the spell can be aimed, what targets are valid, optional area geometry,
// and selected-area targeting rules.
// ============================================================================

export const Targeting = z.object({
  type: z.enum(["self", "single", "multi", "area", "melee", "ranged", "point"]),
  range: z.number(),
  rangeUnit: DistanceUnit.optional(),
  maxTargets: ScalableNumber,
  validTargets: z.array(ValidTargetType),
  lineOfSight: z.boolean(),
  // Non-area spells should not need to carry a fake zero-size Sphere just to
  // satisfy the validator. Area-targeted spells are still checked by the
  // stricter template audit so real area geometry remains required where it
  // matters.
  areaOfEffect: TargetingAreaOfEffect.optional(),
  filter: TargetConditionFilter,
  spatialDetails: SpatialDetails.optional(),
  // Legacy fields (deprecated, use areaOfEffect instead - keeping optional for backwards compat during migration if needed, but script backfilled them)
  shape: z.enum(["sphere", "cone", "cube", "line", "cylinder"]).optional(),
  radius: z.number().optional(),
  areaTargetSelection: AreaTargetSelection.optional(),
  // Allocation is separate from area selection: the area or UI picks the
  // candidate list first, then allocation decides which valid candidates are
  // actually affected.
  allocation: TargetAllocation.optional(),
  instanceAllocation: TargetInstanceAllocation.optional(),
  targetCluster: TargetCluster.optional(),
  perTargetChoice: PerTargetChoice.optional(),
  targetParticipation: TargetParticipation.optional(),
});
