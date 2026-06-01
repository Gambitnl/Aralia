// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/05/2026, 10:30:02
 * Dependents: components/Glossary/spellGateChecker/spellGateBucketDetails.ts, components/Glossary/spellGateChecker/spellGateSelectedRefresh.ts, components/Glossary/spellGateChecker/useSpellGateChecks.ts, data/summonTemplates.ts, utils/validation/spellAuditor.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file spellValidator.ts
 * 
 * PURPOSE:
 * This file defines the Zod schema used for validating every Spell JSON file in the codebase.
 * It ensures that our "Gold Standard" data remains structuraly sound and consistent.
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added an explicit 'any' type to 
 * the 'cls' parameter in the 'BASE_CLASS_NAMES' mapping to resolve 
 * implicit any warnings in the script environment.
 * 
 * WHO USES THIS:
 * 1. Data Validation Script (`scripts/validate-data.ts`): Runs during `npm run validate`.
 * 2. Spell Migration Service: Used by the AI agents when converting new spells to JSON.
 * 3. Combat Engine: Relies on these keys existing to avoid runtime undefined errors.
 */
import { z } from 'zod';
import { CLASSES_DATA } from '../../../data/classes/index.js';
import { TargetConditionFilter, Targeting } from './targetingSchemas';
import { SecondaryTargeting } from './effectRelationshipSchemas';
import { EffectSchedule } from './effectScheduleSchemas';
import { DurationProgression } from './durationProgressionSchemas';
import { ModeChoice } from './modeChoiceSchemas';
import { AttackAugment } from './attackAugmentSchemas';
import { AbilityCheckModifier } from './abilityCheckModifierSchemas';
import { ControlledEntity } from './controlledEntitySchemas';
import { IllusionMetadata, SensoryManifestation } from './illusionSchemas';
import { FallControl } from './fallControlSchemas';
import { ConditionBreakTrigger } from './statusConditionSchemas';
import { ConditionalEnding, EffectEndCleanup, SustainRequirement } from './effectLifecycleSchemas';
import {
  BarrierDamagePrevention,
  DamageInteraction,
  DeathPrevention,
  LinkedDamage,
  ResistanceSuppression,
  SpellEffectPrevention,
} from './effectProtectionSchemas';

const BASE_CLASS_NAMES = Object.values(CLASSES_DATA).map((cls: any) => cls.name);
// Legacy spell data may include subclass-specific entries; keep them whitelisted in Title Case.
const SUBCLASS_CLASS_NAMES = [
  "Artificer - Armorer",
  "Artificer - Artillerist",
  "Artificer - Battle Smith",
  "Cleric - Life Domain",
  "Cleric - Light Domain",
  "Cleric - Twilight Domain",
  "Druid - Circle Of The Stars",
  "Fighter - Eldritch Knight",
  "Paladin - Oath Of Glory",
  "Paladin - Oath Of Redemption",
  "Paladin - Oath Of The Ancients",
  "Paladin - Oath Of Vengeance",
  "Rogue - Arcane Trickster",
  "Warlock - Archfey Patron",
  "Warlock - Celestial Patron",
  "Warlock - Fiend Patron",
];

const CLASS_NAMES = Array.from(new Set([...BASE_CLASS_NAMES, ...SUBCLASS_CLASS_NAMES]));
const ClassNameEnum = z.enum(CLASS_NAMES as [string, ...string[]]);
const BaseClassNameEnum = z.enum(BASE_CLASS_NAMES as [string, ...string[]]);

const SpellRarity = z.enum(["common", "uncommon", "rare", "very_rare", "legendary"]);

const SpellSchool = z.enum([
  "Abjuration", "Conjuration", "Divination", "Enchantment",
  "Evocation", "Illusion", "Necromancy", "Transmutation"
]);

const ArbitrationType = z.enum(["mechanical", "ai_assisted", "ai_dm"]);

const AIContext = z.object({
  prompt: z.string(),
  playerInputRequired: z.boolean(),
});

// ============================================================================
// Class Access Shape
// ============================================================================
// This section keeps spell class access explicit and testable across the entire
// corpus. The owner ruled that base/default class access and subclass/domain
// access should not be flattened into one ambiguous array.
//
// That means every spell JSON should expose:
// - `classes`: base/default class access only
// - `subClasses`: subclass/domain-specific access, or an explicit empty array
// - `subClassesVerification`: whether the subclass/domain access field has been
//   explicitly checked yet
//
// Requiring both fields makes the validation lane answer a stronger question:
// not just "is subclass data legal when present?" but also "does every spell
// JSON declare whether subclass-specific access exists at all?"
// ============================================================================
const SubClassesVerificationStatus = z.enum(["unverified", "verified"]);

