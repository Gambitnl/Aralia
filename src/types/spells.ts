// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 24/04/2026, 00:24:56
 * Dependents: commands/base/BaseEffectCommand.ts, commands/base/SpellCommand.ts, commands/effects/AttackRollModifierCommand.ts, commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/RegisterRiderCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/UtilityCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/AbilityEffectMapper.ts, commands/factory/SpellCommandFactory.ts, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/Combat/ReactionPrompt.tsx, components/DesignPreview/steps/PreviewCombatSandbox.tsx, data/feats/featsData.ts, hooks/combat/useSummons.ts, hooks/useAbilitySystem.ts, scripts/audit_enchantment_consistency.ts, systems/creatures/CreatureTaxonomy.ts, systems/environment/EnvironmentSystem.ts, systems/environment/hazards.ts, systems/rituals/RitualManager.ts, systems/spells/ai/AISpellArbitrator.ts, systems/spells/effects/triggerHandler.ts, systems/spells/mechanics/ConcentrationTracker.ts, systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/mechanics/ScalingEngine.ts, systems/spells/targeting/TargetAllocator.ts, systems/spells/targeting/TargetValidationUtils.ts, systems/spells/validation/LegacySpellValidator.ts, systems/spells/validation/SpellIntegrityValidator.ts, systems/spells/validation/TargetingPresets.ts, types/index.ts, types/mechanics.ts, utils/character/savingThrowUtils.ts, utils/combat/combatUtils.ts, utils/combat/resistanceUtils.ts, utils/core/factories.ts, utils/validation/spellAuditor.ts, utils/validation/spellConsistencyValidator.ts, utils/visuals/spellVisuals.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/types/spells.ts
 * This file contains all the new TypeScript type definitions and interfaces
 * for the component-based spell system.
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added '@ts-ignore' to the 
 * 'SpellVisualSpec' import to suppress script-specific resolution 
 * warnings.
 */

// @ts-ignore
import type { SpellVisualSpec } from './visuals';

//==============================================================================
// Core Spell Structure
//==============================================================================

/**
 * Represents a D&D 5e spell with a complete mechanical definition, designed
 * for a component-based, machine-readable system.
 */
export interface Spell {
  // --- Identity & Metadata ---
  id: string;
  name: string;
  aliases?: string[];
  level: number; // 0 for Cantrip
  school: SpellSchool;
  // TODO(preserve-lint): Align required metadata with SpellValidator once schema/typing are unified.
  source?: string;
  legacy?: boolean;
  classes: string[];
  description: string;
  higherLevels?: string;
  /**
   * Structured higher-level scaling data for the runtime engine.
   *
   * Why this exists:
   * `higherLevels` is still the readable prose surface, but it is not a stable
   * runtime format. This field gives the JSON a machine-readable place to store
   * cantrip tier scaling, slot-level bonuses, breakpoint tables, and odd cases
   * that still need to preserve raw rules text without forcing the engine to
   * parse prose later.
   *
   * What it preserves:
   * - existing prose-based `higherLevels` for glossary/readability
   * - future room for richer runtime scaling without breaking old spells
   *
   * Current limitation:
   * most of the live corpus still uses prose only. This field is additive so the
   * migration can happen incrementally instead of forcing a corpus-wide rewrite.
   */
  higherLevelScaling?: HigherLevelScaling;
  tags?: string[];
  /**
   * Whether the spell can also be cast as a ritual.
   *
   * Why this stays separate from `castingTime`:
   * canonical spell pages often display ritual as part of the visible casting
   * time line, for example `1 Minute Ritual`. The runtime model keeps ritual as
   * its own switch so the app can reason about the normal cast time and the
   * ritual-capable status separately instead of flattening both ideas into one
   * string.
   */
  ritual?: boolean;
  rarity?: SpellRarity;
  attackType?: SpellAttackType;

  // --- Core Mechanics ---
  castingTime: CastingTime;
  range: Range;
  components: Components;
  duration: Duration;

  // --- System Components ---
  targeting: SpellTargeting;
  effects: SpellEffect[];

  // --- Visual Representation ---
  visual?: SpellVisualSpec;

  // --- AI & Advanced Systems ---
  arbitrationType?: ArbitrationType;
  aiContext?: AIContext;

  // --- Legacy/Convenience Fields ---
  // TODO(Taxonomist): Remove these once all spell data uses the new targeting/effects structure
  /** @deprecated Use targeting.areaOfEffect instead */
  areaOfEffect?: AreaOfEffect;
  /** @deprecated Use effects[].damage.type instead */
  damageType?: DamageType;
}

/**
 * The eight schools of magic in D&D 5e. */
export enum SpellSchool {
  Abjuration = "Abjuration",
  Conjuration = "Conjuration",
  Divination = "Divination",
  Enchantment = "Enchantment",
  Evocation = "Evocation",
  Illusion = "Illusion",
  Necromancy = "Necromancy",
  Transmutation = "Transmutation",
}

/** Legacy alias for SpellSchool */
export type MagicSchool = SpellSchool;
export const MagicSchool = SpellSchool;

export interface SpellSchoolTraits {
  /** A brief description of what the school encompasses. */
  description: string;
  /** Thematic keywords associated with the school. */
  themes: string[];
}

