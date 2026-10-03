/**
 * @file spellPrimitives.ts
 *
 * PURPOSE:
 * Primitive and base-level Zod shapes for the spell schema: class-access
 * enums, rarity/school, saving throws, casting time, range, components,
 * duration, effect triggers and conditions, repeat/recurring save rules, and
 * higher-level scaling.
 *
 * WHY THIS FILE EXISTS:
 * Split out of spellValidator.ts on 2026-09-09 (MOD-3.2, board agora-907c.6)
 * when that file reached 1642 lines with 13 dependents. Nothing was renamed,
 * reordered, or dropped; the declarations appear here in their original order
 * because these Zod schemas are order-sensitive (later shapes reference
 * earlier ones). spellValidator.ts re-exports this module, so every existing
 * import path still resolves.
 *
 * WHAT IS PRESERVED:
 * Declarations that no consumer references yet (ClassNameEnum) are kept and
 * exported rather than pruned; they are future feature space for the spell
 * class-access lane.
 *
 * USED BY: ./spellEffectSchemas.ts and ../spellValidator.ts.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:21:17
 * Dependents: systems/spells/validation/schemas/spellEffectSchemas.ts, systems/spells/validation/spellValidator.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';
import { CLASSES_DATA } from '../../../../data/classes/index.js';
import { TargetConditionFilter } from '../targetingSchemas';

export const BASE_CLASS_NAMES = Object.values(CLASSES_DATA).map((cls: any) => cls.name);
// Legacy spell data may include subclass-specific entries; keep them whitelisted in Title Case.
export const SUBCLASS_CLASS_NAMES = [
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

export const CLASS_NAMES = Array.from(new Set([...BASE_CLASS_NAMES, ...SUBCLASS_CLASS_NAMES]));
export const ClassNameEnum = z.enum(CLASS_NAMES as [string, ...string[]]);
export const BaseClassNameEnum = z.enum(BASE_CLASS_NAMES as [string, ...string[]]);

export const SpellRarity = z.enum(["common", "uncommon", "rare", "very_rare", "legendary"]);

export const SpellSchool = z.enum([
  "Abjuration", "Conjuration", "Divination", "Enchantment",
  "Evocation", "Illusion", "Necromancy", "Transmutation"
]);

export const ArbitrationType = z.enum(["mechanical", "ai_assisted", "ai_dm"]);

export const AIContext = z.object({
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
export const SubClassesVerificationStatus = z.enum(["unverified", "verified"]);

export const SpellClassAccess = z.object({
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
export const SpellAccessGrant = z.object({
  sourceType: z.enum(["class_feature", "subclass_feature", "species_trait", "feat", "item", "background", "other"]),
  className: BaseClassNameEnum.optional(),
  sourceName: z.string(),
  accessType: z.enum(["known", "prepared", "always_prepared", "cast"]),
  automatic: z.boolean(),
  consumesSelection: z.boolean().optional(),
  notes: z.string().optional(),
});

export const SavingThrowAbility = z.enum(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);

// Defensive spell rows use this field for two different evidence layers:
// executable ability saves and source-backed protection scopes or modifier
// packets. Keep the ability enum strict while preserving the richer authored
// entries for a later defensive-runtime adapter.
export const SourceBackedSavingThrowLabel = z.string().trim().min(1);
export const SourceBackedSavingThrowMetadata = z.object({}).passthrough().refine(
  value => Object.keys(value).length > 0,
  { message: "saving-throw metadata must contain at least one source-backed field" },
);
export const SavingThrowEntry = z.union([
  SavingThrowAbility,
  SourceBackedSavingThrowLabel,
  SourceBackedSavingThrowMetadata,
]);

export const CastingTime = z.object({
  value: z.number(),
  unit: z.enum(["action", "bonus_action", "reaction", "free", "minute", "hour", "special"]),
  combatCost: z.object({
    type: z.enum(["action", "bonus_action", "reaction", "free"]), // Validation Rule: Must strictly match castingTime.unit if applicable
    condition: z.string(),
  }),
  explorationCost: z.object({
    value: z.number(),
    unit: z.enum(["minute", "hour"]),
  }),
});

// ============================================================================
// Spell-Level Runtime Trigger Metadata
// ============================================================================
// These shapes validate spell timing rules that happen before or around the
// normal effect list. Smite-style reaction spells, Counterspell, and Lightning
// Arrow cannot be represented correctly by changing only an effect trigger,
// because the runtime also needs to know which combat event opens the cast.
// ============================================================================

export const SpellCastingTrigger = z.object({
  type: z.enum(["after_attack_hit", "when_visible_creature_casts_spell"]),
  timing: z.string().optional(),
  requiredCost: z.enum(["action", "bonus_action", "reaction", "free", "free"]).optional(),
  attackFilter: z.object({
    weaponType: z.enum(["melee", "ranged", "melee_weapon", "ranged_weapon", "unarmed", "any"]).optional(),
    attackType: z.enum(["weapon", "spell", "unarmed", "any"]).optional()
  }).optional(),
  targetBinding: z.string().optional(),
  maxRangeFeet: z.number().optional(),
  notes: z.string().optional(),
});

export const PendingAttackTrigger = z.object({
  type: z.enum(["next_attack"]),
  attackFilter: z.object({
    attackType: z.enum(["weapon", "spell", "unarmed", "any"]).optional(),
    weaponType: z.enum(["melee", "ranged", "melee_weapon", "ranged_weapon", "unarmed", "any"]).optional()
  }).optional(),
  resolvesOn: z.enum(["hit", "miss", "hit_or_miss"]),
  primaryTargetBinding: z.string().optional(),
  consumption: z.enum(["first_matching_attack", "every_matching_attack"]).optional(),
  missResolution: z.string().optional(),
  notes: z.string().optional(),
});

export const SpellInterruptionState = z.object({
  event: z.enum(["visible_creature_casts_spell"]),
  saveType: SavingThrowAbility,
  failureOutcome: z.enum(["spell_has_no_effect"]).optional(),
  failedSaveOutcome: z.string(),
  slotPolicy: z.string(),
  preservesInterruptedSlot: z.boolean().optional(),
  actionPolicy: z.string(),
  visibilityRequired: z.boolean(),
  rangeFeet: z.number(),
  runtimeBoundary: z.string().optional(),
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
export const DistanceUnit = z.enum(["feet", "miles", "inches"]);

export const Range = z.object({
  type: z.enum(["self", "touch", "ranged", "special", "sight", "unlimited"]),
  distance: z.number(),
  distanceUnit: DistanceUnit.optional(),
});

export const Components = z.object({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.boolean(),
  materialDescription: z.string(),
  materialCost: z.number(),
  isConsumed: z.boolean(),
});

export const Duration = z.object({
  type: z.enum(["instantaneous", "timed", "special", "until_dispelled", "until_dispelled_or_triggered"]),
  value: z.number(),
  unit: z.enum(["round", "minute", "hour", "day"]),
  concentration: z.boolean(),
});

export const EffectDuration = z.object({
  // Turn-relative values are valid authored rules, not legacy aliases for a
  // one-round duration. The combat lifecycle preserves their exact boundary.
  type: z.string().trim().min(1),
  value: z.number().optional()
});

export const EscapeCheck = z.object({
  ability: SavingThrowAbility.optional(),
  abilityOptions: z.array(z.string().trim().min(1)).optional(),
  skill: z.string().optional(),
  dc: z.union([z.number(), z.string().trim().min(1)]),
  actionCost: z.string().trim().min(1),
  success: z.string().optional(),
  eligibleActors: z.array(z.enum([
    "affected_creature",
    "creature_that_can_reach_affected_creature"
  ])).optional(),
}).passthrough();

// Zone movement is a real runtime trigger, not prose-only spell text. It stays
// beside the other area triggers so spell data for Spike Growth-style movement
// hazards can validate before the effect layer processes movement through a
// zone.
export const EffectTrigger = z.object({
  // Composite source labels such as `area_entry_or_turn_start` carry several
  // event boundaries in one record. Keep the label intact until a dedicated
  // area-schedule adapter owns the expansion into executable triggers.
  type: z.string().trim().min(1),
  frequency: z.enum(["every_time", "first_per_turn", "once", "once_per_creature"]).optional(),
  consumption: z.enum(["unlimited", "first_hit", "per_turn", "per_instance_hit_or_miss"]).optional(),
  attackFilter: z.object({
    weaponType: z.enum(["melee", "ranged", "melee_weapon", "ranged_weapon", "unarmed", "any"]).optional(),
    attackType: z.enum(["weapon", "spell", "unarmed", "any"]).optional()
  }).optional(),
  movementType: z.enum(["any", "willing", "forced"]).optional(),
  sustainCost: z.object({
    actionType: z.enum(["action", "bonus_action", "reaction"]),
    optional: z.boolean()
  }).optional(),
  areaTiming: z.array(z.string()).optional(),
  repeatAction: z.object({}).passthrough().optional(),
  onlyIf: z.string().optional(),
  oncePerTurn: z.boolean().optional(),
});

// Save modifiers have a normalized executable form, but several authored
// spell rows still carry source labels such as `modifier`, `source`, or a
// prose `appliesTo` value. Preserve those rows until a save-resolution
// adapter owns their normalization instead of rejecting the spell record.
export const SaveModifier = z.object({
  type: z.string().trim().min(1).optional(),
  modifier: z.string().trim().min(1).optional(),
  value: z.number().optional(),
  appliesTo: z.union([TargetConditionFilter, z.string().trim().min(1)]).optional(),
  reason: z.string().optional(),
  condition: z.string().optional(),
  source: z.string().optional(),
  options: z.array(z.object({
    label: z.string(),
    modifier: z.number(),
  }).passthrough()).optional(),
  advantageOnDamage: z.boolean().optional(),
  sizeAdvantage: z.array(z.string()).optional(),
  sizeDisadvantage: z.array(z.string()).optional(),
  // Some saving throws, such as Sacred Flame, explicitly deny normal cover
  // bonuses. This keeps those exceptions attached to the save that uses them
  // instead of hiding them in prose where the runtime cannot apply them.
  ignoredCover: z.array(z.enum(["half", "three_quarters", "total"])).optional()
}).passthrough().refine(
  value => Boolean(value.type || value.modifier || value.source || value.condition),
  { message: "save modifier requires an executable or source-backed discriminator" },
);

// Save-outcome rows contain both the executable auto-success/auto-failure
// contract and source-backed metadata for outcomes such as voluntary_failure
// or an enclosure escape. Preserve the latter until a save-resolution adapter
// owns those semantics instead of rejecting real authored evidence.
export const SourceBackedSaveOutcomeLabel = z.string().trim().min(1);
export const StructuredSaveOutcomeOverride = z.object({
  outcome: SourceBackedSaveOutcomeLabel,
  condition: SourceBackedSaveOutcomeLabel,
  reason: z.string().optional(),
});
export const SourceBackedSaveOutcomeMetadata = z.object({}).passthrough().refine(
  value => Object.keys(value).length > 0,
  { message: "save-outcome metadata must contain at least one source-backed field" },
);
export const SaveOutcomeOverride = z.union([
  StructuredSaveOutcomeOverride,
  SourceBackedSaveOutcomeMetadata,
]);

export const RepeatSaveModifiers = z.object({
  advantageOnDamage: z.boolean().optional(),
  sizeAdvantage: z.array(z.string()).optional(),
  sizeDisadvantage: z.array(z.string()).optional()
});

export const RepeatSaveTiming = z.enum([
  "turn_end",           // End of target's turn
  "turn_start",         // Start of target's turn
  "on_damage",          // When target takes damage
  "on_action",          // Target must use action to attempt
  "after_forced_movement" // Target saves after completing spell-forced movement
]);

export const RepeatSaveProgression = z.object({
  // Some repeat saves count successes and failures instead of ending on the
  // first success. The optional thresholds keep Contagion/Flesh to Stone data
  // machine-readable without changing simple repeat-save spells.
  successThreshold: z.number().optional(),
  failureThreshold: z.number().optional(),
  consecutiveRequired: z.boolean().optional(),
  successOutcome: z.string().optional(),
  failureOutcome: z.string().optional()
});

export const RepeatSavePrerequisite = z.enum([
  "no_line_of_sight_to_caster"
]);

export const RepeatSave = z.object({
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

export const RecurringMechanic = z.object({
  // Recurring mechanics capture turn-by-turn or trigger-by-trigger rules that
  // are not always status repeat saves, such as Heroism temp HP, Elemental Bane
  // first-per-turn damage, and Tree Stride end-turn positioning.
  timing: z.string().trim().min(1).optional(),
  frequency: z.string().trim().min(1).optional(),
  saveType: z.string().trim().min(1).optional(),
  // The corpus still carries the source label `negates` for effects whose
  // successful save prevents the condition or movement. Preserve that label
  // here; the damage runtime normalizes it at its executable boundary.
  saveEffect: z.string().trim().min(1).optional(),
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
}).passthrough().refine(
  value => Boolean(value.timing || value.trigger || value.type),
  { message: "recurring mechanic requires a timing, trigger, or type discriminator" },
);

export const RecurringMechanics = z.union([
  z.array(RecurringMechanic),
  RecurringMechanic,
]);

export const EffectCondition = z.object({
  type: z.enum(["hit", "save", "always"]),
  saveType: SavingThrowAbility.optional(),
  // Counterspell negates the triggering spell effect rather than a named
  // condition, so the validator must allow that outcome as a real save result.
  saveEffect: z.enum(["none", "half", "negates_condition", "negates_effect", "negates"]).optional(),
  targetFilter: TargetConditionFilter.optional(),
  requiresStatus: z.array(z.string()).optional(),
  saveModifiers: z.array(SaveModifier).optional(),
  // Some spells skip the normal save result entirely for specific targets.
  // This records automatic success/failure rules beside the save they modify,
  // while broader target filters continue to handle ordinary eligibility.
  saveOutcomeOverrides: z.array(SaveOutcomeOverride).optional(),
});

export const ScalingFormula = z.object({
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
export const CharacterLevelTierScaling = z.object({
  type: z.literal("character_level_tiers"),
  tiers: z.record(z.string(), z.string()),
  notes: z.string().optional(),
});

export const SlotLevelBonusScaling = z.object({
  type: z.literal("slot_level_bonus"),
  baseSpellLevel: z.number(),
  bonusPerLevel: z.string(),
  notes: z.string().optional(),
});

export const SlotLevelTableScaling = z.object({
  type: z.literal("slot_level_table"),
  baseSpellLevel: z.number(),
  entries: z.record(z.string(), z.string()),
  notes: z.string().optional(),
});

export const TargetCountBonusScaling = z.object({
  type: z.literal("target_count_bonus"),
  baseSpellLevel: z.number(),
  additionalTargetsPerLevel: z.number(),
  targetLabel: z.string().optional(),
  notes: z.string().optional(),
});

export const AreaSizeBonusScaling = z.object({
  type: z.literal("area_size_bonus"),
  baseSpellLevel: z.number(),
  increasePerLevel: z.number(),
  unit: z.literal("feet"),
  dimension: z.enum(["radius", "diameter", "cube_size", "line_length", "wall_length", "wall_height"]),
  notes: z.string().optional(),
});

export const HigherLevelScalingRule = z.discriminatedUnion("type", [
  CharacterLevelTierScaling,
  SlotLevelBonusScaling,
  SlotLevelTableScaling,
  TargetCountBonusScaling,
  AreaSizeBonusScaling,
]);

export const MultipleHigherLevelScaling = z.object({
  type: z.literal("multiple"),
  rules: z.array(HigherLevelScalingRule),
  notes: z.string().optional(),
});

export const SpecialTextOnlyHigherLevelScaling = z.object({
  type: z.literal("special_text_only"),
  referenceText: z.string(),
  reason: z.string().optional(),
});

export const HigherLevelScaling = z.discriminatedUnion("type", [
  CharacterLevelTierScaling,
  SlotLevelBonusScaling,
  SlotLevelTableScaling,
  TargetCountBonusScaling,
  AreaSizeBonusScaling,
  MultipleHigherLevelScaling,
  SpecialTextOnlyHigherLevelScaling,
]);

export const SoundEmission = z.object({
  audibleRadius: z.union([z.number(), z.literal("not_applicable")]),
  radiusUnit: z.enum(["feet", "miles", "not_applicable"]),
  source: z.enum(["caster", "target", "target_object", "origin_space", "spell_area", "not_applicable"]),
  trigger: z.enum(["on_cast", "on_hit", "after_teleport", "on_trigger", "not_applicable"]),
  description: z.string().optional(),
});