const SpellClassAccess = z.object({
  classes: z.array(BaseClassNameEnum),
  subClasses: z.array(z.string()),
  // Retired 2026-05-11 after the Sub-Classes bucket closed. The flag was
  // needed while the lane was still being filled out (to distinguish
  // examined-empty from never-looked-at). With the bucket closed, every
  // spell's subClasses state is either a roster-clean entry list or a
  // marker in the structured .md layer, so the verification flag is
  // redundant. Kept as optional for backward compatibility with JSON
  // files that still carry it; new files should omit it.
  subClassesVerification: SubClassesVerificationStatus.optional(),
});

// Feature-granted spell access is intentionally separate from spell-list class
// access. Mending is the pilot case: Artificers receive it from Tinker's Magic,
// but that should not make Mending behave like a selectable Artificer cantrip.
const SpellAccessGrant = z.object({
  sourceType: z.enum(["class_feature", "subclass_feature", "species_trait", "feat", "item", "background", "other"]),
  className: BaseClassNameEnum.optional(),
  sourceName: z.string(),
  accessType: z.enum(["known", "prepared", "always_prepared", "cast"]),
  automatic: z.boolean(),
  consumesSelection: z.boolean().optional(),
  notes: z.string().optional(),
});

const SavingThrowAbility = z.enum(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);

const CastingTime = z.object({
  value: z.number(),
  unit: z.enum(["action", "bonus_action", "reaction", "minute", "hour", "special"]),
  combatCost: z.object({
    type: z.enum(["action", "bonus_action", "reaction"]), // Validation Rule: Must strictly match castingTime.unit if applicable
    condition: z.string(),
  }),
  explorationCost: z.object({
    value: z.number(),
    unit: z.enum(["minute", "hour"]),
  }),
});

// ============================================================================
// Range And Geometry Units
// ============================================================================
// Range/Area review showed that the spell JSON was carrying numeric geometry
// while the "feet" part lived only in comments and formatter assumptions.
//
// These unit enums make that geometry explicit without forcing the whole corpus
// to migrate in one pass. Distance itself is always present; spells that do not
// have a measured distance use `0` rather than omitting the field. Missing unit
// fields still mean "legacy feet" for now.
// ============================================================================
const DistanceUnit = z.enum(["feet", "miles", "inches"]);

const Range = z.object({
  type: z.enum(["self", "touch", "ranged", "special", "sight", "unlimited"]),
  distance: z.number(),
  distanceUnit: DistanceUnit.optional(),
});

const Components = z.object({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.boolean(),
  materialDescription: z.string(),
  materialCost: z.number(),
  isConsumed: z.boolean(),
});

const Duration = z.object({
  type: z.enum(["instantaneous", "timed", "special", "until_dispelled", "until_dispelled_or_triggered"]),
  value: z.number(),
  unit: z.enum(["round", "minute", "hour", "day"]),
  concentration: z.boolean(),
});

const EffectDuration = z.object({
  type: z.enum(["rounds", "minutes", "special"]),
  value: z.number().optional()
});

const EscapeCheck = z.object({
  ability: SavingThrowAbility.optional(),
  skill: z.string().optional(),
  dc: z.union([z.number(), z.literal("spell_save_dc")]),
  actionCost: z.enum(["action", "bonus_action"]),
  eligibleActors: z.array(z.enum([
    "affected_creature",
    "creature_that_can_reach_affected_creature"
  ])).optional(),
});

// Zone movement is a real runtime trigger, not prose-only spell text. It stays
// beside the other area triggers so spell data for Spike Growth-style movement
// hazards can validate before the effect layer processes movement through a
// zone.
const EffectTrigger = z.object({
  type: z.enum([
    "immediate",
    "after_primary",
    "turn_start",
    "turn_end",
    "on_enter_area",
    "on_exit_area",
    "on_end_turn_in_area",
    "on_move_in_area",
    "on_target_move",
    "on_target_takes_damage",
    "on_attack_hit",
    "on_target_attack",
    "on_target_cast",
    "on_entity_proximity",
    "on_caster_action",
    "on_granted_action"
  ]),
  frequency: z.enum(["every_time", "first_per_turn", "once", "once_per_creature"]).optional(),
  consumption: z.enum(["unlimited", "first_hit", "per_turn", "per_instance_hit_or_miss"]).optional(),
  attackFilter: z.object({
    weaponType: z.enum(["melee", "ranged", "any"]).optional(),
    attackType: z.enum(["weapon", "spell", "any"]).optional()
  }).optional(),
  movementType: z.enum(["any", "willing", "forced"]).optional(),
  sustainCost: z.object({
    actionType: z.enum(["action", "bonus_action", "reaction"]),
    optional: z.boolean()
  }).optional(),
});

const SaveModifier = z.object({
  type: z.enum(["advantage", "disadvantage", "bonus", "penalty", "cover_bypass"]),
  value: z.number().optional(),
  appliesTo: TargetConditionFilter.optional(),
  reason: z.string().optional(),
  advantageOnDamage: z.boolean().optional(),
  sizeAdvantage: z.array(z.string()).optional(),
  sizeDisadvantage: z.array(z.string()).optional(),
  // Some saving throws, such as Sacred Flame, explicitly deny normal cover
  // bonuses. This keeps those exceptions attached to the save that uses them
  // instead of hiding them in prose where the runtime cannot apply them.
  ignoredCover: z.array(z.enum(["half", "three_quarters", "total"])).optional()
});