/**
 * Standard traits associated with each school of magic.
 */
export const SpellSchoolDefinitions: Record<SpellSchool, SpellSchoolTraits> = {
  [SpellSchool.Abjuration]: {
    description: "Spells that block, banish, or protect.",
    themes: ["Protection", "Warding", "Banishing", "Negation"],
  },
  [SpellSchool.Conjuration]: {
    description: "Spells that transport objects, creatures, or energy.",
    themes: ["Summoning", "Teleportation", "Creation", "Transportation"],
  },
  [SpellSchool.Divination]: {
    description: "Spells that reveal information or provide foresight.",
    themes: ["Knowledge", "Scrying", "Prophecy", "Detection"],
  },
  [SpellSchool.Enchantment]: {
    description: "Spells that affect the minds of others.",
    themes: ["Mind Control", "Emotion", "Influence", "Charm"],
  },
  [SpellSchool.Evocation]: {
    description: "Spells that manipulate magical energy to produce a desired effect.",
    themes: ["Energy", "Damage", "Elements", "Destruction", "Healing"],
  },
  [SpellSchool.Illusion]: {
    description: "Spells that deceive the senses or minds of others.",
    themes: ["Deception", "Phantasm", "Sensory", "Trickery"],
  },
  [SpellSchool.Necromancy]: {
    description: "Spells that manipulate the energies of life and death.",
    themes: ["Death", "Life", "Undeath", "Soul"],
  },
  [SpellSchool.Transmutation]: {
    description: "Spells that change the properties of a creature, object, or environment.",
    themes: ["Transformation", "Alteration", "Shapechange", "Buff"],
  },
};

// TODO(Taxonomist): Refactor codebase to use SpellSchool enum strictly instead of string literals

/** The rarity of a spell. */
export type SpellRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

/** Defines the type of attack roll required, if any. */
export type SpellAttackType = "melee" | "ranged" | "none";

/**
 * Defines the time required to cast a spell.
 *
 * Ritual note:
 * `ritual` is intentionally not part of `unit`. A ritual spell still keeps its
 * normal timing here and then marks the ritual-capable status with the separate
 * top-level `ritual` flag above.
 */
export interface CastingTime {
  value: number;
  unit: "action" | "bonus_action" | "reaction" | "minute" | "hour" | "special";
  reactionCondition?: string; // e.g., "which you take when you are hit by an attack"
  combatCost?: {
    type: "action" | "bonus_action" | "reaction";
    condition?: string;
  };
  explorationCost?: { value: number; unit: "minute" | "hour" };
}

/**
 * Defines the spell's effective range.
 */
export type DistanceUnit = "feet" | "miles" | "inches";

/**
 * Extra unit choices for measured spatial facts that are not always pure
 * distances.
 *
 * Why this exists:
 * the risky spell review found a second category of geometry-adjacent facts that
 * still mattered to spell placement and footprint review, but were not distances:
 * gallons for Create or Destroy Water, minutes for rubble-clear time, and similar
 * values that would otherwise be forced back into prose notes.
 *
 * What stays preserved:
 * the main range/area geometry still uses `DistanceUnit` above. This wider unit
 * type is only for the additive `spatialDetails.measuredDetails` channel.
 */
export type SpatialMeasuredUnit = DistanceUnit | "gallons" | "minutes";

/**
 * This spell-range shape now supports explicit measurement units instead of
 * assuming every numeric distance is in feet.
 *
 * Why this changed:
 * Range/Area review uncovered that the runtime model was carrying real geometry
 * in numbers, but the "feet" part only lived in comments and formatter
 * assumptions. That made the spell JSON weaker than the structured markdown and
 * canonical source when mile-based ranges or future unit-bearing geometry show
 * up.
 *
 * What stays preserved:
 * Existing spell JSON can still omit the unit fields for now. Missing units are
 * treated as legacy "feet" during the migration so we do not force a risky
 * corpus-wide rewrite in one step. The distance itself is required: `0` is the
 * explicit value for self, touch, special, sight, or unlimited range when there
 * is no measured casting distance.
 */
export interface Range {
  type: "self" | "touch" | "ranged" | "special" | "sight" | "unlimited";
  distance: number;
  distanceUnit?: DistanceUnit;
}

/**
 * Defines the components required to cast a spell.
 */
export interface Components {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialDescription?: string;
  materialCost?: number; // in GP
  isConsumed?: boolean;
}

/**
 * Defines how long a spell's effects last.
 */
export interface Duration {
  type: "instantaneous" | "timed" | "special" | "until_dispelled" | "until_dispelled_or_triggered";
  value?: number; // in rounds, minutes, or hours
  unit?: "round" | "minute" | "hour" | "day";
  concentration: boolean;
}

//==============================================================================
// Targeting System
//==============================================================================

/** A discriminated union representing all possible targeting schemes for a spell. */
export type SpellTargeting =
  | SingleTargeting
  | MultiTargeting
  | AreaTargeting
  | PointTargeting
  | SelfTargeting
  | HybridTargeting;

/** Specifies filters for what can be targeted by a spell. */
export type TargetFilter = "creatures" | "objects" | "allies" | "enemies" | "self" | "point" | "ground";

