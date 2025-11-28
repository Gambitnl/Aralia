/**
 * @file src/types/spells.ts
 * This file contains all the new TypeScript type definitions and interfaces
 * for the component-based spell system.
 */

//==============================================================================
// Legacy Interfaces for Backward Compatibility
//==============================================================================

/**
 * @deprecated Use the new `Spell` interface instead.
 * Represents the old, unstructured spell format.
 */
export interface LegacySpell {
  id: string;
  name: string;
  level: number;
  description: string;
  school?: string;
  castingTime?: string | { value: number; unit: string };
  range?: string | { type: string; distance?: number };
  components?: {
    verbal?: boolean;
    somatic?: boolean;
    material?: boolean;
    materialDescription?: string;
  };
  duration?: string | { value: number | null; unit: string; concentration?: boolean };
  higherLevelsDescription?: string;
  classes?: string[];
  tags?: string[];
  effects?: LegacySpellEffect[];
  areaOfEffect?: { shape: string; size: number };
}

/**
 * @deprecated Use the new `SpellEffect` discriminated union instead.
 * Represents the old, unstructured spell effect format.
 */
export interface LegacySpellEffect {
  type: string;
  damage?: {
    dice: string;
    type: string;
  };
  healing?: {
    dice?: string;
    special?: string;
  };
  attack?: {
    type: string;
  };
  areaOfEffect?: {
    shape: string;
    size: number;
  };
  special?: string;
}

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
  level: number; // 0 for Cantrip
  school: SpellSchool;
  classes: string[];
  description: string;
  higherLevels?: string;
  tags?: string[];
  ritual?: boolean;
  rarity?: SpellRarity;

  // --- Core Mechanics ---
  castingTime: CastingTime;
  range: Range;
  components: Components;
  duration: Duration;

  // --- System Components ---
  targeting: SpellTargeting;
  effects: SpellEffect[];

  // --- AI & Advanced Systems ---
  arbitrationType?: ArbitrationType;
}

/** The eight schools of magic in D&D 5e. */
export type SpellSchool =
  | "Abjuration"
  | "Conjuration"
  | "Divination"
  | "Enchantment"
  | "Evocation"
  | "Illusion"
  | "Necromancy"
  | "Transmutation";

/** Defines the rarity of a spell, for loot tables or special scrolls. */
export type SpellRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

/**
 * Defines the time required to cast a spell.
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
export interface Range {
  type: "self" | "touch" | "ranged" | "special";
  distance?: number; // in feet, for 'ranged' type
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
  | SelfTargeting
  | HybridTargeting;

/** Specifies filters for what can be targeted by a spell. */
export type TargetFilter = "creatures" | "objects" | "allies" | "enemies" | "self" | "point";

/** Defines the shape and size of an area of effect. */
export interface AreaOfEffect {
  shape: "Cone" | "Cube" | "Cylinder" | "Line" | "Sphere";
  size: number; // in feet (e.g., radius for Sphere, length for Line)
}

/** Base interface for all targeting types. */
interface BaseTargeting {
  validTargets: TargetFilter[];
  lineOfSight?: boolean;
}

/** Targets a single entity. Example: Chromatic Orb. */
export interface SingleTargeting extends BaseTargeting {
  type: "single";
  range: number;
}

/** Targets multiple specific entities. Example: Magic Missile. */
export interface MultiTargeting extends BaseTargeting {
  type: "multi";
  range: number;
  maxTargets: number;
}

/** Targets an area, affecting all valid entities within. Example: Fireball. */
export interface AreaTargeting extends BaseTargeting {
  type: "area";
  range: number; // Distance to the point of origin
  areaOfEffect: AreaOfEffect;
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
  | DefensiveEffect;

/** The six primary ability scores used for saving throws. */
export type SavingThrowAbility = "Strength" | "Dexterity" | "Constitution" | "Intelligence" | "Wisdom" | "Charisma";

/** The thirteen types of damage in D&D 5e. */
export type DamageType =
  | "Acid" | "Bludgeoning" | "Cold" | "Fire" | "Force"
  | "Lightning" | "Necrotic" | "Piercing" | "Poison" | "Psychic"
  | "Radiant" | "Slashing" | "Thunder";

/** The fourteen status conditions in D&D 5e. */
export type ConditionName =
  | "Blinded" | "Charmed" | "Deafened" | "Exhaustion" | "Frightened"
  | "Grappled" | "Incapacitated" | "Invisible" | "Paralyzed" | "Petrified"
  | "Poisoned" | "Prone" | "Restrained" | "Stunned" | "Unconscious";

/** Defines the trigger for an effect. */
export interface EffectTrigger {
  type: "immediate" | "after_primary" | "turn_start" | "turn_end";
}

/** Defines the condition under which an effect applies. */
export interface EffectCondition {
  type: "hit" | "save" | "always";
  saveType?: SavingThrowAbility;
  saveEffect?: "none" | "half" | "negates_condition";
}

/** Base interface for all spell effects. */
export interface BaseEffect {
  trigger: EffectTrigger;
  condition: EffectCondition;
  scaling?: ScalingFormula;
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
}

/** Defines how long an effect-specific condition lasts. */
export interface EffectDuration {
  type: "rounds" | "minutes" | "special";
  value?: number;
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
  duration: EffectDuration;
}

/** An effect that summons creatures or objects. */
export interface SummoningEffect extends BaseEffect {
  type: "SUMMONING";
  summonType: "creature" | "object";
  creatureId?: string; // ID from a creature database
  objectDescription?: string; // Description for summoned objects
  count: number; // How many creatures/objects are summoned
  duration: EffectDuration;
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
}

/** An effect that provides defensive bonuses (e.g., AC boost, resistance). */
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defenseType: "ac_bonus" | "resistance" | "immunity" | "temporary_hp" | "advantage_on_saves";
  value?: number; // e.g., AC bonus or amount of temporary HP
  damageType?: DamageType[]; // For resistance/immunity
  savingThrow?: SavingThrowAbility[]; // For advantage on saves
  duration: EffectDuration;
}

//==============================================================================
// Scaling System
//==============================================================================

/** Defines how a spell's effects improve when cast at higher levels. */
export interface ScalingFormula {
  type: "slot_level" | "character_level" | "custom";
  bonusPerLevel?: string; // e.g., "+1d6" or "+1 target"
  customFormula?: string; // For complex scaling, e.g., "floor(character_level / 2)"
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