const SaveOutcomeOverride = z.object({
  outcome: z.enum(["auto_success", "auto_failure"]),
  condition: z.enum([
    "challenge_rating_not_zero",
    "fighting_caster_or_allies",
    "cannot_understand_caster",
    "immune_to_charmed",
    "immune_to_frightened",
    "is_shapechanger",
    "is_plant_creature",
    "not_humanoid",
    "recently_affected_by_spell"
  ]),
  reason: z.string().optional()
});

const RepeatSaveModifiers = z.object({
  advantageOnDamage: z.boolean().optional(),
  sizeAdvantage: z.array(z.string()).optional(),
  sizeDisadvantage: z.array(z.string()).optional()
});

const RepeatSaveTiming = z.enum([
  "turn_end",           // End of target's turn
  "turn_start",         // Start of target's turn
  "on_damage",          // When target takes damage
  "on_action",          // Target must use action to attempt
  "after_forced_movement" // Target saves after completing spell-forced movement
]);

const RepeatSaveProgression = z.object({
  // Some repeat saves count successes and failures instead of ending on the
  // first success. The optional thresholds keep Contagion/Flesh to Stone data
  // machine-readable without changing simple repeat-save spells.
  successThreshold: z.number().optional(),
  failureThreshold: z.number().optional(),
  consecutiveRequired: z.boolean().optional(),
  successOutcome: z.string().optional(),
  failureOutcome: z.string().optional()
});

const RepeatSavePrerequisite = z.enum([
  "no_line_of_sight_to_caster"
]);

const RepeatSave = z.object({
  timing: RepeatSaveTiming,
  additionalTimings: z.array(RepeatSaveTiming).optional(),
  saveType: z.enum([
    "Strength", "Dexterity", "Constitution",
    "Intelligence", "Wisdom", "Charisma",
    "strength_check",
    "wisdom_check"
  ]),
  successEnds: z.boolean(),
  useOriginalDC: z.boolean(),
  prerequisites: z.array(RepeatSavePrerequisite).optional(),
  modifiers: RepeatSaveModifiers.optional(),
  progression: RepeatSaveProgression.optional()
});

const RecurringMechanic = z.object({
  // Recurring mechanics capture turn-by-turn or trigger-by-trigger rules that
  // are not always status repeat saves, such as Heroism temp HP, Elemental Bane
  // first-per-turn damage, and Tree Stride end-turn positioning.
  timing: z.enum(["turn_start", "turn_end", "on_damage", "on_move_in_area", "on_entity_proximity", "on_target_cast"]),
  frequency: z.enum(["every_time", "first_per_turn", "once_per_creature"]).optional(),
  saveType: SavingThrowAbility.optional(),
  saveEffect: z.enum(["none", "half", "negates_condition"]).optional(),
  damage: z.object({
    dice: z.string(),
    type: z.string(),
    mitigationBypass: z.array(z.enum(["resistance", "immunity", "damage_reduction", "damage_prevention"])).optional(),
  }).optional(),
  healing: z.object({
    dice: z.string(),
    isTemporaryHp: z.boolean().optional(),
  }).optional(),
  successOutcome: z.string().optional(),
  failureOutcome: z.string().optional(),
  restriction: z.string().optional(),
  notes: z.string().optional(),
});

const EffectCondition = z.object({
  type: z.enum(["hit", "save", "always"]),
  saveType: SavingThrowAbility.optional(),
  saveEffect: z.enum(["none", "half", "negates_condition"]).optional(),
  targetFilter: TargetConditionFilter.optional(),
  requiresStatus: z.array(z.string()).optional(),
  saveModifiers: z.array(SaveModifier).optional(),
  // Some spells skip the normal save result entirely for specific targets.
  // This records automatic success/failure rules beside the save they modify,
  // while broader target filters continue to handle ordinary eligibility.
  saveOutcomeOverrides: z.array(SaveOutcomeOverride).optional(),
});

const ScalingFormula = z.object({
  type: z.enum(["slot_level", "character_level", "custom"]),
  bonusPerLevel: z.string().optional(),
  customFormula: z.string().optional(),
  scalingTiers: z.record(z.string(), z.string()).optional(),
});

// ============================================================================
// Higher-Level Scaling Schema
// ============================================================================
// The live spell corpus still stores most scaling rules in readable prose under
// `higherLevels`. That is fine for glossary display, but it is too weak for the
// runtime engine if we want reliable cantrip tiers or slot-level calculations.
//
// This schema adds an optional machine-readable home for those rules without
// forcing a one-shot migration of every spell. Existing JSON keeps validating,
// while new or upgraded spells can start declaring their higher-level behavior
// explicitly here.
// ============================================================================
const CharacterLevelTierScaling = z.object({
  type: z.literal("character_level_tiers"),
  tiers: z.record(z.string(), z.string()),
  notes: z.string().optional(),
});