/** Defines how complex target selection (e.g., Sleep/Color Spray pools) is allocated. */
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

/** Defines the shape and size of an area of effect. */
export interface AreaOfEffect {
  /**
   * Shape of the area of effect.
   * Basic shapes: Cone, Cube, Cylinder, Line, Sphere, Square
   * Extended shapes:
   * - Emanation: Centered on caster, optionally moves with caster
   * - Wall: Linear barrier with length/height/thickness
   * - Hemisphere: Dome shape (half-sphere)
   * - Ring: Hollow circle/cylinder
   */
  shape: "Cone" | "Cube" | "Cylinder" | "Line" | "Sphere" | "Square"
  | "Emanation" | "Wall" | "Hemisphere" | "Ring";
  /**
   * Primary dimension of the area (radius for spheres/emanations, length for
   * lines/walls).
   *
   * Legacy spell JSON usually omits `sizeUnit`, which should currently be read
   * as feet. The explicit unit field exists so future mile-based or otherwise
   * non-default geometry does not have to hide behind formatter assumptions.
   *
   * Follow-up note:
   * newer spell review also showed that the *kind* of size matters just as much
   * as the number. A `30` might mean radius, diameter, cube edge, or wall
   * length depending on the spell, so future authors should set `sizeType`
   * whenever the distinction matters.
   */
  size: number;
  sizeType?: GeometrySizeType;
  sizeUnit?: DistanceUnit;
  /** Optional vertical dimension for planar effects like squares on the ground. */
  height?: number;
  heightUnit?: DistanceUnit;

  // --- Extended semantics (optional, shape-dependent) ---

  /**
   * For Emanation: whether the AoE moves with the caster.
   * If true, the zone re-centers on the caster at the start of their turn.
   */
  followsCaster?: boolean;

  /** For Wall/Line shapes: thickness (default 1 if not specified). */
  thickness?: number;
  thicknessUnit?: DistanceUnit;

  /** For Wall shapes: width of each segment. */
  width?: number;
  widthUnit?: DistanceUnit;

  /**
   * For spells that allow shape choice at cast time (e.g., Wall of Fire: line or ring).
   * The caster selects one of the options when the spell is cast.
   */
  shapeVariant?: {
    options: ("Line" | "Ring" | "Hemisphere" | "Sphere")[];
    default: string;
  };

  /**
   * For destructible walls: AC and HP per section.
   * Used by terrain/wall destruction logic.
   */
  wallStats?: {
    ac: number;
    hpPerSection: number;
    sectionSize: number; // in feet, e.g., 10 for "10-foot section"
  };

  /**
   * For zones that trigger damage on entry/proximity.
   * E.g., Wall of Fire deals damage within 10 feet of one side.
   */
  triggerZone?: {
    /** Distance from the wall/area that still triggers the effect. */
    triggerDistance?: number;
    /** Which side(s) of the wall trigger the effect. */
    triggerSide?: "one" | "both" | "inside";
  };
}

/**
 * Clarifies what the main scalar on a spatial form actually means.
 *
 * Why this exists:
 * risky Range/Area spells uncovered that a raw number like `20` is not enough
 * once the repo starts storing walls, globes, rings, disks, pillars, and other
 * constructed geometry explicitly. This type says whether the number means a
 * radius, diameter, wall length, square edge, and so on.
 */
export type GeometrySizeType =
  | "radius"
  | "diameter"
  | "length"
  | "edge"
  | "side";

/**
 * A fully explicit spatial form used when the base `range` + `areaOfEffect`
 * fields are too compressed to describe what the spell really creates.
 *
 * Why it exists:
 * the older runtime shape works well for ordinary cones, cubes, spheres, and
 * simple walls. It becomes too lossy for risky spells like Wall of Force,
 * Forcecage, Prismatic Wall, Daylight, or Create or Destroy Water, where we
 * need to preserve alternate forms, edge-vs-radius meaning, height/thickness,
 * or panel counts without flattening everything into prose.
 */
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

/**
 * A measured spell fact that matters spatially but does not belong inside the
 * one primary area shape.
 *
 * Examples:
 * - a detect spell being blocked by 1 inch of metal
 * - Arcane Eye fitting through a 1-inch-diameter opening
 * - Prismatic Wall being 1 inch thick
 *
 * This keeps those facts explicit instead of leaving them trapped in prose.
 */
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

/**
 * A spell's explicit spatial fact bundle.
 *
 * Why this exists:
 * the base runtime geometry is still the primary engine surface, but risky
 * spells need a place to store alternate forms and secondary measurements
 * without pretending those details do not exist.
 *
 * Typical examples:
 * - a spell that can create either a wall or a globe
 * - a spell whose main footprint is a Cube but whose rules also track gallons
 * - a spell whose area is ordinary but whose blocker/opening dimensions matter
 */
export interface SpatialDetails {
  forms?: SpatialForm[];
  measuredDetails?: SpatialMeasuredDetail[];
}

/**
 * A number that can scale based on character level or slot level.
 * Used for effects like Eldritch Blast (1 beam at 1st, 2 at 5th, 3 at 11th, 4 at 17th).
 */
