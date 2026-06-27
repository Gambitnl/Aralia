// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/06/2026, 11:57:29
 * Dependents: commands/base/BaseEffectCommand.ts, commands/base/SpellCommand.ts, commands/effects/AttackRollModifierCommand.ts, commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/RegisterRiderCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/UtilityCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/AbilityEffectMapper.ts, commands/factory/SpellCommandFactory.ts, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/Combat/ReactionPrompt.tsx, components/DesignPreview/steps/PreviewCombatSandbox.tsx, data/adapters/5eTools/index.ts, data/adapters/5eTools/shared.ts, data/adapters/5eTools/spellEffectMapper.ts, data/adapters/5eTools/spellcastingAdapter.ts, data/feats/featsData.ts, data/races/racialTraits.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useSummons.ts, hooks/data/useSpellRegistry.ts, hooks/useAbilitySystem.ts, scripts/audit_enchantment_consistency.ts, systems/creatures/CreatureTaxonomy.ts, systems/environment/EnvironmentSystem.ts, systems/environment/hazards.ts, systems/rituals/RitualManager.ts, systems/spells/ai/AISpellArbitrator.ts, systems/spells/effects/triggerHandler.ts, systems/spells/mechanics/ConcentrationTracker.ts, systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/mechanics/ScalingEngine.ts, systems/spells/targeting/TargetAllocator.ts, systems/spells/targeting/TargetValidationUtils.ts, systems/spells/validation/LegacySpellValidator.ts, systems/spells/validation/SpellIntegrityValidator.ts, systems/spells/validation/TargetingPresets.ts, types/index.ts, types/mechanics.ts, types/spellAttackMetadata.ts, types/spellTargeting.ts, utils/character/savingThrowUtils.ts, utils/combat/combatUtils.ts, utils/combat/createEnemyFromMonster.ts, utils/combat/resistanceUtils.ts, utils/core/factories.ts, utils/validation/spellAuditor.ts, utils/validation/spellConsistencyValidator.ts, utils/visuals/spellVisuals.ts
 * Imports: 16 files
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
import type { SpellAttackType, SpellRarity, SpellSchool } from './spellCoreMetadata';
import type {
  AreaOfEffect,
  DistanceUnit,
  Range,
  ScalableNumber,
  SpellTargeting,
  TargetFilter,
} from './spellTargeting';
import type {
  EffectSchedule,
  ModeChoice,
} from './spellEffectMetadata';
import type { AttackAugment } from './spellAttackMetadata';
import type { AbilityCheckModifier } from './spellCheckMetadata';
import type { ControlledEntity } from './spellControlledEntity';
import { DamageType, DamageTypeDefinitions } from './spellDamageMetadata';
import type { DamageTypeTraits } from './spellDamageMetadata';
import type { IllusionMetadata, SensoryManifestation } from './spellIllusionMetadata';
import type { FallControl } from './spellFallMetadata';
import type { ConditionBreakTrigger } from './spellStatusMetadata';
import type { AIContext, ArbitrationType } from './spellArbitrationMetadata';
import type { ConditionalEnding, EffectEndCleanup, SustainRequirement } from './spellLifecycleMetadata';
import type { HigherLevelScaling, ScalingFormula } from './spellScalingMetadata';
import type { DurationProgression } from './spellDurationMetadata';
import type {
  BarrierDamagePrevention,
  DamageInteraction,
  DeathPrevention,
  LinkedDamage,
  ResistanceSuppression,
  SpellEffectPrevention,
} from './spellProtectionMetadata';
export type { SpellAttackType, SpellRarity, SpellSchoolTraits } from './spellCoreMetadata';
export { MagicSchool, SpellSchool, SpellSchoolDefinitions } from './spellCoreMetadata';
export type {
  IllusionMetadata,
  IllusionRevealRule,
  SensoryChannel,
  SensoryManifestation,
  SensoryManifestationSize,
  SensoryManifestationVariant,
} from './spellIllusionMetadata';
export type { ControlledEntity } from './spellControlledEntity';
export type { AbilityCheckModifier } from './spellCheckMetadata';
export type { FallControl } from './spellFallMetadata';
export type { ConditionBreakTrigger } from './spellStatusMetadata';
export { DamageType, DamageTypeDefinitions } from './spellDamageMetadata';
export type { DamageTypeTraits } from './spellDamageMetadata';
export type { AIContext, ArbitrationType } from './spellArbitrationMetadata';
export type { ConditionalEnding, EffectEndCleanup, SustainRequirement } from './spellLifecycleMetadata';
export type { DurationProgression, DurationProgressionExtension } from './spellDurationMetadata';
export type {
  AreaSizeBonusScaling,
  CharacterLevelTierScaling,
  HigherLevelScaling,
  HigherLevelScalingRule,
  MultipleHigherLevelScaling,
  ScalingFormula,
  SlotLevelBonusScaling,
  SlotLevelTableScaling,
  SpecialTextOnlyHigherLevelScaling,
  TargetCountBonusScaling,
} from './spellScalingMetadata';
export type {
  BarrierDamagePrevention,
  DamageInteraction,
  DeathPrevention,
  LinkedDamage,
  ResistanceSuppression,
  SpellEffectPrevention,
} from './spellProtectionMetadata';
export type {
  AttackAbilitySubstitution,
  AttackAugment,
  AttackDamageDieOverride,
  AttackDamageTypeChoice,
  AttackDamageTypeChoiceOption,
  AttackWeaponRequirement,
  GrantedAttack,
} from './spellAttackMetadata';
export type {
  EffectSchedule,
  EffectScheduleEntry,
  EffectScheduleTargeting,
  ModeChoice,
  ModeChoiceOption,
} from './spellEffectMetadata';
export type {
  AreaOfEffect,
  AreaTargetSelection,
  AreaTargeting,
  DistanceUnit,
  GeometrySizeType,
  HybridTargeting,
  MultiTargeting,
  PointTargeting,
  Range,
  ScalableNumber,
  ScalableNumberObject,
  SelfTargeting,
  SingleTargeting,
  SpatialDetails,
  SpatialForm,
  SpatialMeasuredDetail,
  SpatialMeasuredUnit,
  SpellTargeting,
  TargetAllocation,
  TargetCluster,
  TargetFilter,
  TargetInstanceAllocation,
} from './spellTargeting';
export {
  isScalableNumberObject,
  resolveScalableNumber,
} from './spellTargeting';

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
  subClasses: string[];
  /**
   * Retired 2026-05-11. Optional for backward compatibility with JSON files
   * that still carry it; the Sub-Classes bucket closure made this redundant.
   * New files should omit it.
   */
  subClassesVerification?: "unverified" | "verified";
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
  /**
   * Structured rules that change the spell's duration after later play.
   *
   * Why this exists:
   * repeated daily casting, recasting an active structure, or maintaining
   * concentration for the full duration can make a spell last until dispelled,
   * become permanent, or extend its current lifetime. Those rules are not
   * higher-slot scaling and should not stay hidden in prose.
   */
  durationProgression?: DurationProgression[];
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
  /**
   * Optional menu of mutually exclusive spell modes.
   *
   * Why this exists:
   * many utility spells say "choose one of the following effects." That is not
   * the same as choosing a target; it changes which operation the spell performs.
   * The menu lives here while the actual damage, terrain, utility, or control
   * payloads remain in `effects[]`.
   */
  modeChoice?: ModeChoice;
  /**
   * Optional turn or phase schedule for spells whose effects change over time.
   *
   * Why this exists:
   * some spells, such as Storm of Vengeance, already have separate effect
   * packets for each damage/control event, but a plain `turn_start` trigger
   * cannot say "this packet happens on Turn 2, that packet happens on Turn 3,
   * and this other packet repeats on Turns 5 through 10." The schedule keeps
   * that order machine-readable without flattening the underlying effects.
   */
  effectSchedule?: EffectSchedule;
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