const SlotLevelBonusScaling = z.object({
  type: z.literal("slot_level_bonus"),
  baseSpellLevel: z.number(),
  bonusPerLevel: z.string(),
  notes: z.string().optional(),
});

const SlotLevelTableScaling = z.object({
  type: z.literal("slot_level_table"),
  baseSpellLevel: z.number(),
  entries: z.record(z.string(), z.string()),
  notes: z.string().optional(),
});

const TargetCountBonusScaling = z.object({
  type: z.literal("target_count_bonus"),
  baseSpellLevel: z.number(),
  additionalTargetsPerLevel: z.number(),
  targetLabel: z.string().optional(),
  notes: z.string().optional(),
});

const AreaSizeBonusScaling = z.object({
  type: z.literal("area_size_bonus"),
  baseSpellLevel: z.number(),
  increasePerLevel: z.number(),
  unit: z.literal("feet"),
  dimension: z.enum(["radius", "diameter", "cube_size", "line_length", "wall_length", "wall_height"]),
  notes: z.string().optional(),
});

const HigherLevelScalingRule = z.discriminatedUnion("type", [
  CharacterLevelTierScaling,
  SlotLevelBonusScaling,
  SlotLevelTableScaling,
  TargetCountBonusScaling,
  AreaSizeBonusScaling,
]);

const MultipleHigherLevelScaling = z.object({
  type: z.literal("multiple"),
  rules: z.array(HigherLevelScalingRule),
  notes: z.string().optional(),
});

const SpecialTextOnlyHigherLevelScaling = z.object({
  type: z.literal("special_text_only"),
  referenceText: z.string(),
  reason: z.string().optional(),
});

const HigherLevelScaling = z.discriminatedUnion("type", [
  CharacterLevelTierScaling,
  SlotLevelBonusScaling,
  SlotLevelTableScaling,
  TargetCountBonusScaling,
  AreaSizeBonusScaling,
  MultipleHigherLevelScaling,
  SpecialTextOnlyHigherLevelScaling,
]);

const SoundEmission = z.object({
  audibleRadius: z.union([z.number(), z.literal("not_applicable")]),
  radiusUnit: z.enum(["feet", "miles", "not_applicable"]),
  source: z.enum(["caster", "target", "target_object", "origin_space", "spell_area", "not_applicable"]),
  trigger: z.enum(["on_cast", "on_hit", "after_teleport", "on_trigger", "not_applicable"]),
  description: z.string().optional(),
});

const BaseEffect = z.object({
  trigger: EffectTrigger,
  condition: EffectCondition,
  scaling: ScalingFormula.optional(),
  // Secondary targeting is effect-local because the relationship belongs to a
  // follow-up damage or effect packet, not to the spell's initial target list.
  secondaryTargeting: SecondaryTargeting.optional(),
  // Sound is a sensory mechanic when it has gameplay-facing radius, source, or
  // timing. Keeping it on the base effect lets damage, utility, teleport, and
  // triggered spells all expose audibility without inventing parallel effect
  // types for the same sound rule.
  soundEmission: SoundEmission.optional(),
  // Conditional endings are early-stop rules that are neither normal duration
  // expiry nor concentration loss. They stay on effects so a spell can later
  // have one mode end early without forcing every other mode to do the same.
  conditionalEndings: z.array(ConditionalEnding).optional(),
  // Fall control keeps descent rate and landing damage rules machine-readable.
  // It is separate from ordinary speed or forced movement because falling uses
  // its own timing and damage rules in the runtime engine.
  fallControl: FallControl.optional(),
  // Condition removal is an immediate restorative mechanic: the spell ends a
  // named condition that is already present. It is intentionally separate from
  // condition immunity, suppression, and normal status application.
  conditionRemoval: z.array(z.string()).optional(),
  // Barrier damage prevention is not ordinary resistance. It blocks damage
  // based on crossing a barrier boundary, so the runtime needs origin-side data.
  barrierDamagePrevention: BarrierDamagePrevention.optional(),
  // Spell-effect prevention stops qualifying spells from affecting protected
  // subjects. It is separate from damage prevention because it also blocks
  // targeting effects and area inclusion before damage is considered.
  spellEffectPrevention: SpellEffectPrevention.optional(),
  // Death prevention records last-moment safeguards that intercept death rather
  // than reducing damage. It stays distinct from resistance and healing so the
  // runtime can consume the ward after the first qualifying death event.
  deathPrevention: DeathPrevention.optional(),
  // End cleanup removes spell-created state when an already-modeled ending
  // happens. It is not itself an early-ending trigger.
  endCleanup: z.array(EffectEndCleanup).optional(),
  // Sustain requirements record upkeep actions that must be paid on later turns
  // to keep a spell or effect active. Failure is modeled separately as a
  // conditional ending so the runtime can see both the cost and the consequence.
  sustainRequirement: SustainRequirement.optional(),
  // Linked damage records damage sharing or mirroring between connected
  // creatures. It is neither resistance nor a new damage roll; it follows an
  // existing damage event.
  linkedDamage: LinkedDamage.optional(),
  // Resistance suppression is the inverse of granting resistance: it temporarily
  // disables the target's resistance to a specified damage type while leaving
  // other defenses intact.
  resistanceSuppression: ResistanceSuppression.optional(),
  // Damage interaction is neutral between helpful and harmful modes. Hallow can
  // bind either resistance or vulnerability to an area, so this avoids treating
  // vulnerability as a defensive effect.
  damageInteraction: DamageInteraction.optional(),
  // Some repeat mechanics are not just status repeat saves. This array keeps
  // recurring damage, healing, restrictions, and pre-cast gates visible without
  // forcing them into prose-only descriptions.
  recurringMechanics: z.array(RecurringMechanic).optional(),
  // Sensory manifestations record what a spell-created sound, image, smell, or
  // similar presentation can and cannot produce. This is where Minor Illusion's
  // sound/image restrictions live instead of hiding inside description text.
  sensoryManifestation: SensoryManifestation.optional(),
  // Illusion reveal data records how creatures can discern an illusion and what
  // changes for that creature afterward. It is separate from escape checks
  // because discerning an illusion does not necessarily end the spell.
  illusion: IllusionMetadata.optional(),
  description: z.string(),
});