export type ScalableNumber = number | ScalableNumberObject;

/** Object form of ScalableNumber with explicit scaling thresholds. */
export interface ScalableNumberObject {
  base: number;
  scaling: {
    type: "character_level" | "slot_level";
    /** Maps level thresholds to values. E.g., { "1": 1, "5": 2, "11": 3, "17": 4 } */
    thresholds: Record<string, number>;
  };
}

/**
 * Resolves a ScalableNumber to its actual numeric value based on the given level.
 * @param value - The ScalableNumber (either a plain number or a scaling object)
 * @param level - The character level or slot level to evaluate against
 * @returns The resolved numeric value
 * @example
 * // Eldritch Blast: { base: 1, scaling: { type: "character_level", thresholds: { "1": 1, "5": 2, "11": 3, "17": 4 } } }
 * resolveScalableNumber(eldritchBlast.targeting.maxTargets, 5) // returns 2
 * resolveScalableNumber(eldritchBlast.targeting.maxTargets, 11) // returns 3
 */
export function resolveScalableNumber(value: ScalableNumber, level: number): number {
  // If it's just a plain number, return it
  if (typeof value === 'number') {
    return value;
  }

  // It's a ScalableNumberObject, find the highest threshold <= level
  const thresholds = value.scaling.thresholds;
  const sortedThresholds = Object.keys(thresholds)
    .map(k => parseInt(k, 10))
    .sort((a, b) => b - a); // Sort descending to find highest first

  for (const threshold of sortedThresholds) {
    if (level >= threshold) {
      return thresholds[threshold.toString()];
    }
  }

  // Fallback to base if no threshold matched
  return value.base;
}

/**
 * Type guard to check if a ScalableNumber is a scaling object (not a plain number).
 */
export function isScalableNumberObject(value: ScalableNumber): value is ScalableNumberObject {
  return typeof value === 'object' && value !== null && 'base' in value && 'scaling' in value;
}

/** Base interface for all targeting types. */
interface BaseTargeting {
  validTargets: TargetFilter[];
  lineOfSight?: boolean;
  /**
   * Constraints on what can be targeted.
   * Checked at cast time (unlike effect conditions which are checked at resolution).
   */
  filter?: TargetConditionFilter;
  /**
   * Optional richer spatial facts for risky spells whose geometry cannot be
   * expressed cleanly by one flat range/area pair.
   */
  spatialDetails?: SpatialDetails;
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
  /** Can be a fixed number or scale with level (e.g., Eldritch Blast beams) */
  maxTargets: ScalableNumber;
}

/** Targets an area, affecting all valid entities within. Example: Fireball. */
export interface AreaTargeting extends BaseTargeting {
  type: "area";
  range: number; // Distance to the point of origin
  rangeUnit?: DistanceUnit;
  areaOfEffect: AreaOfEffect;
}

/**
 * Targets a chosen point in space that then anchors a placed effect.
 *
 * Why this exists:
 * some spells do not target a creature directly and are not best described as
 * "the whole area is the target" either. They place something at a point and
 * that placed effect then creates a wall, globe, burst, or similar geometry.
 *
 * Example:
 * Prismatic Wall is cast on a point within range and then creates either a wall
 * or a globe from that origin. The validator already accepts `point`, so the
 * shared TypeScript template must expose it too.
 */
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

/**
 * A complex targeting scheme with an initial target and a secondary area effect.
 * Example: Ice Knife (hits one target, then explodes).
 */
export interface HybridTargeting extends BaseTargeting {
  type: "hybrid";
  primary: SingleTargeting;
  secondary: AreaTargeting;
}

//==============================================================================
// Effect System
//==============================================================================

/** A discriminated union representing all possible spell effects. */
export type SpellEffect =
  | DamageEffect
  | HealingEffect
  | StatusConditionEffect
  | MovementEffect
  | SummoningEffect
  | TerrainEffect
  | UtilityEffect
  | DefensiveEffect
  | ReactiveEffect; // Added ReactiveEffect

/** The six primary ability scores used for saving throws. */
export type SavingThrowAbility = "Strength" | "Dexterity" | "Constitution" | "Intelligence" | "Wisdom" | "Charisma";

/**
 * The thirteen types of damage in D&D 5e. */
export const DamageType = {
  Acid: "Acid",
  Bludgeoning: "Bludgeoning",
  Cold: "Cold",
  Fire: "Fire",
  Force: "Force",
  Lightning: "Lightning",
  Necrotic: "Necrotic",
  Piercing: "Piercing",
  Poison: "Poison",
  Psychic: "Psychic",
  Radiant: "Radiant",
  Slashing: "Slashing",
  Thunder: "Thunder",
} as const;

export type DamageType = typeof DamageType[keyof typeof DamageType] | string; // Allow string for test compatibility

export interface DamageTypeTraits {
  description: string;
}

// TODO(Taxonomist): Refactor codebase to use ConditionType enum from ./conditions.ts strictly instead of ConditionName union.
// This requires updating all references in combat logic, effect processing, and UI components.

/**
 * Standard traits associated with each damage type.
 */
