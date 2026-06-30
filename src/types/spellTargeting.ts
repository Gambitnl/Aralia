// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 03:48:26
 * Dependents: types/spells.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file describes how spells choose places, creatures, objects, and areas.
 *
 * It exists because `spells.ts` had become the single review surface for every
 * spell concept. Targeting now changes often during the mechanics-closure work,
 * so this file keeps target geometry, target counts, and target-instance rules
 * in one place while `spells.ts` remains the public spell contract.
 *
 * Called by: `spells.ts` for public re-exports and any future targeting helpers.
 * Depends on: a few effect-side types from `spells.ts` that are shared across
 * targeting and effect resolution.
 */

import type { ScalingFormula, TargetConditionFilter } from './spells';

//==============================================================================
// Range And Units
//==============================================================================
// These types preserve the spell's measured reach and the units attached to
// spatial facts. Most values are feet today, but keeping the unit explicit stops
// future mile, inch, gallon, or minute mechanics from being flattened into prose.
//==============================================================================

/** Defines the spell's effective range. */
export type DistanceUnit = "feet" | "miles" | "inches";

/**
 * Extra unit choices for measured spatial facts that are not always pure
 * distances.
 */
export type SpatialMeasuredUnit = DistanceUnit | "gallons" | "minutes";

/**
 * This spell-range shape supports explicit measurement units instead of assuming
 * every numeric distance is in feet.
 */
export interface Range {
  type: "self" | "touch" | "ranged" | "special" | "sight" | "unlimited";
  distance: number;
  distanceUnit?: DistanceUnit;
}

//==============================================================================
// Counts And Scaling
//==============================================================================
// Target counts can be fixed, level-scaled, or genuinely unlimited. These helpers
// keep those three meanings distinct for runtime targeting and UI prompts.
//==============================================================================

/**
 * A number-like spell count used for targets and other scalable spell facts.
 */
export type ScalableNumber = number | "unlimited" | ScalableNumberObject;

/** Object form of ScalableNumber with explicit scaling thresholds. */
export interface ScalableNumberObject {
  base: number;
  scaling: {
    type: "character_level" | "slot_level";
    /** Maps level thresholds to values. E.g., { "1": 1, "5": 2 }. */
    thresholds: Record<string, number>;
  };
}

/**
 * Resolves a scalable target count to the number the engine can compare.
 */
export function resolveScalableNumber(value: ScalableNumber, level: number): number {
  // Unlimited counts become Infinity so callers can compare capacity without a
  // fake finite cap such as 999.
  if (value === "unlimited") {
    return Number.POSITIVE_INFINITY;
  }

  // Fixed counts do not need any threshold lookup.
  if (typeof value === 'number') {
    return value;
  }

  // Thresholds are sorted from highest to lowest so the first eligible threshold
  // is the active value for this cast.
  const thresholds = value.scaling.thresholds;
  const sortedThresholds = Object.keys(thresholds)
    .map(k => parseInt(k, 10))
    .sort((a, b) => b - a);

  for (const threshold of sortedThresholds) {
    if (level >= threshold) {
      return thresholds[threshold.toString()];
    }
  }

  // If no threshold applies, the base count is the correct low-level value.
  return value.base;
}

/**
 * Type guard for callers that need to distinguish fixed counts from threshold
 * tables before rendering or editing the value.
 */
export function isScalableNumberObject(value: ScalableNumber): value is ScalableNumberObject {
  return typeof value === 'object' && value !== null && 'base' in value && 'scaling' in value;
}

//==============================================================================
// Target Selection Details
//==============================================================================
// This section stores the extra selection rules found during manual spell review:
// selected creatures inside an area, assignable spell-created instances, and
// clustered targets that must remain within a shared distance.
//==============================================================================

/** Specifies filters for what can be targeted by a spell. */
export type TargetFilter = "creatures" | "objects" | "allies" | "enemies" | "self" | "point" | "ground";