const DamageData = z.object({
  dice: z.string(),
  type: z.string(),
  // Some self-cost damage explicitly cannot be reduced or prevented. Keeping
  // the bypass list on the damage packet lets the runtime skip only the named
  // mitigation families instead of hard-coding spell names.
  mitigationBypass: z.array(z.enum(["resistance", "immunity", "damage_reduction", "damage_prevention"])).optional(),
});

const DamageEffect = BaseEffect.extend({
  type: z.literal("DAMAGE"),
  damage: DamageData,
});

const HealingData = z.object({
  dice: z.string(),
  isTemporaryHp: z.boolean().optional(),
});

const HealingEffect = BaseEffect.extend({
  type: z.literal("HEALING"),
  healing: HealingData,
});

const StatusCondition = z.object({
  name: z.string(),
  duration: EffectDuration,
  level: z.number().optional(),
  escapeCheck: EscapeCheck.optional(),
  repeatSave: RepeatSave.optional(),
  breakTriggers: z.array(ConditionBreakTrigger).optional()
});

const StatusConditionEffect = BaseEffect.extend({
  type: z.literal("STATUS_CONDITION"),
  statusCondition: StatusCondition,
});

// ============================================================================
// Attack Roll Rider Effect Schema
// ============================================================================
// These effects model attack-roll changes that are not real conditions. Blur is
// the incoming-rider pilot: the protected creature is harder to hit for the
// spell duration, but it does not gain a named condition.
// ============================================================================
const AttackRollModifier = z.object({
  modifier: z.enum(["advantage", "disadvantage", "bonus", "penalty"]),
  direction: z.enum(["incoming", "outgoing"]),
  attackKind: z.enum(["any", "weapon", "melee_weapon", "ranged_weapon", "spell"]),
  consumption: z.enum(["next_attack", "first_attack", "while_active"]),
  duration: EffectDuration,
  dice: z.string().optional(),
  value: z.number().optional(),
  attackerFilter: TargetConditionFilter.optional(),
  notes: z.string().optional(),
});

const AttackRollModifierEffect = BaseEffect.extend({
  type: z.literal("ATTACK_ROLL_MODIFIER"),
  attackRollModifier: AttackRollModifier,
  damage: DamageData.optional(),
});

const MovementEffect = BaseEffect.extend({
  type: z.literal("MOVEMENT"),
  movementType: z.enum(["push", "pull", "teleport", "speed_change", "stop"]),
  distance: z.number().optional(),
  speedChange: z.object({
    stat: z.literal("speed"),
    value: z.number(),
    unit: z.literal("feet"),
  }).optional(),
  duration: EffectDuration,
  forcedMovement: z.object({
    usesReaction: z.boolean().optional(),
    direction: z.enum(["away_from_caster", "toward_caster", "caster_choice", "safest_route"]).optional(),
    maxDistance: z.string().optional(),
  }).optional(),
});

const GrantedAction = z.object({
  type: z.enum(["action", "bonus_action", "reaction"]),
  action: z.string(),
  frequency: z.enum(["once", "each_turn", "while_active"]),
  // Actor and action kind distinguish a caster sustaining a spell from a spell
  // granting a target a new Magic action, such as Dragon's Breath.
  actor: z.enum(["caster", "target", "summoned_entity", "affected_creature"]).optional(),
  actionKind: z.enum(["magic_action", "standard_action", "bonus_action", "reaction", "not_applicable"]).optional(),
  areaShape: z.enum(["Cone", "Line", "Sphere", "Cube", "Cylinder", "not_applicable"]).optional(),
  areaSize: z.union([z.number(), z.literal("not_applicable")]).optional(),
  areaSizeUnit: z.enum(["feet", "miles", "not_applicable"]).optional(),
  effectIndices: z.array(z.number()).optional(),
  prerequisites: z.array(z.enum(["target_object_within_spell_range", "target_within_spell_range", "not_applicable"])).optional(),
  rangeLimit: z.number().optional(),
  notes: z.string().optional(),
});