export const DamageTypeDefinitions: Record<DamageType, DamageTypeTraits> = {
  [DamageType.Acid]: { description: "The corrosive spray of a black dragon or the dissolving enzymes of a black pudding." },
  [DamageType.Bludgeoning]: { description: "Blunt force attacks, such as from a hammer or a fall." },
  [DamageType.Cold]: { description: "The infernal chill radiating from an ice devil's spear or a white dragon's breath." },
  [DamageType.Fire]: { description: "The red dragon breathing fire or a spellcaster calling down a meteor swarm." },
  [DamageType.Force]: { description: "Pure magical energy focused into a damaging form." },
  [DamageType.Lightning]: { description: "A storm giant throwing a lightning bolt or a blue dragon's breath." },
  [DamageType.Necrotic]: { description: "The withering touch of a lich or the decaying magic of a vampire." },
  [DamageType.Piercing]: { description: "Puncturing attacks, such as from a spear or an arrow." },
  [DamageType.Poison]: { description: "Venomous stings and toxic gases." },
  [DamageType.Psychic]: { description: "Mental assaults that shatter the mind." },
  [DamageType.Radiant]: { description: "Searng light like that of a cleric's flame strike or an angel's weapon." },
  [DamageType.Slashing]: { description: "Cutting attacks, such as from a sword or an axe." },
  [DamageType.Thunder]: { description: "A concussive burst of sound, such as from a thunderwave spell." },
};

/** The fourteen status conditions in D&D 5e plus custom game conditions. */
export type ConditionName =
  | "Blinded" | "Charmed" | "Deafened" | "Exhaustion" | "Frightened"
  | "Grappled" | "Incapacitated" | "Invisible" | "Paralyzed" | "Petrified"
  | "Poisoned" | "Prone" | "Restrained" | "Stunned" | "Unconscious" | "Ignited"
  // Custom conditions for game mechanics (e.g., feat effects)
  | "Slowed" | "Slasher Slow";

/** Modifiers that adjust how a saving throw is made. */
export interface SaveModifier {
  type: "advantage" | "disadvantage" | "bonus" | "penalty";
  value?: number;
  appliesTo?: TargetConditionFilter;
  reason?: string;
}

/** Defines the trigger for an effect. */
export interface EffectTrigger {
  type:
  | "immediate"
  | "after_primary"
  | "turn_start"
  | "turn_end"
  | "on_enter_area"
  | "on_exit_area"
  | "on_end_turn_in_area"
  | "on_target_move"
  | "on_target_attack"
  | "on_target_cast"
  | "on_caster_action"
  | "on_attack_hit";
  /**
   * Controls how often this trigger can fire.
   * Defaults to 'every_time' if not specified.
   */
  frequency?: "every_time" | "first_per_turn" | "once" | "once_per_creature";
  /**
   * For rider effects (on_attack_hit), controls consumption.
   */
  consumption?: "unlimited" | "first_hit" | "per_turn";
  /**
   * For rider effects, filters which attacks trigger the effect.
   */
  attackFilter?: {
    weaponType?: "melee" | "ranged" | "any";
    attackType?: "weapon" | "spell" | "any";
  };
  /**
   * For on_target_move triggers, specifies if it triggers on willing or forced movement.
   */
  movementType?: "any" | "willing" | "forced";
  /**
   * For on_caster_action triggers, specifies the cost to sustain the effect.
   */
  sustainCost?: {
    actionType: "action" | "bonus_action" | "reaction";
    optional: boolean;
  };
}

/** Defines the condition under which an effect applies. */
export interface EffectCondition {
  type: "hit" | "save" | "always";
  saveType?: SavingThrowAbility;
  saveEffect?: "none" | "half" | "negates_condition";
  /** Filter to apply effect only to specific target types. */
  targetFilter?: TargetConditionFilter;
  /** Require that the target already has certain conditions for this effect to apply. */
  requiresStatus?: ConditionName[];
  /** Adjustments applied when making a saving throw. */
  saveModifiers?: SaveModifier[];
}

/** Filter for conditional effects based on target properties. */
export interface TargetConditionFilter {
  /** Creature types this effect applies to (e.g., ["Undead", "Construct"]) */
  creatureType?: string[];
  /** Preferred plural field for creature types (e.g., ["Undead", "Construct"]) */
  creatureTypes?: string[];
  /** Creature types excluded from the effect */
  excludeCreatureTypes?: string[];
  /** Size categories this effect applies to (e.g., ["Large", "Huge"]) */
  size?: string[];
  /** Preferred plural field for sizes */
  sizes?: string[];
  /** Alignments this effect applies to (e.g., ["Evil"]) */
  alignment?: string[];
  /** Preferred plural field for alignments */
  alignments?: string[];
  /** Conditions the target must have (e.g., ["Prone", "Charmed"]) */
  hasCondition?: string[];
}

/** Base interface for all spell effects. */
export interface BaseEffect {
  trigger: EffectTrigger;
  condition: EffectCondition;
  scaling?: ScalingFormula;
  // TODO(preserve-lint): SpellValidator requires descriptions; make this required once data is normalized.
  description?: string;
  areaOfEffect?: AreaOfEffect;
}

/** An effect that deals damage. */
export interface DamageEffect extends BaseEffect {
  type: "DAMAGE";
  damage: DamageData;
}