//==============================================================================
// Range And Targeting Re-Exports
//==============================================================================
// Range, geometry, scalable target counts, and full targeting shapes live in
// `spellTargeting.ts`. They are imported above and re-exported here so older
// callers can keep using `types/spells` while the file stays reviewable.
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
// The targeting contract was moved to `spellTargeting.ts` during the mechanics
// closure modularization checkpoint. This file re-exports that public surface so
// existing imports from `types/spells` continue to work while targeting can grow
// in a smaller, reviewable module.
//==============================================================================
// Effect System
//==============================================================================

/** A discriminated union representing all possible spell effects. */
export type SpellEffect =
  | DamageEffect
  | HealingEffect
  | StatusConditionEffect
  | AttackRollModifierEffect
  | MovementEffect
  | SummoningEffect
  | TerrainEffect
  | UtilityEffect
  | DefensiveEffect
  | ReactiveEffect; // Added ReactiveEffect

/** The six primary ability scores used for saving throws. */
export type SavingThrowAbility = "Strength" | "Dexterity" | "Constitution" | "Intelligence" | "Wisdom" | "Charisma";

// TODO(Taxonomist): Refactor codebase to use ConditionType enum from ./conditions.ts strictly instead of ConditionName union.
// This requires updating all references in combat logic, effect processing, and UI components.

/** The fourteen status conditions in D&D 5e plus custom game conditions. */
export type ConditionName =
  | "Blinded" | "Charmed" | "Deafened" | "Exhaustion" | "Frightened"
  | "Grappled" | "Incapacitated" | "Invisible" | "Paralyzed" | "Petrified"
  | "Poisoned" | "Prone" | "Restrained" | "Stunned" | "Unconscious" | "Ignited"
  // Custom conditions for game mechanics (e.g., feat effects)
  | "Slowed" | "Slasher Slow";

/** Modifiers that adjust how a saving throw is made. */
export interface SaveModifier {
  type: "advantage" | "disadvantage" | "bonus" | "penalty" | "cover_bypass";
  value?: number;
  appliesTo?: TargetConditionFilter;
  reason?: string;
  /** Cover grades ignored by spells such as Sacred Flame when resolving Dexterity saves. */
  ignoredCover?: ("half" | "three_quarters" | "total")[];
}

/** Timings that can ask an affected target to repeat a saving throw or check. */
export type RepeatSaveTiming =
  | "turn_end"
  | "turn_start"
  | "on_damage"
  | "on_action"
  | "after_forced_movement";

/** Modifiers that only apply to repeat-save attempts, not the initial save. */
export interface RepeatSaveModifiers {
  advantageOnDamage?: boolean;
  sizeAdvantage?: string[];
  sizeDisadvantage?: string[];
}

/** Tracks repeat-save counters such as Flesh to Stone and Contagion. */
export interface RepeatSaveProgression {
  successThreshold?: number;
  failureThreshold?: number;
  consecutiveRequired?: boolean;
  successOutcome?: "ends_spell" | "ends_condition" | "not_restrained" | "not_applicable" | string;
  failureOutcome?: "condition_becomes_persistent" | "apply_condition" | "repeat_damage" | "not_applicable" | string;
}

/** Preconditions that must be true before a repeat save can be attempted. */
export type RepeatSavePrerequisite = "no_line_of_sight_to_caster";

/** Defines recurring save/check attempts that can end, continue, or transform a status. */
export interface RepeatSave {
  timing: RepeatSaveTiming;
  /** Additional timings preserve spells that repeat both at turn end and on damage. */
  additionalTimings?: RepeatSaveTiming[];
  saveType: SavingThrowAbility | "strength_check" | "wisdom_check";
  successEnds: boolean;
  useOriginalDC: boolean;
  /** Optional gates such as Fear's no-line-of-sight requirement. */
  prerequisites?: RepeatSavePrerequisite[];
  modifiers?: RepeatSaveModifiers;
  progression?: RepeatSaveProgression;
}

/** Describes repeated non-save mechanics that ride on an existing spell effect. */
export interface RecurringMechanic {
  timing: "turn_start" | "turn_end" | "on_damage" | "on_move_in_area" | "on_entity_proximity" | "on_target_cast";
  frequency?: "every_time" | "first_per_turn" | "once_per_creature";
  saveType?: SavingThrowAbility;
  saveEffect?: "none" | "half" | "negates_condition";
  damage?: DamageData;
  healing?: HealingData;
  successOutcome?: string;
  failureOutcome?: string;
  restriction?: string;
  notes?: string;
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
  // Movement-within-area is used by zone hazards such as Spike Growth. Keeping
  // it in the exported type keeps TypeScript callers aligned with the Zod
  // validator and the AreaEffectTracker runtime path.
  | "on_move_in_area"
  | "on_target_move"
  | "on_target_takes_damage"
  | "on_target_attack"
  | "on_target_cast"
  | "on_entity_proximity"
  | "on_caster_action"
  | "on_granted_action"
  | "on_attack_hit";
  /**
   * Controls how often this trigger can fire.
   * Defaults to 'every_time' if not specified.
   */
  frequency?: "every_time" | "first_per_turn" | "once" | "once_per_creature";
  /**
   * For rider effects (on_attack_hit), controls consumption.
   */
  consumption?: "unlimited" | "first_hit" | "per_turn" | "per_instance_hit_or_miss";
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
  /** Plane-native restriction used by banishment-style and summoning-adjacent effects. */
  isNativeToPlane?: boolean;
  /** Whether the spell requires a willing target, rejects willing targets, or does not care. */
  willing?: "willing" | "unwilling" | "not_applicable";
  /** Object-specific gates such as worn, carried, magical, fixed, size, and weight limits. */
  objectEligibility?: {
    wornOrCarried?: string;
    magicalStatus?: string;
    fixedToSurface?: string;
    maxSize?: string;
    maxWeightPounds?: number | string;
    maxWeightScaling?: string;
  };
  /** Rules for placing created effects or teleporting targets. */
  placementEligibility?: {
    unoccupied?: "required" | "not_applicable";
    surface?: "ground" | "liquid" | "any_solid" | "not_applicable";
    destination?: "safest_nearby" | "nearest_unoccupied" | "caster_choice" | "not_applicable";
    notes?: string;
  };
  /** Narrow identity filters beyond broad creature types (e.g. humanoid-only, corpse-only, or specific reaction triggers). */
  specialIdentity?: {
    corpseOrRemains?: "required" | "not_applicable";
    reactionTriggeringCreature?: "required" | "not_applicable";
    summonedByCaster?: "required" | "not_applicable";
    notes?: string;
  };
  /** Communication and perception gates that make social/control targeting explicit. */
  communicationPrerequisites?: {
    canHearCaster?: "required" | "not_applicable";
    canUnderstandCaster?: "required" | "not_applicable";
    canSeeCaster?: "required" | "not_applicable";
  };
  /** Ability-score threshold gates such as "Intelligence 4 or higher." */
  abilityThreshold?: {
    ability?: string;
    operator?: string;
    value?: number | string;
  };
  /** Whether the target must be the caster, another creature, or has no self/other rule. */
  selfRelation?: string;
}