const ControlOption = z.object({
  name: z.string(),
  effect: z.string(),
  details: z.string().optional(),
});

const TauntEffect = z.object({
  disadvantageAgainstOthers: z.boolean().optional(),
  leashRangeFeet: z.number().optional(),
  breakConditions: z.array(z.string()).optional(),
});

// Summoning Schema
export const SummonedEntityStatBlock = z.object({
  name: z.string().optional(),
  type: z.string().optional(), // Celestial, Fey, Fiend, Beast, etc.
  size: z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']).optional(),
  ac: z.number().optional(),
  hp: z.number().optional(),
  speed: z.number().optional(),
  flySpeed: z.number().optional(),
  climbSpeed: z.number().optional(),
  swimSpeed: z.number().optional(),
  abilities: z.object({
    str: z.number(),
    dex: z.number(),
    con: z.number(),
    int: z.number(),
    wis: z.number(),
    cha: z.number(),
  }).optional(),
  senses: z.array(z.string()).optional(),
  skills: z.record(z.string(), z.number()).optional(),
  cr: z.union([z.number(), z.string()]).optional(),
});

const SummonSpecialAction = z.object({
  name: z.string(),
  description: z.string(),
  cost: z.enum(['action', 'bonus_action', 'reaction', 'free']),
  damage: z.object({
    dice: z.string(),
    type: z.string() // DamageType
  }).optional()
});

const SummoningEffect = BaseEffect.extend({
  type: z.literal("SUMMONING"),
  summon: z.object({
    entityType: z.enum(["familiar", "servant", "construct", "creature", "undead", "mount", "object"]),
    persistent: z.boolean(), // If true, remains until dismissed or killed. If false, duration applies.
    dismissAction: z.enum(["action", "bonus_action", "free", "none"]).optional(),

    // For variable summons
    count: z.number().optional(),
    countByCR: z.record(z.string(), z.number()).optional(), // e.g. {"2": 1, "1": 2, "0.5": 4}

    // For choice summons
    formOptions: z.array(z.string()).optional(),

    // Stats
    statBlock: SummonedEntityStatBlock.optional(),
    objectDescription: z.string().optional(), // For simple objects like Disk

    // Command Economy
    commandCost: z.enum(["action", "bonus_action", "free", "none"]),
    commandsPerTurn: z.number().optional(),
    initiative: z.enum(["immediate", "rolled", "shared"]).optional(),

    // Movement/Following
    followDistance: z.number().optional(),
    hoverHeight: z.number().optional(),
    terrainRestrictions: z.array(z.string()).optional(),

    // Capacity
    carryCapacity: z.number().optional(), // In pounds

    // Special Integrations
    telepathyRange: z.number().optional(),
    sharedSenses: z.boolean().optional(),
    sharedSensesCost: z.enum(["action", "bonus_action"]).optional(),
    specialActions: z.array(SummonSpecialAction).optional()
  })
});

const AreaOfEffect = z.object({
  shape: z.enum(["Cone", "Cube", "Cylinder", "Line", "Sphere", "Square"]),
  size: z.number(),
  height: z.number().optional(),
});

const TerrainManipulation = z.object({
  type: z.enum(["excavate", "fill", "difficult", "normal", "cosmetic"]),
  volume: z.object({
    shape: z.literal("Cube"),
    size: z.number(),
    depth: z.number().optional()
  }).optional(),
  duration: EffectDuration.optional(),
  depositDistance: z.number().optional()
});

const TerrainEffect = BaseEffect.extend({
  type: z.literal("TERRAIN"),
  terrainType: z.enum(["difficult", "obscuring", "damaging", "blocking", "wall"]),
  areaOfEffect: AreaOfEffect,
  duration: EffectDuration,
  damage: DamageData.optional(),
  wallProperties: z.object({
    hp: z.number(),
    ac: z.number(),
  }).optional(),
  dispersedByStrongWind: z.boolean().optional(),
  manipulation: TerrainManipulation.optional(),
});

/**
 * Save penalty data for effects like Mind Sliver that impose penalties on saving throws.
 * The penalty can be a dice roll (e.g., "1d4") or a flat modifier, and applies to
 * either the next save or all saves for the duration.
 */
const SavePenaltyData = z.object({
  dice: z.string().optional(),        // e.g. "1d4" - rolled and subtracted from save
  flat: z.number().optional(),        // e.g. -2 - flat penalty to save
  applies: z.enum(["next_save", "all_saves"]),
  duration: EffectDuration.optional() // Falls back to spell duration if not specified
});