/** Defines how complex target selection, such as Sleep pools, is allocated. */
export interface TargetAllocation {
  type: 'all' | 'pool' | 'random' | 'choice';
  pool?: {
    resource: 'hp' | 'hit_dice';
    dice: string;
    sortOrder: 'ascending' | 'descending';
    strictLimit?: boolean;
    // TODO(lint-intent): Hook scaling formulas into dice resolution when the system is fully wired.
    scaling?: ScalingFormula;
  };
}

/** Describes how an area spell chooses which creatures inside its footprint are affected. */
export interface AreaTargetSelection {
  mode: "all_valid_targets" | "caster_choice" | "random" | "not_applicable";
  scope: "creatures_in_area" | "not_applicable";
  count: number | "all_chosen" | "not_applicable";
  excludesUnchosen: boolean;
  requiresLineOfSight?: boolean;
  notes?: string;
}

/** Describes several spell instances that the caster distributes among targets. */
export interface TargetInstanceAllocation {
  instanceType: "dart" | "beam" | "ray" | "projectile" | "light" | "animated_tree" | "controlled_undead" | "not_applicable";
  baseCount: number | "not_applicable";
  scalingRule?: "slot_level_plus_one_per_level" | "character_level_tiers" | "not_applicable" | string;
  assignment: "same_or_different_targets" | "unique_targets" | "single_target_only" | "independent_positions" | "not_applicable";
  resolution: "simultaneous" | "sequential" | "persistent" | "not_applicable";
  notes?: string;
}

/** Records when all selected targets must stay within a shared distance band. */
export interface TargetCluster {
  requirement: "required" | "not_applicable";
  maxDistance: number | "not_applicable";
  distanceUnit: DistanceUnit | "not_applicable";
  scope: "all_targets" | "not_applicable";
  notes?: string;
}

/** Describes a choice that can be made separately for each selected target. */
export interface PerTargetChoice {
  /** Current pilot choice family: Enhance Ability chooses an ability per target. */
  choiceType: "ability" | "not_applicable";
  /** The choice applies independently to every selected target. */
  scope: "each_target" | "not_applicable";
  /** Allowed option values for the per-target choice. */
  options: string[];
  /** True when different selected targets can receive different choices. */
  differentChoicesAllowed: boolean;
  /** True when the spell cannot resolve without making the choice. */
  required: boolean;
  notes?: string;
}

/** Records target eligibility that must stay true across a long casting time. */
export interface TargetParticipation {
  /** True when selected targets only qualify if they remain in range until casting finishes. */
  requiresWithinRangeForFullCasting: boolean | "not_applicable";
  /** Short canonical reminder for the casting-time participation rule. */
  notes?: string;
}

//==============================================================================
// Area And Spatial Geometry
//==============================================================================
// These types describe areas, walls, alternate forms, and secondary measurements.
// They keep spatial mechanics machine-readable without making every spell look
// like a simple sphere or cube.
//==============================================================================

/** Defines the shape and size of an area of effect. */
export interface AreaOfEffect {
  shape: "Cone" | "Cube" | "Cylinder" | "Line" | "Sphere" | "Square" | "Circle"
  | "Emanation" | "Wall" | "Hemisphere" | "Ring";
  size: number;
  sizeType?: GeometrySizeType;
  sizeUnit?: DistanceUnit;
  height?: number;
  heightUnit?: DistanceUnit;
  followsCaster?: boolean;
  thickness?: number;
  thicknessUnit?: DistanceUnit;
  width?: number;
  widthUnit?: DistanceUnit;
  shapeVariant?: {
    options: ("Line" | "Ring" | "Hemisphere" | "Sphere")[];
    default: string;
  };
  wallStats?: {
    ac: number;
    hpPerSection: number;
    sectionSize: number;
  };
  triggerZone?: {
    triggerDistance?: number;
    triggerSide?: "one" | "both" | "inside";
  };
}

/** Clarifies what the main scalar on a spatial form actually means. */
export type GeometrySizeType =
  | "radius"
  | "diameter"
  | "length"
  | "edge"
  | "side"
  | "square";