/** Describes a secondary or chained target reached from a spell's first target. */
export interface SecondaryTargeting {
  /** What event allows the secondary target to be chosen. */
  trigger: "primary_hit" | "duplicate_damage_die";
  /** Where the secondary range is measured from. */
  origin: "primary_target" | "previous_target";
  /** Maximum distance from the origin to the secondary or chained target. */
  range: number;
  /** Unit for the secondary target range. */
  rangeUnit: DistanceUnit;
  /** Which target category the secondary selection can choose. */
  validTargets: "creature" | "creature_or_object";
  /** Current supported selection mode: the caster chooses the secondary target. */
  selection: "caster_choice";
  /** True when the secondary target must differ from the origin target. */
  mustBeDifferent: boolean;
  /** True when the secondary selection has an explicit sight requirement. */
  requiresLineOfSight: boolean;
  /** Whether resolving the secondary target requires a fresh attack roll. */
  requiresAttackRoll: boolean;
  /** Whether resolving the secondary target requires a fresh damage roll. */
  requiresDamageRoll: boolean;
  /** Whether and how the secondary target can chain again. */
  repeatRule?: "none" | "slot_level_max_leaps";
  /** Fixed or scalable maximum number of leaps/chains allowed. */
  maxLeaps?: number | "slot_level";
  /** True when each creature may only be selected once by the casting. */
  uniquePerCasting?: boolean;
  notes?: string;
}


/** Describes sound emitted by a spell or effect. */
export interface SoundEmission {
  audibleRadius: number | "not_applicable";
  radiusUnit: "feet" | "miles" | "not_applicable";
  source: "caster" | "target" | "target_object" | "origin_space" | "spell_area" | "not_applicable";
  trigger: "on_cast" | "on_hit" | "after_teleport" | "on_trigger" | "not_applicable";
  description?: string;
}

/** Base interface for all spell effects. */
export interface BaseEffect {
  trigger: EffectTrigger;
  condition: EffectCondition;
  scaling?: ScalingFormula;
  /** Secondary target relationship for leap, chain, or splash-like follow-up effects. */
  secondaryTargeting?: SecondaryTargeting;
  /** Repeated secondary mechanics, such as turn-start temp HP or first-per-turn rider damage. */
  recurringMechanics?: RecurringMechanic[];
  /** Sound is a sensory mechanic when it has gameplay-facing radius, source, or timing. */
  soundEmission?: SoundEmission;
  /** Sensory manifestation limits, such as which senses an illusion can or cannot create. */
  sensoryManifestation?: SensoryManifestation;
  /** Illusion reveal/discernment rules and the state after a creature sees through the effect. */
  illusion?: IllusionMetadata;
  /** Falling-specific control, such as slowing descent and preventing fall damage on landing. */
  fallControl?: FallControl;
  /** Early-ending rules that stop the spell, one effect, or an item before normal duration expiry. */
  conditionalEndings?: ConditionalEnding[];
  /** Conditions this effect ends immediately, such as Protection from Poison ending Poisoned. */
  conditionRemoval?: ConditionName[];
  /** Damage blocked because it crosses a spell barrier rather than because of resistance. */
  barrierDamagePrevention?: BarrierDamagePrevention;
  /** Spell effects blocked before they can affect protected targets or areas. */
  spellEffectPrevention?: SpellEffectPrevention;
  /** Last-moment death safeguards, such as Death Ward preventing 0 HP or instant death. */
  deathPrevention?: DeathPrevention;
  /** Cleanup rules that remove spell-created state when the spell or effect ends. */
  endCleanup?: EffectEndCleanup[];
  /** Ongoing action costs required to keep a spell or effect active after casting. */
  sustainRequirement?: SustainRequirement;
  /** Actions granted by this effect to the caster, target, or other actor. */
  grantedActions?: GrantedAction[];
  /** Damage mirrored from one linked participant to another. */
  linkedDamage?: LinkedDamage;
  /** Temporary removal of a target's resistance to one or more damage types. */
  resistanceSuppression?: ResistanceSuppression;
  /** Area or mode-based changes to damage interaction, such as Hallow resistance/vulnerability choices. */
  damageInteraction?: DamageInteraction;
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
  /** Specifies if the damage type is chosen or copied from a trigger. */
  damageTypeSource?: "listed" | "triggering_damage_type" | "chosen_damage_type";
  /** Mitigation rules the damage explicitly ignores, for self-cost damage that cannot be reduced or prevented. */
  mitigationBypass?: ("resistance" | "immunity" | "damage_reduction" | "damage_prevention")[];
  /** Optional destruction rule for damage that can remove a target from the world instead of only lowering HP. */
  disintegration?: {
    /** Whether a creature is turned to residue when this damage leaves it at 0 Hit Points. */
    creatureAtZeroHp: boolean;
    /** Whether nonmagical worn and carried items are destroyed with the creature. */
    includesNonmagicalWornAndCarried: boolean;
    /** Which magic can restore the target after this special destruction. */
    revivalOnlyBy: string[];
    /** Target categories that are destroyed automatically rather than damaged normally. */
    automaticTargetTypes: string[];
    /** Largest complete object size the spell destroys automatically. */
    maxAutomaticTargetSize: string;
    /** Portion removed from larger objects or force creations. */
    hugeOrLargerPortionCubeFeet: number;
    /** Name of the visible residue left behind after destruction. */
    residueName: string;
    /** Human-readable description of what remains for inventory, map, or narration systems. */
    residueDescription: string;
  };
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

//==============================================================================
// Attack Roll Rider Effects
//==============================================================================

/**
 * A spell effect that changes how an attack roll is made without treating the
 * change as a named condition.
 *
 * Why this exists:
 * Some spells say "attacks against this creature have disadvantage" or "this
 * creature's next attack has disadvantage." Those are real combat mechanics,
 * but they are not conditions like Prone or Blinded. This shape gives those
 * riders their own runtime home so the attack system can read them later.
 */
export interface AttackRollModifierEffect extends BaseEffect {
  type: "ATTACK_ROLL_MODIFIER";
    attackRollModifier?: {
    /** Advantage/disadvantage or a numeric/dice shift to the attack roll. */
    modifier: "advantage" | "disadvantage" | "bonus" | "penalty";
    /** Incoming modifies attacks against the affected creature; outgoing modifies attacks the affected creature makes. */
    direction: "incoming" | "outgoing";
    /** Which attack family the rider applies to. */
    attackKind: "any" | "weapon" | "melee_weapon" | "ranged_weapon" | "spell";
    /** Whether the rider is consumed by one attack or remains for the whole active duration. */
    consumption: "next_attack" | "first_attack" | "while_active";
    /** How long the rider can be read by combat before it expires. */
    duration: EffectDuration;
    /** Optional dice amount for bonus/penalty riders such as Bane. */
    dice?: string;
    /** Optional flat amount for bonus/penalty riders. */
    value?: number;
    /** Optional attacker filter for rider families that only affect certain creature types. */
    attackerFilter?: TargetConditionFilter;
    /** Human-readable caveats that the current combat filter model cannot express yet. */
    notes?: string;
  };
  savingThrowModifier?: {
    /** Advantage/disadvantage or a numeric/dice shift to the saving throw. */
    modifier: "advantage" | "disadvantage" | "bonus" | "penalty";
    /** Whether the rider is consumed by one save or remains for the whole active duration. */
    consumption: "next_save" | "while_active";
    /** How long the rider can be read by combat before it expires. */
    duration: EffectDuration;
    /** Optional dice amount for bonus/penalty riders such as Bane. */
    dice?: string;
    /** Optional flat amount for bonus/penalty riders. */
    value?: number;
    /** Optional requirement for a specific ability score (e.g. Dexterity). */
    ability?: SavingThrowAbility;
    /** Human-readable caveats that the current combat filter model cannot express yet. */
    notes?: string;
  };
  /**
   * Optional bundled damage for spells such as Frostbite where the same save
   * controls both damage and the later attack-roll rider.
   */
  damage?: DamageData;
  /**
   * Optional bundled status condition to apply if the save fails.
   */
  statusCondition?: StatusCondition;
}

/** Defines the applied status condition and its duration. */
export interface StatusCondition {
  name: ConditionName;
  duration: EffectDuration;
  level?: number;
  escapeCheck?: EscapeCheck;
  repeatSave?: RepeatSave;
  /** Events that end this condition before its duration or repeat-save path resolves. */
  breakTriggers?: ConditionBreakTrigger[];
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
  /** Who is allowed to spend the action/check to end the condition. */
  eligibleActors?: ("affected_creature" | "creature_that_can_reach_affected_creature")[];
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
  /**
   * Runtime assignment map for spells that move more than one target to
   * separately chosen destinations, such as Scatter. This is not intended for
   * static spell JSON; the combat UI should fill it after the caster chooses
   * one legal landing space per affected target.
   */
  destinationsByTargetId?: Record<string, { x: number; y: number }>;
  duration: EffectDuration;
  forcedMovement?: ForcedMovement;
}

/** An effect that summons creatures or objects. */

/** Structured statistics for a summoned entity. */
export interface SummonedEntityStatBlock {
  name?: string;
  type?: string;
  size?: "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan";
  ac?: number;
  hp?: number;
  speed?: number;
  flySpeed?: number;
  climbSpeed?: number;
  swimSpeed?: number;
  abilities?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  senses?: string[];
  skills?: Record<string, number>;
  attacks?: Array<{
    name: string;
    type: "melee" | "ranged";
    reach?: number;
    range?: { normal: number; long?: number };
    bonus: string | number; // "spell_attack" or flat bonus
    damage: string; // e.g. "1d6 + spell_level"
    damageType: string;
  }>;
}

export interface SummoningEffect extends BaseEffect {
  type: "SUMMONING";
  // Legacy flat fields for backward compatibility during transition
  summonType?: "creature" | "object";
  creatureId?: string; // ID from a creature database
  objectDescription?: string; // Description for summoned objects
  count?: number; // How many creatures/objects are summoned
  familiarContract?: FamiliarContract;