/** Contains the details of the damage dealt. */
export interface DamageData {
  dice: string; // e.g., "8d6"
  type: DamageType;
}

/** An effect that restores hit points. */
export interface HealingEffect extends BaseEffect {
  type: "HEALING";
  healing: HealingData;
}

/** Contains the details of the healing done. */
export interface HealingData {
  dice: string; // e.g., "2d8+5"
  isTemporaryHp?: boolean;
}

/** An effect that applies a status condition. */
export interface StatusConditionEffect extends BaseEffect {
  type: "STATUS_CONDITION";
  statusCondition: StatusCondition;
}

/** Defines the applied status condition and its duration. */
export interface StatusCondition {
  name: ConditionName;
  duration: EffectDuration;
  level?: number;
  escapeCheck?: EscapeCheck;
  /**
   * Optional mechanical effect associated with this status.
   * Allows encapsulating numeric modifiers (e.g. Speed -10) directly within the condition object.
   * This structure mirrors the `effect` property of `StatusEffect` in `combat.ts`.
   */
  effect?: {
    type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn' | 'condition';
    value?: number;
    stat?: string; // Using string to avoid circular dependency with CharacterStats keys
  };
}

/** Defines how long an effect-specific condition lasts. */
export interface EffectDuration {
  type: "rounds" | "minutes" | "special";
  value?: number;
}

/** Requirements to end a condition through an action or check. */
export interface EscapeCheck {
  ability?: SavingThrowAbility;
  skill?: string;
  dc: number | "spell_save_dc";
  actionCost: "action" | "bonus_action";
}

/** A temporary or permanent modification to a character's stats. */
export interface StatModifier {
  stat: string; // e.g., "armor_class", "attack_roll"
  value: number;
  type: "bonus" | "penalty";
}

// --- Stubbed Effect Types for Future Implementation ---

/** An effect that alters movement (e.g., reduces speed, forces movement). */
export interface MovementEffect extends BaseEffect {
  type: "MOVEMENT";
  movementType: "push" | "pull" | "teleport" | "speed_change" | "stop";
  distance?: number; // for push, pull, teleport in feet
  speedChange?: {
    stat: "speed";
    value: number; // can be negative for reduction
    unit: "feet";
  };
  /** Explicit destination for teleport effects (if known at design time) */
  destination?: { x: number; y: number };
  /** Alternative field for target position */
  targetPosition?: { x: number; y: number };
  duration: EffectDuration;
  forcedMovement?: ForcedMovement;
}

/** An effect that summons creatures or objects. */
export interface SummoningEffect extends BaseEffect {
  type: "SUMMONING";
  summonType: "creature" | "object";
  creatureId?: string; // ID from a creature database
  objectDescription?: string; // Description for summoned objects
  count: number; // How many creatures/objects are summoned
  duration: EffectDuration;
  familiarContract?: FamiliarContract;
}

/** Structured terrain manipulation for spells like Mold Earth */
export interface TerrainManipulation {
  /** Type of manipulation: excavate/fill dirt, toggle difficult terrain, or cosmetic changes */
  type: "excavate" | "fill" | "difficult" | "normal" | "cosmetic";
  /** Volume of terrain affected */
  volume?: {
    shape: "Cube";
    size: number;  // in feet
    depth?: number; // in feet, for excavation
  };
  /** How long the manipulation lasts (for difficult/cosmetic) */
  duration?: EffectDuration;
  /** Distance excavated material can be deposited, in feet */
  depositDistance?: number;
}

/** An effect that creates or alters terrain. */
export interface TerrainEffect extends BaseEffect {
  type: "TERRAIN";
  terrainType: "difficult" | "obscuring" | "damaging" | "blocking" | "wall";
  areaOfEffect: AreaOfEffect;
  duration: EffectDuration;
  damage?: DamageData; // For damaging terrain
  wallProperties?: {
    hp: number;
    ac: number;
  };
  dispersedByStrongWind?: boolean;
  /** Structured manipulation action for spells like Mold Earth */
  manipulation?: TerrainManipulation;
}

/** A non-combat or miscellaneous effect (e.g., creating light, communicating). */
export interface UtilityEffect extends BaseEffect {
  type: "UTILITY";
  utilityType:
  | "light"
  | "communication"
  | "creation"
  | "information"
  | "control"
  | "sensory"
  | "other";
  description: string;
  grantedActions?: GrantedAction[];
  attackAugments?: AttackAugment[];
  controlOptions?: ControlOption[];
  taunt?: TauntEffect;
  /** Structured light source configuration for utilityType: "light" */
  light?: {
    brightRadius: number;   // Radius of bright light in feet
    dimRadius?: number;     // Additional radius of dim light in feet
    attachedTo?: "caster" | "target" | "point";
    color?: string;         // e.g., "warm", "cold", "#RRGGBB"
  };
  /** Structured save penalty for debuff effects like Mind Sliver */
  savePenalty?: SavePenalty;
}

/** Defines a penalty applied to future saving throws (e.g., Mind Sliver's -1d4). */
export interface SavePenalty {
  dice: string;           // e.g., "1d4"
  applies: "next_save";   // When the penalty applies
  duration: EffectDuration;
}