const UtilityEffect = BaseEffect.extend({
  type: z.literal("UTILITY"),
  utilityType: z.enum(["light", "communication", "creation", "information", "control", "sensory", "other"]),
  description: z.string(),
  attackAugments: z.array(AttackAugment).optional(),
  abilityCheckModifier: AbilityCheckModifier.optional(),
  controlledEntity: ControlledEntity.optional(),
  controlOptions: z.array(ControlOption).optional(),
  taunt: TauntEffect.optional(),
  savePenalty: SavePenaltyData.optional(), // For effects like Mind Sliver that impose save penalties
  light: z.object({
    brightRadius: z.number(),
    dimRadius: z.number().optional(),
    attachedTo: z.enum(["caster", "target", "point"]).optional(),
    color: z.string().optional(),
    colorChoice: z.enum(["caster_choice", "fixed", "not_applicable"]).optional(),
    opaqueCoverBlocks: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    emitsHeat: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    ignitesObjects: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    consumesFuel: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    canBeCoveredOrHidden: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    canBeSmotheredOrQuenched: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  }).optional(),
});

const DamageReduction = z.object({
  // Reduction is different from resistance: it subtracts an explicit amount
  // from qualifying damage instead of halving damage through the resistance
  // rules. Resistance the cantrip is the first closed corpus case.
  dice: z.string(),
  flat: z.number().optional(),
  appliesTo: z.enum(["damage_taken"]),
  frequency: z.enum(["once_per_turn", "every_time"]).optional(),
});

const DefenseSourceFilter = z.object({
  // Defensive source filters describe the incoming harm the defense responds
  // to. This is separate from target eligibility: Investiture of Stone targets
  // the caster, but only resists damage from nonmagical attacks.
  sourceCategories: z.array(z.enum(["attack", "spell", "effect", "environment"])).optional(),
  attackMagicalStatus: z.enum(["any", "magical", "nonmagical", "not_applicable"]).optional(),
});

const DefensiveEffect = BaseEffect.extend({
  type: z.literal("DEFENSIVE"),
  defenseType: z.enum([
    "ac_bonus",
    "set_base_ac",
    "ac_minimum",
    "resistance",
    "immunity",
    "damage_reduction",
    "temporary_hp",
    "advantage_on_saves",
    // Some protection spells defend by making filtered attackers roll worse.
    // The core spell type already allowed this value; the validator now accepts
    // it so runtime data can preserve that defensive mechanic directly.
    "disadvantage_on_attacks"
  ]),
  value: z.number().optional(), // Used for AC bonus value or Temp HP amount
  baseACFormula: z.string().optional(), // For set_base_ac
  acMinimum: z.number().optional(), // For ac_minimum

  damageType: z.array(z.string()).optional(),
  // Dynamic resistances name an eligible set but choose the actual protected
  // damage type from play context, such as Absorb Elements using the incoming
  // triggering damage type.
  damageTypeSource: z.enum(["listed", "triggering_damage_type", "chosen_damage_type"]).optional(),
  // Some defensive prose names a broad damage set and then carves out explicit
  // exceptions, such as Feign Death resisting all damage except Psychic.
  excludedDamageType: z.array(z.string()).optional(),
  damageReduction: DamageReduction.optional(),
  // Prevention immunity covers non-condition mechanics that a defense blocks,
  // such as Aura of Life preventing hit point maximum reduction.
  preventionImmunity: z.array(z.enum(["hit_point_maximum_reduction"])).optional(),
  // Condition immunity is separate from damage immunity. Heroism, for example,
  // prevents Frightened without implying immunity to any damage type.
  conditionImmunity: z.array(z.string()).optional(),
  // Condition suppression is also distinct: Calm Emotions can pause an existing
  // Charmed or Frightened condition without permanently removing it.
  conditionSuppression: z.array(z.string()).optional(),
  savingThrow: z.array(SavingThrowAbility).optional(),
  duration: EffectDuration,
  attackerFilter: TargetConditionFilter.optional(),
  defenseSourceFilter: DefenseSourceFilter.optional(),

  // Reaction trigger (for shield)
  reactionTrigger: z.object({
    event: z.enum(["when_hit", "when_targeted", "when_damaged"]),
    includesSpells: z.array(z.string()).optional()
  }).optional(),

  // Restrictions
  restrictions: z.object({
    noArmor: z.boolean().optional(),
    noShield: z.boolean().optional(),
    targetSelf: z.boolean().optional()
  }).optional()
});

/**
 * EFFECT SYSTEM
 * A discriminated union of all possible mechanical results.
 * Discriminated by the "type" field (e.g. DAMAGE, HEALING, UTILITY).
 * 
 * Dependencies: 
 * - DamageEffect -> DamageCommand.ts
 * - HealingEffect -> HealingCommand.ts
 * - DefensiveEffect -> DefensiveCommand.ts
 * - UtilityEffect -> UtilityCommand.ts
 */
const SpellEffect = z.discriminatedUnion("type", [
  DamageEffect,
  HealingEffect,
  StatusConditionEffect,
  AttackRollModifierEffect,
  MovementEffect,
  SummoningEffect,
  TerrainEffect,
  UtilityEffect,
  DefensiveEffect,
]);