  // Modern nested structure aligned with spellValidator
  summon?: {
    entityType: "familiar" | "servant" | "construct" | "creature" | "undead" | "mount" | "object";
    persistent?: boolean;
    dismissAction?: "action" | "bonus_action" | "free" | "none";
    count?: number;
    countByCR?: Record<string, number>;
    formOptions?: string[];
    statBlock?: SummonedEntityStatBlock;
    objectDescription?: string;
    commandCost?: "action" | "bonus_action" | "free" | "none";
    commandsPerTurn?: number;
    initiative?: "immediate" | "rolled" | "shared";
    followDistance?: number;
    hoverHeight?: number;
    telepathyRange?: number;
    sharedSenses?: boolean;
    sharedSensesCost?: "action" | "bonus_action" | "free" | "none";
    specialActions?: Array<{
      name: string;
      description: string;
      cost: "action" | "bonus_action" | "reaction" | "free";
      damage?: {
        dice: string;
        type: string;
      };
    }>;
  };
  duration: EffectDuration;
}

/** Structured terrain manipulation for spells like Mold Earth */
export interface TerrainManipulation {
  /** Type of manipulation: excavate/fill dirt, toggle difficult terrain, or cosmetic changes */
  type: "excavate" | "fill" | "difficult" | "normal" | "cosmetic" | "reshape";
  /** Volume of terrain affected */
  volume?: {
    shape: "Cube" | "Square";
    size: number;  // in feet
    depth?: number; // in feet, for excavation
  };
  /** Materials the spell can reshape, such as dirt, sand, or clay. */
  materialOptions?: string[];
  /** Materials or construction types the spell cannot directly manipulate. */
  excludedMaterials?: string[];
  /** Terrain forms the caster can create or remove. */
  formOptions?: ("elevation" | "trench" | "wall" | "pillar" | "not_applicable")[];
  /** Maximum vertical change for elevation, trench depth, wall height, or pillar height. */
  maxChangeFeet?: number;
  /** Time required before one terrain transformation is complete. */
  completionTimeMinutes?: number;
  /** Whether the caster can choose another area after each completed interval while concentrating. */
  canChooseNewAreaAfterCompletion?: boolean;
  /** Whether the slow movement normally prevents trapping or injuring creatures directly. */
  slowTransformationPreventsTrappingOrInjury?: boolean;
  /** Whether nearby rocks and structures shift to accommodate the new terrain. */
  rocksAndStructuresShift?: boolean;
  /** Whether unstable structures can collapse because of the new terrain shape. */
  unstableStructuresMayCollapse?: boolean;
  /** Whether plants are carried with the moved earth without changing their growth directly. */
  carriesPlantsWithoutAffectingGrowth?: boolean;
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
  attackAugments?: AttackAugment[];
  abilityCheckModifier?: AbilityCheckModifier;
  controlledEntity?: ControlledEntity;
  createdObjects?: CreatedObject[];
  objectAccessChange?: ObjectAccessChange;
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

/** Machine-readable changes to doors, chests, locks, bars, seals, and similar access-blocking objects. */
export interface ObjectAccessChange {
  /** Object families the spell can affect, kept as player-facing labels because map object taxonomies are still expanding. */
  eligibleObjectTypes: string[];
  /** Mundane object states the spell can remove or change. */
  mundaneStateChanges: ("unlock" | "unstick" | "unbar")[];
  /** Maximum number of mundane locks the spell opens on a multiply locked object. */
  maxLocksAffected: number;
  /** Magical closure that is suppressed instead of permanently removed. */
  suppressesMagicalClosure?: string;
  /** How long the named magical closure is suppressed. */
  suppressionDuration?: EffectDuration;
  /** Whether the target can still be opened and closed while the magical closure is suppressed. */
  targetOperableDuringSuppression?: boolean;
  /** Audible cue produced by the access change, when the spell broadcasts its use. */
  soundEmission?: {
    audibleRadius: number;
    radiusUnit: "feet" | "miles";
    source: "target_object" | "caster" | "point";
    trigger: "on_cast" | "on_change";
    description: string;
  };
}

/** Machine-readable object stacks created by utility spells such as Goodberry. */
export interface CreatedObject {
  /** The gameplay family of object created by the spell. */
  objectType: "food" | "water" | "ammunition" | "weapon" | "portal" | "structure" | "hazard" | "other";
  /** Player-facing object name, for example "Goodberry". */
  name: string;
  /** How many instances or units are created. */
  count: number;
  /** Optional slot-level scaling for the created-object count, such as +10 gallons per slot. */
  countScaling?: {
    type: "slot_level";
    bonusPerLevel: number;
  };
  /** Unit used by the count so pounds, gallons, and discrete objects stay distinct. */
  countUnit: "item" | "pound" | "gallon" | "cubic_foot" | "square_foot" | "structure" | "not_applicable";
  /** Where the object appears relative to the cast. */
  appearsIn: "caster_hand" | "target_container" | "ground" | "unoccupied_space" | "spell_area" | "not_applicable";
  /** Allowed shapes for created structures or objects, such as round or square towers. */
  shapeOptions?: string[];
  /** Allowed material choices for created structures or objects. */
  materialOptions?: string[];
  /** Whether the spell creates only nonliving objects rather than creatures or animated beings. */
  nonlivingObjectOnly?: boolean;
  /** Whether the caster must already have seen the object's form and material. */
  requiresSeenFormAndMaterial?: boolean;
  /** Planar or magical source of the created object's substance, when the spell specifies one. */
  materialSource?: string;
  /** Maximum cube edge or equivalent bounding size for a freely chosen created object. */
  maxCreatedObjectCubeFeet?: number;
  /** Slot-level scaling for a created object's maximum cube edge. */
  maxCreatedObjectCubeScaling?: {
    type: "slot_level";
    bonusPerLevel: number;
  };
  /** Duration lookup keyed by material choice for objects whose lifetime depends on material. */
  durationByMaterial?: Record<string, string>;
  /** Whether mixed-material objects use the shortest material duration in the table. */
  mixedMaterialsUseShortestDuration?: boolean;
  /** Whether using the created object as another spell's Material component makes that spell fail. */
  cannotServeAsMaterialComponent?: boolean;
  /** Whether the created object must be made from visible raw materials. */
  requiresVisibleRawMaterials?: boolean;
  /** Whether the source raw materials are consumed or transformed into the output. */
  consumesSourceMaterials?: boolean;
  /** Whether the created object must be made from the same material as the source. */
  outputSameMaterialAsSource?: boolean;
  /** Maximum non-mineral object size as a cube edge or equivalent connected cube volume. */
  maxFabricatedObjectCubeFeet?: number;
  /** Maximum number of connected 5-foot cubes allowed for non-mineral fabrication. */
  maxConnectedFiveFootCubes?: number;
  /** Maximum size for metal, stone, or mineral fabrication. */
  maxMineralObjectCubeFeet?: number;
  /** Whether output quality is limited by the source material quality. */
  qualityLimitedByMaterials?: boolean;
  /** Whether the spell is forbidden from creating creatures. */
  cannotCreateCreatures?: boolean;
  /** Whether the spell is forbidden from creating magic items. */
  cannotCreateMagicItems?: boolean;
  /** Whether skilled goods require matching artisan-tool proficiency. */
  skilledGoodsRequireToolProficiency?: boolean;
  /** Maximum stone thickness or dimension the spell can reshape. */
  maxStoneDimensionFeet?: number;
  /** Maximum number of hinges the shaped object can include. */
  maxHinges?: number;
  /** Whether the shaped object can include a latch. */
  canIncludeLatch?: boolean;
  /** Whether the spell can create fine mechanical detail. */
  canCreateFineMechanicalDetail?: boolean;
  /** Number of levels/stories/segments in a created structure. */
  levels?: number;
  /** Optional slot-level scaling for structure levels, such as +1 story per slot. */
  levelScaling?: {
    type: "slot_level";
    bonusPerLevel: number;
  };
  /** Height of each created structure level. */
  levelHeightFeet?: number;
  /** Maximum area per created structure level. */
  areaPerLevelSquareFeet?: number;
  /** Whether the created structure includes access between levels. */
  accessBetweenLevels?: boolean;
  /** Whether doors/windows can be secured from inside. */
  secureOpenings?: boolean;
  /** Whether the structure provides simple furnishings. */
  furnished?: boolean;
  /** Whether the structure is warm and dry regardless of outside weather. */
  weatherProtected?: boolean;
  /** Source that defines a sacred or themed created structure's dedication. */
  dedicationSource?: string;
  /** Whether the caster chooses the created structure's outward appearance. */
  appearanceChosenByCaster?: boolean;
  /** Required interior fixtures or sacred features inside the structure. */
  interiorFeatures?: string[];
  /** Number of required doors in the created structure. */
  doorCount?: number;
  /** Whether only the caster and casting-time designates can operate the door. */
  doorControlledByCasterAndDesignates?: boolean;
  /** Whether the caster chooses how many windows the structure has. */
  windowsCasterChoice?: boolean;
  /** Lighting states the caster can choose for the created structure. */
  illuminationOptions?: ("bright" | "dim" | "unlit" | "not_applicable")[];
  /** Ambient scent or atmosphere created inside the structure. */
  ambientScent?: string;
  /** Temperature state maintained inside the created structure. */
  ambientTemperature?: "mild" | "normal" | "not_applicable";
  /** Width of a created doorway, portal, or aperture. */
  portalWidthFeet?: number;
  /** Height of a created doorway, portal, or aperture. */
  portalHeightFeet?: number;
  /** Whether the created object opens into extradimensional space. */
  extradimensionalSpace?: boolean;
  /** Creature capacity for a created space or container-like object. */
  capacityCreatures?: number;
  /** Maximum creature size allowed by the created space, when specified. */
  capacityCreatureMaxSize?: string;
  /** Whether attacks, spells, or other effects are blocked across the created boundary. */
  blocksCrossBoundaryEffects?: boolean;
  /** Whether occupants inside the created space can see out through the boundary. */
  occupantsCanSeeOut?: boolean;
  /** Whether remaining contents are expelled when the spell or object ends. */
  contentsDropOutOnEnd?: boolean;
  /** Whether expulsion places occupants safely in the nearest open space. */
  safelyEjectsContentsOnEnd?: boolean;
  /** Whether creating the passage avoids destabilizing the surrounding structure. */
  preservesStructuralStability?: boolean;
  /** Whether the created object must be anchored to solid supports or surfaces. */
  requiresAnchoring?: boolean;
  /** What supports satisfy the anchoring requirement. */
  anchoringOptions?: string[];
  /** Whether unsupported created matter collapses or ends early. */
  collapsesIfUnsupported?: boolean;
  /** Timing for unsupported collapse, such as "start_of_caster_next_turn". */
  collapseTiming?: string;
  /** Whether the created object makes its area obscured. */
  obscuresArea?: "lightly" | "heavily" | "not_applicable";
  /** Cover level the created object provides to creatures using or standing behind it. */
  providesCover?: "half" | "three_quarters" | "total" | "not_applicable";
  /** Whether the created object's own space is difficult terrain. */
  spaceIsDifficultTerrain?: boolean;
  /** Whether ranged weapon attacks that pass through this object have disadvantage. */
  rangedWeaponAttacksThroughHaveDisadvantage?: boolean;
  /** Damage type reduced when an effect passes through this object. */
  reducesPassingDamageType?: DamageType;
  /** Multiplier applied to the reduced passing damage type. */
  passingDamageMultiplier?: number;
  /** Whether a damage type can transform part of this object into frozen sections. */
  canFreezeFromDamageType?: DamageType;
  /** Minimum section size created when part of the object freezes. */
  frozenSectionSizeFeet?: number;
  /** Armor Class of a frozen section created from this object. */
  frozenSectionArmorClass?: number;
  /** Hit points of a frozen section created from this object. */
  frozenSectionHitPoints?: number;
  /** Whether destroyed frozen sections remain empty instead of refilling. */
  destroyedFrozenSectionsDoNotRefill?: boolean;
  /** Maximum created wall length when the object is a wall or barrier. */
  wallLengthFeet?: number;
  /** Created wall height when the object is a wall or barrier. */
  wallHeightFeet?: number;
  /** Wall or barrier thickness measurement. */
  wallThickness?: number;
  /** Unit used by the wall thickness measurement. */
  wallThicknessUnit?: "feet" | "inches" | "not_applicable";
  /** Number of wall panels or sections created by the spell. */
  panelCount?: number;
  /** Width of one wall panel or section. */
  panelWidthFeet?: number;
  /** Height of one wall panel or section. */
  panelHeightFeet?: number;
  /** Whether wall panels or sections must connect to one another. */
  panelContiguityRequired?: boolean;
  /** Legal orientation choices for the created wall or barrier. */
  orientationOptions?: ("horizontal" | "vertical" | "diagonal" | "angled" | "caster_choice" | "not_applicable")[];
  /** Whether the barrier can float without a supporting surface. */
  freeFloating?: boolean;
  /** Whether creatures and objects are physically blocked by the barrier. */
  blocksPhysicalPassage?: boolean;
  /** Whether the created object blocks line of sight without necessarily blocking movement. */
  blocksLineOfSight?: boolean;
  /** Whether the barrier blocks travel through the Ethereal Plane. */
  blocksEtherealTravel?: boolean;
  /** Whether spell effects are blocked from crossing the created object. */
  blocksSpellEffects?: boolean;
  /** Whether energy effects are blocked from crossing the created object. */
  blocksEnergyEffects?: boolean;
  /** Whether contained creatures can breathe while enclosed by the object. */
  breathableInside?: boolean;
  /** Whether the barrier can be damaged by ordinary damage resolution. */
  immuneToDamage?: boolean;
  /** Armor Class for a created object that can be attacked and breached. */
  objectArmorClass?: number;
  /** Hit points per inch of thickness for panel-style created objects. */
  hitPointsPerInchThickness?: number;
  /** Fixed hit points for each section or panel when HP is not thickness-based. */
  sectionHitPoints?: number;
  /** Damage types that cannot damage this created object. */
  damageImmunities?: DamageType[];
  /** Damage types that deal extra damage to this created object. */
  damageVulnerabilities?: DamageType[];
  /** Whether Dispel Magic can end the created object. */
  immuneToDispelMagic?: boolean;
  /** Whether Antimagic Field fails to suppress or remove the created object. */
  immuneToAntimagicField?: boolean;
  /** Whether divination sensors are blocked from appearing inside the object. */
  blocksDivinationSensorsInside?: boolean;
  /** Whether divination spells cannot target creatures inside the object. */
  blocksDivinationTargetingInside?: boolean;
  /** Creature types the structure can be configured to oppose. */
  opposedCreatureTypeOptions?: string[];
  /** Save required when an opposed creature tries to enter. */
  opposedCreatureEntrySaveType?: SavingThrowAbility;
  /** Hours an opposed creature is barred after failing the entry save. */
  opposedCreatureEntryBlockedDurationHours?: number;
  /** Penalty die opposed creatures subtract while affected inside the structure. */
  opposedCreaturePenaltyDice?: string;
  /** Ability modifier used by the structure's healing bonus. */
  healingBonusAbilityModifier?: "Wisdom" | "spellcasting_ability" | "not_applicable";
  /** Minimum extra hit points restored by the healing bonus. */
  healingBonusMinimum?: number;
  /** Trigger that makes the structure's healing bonus apply. */
  healingBonusTrigger?: string;
  /** Number of daily casts needed before the structure becomes permanent. */
  permanenceRequiresDailyCasts?: number;
  /** Whether the permanence cadence requires the same map location each day. */
  permanenceSameLocationRequired?: boolean;
  /** Kind of inert or delayed entity represented by a created body. */
  createdEntityKind?: "clone_body" | "inert_duplicate" | "suspended_body" | "astral_form" | "other";
  /** Number of days before a created entity finishes growing or maturing. */
  growthDurationDays?: number;
  /** Whether the created entity forms inside a required vessel. */
  maturesInVessel?: boolean;
  /** Whether the spell requires a vessel to preserve the created entity. */
  vesselRequired?: boolean;
  /** Minimum value of the required vessel in gold pieces. */
  vesselMinimumValueGp?: number;
  /** Whether disturbing the vessel ends or invalidates the lifecycle. */
  vesselMustRemainUndisturbed?: boolean;
  /** Whether the created entity stays inert until a later trigger occurs. */
  inertUntilTrigger?: boolean;
  /** Event that activates the delayed created entity. */
  activationTrigger?: string;
  /** Whether activation requires a free and willing soul. */
  soulMustBeFreeAndWilling?: boolean;
  /** Whether activation moves the soul away from the original remains. */
  soulTransferConsumesOriginalRevival?: boolean;
  /** Whether the created body keeps the original creature's personality, memories, and abilities. */
  duplicateRetainsPersonalityMemoriesAbilities?: boolean;
  /** Whether the created body includes the original creature's equipment. */
  duplicateHasOriginalEquipment?: boolean;
  /** Whether the caster chooses the duplicate body's finished age. */
  casterChoosesFinalAge?: boolean;
  /** Whether the matured created entity endures indefinitely after growth completes. */
  enduresIndefinitelyAfterMature?: boolean;
  /** Whether a suspended or projected body still needs food or air. */
  needsFoodOrAir?: boolean;
  /** Whether a suspended or projected body continues aging. */
  agesWhileSuspended?: boolean;
  /** Whether this entity is linked to an astral form or original body. */
  linkedToCounterpartForm?: boolean;
  /** Whether the link is represented by a silver cord. */
  silverCordLink?: boolean;
  /** Distance the silver cord remains visible before fading from view. */
  silverCordVisibleDistanceFeet?: number;
  /** Outcome when an explicit effect cuts the silver cord. */
  silverCordCutEffect?: string;
  /** Whether damage on this entity is shared with its linked counterpart. */
  damageSharedWithCounterpart?: boolean;
  /** Whether non-damage effects on this entity are shared with its linked counterpart. */
  effectsSharedWithCounterpart?: boolean;
  /** Whether leaving the Astral Plane pulls the body and possessions to the new plane. */
  planarExitTransfersBodyAndPossessions?: boolean;
  /** Whether the spell ends for this target when either linked form reaches 0 hit points. */
  endsWhenBodyOrFormDropsToZeroHp?: boolean;
  /** Whether a living target returns to the body when the spell ends for that target. */
  returnsToBodyOnEndIfAlive?: boolean;
  /** Whether maintaining the spell for its full duration makes the object permanent. */
  permanentAfterFullDuration?: boolean;
  /** Whether the permanent result can no longer be dispelled. */
  nonDispellableWhenPermanent?: boolean;
  /** Spell ids or names that explicitly destroy the object despite normal immunity. */
  destroyedBySpells?: string[];
  /** Whether creatures cut by initial placement are moved to a caster-chosen side. */
  pushesCreaturesToChosenSide?: boolean;
  /** Saving throw available when a wall would trap a creature on all sides. */
  enclosureEscapeSaveType?: SavingThrowAbility;
  /** Whether a successful enclosure escape consumes the creature's Reaction. */
  enclosureEscapeUsesReaction?: boolean;
  /** How far a creature can move on a successful enclosure escape. */
  enclosureEscapeMoveDistance?: "speed" | "not_applicable";
  /** Whether destroying a section leaves another hazard in the same space. */
  leavesHazardOnSectionDestroyed?: boolean;
  /** Name of the lingering hazard left after a section is destroyed. */
  lingeringHazardName?: string;
  /** Damage caused by the lingering hazard left after destruction. */
  lingeringHazardDamage?: DamageData;
  /** Saving throw used by the lingering hazard, if any. */
  lingeringHazardSaveType?: SavingThrowAbility;
  /** What a successful save does against the lingering hazard. */
  lingeringHazardSaveEffect?: "none" | "half" | "negates_condition";
  /** How often the lingering hazard can affect the same creature. */
  lingeringHazardFrequency?: "first_per_turn" | "every_time" | "once_per_creature";
  /** Diameter of a created hazard or object with a round footprint. */
  diameterFeet?: number;
  /** Length of a narrow created object such as a blade-shaped rift. */
  objectLengthFeet?: number;
  /** Distance a spell-created movable object can travel when commanded. */
  moveDistanceFeet?: number;
  /** Reach from the created object to targets it can attack or affect. */
  attackReachFeet?: number;
  /** Number of attacks the created object can make when created or commanded. */
  attacksPerActivation?: number;
  /** Lowest natural d20 roll that counts as a critical hit for this object. */
  criticalHitThreshold?: number;
  /** Whether the created object can pass through barriers without interacting with them. */
  passesHarmlesslyThroughBarriers?: boolean;
  /** Whether the created object can attack loose objects. */
  canTargetLooseObjects?: boolean;
  /** Whether the created object can attack structures. */
  canTargetStructures?: boolean;
  /** Imprisonment-style prison modes available for the created restraint. */
  prisonModeOptions?: ("burial" | "chaining" | "hedged_prison" | "minimus_containment" | "slumber" | "not_applicable")[];
  /** Caster-chosen demiplane forms for a created prison. */
  demiplaneFormOptions?: string[];
  /** Whether the created prison prevents teleportation. */
  blocksTeleportation?: boolean;
  /** Whether the created prison prevents planar travel. */
  blocksPlanarTravel?: boolean;
  /** Whether light can pass through the prison boundary while matter cannot. */
  lightPassesThroughOnly?: boolean;
  /** Size, in inches, for a creature reduced by containment magic. */
  containedCreatureSizeInches?: number;
  /** Whether an observable caster-defined trigger can end the created prison. */
  observableEndingTriggerRequired?: boolean;
  /** Time window in years used to judge whether the ending trigger is likely. */
  endingTriggerExpectedWithinYears?: number;
  /** Minimum spell slot level needed for Dispel Magic to affect this object. */
  dispelMagicMinimumSlotLevel?: number;
  /** Valid things Dispel Magic can target to end the created object. */
  dispelMagicTargetOptions?: string[];
  /** Whether the object fails if placed in an occupied creature space. */
  failsIfPlacedInOccupiedSpace?: boolean;
  /** Creature groups allowed to ignore this object's harmful effects. */
  safePassageAllowedFor?: string[];
  /** Distance at which nearby creatures trigger this object's aura or hazard. */
  proximityTriggerRadiusFeet?: number;
  /** Number of ordered magical layers in the object. */
  layerCount?: number;
  /** Ordered layer names or colors for a multi-layer magical object. */
  layerOrder?: string[];
  /** Whether layers must be destroyed in order. */
  layersDestroyedInOrder?: boolean;
  /** Whether removed layers stay gone until the spell ends. */
  destroyedLayersRemainGone?: boolean;
  /** Whether Dispel Magic can affect only a named layer. */
  dispelMagicAffectsOnlyLayer?: string;
  /** Whether layer-specific table rules are needed for full effect execution. */
  requiresLayerEffectTable?: boolean;
  /** Whether an occupant can roll or push the object from inside. */
  movableByOccupants?: boolean;
  /** Whether outside creatures can pick up or move the object. */
  movableByExternalCreatures?: boolean;
  /** Multiplier applied to an occupant's Speed when rolling the object. */
  occupantRollSpeedMultiplier?: number;
  /** Maximum hover height above the ground for floating created objects. */
  hoverMaxHeightFeet?: number;
  /** Whether the created object safely descends when moved over a drop-off. */
  safelyDescendsOverDrops?: boolean;
  /** Maximum barrier height a movable created object can cross. */
  barrierHeightFeet?: number;
  /** Maximum pit width a movable created object can jump or cross. */
  pitJumpWidthFeet?: number;
  /** Radius around the object that applies adjacency or end-turn hazard effects. */
  hazardRadiusFeet?: number;
  /** Which side or region of a created object projects its hazard damage. */
  hazardSide?: "caster_choice" | "all_sides" | "inside" | "outside" | "not_applicable";
  /** Runtime events that can cause the created object's hazard damage. */
  hazardTriggers?: ("enter" | "end_turn_inside" | "end_turn_within_radius" | "first_per_turn")[];
  /** Shape of a manipulated fluid or loose-material volume, such as Shape Water's cube. */
  affectedVolumeShape?: "Cube" | "Sphere" | "Line" | "Wall" | "not_applicable";
  /** Size of the manipulated volume in feet, usually the cube edge or radius. */
  affectedVolumeSizeFeet?: number;
  /** Distance the affected material can be moved or redirected by the spell. */
  maxManipulationDistanceFeet?: number;
  /** Player-facing manipulation modes that can be applied to the affected object. */
  manipulationOptions?: string[];
  /** Maximum standing-water level change created by the spell. */
  waterLevelChangeFeet?: number;
  /** Chance that a vehicle affected by the water object capsizes. */
  vehicleCapsizeChancePercent?: number;
  /** Maximum vehicle size category affected by the water movement. */
  maxAffectedVehicleSize?: string;
  /** Whether a water-control mode can be repeated while it remains active. */
  repeatsOnCasterTurn?: boolean;
  /** Distance creatures are pulled by a water-control hazard. */
  pullDistanceFeet?: number;
  /** Ability check required to escape or swim away from the water-control hazard. */
  escapeCheck?: string;
  /** Whether the spell can animate the object into simple directed shapes. */
  canAnimateSimpleShapes?: boolean;
  /** Whether the spell can change the object's visible color or opacity. */
  canChangeColorOrOpacity?: boolean;
  /** Whether the spell can freeze the affected object or volume. */
  canFreeze?: boolean;
  /** Whether freezing is legal only when no creatures occupy the affected volume. */
  freezeRequiresNoCreatures?: boolean;
  /** Length of a transient wave or similar moving volume. */
  waveLengthFeet?: number;
  /** Width of a transient wave or similar moving volume. */
  waveWidthFeet?: number;
  /** Height of a transient wave or similar moving volume. */
  waveHeightFeet?: number;
  /** Radius within which unprotected flames are extinguished by the created water. */
  extinguishesUnprotectedFlamesRadiusFeet?: number;
  /** Whether the created water or wave disappears immediately after resolving. */
  vanishesAfterEffect?: boolean;
  /** Maximum number of Medium-or-smaller creatures the object can contain. */
  capacityMediumOrSmallerCreatures?: number;
  /** Maximum number of Large creatures the object can contain. */
  capacityLargeCreatures?: number;
  /** Whether creatures trapped inside move with the object. */
  occupantsMoveWithObject?: boolean;
  /** What happens when the object exceeds its creature capacity. */
  overflowEjectionRule?: "random_existing_occupant" | "newest_creature" | "not_applicable";
  /** Whether creatures that save successfully are ejected from the object. */
  successfulSaveEjectsCreature?: boolean;
  /** Distance from the object where ejected occupants can land. */
  ejectionDistanceFeet?: number;
  /** Whether occupants fall prone when the object ends or drops. */
  occupantsProneOnEnd?: boolean;
  /** Whether creatures on or in the created object become trapped by it. */
  trapsCreaturesOnSurface?: boolean;
  /** Condition applied to creatures trapped by the created object. */
  trappedCondition?: string;
  /** Whether touching the object ignites unattended flammable objects. */
  ignitesTouchedObjects?: boolean;
  /** Depth of layered created material, when specified. */
  depthFeet?: number;
  /** Whether the created material can be ignited. */
  flammable?: boolean;
  /** Size of one burnable section, such as a 5-foot cube of web. */
  burnUnitSizeFeet?: number;
  /** How many rounds one ignited section burns before destruction. */
  burnDurationRounds?: number;
  /** Damage caused by burning created material. */
  burnDamage?: DamageData;
  /** Whether created objects orbit the caster instead of occupying a board square. */
  orbitsCaster?: boolean;
  /** Whether each created object can be spent by a later granted action. */
  expendable?: boolean;
  /** Maximum number of created objects one follow-up action can spend. */
  maxExpendedPerAction?: number;
  /** Action needed to consume or use one created item, if it is consumable. */
  consumeAction?: "action" | "bonus_action" | "reaction" | "free" | "not_applicable";
  /** Hit points restored by consuming one item, such as one Goodberry. */
  healingPerItem?: number;
  /** Days of nourishment supplied by one item. */
  nourishmentDaysPerItem?: number;
  /** Multiplier applied when this created or altered food source is harvested. */
  harvestYieldMultiplier?: number;
  /** Radius covered by the harvest-yield change, measured from the spell point. */
  harvestYieldRadiusFeet?: number;
  /** Number of days the harvest-yield change remains active in the world. */
  harvestYieldDurationDays?: number;
  /** What kind of plants or food source can receive the harvest-yield change. */
  harvestYieldAppliesTo?: "plants" | "food_plants" | "not_applicable";
  /** How often a target area can benefit from the harvest-yield change. */
  harvestBenefitLimit?: string;
  /** Canonical inventory id to emit when the created object should feed existing systems. */
  inventoryItemId?: string;
  /** Stack quantity to emit for inventory systems when it differs from the created-object count. */
  inventoryQuantity?: number;
  /** Optional slot-level scaling for the emitted inventory stack quantity. */
  inventoryQuantityScaling?: {
    type: "slot_level";
    bonusPerLevel: number;
  };
  /** Whether the created object can spoil or otherwise expire by shelf-life timing. */
  perishable?: boolean;
  /** Whether unconsumed objects disappear when the spell duration ends. */
  expiresWithSpell?: boolean;
  /** Readable shelf-life for inventory/world-clock cleanup, such as "24 hours". */
  shelfLife?: string;
  notes?: string;
}

/** Defines a penalty applied to future saving throws (e.g., Mind Sliver's -1d4). */
export interface SavePenalty {
  dice: string;           // e.g., "1d4"
  flat?: number;          // Optional flat penalty, e.g., 2
  applies: "next_save";   // When the penalty applies
  duration: EffectDuration;
}

/** An effect that provides defensive bonuses (e.g., AC boost, resistance). */
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defenseType: "ac_bonus" | "set_base_ac" | "ac_minimum" | "resistance" | "immunity" | "damage_reduction" | "temporary_hp" | "advantage_on_saves" | "disadvantage_on_attacks";
  value?: number; // e.g., AC bonus or amount of temporary HP