/** An effect that provides defensive bonuses (e.g., AC boost, resistance). */
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defenseType: "ac_bonus" | "set_base_ac" | "ac_minimum" | "resistance" | "immunity" | "temporary_hp" | "advantage_on_saves" | "disadvantage_on_attacks";
  value?: number; // e.g., AC bonus or amount of temporary HP

  // AC Specifics
  acBonus?: number;
  baseACFormula?: string;
  acMinimum?: number;

  damageType?: DamageType[]; // For resistance/immunity
  savingThrow?: SavingThrowAbility[]; // For advantage on saves
  duration: EffectDuration;
  attackerFilter?: TargetConditionFilter;

  // Reaction
  reactionTrigger?: {
    event: "when_hit" | "when_targeted" | "when_damaged";
    includesSpells?: string[];
  };

  // Restrictions
  restrictions?: {
    noArmor?: boolean;
    noShield?: boolean;
    targetSelf?: boolean;
  };
}

/**
 * Reactive triggers and sustain-style effects (e.g., Shield, Glyph of Warding).
 * TODO(preserve-lint): Formalize trigger/movement vocab and costs once reactive spells are data-driven.
 */
export interface ReactiveEffect extends Omit<BaseEffect, 'trigger'> {
  type: "REACTIVE";
  trigger: {
    type: 'on_target_move' | 'on_target_attack' | 'on_any_cast' | 'on_caster_action';
    movementType?: string;
    sustainCost?: number;
  };
  duration?: {
    type?: 'rounds' | 'minutes' | 'hours' | 'special';
    value?: number;
  };
  description?: string;
}

//==============================================================================
// Advanced Effect Structures
//==============================================================================

/** Describes an action, bonus action, or reaction option granted while a spell is active. */
export interface GrantedAction {
  type: "action" | "bonus_action" | "reaction";
  action: string;
  frequency: "once" | "each_turn" | "while_active";
  rangeLimit?: number;
  notes?: string;
}

/** Adds structured rider effects to weapon attacks (e.g., extra radiant damage). */
export interface AttackAugment {
  attackType: "weapon" | "melee_weapon" | "ranged_weapon";
  additionalDamage?: DamageData;
  appliesOn?: "hit";
}

/** Models specific one-word command options for spells like Command. */
export interface ControlOption {
  name: string;
  effect: "approach" | "drop" | "flee" | "grovel" | "halt" | string;
  details?: string;
}

/** Captures taunt/leash mechanics such as Compelled Duel. */
export interface TauntEffect {
  disadvantageAgainstOthers?: boolean;
  leashRangeFeet?: number;
  breakConditions?: string[];
}

/** Defines forced movement parameters (e.g., reaction-based fleeing). */
export interface ForcedMovement {
  usesReaction?: boolean;
  direction?: "away_from_caster" | "toward_caster" | "caster_choice" | "safest_route";
  maxDistance?: string;
}

/** Provides machine-readable details for familiars created by spells. */
export interface FamiliarContract {
  forms: string[];
  telepathyRange: number;
  actionEconomy: {
    actsIndependently: boolean;
    canAttack: boolean;
  };
  sensesSharing?: {
    actionType: "action" | "bonus_action" | "reaction";
    range: number;
  };
  touchDelivery?: {
    enabled: boolean;
    range: number;
    usesReactionOf: "familiar" | "caster";
  };
  dismissal?: {
    method: "pocket_dimension";
    actionType: "action" | "bonus_action";
  };
  notes?: string;
}

//==============================================================================
// Scaling System
//==============================================================================

/**
 * A single machine-readable higher-level scaling rule.
 *
 * These leaf rule shapes are intentionally narrow. They are meant to cover the
 * recurring runtime patterns first, while still leaving a `special_text_only`
 * escape hatch for rules text that cannot yet be modeled safely.
 */
export type HigherLevelScalingRule =
  | CharacterLevelTierScaling
  | SlotLevelBonusScaling
  | SlotLevelTableScaling
  | TargetCountBonusScaling
  | AreaSizeBonusScaling;

/**
 * Top-level higher-level scaling container stored on a spell.
 *
 * Single-rule spells can store one direct rule. More complex spells can use the
 * `multiple` form to preserve several simultaneous scaling behaviors without
 * flattening them into one ambiguous string.
 */
export type HigherLevelScaling =
  | HigherLevelScalingRule
  | MultipleHigherLevelScaling
  | SpecialTextOnlyHigherLevelScaling;

/**
 * Character-level tier scaling, primarily for cantrips.
 *
 * Example:
 * Fire Bolt can map 5 -> 2d10, 11 -> 3d10, 17 -> 4d10.
 */
export interface CharacterLevelTierScaling {
  type: "character_level_tiers";
  tiers: Record<string, string>;
  notes?: string;
}

/**
 * Simple slot-level bonus scaling.
 *
 * Example:
 * Fireball adds +1d6 per slot above 3rd.
 */
export interface SlotLevelBonusScaling {
  type: "slot_level_bonus";
  baseSpellLevel: number;
  bonusPerLevel: string;
  notes?: string;
}