/**
 * MAIN SPELL VALIDATOR
 * The root schema for a Spell JSON file.
 * 
 * Key Pillars:
 * - arbitrationType: Determines if the engine (mechanical) or DM (ai_dm) handles it.
 * - aiContext: Instructions for the AI DM for non-mechanical outcomes.
 * - effects: Array of structured mechanical results.
 * - description: Flavor text for the Glossary.
 * - source: intentionally not part of the live schema anymore. The spell JSON files
 *   no longer carry a top-level source field, so validation should not keep enforcing
 *   a dead requirement that the dataset has already moved away from.
 */
export const SpellValidator = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  level: z.number(),
  school: SpellSchool,
  legacy: z.boolean(),
  // Spread the dedicated class-access schema into the main spell shape so the
  // validator can enforce the explicit split everywhere, not only in new data.
  ...SpellClassAccess.shape,
  accessGrants: z.array(SpellAccessGrant).optional(),
  ritual: z.boolean(), // Validation Rule: Must be false for Level 0 (enforce via .refine or subclass)
  rarity: SpellRarity,
  attackType: z.string(),
  castingTime: CastingTime,
  range: Range,
  components: Components,
  duration: Duration,
  targeting: Targeting,
  // Mode choice records spell menus such as "choose one of the following
  // effects." The actual payload still lives in effects/controlOptions.
  modeChoice: ModeChoice.optional(),
  // Effect schedules describe when already-modeled effects become active for
  // spells with turn-numbered stages. The field is optional so ordinary spells
  // do not have to carry an empty schedule object.
  effectSchedule: EffectSchedule.optional(),
  effects: z.array(SpellEffect),
  arbitrationType: ArbitrationType,
  aiContext: AIContext,
  description: z.string(),
  higherLevels: z.string(),
  higherLevelScaling: HigherLevelScaling.optional(),
  durationProgression: z.array(DurationProgression).optional(),
  tags: z.array(z.string()),
}).superRefine((spell, ctx) => {
  /**
   * SUPER REFINE LOGIC
   * Performs advanced validation that can't be expressed by simple types.
   * Currently handles:
   * 1. Material Component Cost Mismatch (checks desc vs numeric data)
   * 2. Material Consumption Mismatch (checks desc vs boolean flag)
   */
  if (spell.components.material) {
    const desc = spell.components.materialDescription || '';

    // Check for Cost Mismatch
    const costMatches = Array.from(desc.matchAll(/worth (?:at least )?([\d,]+)(?:\+)? gp/gi));
    if (costMatches.length) {
      const foundCosts = costMatches
        .map(m => parseInt(String(m[1]).replace(/,/g, ''), 10))
        .filter(n => Number.isFinite(n));

      const expectedCost = foundCosts.length === 1 ? foundCosts[0] : undefined;
      const expectedSum = foundCosts.reduce((sum, n) => sum + n, 0);
      const expectedMax = foundCosts.length ? Math.max(...foundCosts) : undefined;
      const actualCost = spell.components.materialCost;

      // Allow for "each" pricing logic (e.g. "each worth 5 gp" for multiple components).
      // If the actual cost is an integer multiple of the found cost, we assume it's intentional.
      const isPair = desc.includes('pair') || desc.includes('each');

      const actualCostNumber = actualCost ?? 0;

      // Multiple distinct costs are inherently ambiguous (sum vs max vs quantity multipliers),
      // so accept either the max single component cost or the straight sum.
      if (foundCosts.length >= 2) {
        const ok =
          actualCost != null &&
          (actualCostNumber === expectedSum ||
            (expectedMax != null && actualCostNumber === expectedMax) ||
            (isPair && expectedMax != null && expectedMax > 0 && actualCostNumber % expectedMax === 0));

        if (!ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Material cost mismatch: Description costs suggest ${expectedMax ?? 0} gp (max) or ${expectedSum} gp (sum), but data has ${actualCostNumber} gp.`,
            path: ['components', 'materialCost'],
          });
        }
      } else if (expectedCost != null && actualCostNumber !== expectedCost) {
        if (
          isPair &&
          expectedCost > 0 &&
          actualCost != null &&
          Number.isFinite(actualCost) &&
          actualCostNumber % expectedCost === 0 &&
          actualCostNumber >= expectedCost * 2
        ) {
          // Acceptable deviation for multi-item "each" pricing
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Material cost mismatch: Description says ${expectedCost} gp, but data has ${actualCostNumber} gp.`,
            path: ['components', 'materialCost'],
          });
        }
      }
    }

    // Check for Consumption Mismatch
    const consumedMatch = desc.match(/consumes?|consumed/i);
    const expectedConsumed = !!consumedMatch;
    const actualConsumed = spell.components.isConsumed ?? false;

    if (expectedConsumed && !actualConsumed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Material consumption mismatch: Description implies consumption, but isConsumed is false/missing.`,
        path: ['components', 'isConsumed'],
      });
    }
  }

  // Subclass verification refinement retired 2026-05-11 with the field.
  // See SpellClassAccess above for context.
});
