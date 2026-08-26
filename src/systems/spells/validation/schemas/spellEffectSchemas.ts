/**
 * @file spellEffectSchemas.ts
 *
 * PURPOSE:
 * The per-effect-type Zod schemas for the spell corpus: BaseEffect and every
 * effect family that extends it (DAMAGE, HEALING, STATUS_CONDITION,
 * ATTACK_ROLL_MODIFIER, MOVEMENT, SUMMONING, TERRAIN, UTILITY, DEFENSIVE),
 * ending in the `SpellEffect` discriminated union consumed by SpellValidator.
 *
 * WHY THIS FILE EXISTS:
 * Split out of spellValidator.ts on 2026-09-09 (MOD-3.2, board agora-907c.6).
 * Declaration order is unchanged from the original file because the effect
 * schemas build on each other through .extend()/z.union(); the union at the
 * bottom must still see every member above it.
 *
 * WHAT IS PRESERVED:
 * `SummonedEntityStatBlock` keeps its original export (src/data/summonTemplates.ts
 * imports it through the spellValidator.ts barrel). `GrantedAction` is declared
 * but not yet wired into an effect shape; it is exported here rather than
 * pruned so the granted-action lane stays available.
 *
 * USED BY: ../spellValidator.ts.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:21:17
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';
import { TargetConditionFilter } from '../targetingSchemas';
import { SecondaryTargeting } from '../effectRelationshipSchemas';
import { AttackAugment } from '../attackAugmentSchemas';
import { AbilityCheckModifier } from '../abilityCheckModifierSchemas';
import { ControlledEntity } from '../controlledEntitySchemas';
import { IllusionMetadata, SensoryManifestation } from '../illusionSchemas';
import { FallControl } from '../fallControlSchemas';
import { ConditionBreakTrigger } from '../statusConditionSchemas';
import { ConditionalEnding, EffectEndCleanup, SustainRequirement } from '../effectLifecycleSchemas';
import {
  BarrierDamagePrevention,
  DamageInteraction,
  DeathPrevention,
  LinkedDamage,
  ResistanceSuppression,
  SpellEffectPrevention,
} from '../effectProtectionSchemas';
import {
  EffectCondition,
  EffectDuration,
  EffectTrigger,
  EscapeCheck,
  RecurringMechanics,
  RepeatSave,
  SavingThrowAbility,
  SavingThrowEntry,
  ScalingFormula,
  SoundEmission,
} from './spellPrimitives';

export const BaseEffect = z.object({
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
  // happens. Most rows use normalized arrays; compact source-backed lifecycle
  // rows remain valid as one object until a cleanup adapter owns their result.
  endCleanup: z.union([z.array(EffectEndCleanup), EffectEndCleanup]).optional(),
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
  recurringMechanics: RecurringMechanics.optional(),
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

export const DamageData = z.object({
  dice: z.string(),
  type: z.string(),
  // Some self-cost damage explicitly cannot be reduced or prevented. Keeping
  // the bypass list on the damage packet lets the runtime skip only the named
  // mitigation families instead of hard-coding spell names.
  mitigationBypass: z.array(z.enum(["resistance", "immunity", "damage_reduction", "damage_prevention"])).optional(),
  // Disintegrate-style damage has consequences beyond HP loss: some targets
  // vanish completely and leave only residue. This keeps that destruction rule
  // on the damage packet so combat and map systems can later enforce it after
  // saves and damage resolution.
  disintegration: z.object({
    creatureAtZeroHp: z.boolean(),
    includesNonmagicalWornAndCarried: z.boolean(),
    revivalOnlyBy: z.array(z.string()),
    automaticTargetTypes: z.array(z.string()),
    maxAutomaticTargetSize: z.string(),
    hugeOrLargerPortionCubeFeet: z.number(),
    residueName: z.string(),
    residueDescription: z.string()
  }).optional(),
});

export const DamageEffect = BaseEffect.extend({
  type: z.literal("DAMAGE"),
  damage: DamageData,
  // Lightning Arrow resolves even on a miss, but for half primary damage.
  // Keeping the multiplier on the damage effect matches the public spell type
  // and lets AbilityCommandFactory pass the fraction into DamageCommand without
  // a spell-name exception.
  missDamageMultiplier: z.number().optional(),
});

// Knock-style utility spells change the state of doors, boxes, locks, bars,
// and magical seals. Keeping that as structured object access data lets future
// map and inventory systems open the right thing without parsing spell prose.
export const NormalizedObjectAccessChange = z.object({
  eligibleObjectTypes: z.array(z.string()),
  mundaneStateChanges: z.array(z.enum(["unlock", "unstick", "unbar"])),
  maxLocksAffected: z.number(),
  suppressesMagicalClosure: z.string().optional(),
  suppressionDuration: EffectDuration.optional(),
  targetOperableDuringSuppression: z.boolean().optional(),
  soundEmission: z.object({
    audibleRadius: z.number(),
    radiusUnit: z.enum(["feet", "miles"]),
    source: z.enum(["target_object", "caster", "point"]),
    trigger: z.enum(["on_cast", "on_change"]),
    description: z.string(),
  }).optional(),
});

// Arcane Lock carries a source-shaped access packet rather than the normalized
// Knock-style lock-count fields. Both forms feed the same object-access runtime
// record, so preserve the source fields without making them pretend to be
// mundane lock-removal metadata.
export const SourceBackedObjectAccessChange = z.object({
  targetObjects: z.array(z.string()).min(1),
  newState: z.string().trim().min(1),
}).passthrough();

export const ObjectAccessChange = z.union([
  NormalizedObjectAccessChange,
  SourceBackedObjectAccessChange,
]);

// Summon/control packets share a small executable discriminator but their
// source vocabulary is intentionally broader than Tiny Servant. Command
// consumers narrow known fields by effect family; the validator must preserve
// richer domination, binding, transformation, and Wish-routing metadata rather
// than rejecting it or stripping it into description prose.
export const SummonControl = z.object({
  entityType: z.string().trim().min(1).optional(),
  mode: z.string().trim().min(1).optional(),
}).passthrough().refine(
  (value) => Boolean(value.entityType || value.mode),
  { message: "summonControl requires a non-empty entityType or mode discriminator" },
);

// Animated-object rows vary by spell: Tiny Servant has a compact normalized
// packet, while Animate Objects keeps size tables, communication facts, and a
// structured control record. Preserve both forms until the summon adapter
// owns a common normalized state.
export const AnimatedObjectState = z.object({
  creatureType: z.string().trim().min(1).optional(),
  size: z.string().trim().min(1).optional(),
  sourceObject: z.string().trim().min(1).optional(),
  damageImmunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  description: z.string().optional(),
  armorClass: z.number().optional(),
  hitPointsBySize: z.object({}).passthrough().optional(),
  lifecycle: z.object({}).passthrough().optional(),
  communication: z.object({}).passthrough().optional(),
  control: z.union([z.string().trim().min(1), z.object({}).passthrough()]).optional(),
}).passthrough().refine(
  value => Boolean(value.creatureType || value.size || value.sourceObject || value.lifecycle || value.control),
  { message: "animatedObjectState requires source-backed lifecycle or identity data" },
);

export const HealingData = z.object({
  dice: z.string().optional(),
  isTemporaryHp: z.boolean().optional(),
  pool: z.number().optional(),
  distribution: z.string().optional(),
  amount: z.string().optional(),
  target: z.string().optional(),
  exclusions: z.array(z.string()).optional(),
  cannotAffect: z.array(z.string()).optional(),
  trigger: z.string().optional(),
}).passthrough().refine(
  value => Boolean(value.dice || value.pool !== undefined || value.amount || value.target),
  { message: "healing requires dice, a healing pool, or a source-backed amount/target" },
);

export const HealingEffect = BaseEffect.extend({
  type: z.literal("HEALING"),
  healing: HealingData,
});

export const StatusCondition = z.object({
  name: z.string(),
  duration: EffectDuration,
  level: z.number().optional(),
  escapeCheck: EscapeCheck.optional(),
  repeatSave: RepeatSave.optional(),
  breakTriggers: z.array(ConditionBreakTrigger).optional()
});

export const StatusConditionEffect = BaseEffect.extend({
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
export const AttackRollModifier = z.object({
  modifier: z.enum(["advantage", "disadvantage", "bonus", "penalty"]),
  direction: z.enum(["incoming", "outgoing"]),
  attackKind: z.enum(["any", "weapon", "melee_weapon", "ranged_weapon", "spell"]),
  consumption: z.enum(["next_attack", "first_attack", "while_active"]),
  duration: EffectDuration,
  dice: z.string().optional(),
  value: z.number().optional(),
  attackerFilter: TargetConditionFilter.optional(),
  notes: z.string().optional(),
}).passthrough();

export const InvisibilitySuppression = z.object({
  suppressesConditionBenefit: z.union([z.literal("Invisible"), z.string()]),
  scope: z.string().optional(),
  duration: z.string().optional(),
  description: z.string().optional(),
});

export const RiderLight = z.object({
  brightRadius: z.number(),
  dimRadius: z.number().optional(),
  attachedTo: z.enum(["caster", "target", "point"]).optional(),
  color: z.string().optional(),
  colorChoice: z.enum(["caster_choice", "fixed", "not_applicable"]).optional(),
  opaqueCoverBlocks: z.union([z.boolean(), z.string().trim().min(1)]).optional(),
  emitsHeat: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  ignitesObjects: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  consumesFuel: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  canBeCoveredOrHidden: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  canBeSmotheredOrQuenched: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
});

export const AttackRollModifierEffect = BaseEffect.extend({
  type: z.literal("ATTACK_ROLL_MODIFIER"),
  attackRollModifier: AttackRollModifier,
  damage: DamageData.optional(),
  // Shining Smite's after-hit rider also makes the target shed light. Validate
  // that payload here so it travels with the shared attack-roll rider instead
  // of requiring a separate utility effect or spell-specific exception.
  light: RiderLight.optional(),
  // Shining Smite-style rider effects can carry a second payload: attacks
  // against the target gain the rider, and the target stops benefiting from
  // Invisible while the rider remains active. Keep that contract validated on
  // the shared rider family rather than accepting it as untyped spell prose.
  invisibilitySuppression: InvisibilitySuppression.optional(),
});

export const MovementEffect = BaseEffect.extend({
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

export const GrantedAction = z.object({
  type: z.enum(["action", "bonus_action", "reaction", "free"]),
  action: z.string(),
  frequency: z.enum(["once", "each_turn", "while_active"]),
  // Actor and action kind distinguish a caster sustaining a spell from a spell
  // granting a target a new Magic action, such as Dragon's Breath.
  actor: z.enum(["caster", "target", "summoned_entity", "affected_creature"]).optional(),
  targeting: z.enum(["single_any", "single_enemy", "single_ally"]).optional(),
  socialServiceRequest: z.string().trim().min(1).optional(),
  actionKind: z.enum(["magic_action", "standard_action", "bonus_action", "reaction", "not_applicable"]).optional(),
  areaShape: z.enum(["Cone", "Line", "Sphere", "Cube", "Cylinder", "not_applicable"]).optional(),
  areaSize: z.union([z.number(), z.literal("not_applicable")]).optional(),
  areaSizeUnit: z.enum(["feet", "miles", "not_applicable"]).optional(),
  effectIndices: z.array(z.number()).optional(),
  prerequisites: z.array(z.enum(["target_object_within_spell_range", "target_within_spell_range", "not_applicable"])).optional(),
  rangeLimit: z.number().optional(),
  attackType: z.enum(["ranged_spell_attack", "melee_spell_attack", "not_applicable"]).optional(),
  damage: DamageData.optional(),
  // Area follow-up actions can resolve through saving throws instead of attack
  // rolls. Melf's Minute Meteors and Flaming Sphere both use Dexterity-half
  // payloads, so the validator must accept the same contract the runtime logs.
  saveType: SavingThrowAbility.optional(),
  saveEffect: z.enum(["none", "half", "negates_condition", "negates"]).optional(),
  // Flame Blade-style conjured attacks add the caster's spellcasting ability
  // modifier to later granted-action damage. Keep it opt-in so generic beams
  // and illusion actions do not inherit modifiers by implication.
  damageAbilityModifier: z.enum(["spellcasting_ability", "not_applicable"]).optional(),
  wallLengthReduction: z.number().optional(),
  endsWhenLengthZero: z.boolean().optional(),
  notes: z.string().optional(),
});

// Command menus use `name`/`effect`, while several authored source packets use
// `mode` or `label` with richer fields. Keep both forms lossless, but require a
// real discriminator so an empty option cannot silently enter the command UI.
export const ControlOption = z.object({
  name: z.string().trim().min(1).optional(),
  effect: z.string().trim().min(1).optional(),
  mode: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  details: z.string().optional(),
  summary: z.string().optional(),
}).passthrough().refine(
  (value) => Boolean((value.name && value.effect) || value.mode || value.label),
  { message: "controlOptions require name/effect, mode, or label metadata" },
);

export const TauntEffect = z.object({
  disadvantageAgainstOthers: z.boolean().optional(),
  leashRangeFeet: z.number().optional(),
  breakEvents: z.array(z.enum([
    "caster_attacks_other",
    "caster_casts_spell_on_other_enemy",
    "caster_ally_damages_target",
    "caster_ends_turn_outside_leash",
  ])).optional(),
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

export const SummonedEntityLifecycle = z.object({
  // Persistent summons need their end-state, repair, and recast behavior to
  // survive validation so the structured packet remains useful to runtime.
  hitPointMaximum: z.string().optional(),
  repairOnly: z.string().optional(),
  zeroHpEnding: z.string().optional(),
  recastEnding: z.string().optional(),
});

export const SummonedEntityControl = z.object({
  // Control summaries keep ownership and obedience facts attached to the
  // summon packet instead of flattening them into prose.
  entityType: z.string().optional(),
  source: z.string().optional(),
  allegiance: z.string().optional(),
  obedience: z.string().optional(),
  initiative: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  destruction: z.string().optional(),
});

export const SummonSpecialAction = z.object({
  name: z.string(),
  description: z.string(),
  cost: z.enum(['action', 'bonus_action', 'reaction', 'free']),
  damage: z.object({
    dice: z.string(),
    type: z.string() // DamageType
  }).optional()
});

export const SummonActionPermissions = z.object({
  // Familiar and summon packets need action permissions beside the created
  // entity so the runtime can enforce attacks, touch delivery, and command
  // economy from data instead of hidden spell branches.
  canAttack: z.boolean().optional(),
  canDeliverTouchSpells: z.boolean().optional(),
  touchDeliveryRangeFeet: z.number().optional(),
  touchDeliveryCost: z.enum(["action", "bonus_action", "reaction", "free", "free", "none"]).optional(),
  independentInitiative: z.boolean().optional(),
  obeysCasterCommands: z.boolean().optional(),
  commandCost: z.enum(["action", "bonus_action", "reaction", "free", "free", "none"]).optional(),
  defaultUncommandedAction: z.string().optional(),
  notes: z.string().optional(),
});

export const SummonFormTrait = z.object({
  // Form traits let one summon spell expose Air/Land/Water or similar choices
  // without pretending every form has the same movement and opportunity rules.
  name: z.string(),
  appliesToForms: z.array(z.string()).optional(),
  opportunityAttackPolicy: z.enum(["does_not_provoke_when_flying_out_of_reach", "normal"]).optional(),
  movementModeRequired: z.enum(["fly", "walk", "swim", "climb", "any"]).optional(),
  notes: z.string().optional(),
});

export const SummoningEffect = BaseEffect.extend({
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
    lifecycle: SummonedEntityLifecycle.optional(),
    control: SummonedEntityControl.optional(),

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
    // Runtime summon abilities already support free/no-action shared senses
    // costs. Keep the validator aligned so spell JSON can express those rules
    // without being rejected before SummoningCommand sees the metadata.
    sharedSensesCost: z.enum(["action", "bonus_action", "free", "none"]).optional(),
    specialActions: z.array(SummonSpecialAction).optional(),
    actionPermissions: SummonActionPermissions.optional(),
    formTraits: z.array(SummonFormTrait).optional()
  })
});

export const AreaOfEffect = z.object({
  shape: z.enum(["Cone", "Cube", "Cylinder", "Line", "Sphere", "Square"]),
  size: z.number(),
  height: z.number().optional(),
});

export const TerrainManipulation = z.object({
  type: z.enum(["excavate", "fill", "difficult", "normal", "cosmetic", "reshape"]),
  volume: z.object({
    shape: z.enum(["Cube", "Square"]),
    size: z.number(),
    depth: z.number().optional()
  }).optional(),
  // Move Earth reshapes a large terrain patch over time rather than instantly
  // creating a wall object. These fields keep the allowed materials, output
  // forms, slow completion cadence, and structure/plant side effects readable.
  materialOptions: z.array(z.string()).optional(),
  excludedMaterials: z.array(z.string()).optional(),
  formOptions: z.array(z.enum(["elevation", "trench", "wall", "pillar", "not_applicable"])).optional(),
  maxChangeFeet: z.number().optional(),
  completionTimeMinutes: z.number().optional(),
  canChooseNewAreaAfterCompletion: z.boolean().optional(),
  slowTransformationPreventsTrappingOrInjury: z.boolean().optional(),
  rocksAndStructuresShift: z.boolean().optional(),
  unstableStructuresMayCollapse: z.boolean().optional(),
  carriesPlantsWithoutAffectingGrowth: z.boolean().optional(),
  duration: EffectDuration.optional(),
  depositDistance: z.number().optional()
});

export const TerrainEffect = BaseEffect.extend({
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
export const SavePenaltyData = z.object({
  dice: z.string().optional(),        // e.g. "1d4" - rolled and subtracted from save
  flat: z.number().optional(),        // e.g. -2 - flat penalty to save
  applies: z.enum(["next_save", "all_saves"]),
  duration: EffectDuration.optional() // Falls back to spell duration if not specified
});

// Created-object rows preserve source distinctions that are broader than the
// current runtime object adapters. The corpus includes labels such as
// "sensory_effect", "target_object", and "per target body" alongside the
// smaller normalized vocabulary already consumed by runtime code. Keeping the
// source label is important for future adapters, so this validator checks that
// the field is a non-empty source-backed label without falsely rejecting a real
// spell or collapsing it into the wrong runtime category.
export const SourceBackedCreatedObjectLabel = z.string().trim().min(1);

export const CreatedObjectShape = z.object({
  // Utility creation effects can now preserve object stacks without forcing
  // every created thing into summons or terrain. Goodberry is the first compact
  // consumable pilot: ten discrete food items with healing and nourishment.
  kind: SourceBackedCreatedObjectLabel.optional(),
  objectType: SourceBackedCreatedObjectLabel,
  name: z.string(),
  count: z.number(),
  countScaling: z.object({
    type: z.literal("slot_level"),
    bonusPerLevel: z.number()
  }).optional(),
  countUnit: SourceBackedCreatedObjectLabel,
  appearsIn: SourceBackedCreatedObjectLabel,
  shapeOptions: z.array(z.string()).optional(),
  materialOptions: z.array(z.string()).optional(),
  // Creation pulls temporary nonliving matter from the Shadowfell. These fields
  // keep its player-choice limits, upcast size scaling, material-based expiry,
  // and material-component failure rule machine-readable instead of prose-only.
  nonlivingObjectOnly: z.boolean().optional(),
  requiresSeenFormAndMaterial: z.boolean().optional(),
  materialSource: z.string().optional(),
  maxCreatedObjectCubeFeet: z.number().optional(),
  maxCreatedObjectCubeScaling: z.object({
    type: z.literal("slot_level"),
    bonusPerLevel: z.number()
  }).optional(),
  durationByMaterial: z.record(z.string(), z.string()).optional(),
  mixedMaterialsUseShortestDuration: z.boolean().optional(),
  cannotServeAsMaterialComponent: z.boolean().optional(),
  // Fabricate transforms visible raw materials into finished products. These
  // fields keep the material, size, quality, forbidden-output, and tool-gate
  // limits machine-readable for future crafting and inventory systems.
  requiresVisibleRawMaterials: z.boolean().optional(),
  consumesSourceMaterials: z.boolean().optional(),
  outputSameMaterialAsSource: z.boolean().optional(),
  maxFabricatedObjectCubeFeet: z.number().optional(),
  maxConnectedFiveFootCubes: z.number().optional(),
  maxMineralObjectCubeFeet: z.number().optional(),
  qualityLimitedByMaterials: z.boolean().optional(),
  cannotCreateCreatures: z.boolean().optional(),
  cannotCreateMagicItems: z.boolean().optional(),
  skilledGoodsRequireToolProficiency: z.boolean().optional(),
  // Stone Shape can create useful stone forms, but it has hard limits on the
  // size of the affected stone and on fine mechanical detail. Keeping those
  // limits here lets map/object systems distinguish a shaped passage or latch
  // from an unrestricted fabrication tool.
  maxStoneDimensionFeet: z.number().optional(),
  maxHinges: z.number().optional(),
  canIncludeLatch: z.boolean().optional(),
  canCreateFineMechanicalDetail: z.boolean().optional(),
  levels: z.number().optional(),
  levelScaling: z.object({
    type: z.literal("slot_level"),
    bonusPerLevel: z.number()
  }).optional(),
  levelHeightFeet: z.number().optional(),
  areaPerLevelSquareFeet: z.number().optional(),
  accessBetweenLevels: z.boolean().optional(),
  secureOpenings: z.boolean().optional(),
  furnished: z.boolean().optional(),
  weatherProtected: z.boolean().optional(),
  dedicationSource: z.string().optional(),
  appearanceChosenByCaster: z.boolean().optional(),
  interiorFeatures: z.array(z.string()).optional(),
  doorCount: z.number().optional(),
  doorControlledByCasterAndDesignates: z.boolean().optional(),
  windowsCasterChoice: z.boolean().optional(),
  illuminationOptions: z.array(z.enum(["bright", "dim", "unlit", "not_applicable"])).optional(),
  ambientScent: z.string().optional(),
  ambientTemperature: z.enum(["mild", "normal", "not_applicable"]).optional(),
  portalWidthFeet: z.number().optional(),
  portalHeightFeet: z.number().optional(),
  extradimensionalSpace: z.boolean().optional(),
  capacityCreatures: z.number().optional(),
  capacityCreatureMaxSize: z.string().optional(),
  blocksCrossBoundaryEffects: z.boolean().optional(),
  occupantsCanSeeOut: z.boolean().optional(),
  contentsDropOutOnEnd: z.boolean().optional(),
  safelyEjectsContentsOnEnd: z.boolean().optional(),
  preservesStructuralStability: z.boolean().optional(),
  requiresAnchoring: z.boolean().optional(),
  anchoringOptions: z.array(z.string()).optional(),
  collapsesIfUnsupported: z.boolean().optional(),
  collapseTiming: z.string().optional(),
  obscuresArea: z.enum(["lightly", "heavily", "not_applicable"]).optional(),
  // Blade Barrier-style walls are not solid barriers, but they do provide
  // cover and make their own space hard to cross. Keep those battlefield facts
  // on the created object so map systems can consume them later.
  providesCover: z.enum(["half", "three_quarters", "total", "not_applicable"]).optional(),
  spaceIsDifficultTerrain: z.boolean().optional(),
  // Wall of Water-style barriers alter attacks and elemental damage that pass
  // through them. Keep these pass-through rules on the created object so combat
  // can later enforce them without parsing spell descriptions.
  rangedWeaponAttacksThroughHaveDisadvantage: z.boolean().optional(),
  reducesPassingDamageType: z.string().optional(),
  passingDamageMultiplier: z.number().optional(),
  canFreezeFromDamageType: z.string().optional(),
  frozenSectionSizeFeet: z.number().optional(),
  frozenSectionArmorClass: z.number().optional(),
  frozenSectionHitPoints: z.number().optional(),
  destroyedFrozenSectionsDoNotRefill: z.boolean().optional(),
  // Wall/barrier objects need blocking and destruction rules in data so future
  // map targeting can enforce them without reparsing prose. Wall of Force is
  // the first force-barrier pilot for this contract.
  wallLengthFeet: z.number().optional(),
  wallHeightFeet: z.number().optional(),
  wallThickness: z.number().optional(),
  wallThicknessUnit: z.enum(["feet", "inches", "not_applicable"]).optional(),
  panelCount: z.number().optional(),
  panelWidthFeet: z.number().optional(),
  panelHeightFeet: z.number().optional(),
  panelContiguityRequired: z.boolean().optional(),
  orientationOptions: z.array(z.enum(["horizontal", "vertical", "diagonal", "angled", "caster_choice", "not_applicable"])).optional(),
  freeFloating: z.boolean().optional(),
  blocksPhysicalPassage: z.boolean().optional(),
  blocksLineOfSight: z.boolean().optional(),
  blocksEtherealTravel: z.boolean().optional(),
  blocksSpellEffects: z.boolean().optional(),
  blocksEnergyEffects: z.boolean().optional(),
  breathableInside: z.boolean().optional(),
  immuneToDamage: z.boolean().optional(),
  objectArmorClass: z.number().optional(),
  hitPointsPerInchThickness: z.number().optional(),
  sectionHitPoints: z.number().optional(),
  damageImmunities: z.array(z.string()).optional(),
  damageVulnerabilities: z.array(z.string()).optional(),
  immuneToDispelMagic: z.boolean().optional(),
  immuneToAntimagicField: z.boolean().optional(),
  blocksDivinationSensorsInside: z.boolean().optional(),
  blocksDivinationTargetingInside: z.boolean().optional(),
  opposedCreatureTypeOptions: z.array(z.string()).optional(),
  opposedCreatureEntrySaveType: SavingThrowAbility.optional(),
  opposedCreatureEntryBlockedDurationHours: z.number().optional(),
  opposedCreaturePenaltyDice: z.string().optional(),
  healingBonusAbilityModifier: z.enum(["Wisdom", "spellcasting_ability", "not_applicable"]).optional(),
  healingBonusMinimum: z.number().optional(),
  healingBonusTrigger: z.string().optional(),
  permanenceRequiresDailyCasts: z.number().optional(),
  permanenceSameLocationRequired: z.boolean().optional(),
  createdEntityKind: z.enum(["clone_body", "inert_duplicate", "suspended_body", "astral_form", "other"]).optional(),
  growthDurationDays: z.number().optional(),
  maturesInVessel: z.boolean().optional(),
  vesselRequired: z.boolean().optional(),
  vesselMinimumValueGp: z.number().optional(),
  vesselMustRemainUndisturbed: z.boolean().optional(),
  inertUntilTrigger: z.boolean().optional(),
  activationTrigger: z.string().optional(),
  soulMustBeFreeAndWilling: z.boolean().optional(),
  soulTransferConsumesOriginalRevival: z.boolean().optional(),
  duplicateRetainsPersonalityMemoriesAbilities: z.boolean().optional(),
  duplicateHasOriginalEquipment: z.boolean().optional(),
  casterChoosesFinalAge: z.boolean().optional(),
  enduresIndefinitelyAfterMature: z.boolean().optional(),
  needsFoodOrAir: z.boolean().optional(),
  agesWhileSuspended: z.boolean().optional(),
  linkedToCounterpartForm: z.boolean().optional(),
  silverCordLink: z.boolean().optional(),
  silverCordVisibleDistanceFeet: z.number().optional(),
  silverCordCutEffect: z.string().optional(),
  damageSharedWithCounterpart: z.boolean().optional(),
  effectsSharedWithCounterpart: z.boolean().optional(),
  planarExitTransfersBodyAndPossessions: z.boolean().optional(),
  endsWhenBodyOrFormDropsToZeroHp: z.boolean().optional(),
  returnsToBodyOnEndIfAlive: z.boolean().optional(),
  permanentAfterFullDuration: z.boolean().optional(),
  nonDispellableWhenPermanent: z.boolean().optional(),
  destroyedBySpells: z.array(z.string()).optional(),
  pushesCreaturesToChosenSide: z.boolean().optional(),
  enclosureEscapeSaveType: SavingThrowAbility.optional(),
  enclosureEscapeUsesReaction: z.boolean().optional(),
  enclosureEscapeMoveDistance: z.enum(["speed", "not_applicable"]).optional(),
  leavesHazardOnSectionDestroyed: z.boolean().optional(),
  lingeringHazardName: z.string().optional(),
  lingeringHazardDamage: DamageData.optional(),
  lingeringHazardSaveType: SavingThrowAbility.optional(),
  lingeringHazardSaveEffect: z.enum(["none", "half", "negates_condition", "negates"]).optional(),
  lingeringHazardFrequency: z.enum(["first_per_turn", "every_time", "once_per_creature"]).optional(),
  // Movable hazards, such as Flaming Sphere, need enough geometry and motion
  // data for later map enforcement without being promoted to summoned actors.
  diameterFeet: z.number().optional(),
  objectLengthFeet: z.number().optional(),
  moveDistanceFeet: z.number().optional(),
  attackReachFeet: z.number().optional(),
  attacksPerActivation: z.number().optional(),
  criticalHitThreshold: z.number().optional(),
  passesHarmlesslyThroughBarriers: z.boolean().optional(),
  canTargetLooseObjects: z.boolean().optional(),
  canTargetStructures: z.boolean().optional(),
  prisonModeOptions: z.array(z.enum(["burial", "chaining", "hedged_prison", "minimus_containment", "slumber", "not_applicable"])).optional(),
  demiplaneFormOptions: z.array(z.string()).optional(),
  blocksTeleportation: z.boolean().optional(),
  blocksPlanarTravel: z.boolean().optional(),
  lightPassesThroughOnly: z.boolean().optional(),
  containedCreatureSizeInches: z.number().optional(),
  observableEndingTriggerRequired: z.boolean().optional(),
  endingTriggerExpectedWithinYears: z.number().optional(),
  dispelMagicMinimumSlotLevel: z.number().optional(),
  dispelMagicTargetOptions: z.array(z.string()).optional(),
  failsIfPlacedInOccupiedSpace: z.boolean().optional(),
  safePassageAllowedFor: z.array(z.string()).optional(),
  proximityTriggerRadiusFeet: z.number().optional(),
  layerCount: z.number().optional(),
  layerOrder: z.array(z.string()).optional(),
  layersDestroyedInOrder: z.boolean().optional(),
  destroyedLayersRemainGone: z.boolean().optional(),
  dispelMagicAffectsOnlyLayer: z.string().optional(),
  requiresLayerEffectTable: z.boolean().optional(),
  movableByOccupants: z.boolean().optional(),
  movableByExternalCreatures: z.boolean().optional(),
  occupantRollSpeedMultiplier: z.number().optional(),
  hoverMaxHeightFeet: z.number().optional(),
  safelyDescendsOverDrops: z.boolean().optional(),
  barrierHeightFeet: z.number().optional(),
  pitJumpWidthFeet: z.number().optional(),
  hazardRadiusFeet: z.number().optional(),
  // Fire-wall hazards can damage only a chosen side while still damaging
  // creatures inside the wall. These fields preserve the side and timing
  // contract for later map enforcement.
  hazardSide: z.enum(["caster_choice", "all_sides", "inside", "outside", "not_applicable"]).optional(),
  hazardTriggers: z.array(z.enum(["enter", "end_turn_inside", "end_turn_within_radius", "first_per_turn"])).optional(),
  // Shape Water-style utility spells alter a bounded volume of existing
  // material. These fields keep the legal volume, movement, visual, animation,
  // and freezing modes available to UI/runtime systems without interpreting prose.
  affectedVolumeShape: SourceBackedCreatedObjectLabel.optional(),
  affectedVolumeSizeFeet: z.number().optional(),
  maxManipulationDistanceFeet: z.number().optional(),
  manipulationOptions: z.array(z.string()).optional(),
  // Large environmental water-control spells need mode metadata for flood,
  // part-water, redirect-flow, and whirlpool behavior without creating a new
  // effect type for every natural-water shape.
  waterLevelChangeFeet: z.number().optional(),
  vehicleCapsizeChancePercent: z.number().optional(),
  maxAffectedVehicleSize: z.string().optional(),
  repeatsOnCasterTurn: z.boolean().optional(),
  pullDistanceFeet: z.number().optional(),
  escapeCheck: z.string().optional(),
  canAnimateSimpleShapes: z.boolean().optional(),
  canChangeColorOrOpacity: z.boolean().optional(),
  canFreeze: z.boolean().optional(),
  freezeRequiresNoCreatures: z.boolean().optional(),
  // Transient conjured water effects, such as Tidal Wave, need dimensions and
  // cleanup behavior even though they disappear immediately instead of staying
  // on the map as a wall or terrain zone.
  waveLengthFeet: z.number().optional(),
  waveWidthFeet: z.number().optional(),
  waveHeightFeet: z.number().optional(),
  extinguishesUnprotectedFlamesRadiusFeet: z.number().optional(),
  vanishesAfterEffect: z.boolean().optional(),
  // Watery Sphere-style objects restrain and carry occupants, so the sphere's
  // capacity and ejection rules need to travel with the created object rather
  // than living only in the status-condition prose.
  capacityMediumOrSmallerCreatures: z.number().optional(),
  capacityLargeCreatures: z.number().optional(),
  occupantsMoveWithObject: z.boolean().optional(),
  overflowEjectionRule: z.enum(["random_existing_occupant", "newest_creature", "not_applicable"]).optional(),
  successfulSaveEjectsCreature: z.boolean().optional(),
  ejectionDistanceFeet: z.number().optional(),
  occupantsProneOnEnd: z.boolean().optional(),
  trapsCreaturesOnSurface: z.boolean().optional(),
  trappedCondition: z.string().optional(),
  ignitesTouchedObjects: z.boolean().optional(),
  depthFeet: z.number().optional(),
  flammable: z.boolean().optional(),
  burnUnitSizeFeet: z.number().optional(),
  burnDurationRounds: z.number().optional(),
  burnDamage: z.object({
    dice: z.string(),
    type: z.string(),
    mitigationBypass: z.array(z.enum(["resistance", "immunity", "damage_reduction", "damage_prevention"])).optional(),
  }).optional(),
  // Orbiting expendables cover spells such as Melf's Minute Meteors without
  // pretending each small charge is an independent summon or terrain zone.
  orbitsCaster: z.boolean().optional(),
  expendable: z.boolean().optional(),
  maxExpendedPerAction: z.number().optional(),
  consumeAction: z.enum(["action", "bonus_action", "reaction", "free", "free", "not_applicable"]).optional(),
  healingPerItem: z.number().optional(),
  nourishmentDaysPerItem: z.number().optional(),
  // Long-running enrichment spells alter a future harvest instead of creating
  // immediate inventory. These fields let travel/provision systems recognize
  // the yield rule without scraping prose from the spell description.
  harvestYieldMultiplier: z.number().optional(),
  harvestYieldRadiusFeet: z.number().optional(),
  harvestYieldDurationDays: z.number().optional(),
  harvestYieldAppliesTo: z.enum(["plants", "food_plants", "not_applicable"]).optional(),
  harvestBenefitLimit: z.string().optional(),
  // Some created supplies are measured as pounds or gallons in spell text but
  // need canonical inventory ids/stack quantities so travel provisioning can
  // count them without learning spell-specific names.
  inventoryItemId: z.string().optional(),
  inventoryQuantity: z.number().optional(),
  inventoryQuantityScaling: z.object({
    type: z.literal("slot_level"),
    bonusPerLevel: z.number()
  }).optional(),
  perishable: z.boolean().optional(),
  expiresWithSpell: z.boolean().optional(),
  shelfLife: z.string().optional(),
  notes: z.string().optional(),
});

// Older authored packets, such as Mighty Fortress, use a named `kind` packet
// with spell-specific properties instead of the normalized object fields. Keep
// those records valid and lossless until the structure runtime owns a complete
// adapter; the presence of a non-empty kind still distinguishes this legacy
// form from an arbitrary malformed object row.
export const CreatedObject = z.union([
  CreatedObjectShape,
  z.object({ kind: SourceBackedCreatedObjectLabel }).passthrough(),
]);

export const UtilityEffect = BaseEffect.extend({
  type: z.literal("UTILITY"),
  utilityType: z.string().trim().min(1),
  description: z.string(),
  attackAugments: z.array(AttackAugment).optional(),
  abilityCheckModifier: AbilityCheckModifier.optional(),
  controlledEntity: ControlledEntity.optional(),
  // Tiny Servant and other source-backed control packets stay on the utility
  // effect so command/runtime adapters can retain their family-specific state.
  animatedObjectState: AnimatedObjectState.optional(),
  summonControl: SummonControl.optional(),
  createdObjects: z.array(CreatedObject).optional(),
  objectAccessChange: ObjectAccessChange.optional(),
  controlOptions: z.array(ControlOption).optional(),
  taunt: TauntEffect.optional(),
  savePenalty: SavePenaltyData.optional(), // For effects like Mind Sliver that impose save penalties
  light: z.object({
    brightRadius: z.number(),
    dimRadius: z.number().optional(),
    attachedTo: z.enum(["caster", "target", "point"]).optional(),
    color: z.string().optional(),
    colorChoice: z.enum(["caster_choice", "fixed", "not_applicable"]).optional(),
    opaqueCoverBlocks: z.union([z.boolean(), z.string().trim().min(1)]).optional(),
    emitsHeat: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    ignitesObjects: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    consumesFuel: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    canBeCoveredOrHidden: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
    canBeSmotheredOrQuenched: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  }).optional(),
  // Starry Wisp is a sensory utility rider rather than an attack-roll rider,
  // but it uses the same explicit "Invisible stops helping this target" payload
  // as Shining Smite. Keep the shared shape valid here so the spell data does
  // not have to hide that combat fact in prose.
  invisibilitySuppression: InvisibilitySuppression.optional(),
});

export const DamageReduction = z.object({
  // Reduction is different from resistance: it subtracts an explicit amount
  // from qualifying damage instead of halving damage through the resistance
  // rules. Resistance the cantrip is the first closed corpus case.
  dice: z.string(),
  flat: z.number().optional(),
  appliesTo: z.enum(["damage_taken"]),
  frequency: z.enum(["once_per_turn", "every_time"]).optional(),
});

export const DefenseSourceFilter = z.object({
  // Defensive source filters describe the incoming harm the defense responds
  // to. This is separate from target eligibility: Investiture of Stone targets
  // the caster, but only resists damage from nonmagical attacks.
  sourceCategories: z.array(z.enum(["attack", "spell", "effect", "environment"])).optional(),
  attackMagicalStatus: z.enum(["any", "magical", "nonmagical", "not_applicable"]).optional(),
});

export const DefensiveEffect = BaseEffect.extend({
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
  savingThrow: z.array(SavingThrowEntry).optional(),
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
export const SpellEffect = z.discriminatedUnion("type", [
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