/**
 * Explicit slot-level breakpoint table for spells that do not scale linearly.
 *
 * Example:
 * a duration that becomes 10 minutes at slot 5, 1 hour at slot 6, and 8 hours
 * at slot 7+.
 */
export interface SlotLevelTableScaling {
  type: "slot_level_table";
  baseSpellLevel: number;
  entries: Record<string, string>;
  notes?: string;
}

/**
 * Structured target-count scaling for spells that affect more creatures per slot.
 */
export interface TargetCountBonusScaling {
  type: "target_count_bonus";
  baseSpellLevel: number;
  additionalTargetsPerLevel: number;
  targetLabel?: string;
  notes?: string;
}

/**
 * Structured area-size scaling for spells whose radius/size grows with slot level.
 */
export interface AreaSizeBonusScaling {
  type: "area_size_bonus";
  baseSpellLevel: number;
  increasePerLevel: number;
  unit: "feet";
  dimension: "radius" | "diameter" | "cube_size" | "line_length" | "wall_length" | "wall_height";
  notes?: string;
}

/**
 * Multiple simultaneous higher-level scaling rules on one spell.
 *
 * Example:
 * a spell might scale both damage and target count. This keeps those as separate
 * runtime facts instead of collapsing them into one prose blob.
 */
export interface MultipleHigherLevelScaling {
  type: "multiple";
  rules: HigherLevelScalingRule[];
  notes?: string;
}

/**
 * Escape hatch for valid canonical scaling text that the runtime model still
 * cannot safely express.
 *
 * This exists to preserve future possibility. It is better to mark the runtime
 * scaling as "structured storage still pending" than to force a misleading fake
 * shape just to satisfy neatness.
 */
export interface SpecialTextOnlyHigherLevelScaling {
  type: "special_text_only";
  referenceText: string;
  reason?: string;
}

/** Defines how a spell's effects improve when cast at higher levels. */
export interface ScalingFormula {
  type: "slot_level" | "character_level" | "custom";
  bonusPerLevel?: string; // e.g., "+1d6" or "+1 target"
  customFormula?: string; // For complex scaling, e.g., "floor(character_level / 2)"
  /**
   * Explicitly maps character/slot levels to new dice values (or flat values).
   * Key is the level threshold (e.g., "5"), Value is the new damage string (e.g., "2d10").
   * Used for tiered scaling like cantrips (5th, 11th, 17th).
   */
  scalingTiers?: Record<string, string>;
}

//==============================================================================
// AI Arbitration System
//==============================================================================

/**
 * Determines how ambiguous or complex spell effects are resolved.
 * - `mechanical`: Fully defined by the rules, no AI needed.
 * - `ai_assisted`: Requires AI interpretation of player input (e.g., Phantasmal Force).
 * - `ai_dm`: Requires the AI to act as a Dungeon Master to determine outcomes (e.g., Wish).
 */
export type ArbitrationType = "mechanical" | "ai_assisted" | "ai_dm";

/** Provides the necessary context for the AI to make a ruling on a spell's effect. */
export interface AIContext {
  prompt: string; // The prompt to be sent to the AI model
  playerInputRequired: boolean;
}

//==============================================================================
// Type Guards & Validation Helpers
//==============================================================================

/**
 * A type guard that checks if an object is a valid `Spell`.
 * @param obj The object to check.
 * @returns `true` if the object is a `Spell`, `false` otherwise.
 */
export function isSpell(obj: unknown): obj is Spell {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'level' in obj &&
    'targeting' in obj &&
    'effects' in obj
  );
}

/** A type guard to check if a `SpellEffect` is a `DamageEffect`. */
export function isDamageEffect(effect: SpellEffect): effect is DamageEffect {
  return effect.type === "DAMAGE";
}

/** A type guard to check if a `SpellEffect` is a `HealingEffect`. */
export function isHealingEffect(effect: SpellEffect): effect is HealingEffect {
  return effect.type === "HEALING";
}

/** A type guard to check if a `SpellEffect` is a `StatusConditionEffect`. */
export function isStatusConditionEffect(effect: SpellEffect): effect is StatusConditionEffect {
  return effect.type === "STATUS_CONDITION";
}

/** A type guard to check if a `SpellEffect` is a `MovementEffect`. */
export function isMovementEffect(effect: SpellEffect): effect is MovementEffect {
  return effect.type === "MOVEMENT";
}

/** A type guard to check if a `SpellEffect` is a `SummoningEffect`. */
export function isSummoningEffect(effect: SpellEffect): effect is SummoningEffect {
  return effect.type === "SUMMONING";
}

/** A type guard to check if a `SpellEffect` is a `TerrainEffect`. */
export function isTerrainEffect(effect: SpellEffect): effect is TerrainEffect {
  return effect.type === "TERRAIN";
}

/** A type guard to check if a `SpellEffect` is a `UtilityEffect`. */
export function isUtilityEffect(effect: SpellEffect): effect is UtilityEffect {
  return effect.type === "UTILITY";
}

/** A type guard to check if a `SpellEffect` is a `DefensiveEffect`. */
export function isDefensiveEffect(effect: SpellEffect): effect is DefensiveEffect {
  return effect.type === "DEFENSIVE";
}