/** A fully explicit spatial form used when base range plus area is too compressed. */
export interface SpatialForm {
  label?: string;
  shape: string;
  size?: number;
  sizeType?: GeometrySizeType;
  sizeUnit?: DistanceUnit;
  height?: number;
  heightUnit?: DistanceUnit;
  width?: number;
  widthUnit?: DistanceUnit;
  thickness?: number;
  thicknessUnit?: DistanceUnit;
  segmentCount?: number;
  segmentWidth?: number;
  segmentWidthUnit?: DistanceUnit;
  segmentHeight?: number;
  segmentHeightUnit?: DistanceUnit;
  notes?: string;
}

/** A measured spell fact that matters spatially but does not belong inside the primary area shape. */
export interface SpatialMeasuredDetail {
  label: string;
  kind:
    | "blocker"
    | "opening"
    | "diameter"
    | "thickness"
    | "depth"
    | "size_change"
    | "distance"
    | "count"
    | "volume"
    | "time"
    | "special";
  subject?: string;
  value?: number;
  unit?: SpatialMeasuredUnit;
  qualifier?: string;
  notes?: string;
}

/** A spell's explicit spatial fact bundle. */
export interface SpatialDetails {
  forms?: SpatialForm[];
  measuredDetails?: SpatialMeasuredDetail[];
}

//==============================================================================
// Full Targeting Shapes
//==============================================================================
// The full spell targeting union is what spell JSON uses at runtime. Each branch
// keeps a distinct game meaning: one entity, several entities, an area, a point,
// the caster, or a hybrid primary/secondary targeting pattern.
//==============================================================================

/** Base interface for all targeting types. */
interface BaseTargeting {
  validTargets: TargetFilter[];
  lineOfSight?: boolean;
  /**
   * Optional sensory acquisition override for spells whose target text permits
   * more than ordinary sight. Vicious Mockery uses `sight_or_hearing` so a
   * blocked sight line can still be legal when the target is explicitly audible
   * to the caster.
   */
  acquisition?: {
    mode: "line_of_sight" | "sight_or_hearing";
  };
  filter?: TargetConditionFilter;
  /**
   * Optional final-selection rule after raw valid targets are found.
   *
   * Sleep and Color Spray do not simply affect every creature in an area; they
   * spend a rolled pool across eligible creatures. Keeping that rule on the
   * shared targeting shape lets the resolver apply the same candidate filtering
   * as every other spell, then hand the remaining list to the allocation helper.
   */
  allocation?: TargetAllocation;
  spatialDetails?: SpatialDetails;
  areaTargetSelection?: AreaTargetSelection;
  instanceAllocation?: TargetInstanceAllocation;
  targetCluster?: TargetCluster;
  perTargetChoice?: PerTargetChoice;
  targetParticipation?: TargetParticipation;
}

/** Targets a single entity. Example: Chromatic Orb. */
export interface SingleTargeting extends BaseTargeting {
  type: "single";
  range: number;
  rangeUnit?: DistanceUnit;
}

/** Targets multiple specific entities. Example: Magic Missile, Eldritch Blast. */
export interface MultiTargeting extends BaseTargeting {
  type: "multi";
  range: number;
  rangeUnit?: DistanceUnit;
  maxTargets: ScalableNumber;
}

/** Targets an area, affecting all valid entities within. Example: Fireball. */
export interface AreaTargeting extends BaseTargeting {
  type: "area";
  range: number;
  rangeUnit?: DistanceUnit;
  areaOfEffect: AreaOfEffect;
}

/** Targets a chosen point in space that then anchors a placed effect. */
export interface PointTargeting extends BaseTargeting {
  type: "point";
  range: number;
  rangeUnit?: DistanceUnit;
  maxTargets?: ScalableNumber;
  areaOfEffect?: AreaOfEffect;
}

/** Targets only the caster. Example: Shield. */
export interface SelfTargeting extends BaseTargeting {
  type: "self";
}

/** A complex targeting scheme with an initial target and a secondary area effect. */
export interface HybridTargeting extends BaseTargeting {
  type: "hybrid";
  primary: SingleTargeting;
  secondary: AreaTargeting;
}

/** A discriminated union representing all possible targeting schemes for a spell. */
export type SpellTargeting =
  | SingleTargeting
  | MultiTargeting
  | AreaTargeting
  | PointTargeting
  | SelfTargeting
  | HybridTargeting;
