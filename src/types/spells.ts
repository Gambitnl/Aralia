// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/05/2026, 22:27:31
 * Dependents: commands/base/BaseEffectCommand.ts, commands/base/SpellCommand.ts, commands/effects/AttackRollModifierCommand.ts, commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/RegisterRiderCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/UtilityCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/AbilityEffectMapper.ts, commands/factory/SpellCommandFactory.ts, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/Combat/ReactionPrompt.tsx, components/DesignPreview/steps/PreviewCombatSandbox.tsx, data/adapters/5eTools/index.ts, data/adapters/5eTools/shared.ts, data/adapters/5eTools/spellEffectMapper.ts, data/adapters/5eTools/spellcastingAdapter.ts, data/feats/featsData.ts, data/races/racialTraits.ts, hooks/combat/useSummons.ts, hooks/data/useSpellRegistry.ts, hooks/useAbilitySystem.ts, scripts/audit_enchantment_consistency.ts, systems/creatures/CreatureTaxonomy.ts, systems/environment/EnvironmentSystem.ts, systems/environment/hazards.ts, systems/rituals/RitualManager.ts, systems/spells/ai/AISpellArbitrator.ts, systems/spells/effects/triggerHandler.ts, systems/spells/mechanics/ConcentrationTracker.ts, systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/mechanics/ScalingEngine.ts, systems/spells/targeting/TargetAllocator.ts, systems/spells/targeting/TargetValidationUtils.ts, systems/spells/validation/LegacySpellValidator.ts, systems/spells/validation/SpellIntegrityValidator.ts, systems/spells/validation/TargetingPresets.ts, types/index.ts, types/mechanics.ts, types/spellAttackMetadata.ts, types/spellTargeting.ts, utils/character/savingThrowUtils.ts, utils/combat/combatUtils.ts, utils/combat/resistanceUtils.ts, utils/core/factories.ts, utils/validation/spellAuditor.ts, utils/validation/spellConsistencyValidator.ts, utils/visuals/spellVisuals.ts
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
  type: "advantage" | "disadvantage" | "bonus" | "penalty";
  value?: number;
  appliesTo?: TargetConditionFilter;
  reason?: string;
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
  attackAugments?: AttackAugment[];
  abilityCheckModifier?: AbilityCheckModifier;
  controlledEntity?: ControlledEntity;
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