  // AC Specifics
  acBonus?: number;
  baseACFormula?: string;
  acMinimum?: number;

  damageType?: DamageType[]; // For resistance/immunity
  /** Whether damageType is directly applied, chosen by the player, or copied from a triggering damage event. */
  damageTypeSource?: "listed" | "triggering_damage_type" | "chosen_damage_type";
  /** Damage types excluded from a broad resistance/immunity entry, such as "all except Psychic". */
  excludedDamageType?: DamageType[];
  /** Explicit damage subtraction rules, distinct from resistance or immunity. */
  damageReduction?: {
    dice: string;
    flat?: number;
    abilityModifier?: SavingThrowAbility;
    addProficiencyBonus?: boolean;
    appliesTo: "damage_taken";
    frequency?: "once_per_turn" | "every_time";
  };
  /** Non-condition mechanics this defense prevents, such as hit point maximum reduction. */
  preventionImmunity?: "hit_point_maximum_reduction"[];
  /** Conditions this defensive effect prevents, such as Heroism blocking Frightened. */
  conditionImmunity?: ConditionName[];
  /** Conditions this defensive effect suppresses without removing, such as Calm Emotions pausing Charmed. */
  conditionSuppression?: ConditionName[];
  savingThrow?: SavingThrowAbility[]; // For advantage on saves
  duration: EffectDuration;
  attackerFilter?: TargetConditionFilter;
  /** Filters the incoming source this defense applies to, such as nonmagical attacks only. */
  defenseSourceFilter?: {
    sourceCategories?: ("attack" | "spell" | "effect" | "environment")[];
    attackMagicalStatus?: "any" | "magical" | "nonmagical" | "not_applicable";
  };

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
  /** Who can use the action granted by the spell. */
  actor?: "caster" | "target" | "summoned_entity" | "affected_creature";
  /** Whether the granted action is a Magic action or another named action kind. */
  actionKind?: "magic_action" | "standard_action" | "bonus_action" | "reaction" | "not_applicable";
  /** Area shape produced by the granted action, when the action emits an area effect. */
  areaShape?: "Cone" | "Line" | "Sphere" | "Cube" | "Cylinder" | "not_applicable";
  /** Area size produced by the granted action, such as a 15-foot cone. */
  areaSize?: number | "not_applicable";
  /** Unit for the granted action area size. */
  areaSizeUnit?: "feet" | "miles" | "not_applicable";
  /** Effect indexes activated by this action. */
  effectIndices?: number[];
  /** Conditions that must be true before the granted action can be used. */
  prerequisites?: ("target_object_within_spell_range" | "target_within_spell_range" | "not_applicable")[];
  rangeLimit?: number;
  /** Attack roll model for granted actions that make their own later attack. */
  attackType?: "ranged_spell_attack" | "melee_spell_attack" | "not_applicable";
  /** Damage dealt by the granted action after its own hit/save gate succeeds. */
  damage?: DamageData;
  /** Saving throw used by the granted action when it resolves later. */
  saveType?: SavingThrowAbility;
  /** What a successful save does for the granted action payload. */
  saveEffect?: "none" | "half" | "negates_condition";
  /** Optional ability modifier added to the granted action's damage roll. */
  damageAbilityModifier?: "spellcasting_ability" | "not_applicable";
  /** Wall length removed after this granted action is used, hit or miss. */
  wallLengthReduction?: number;
  /** Whether the parent spell ends once the tracked wall length reaches zero. */
  endsWhenLengthZero?: boolean;
  notes?: string;
}

/** Models specific one-word command options for spells like Command. */
export interface ControlOption {
  name: string;
  effect: "approach" | "drop" | "flee" | "grovel" | "halt" | string;
  details?: string;
  /**
   * Optional status condition applied by this specific option (e.g., Grovel applying Prone).
   */
  statusCondition?: StatusCondition;
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

/** A type guard to check if a `SpellEffect` is an attack-roll rider. */
export function isAttackRollModifierEffect(effect: SpellEffect): effect is AttackRollModifierEffect {
  return effect.type === "ATTACK_ROLL_MODIFIER";
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
