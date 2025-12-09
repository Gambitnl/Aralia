import { z } from 'zod';
import { CLASSES_DATA } from '../../../data/classes';

const BASE_CLASS_NAMES = Object.values(CLASSES_DATA).map(cls => cls.name);
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

const SpellRarity = z.enum(["common", "uncommon", "rare", "very_rare", "legendary"]);

const SavingThrowAbility = z.enum(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);

const CastingTime = z.object({
  value: z.number(),
  unit: z.enum(["action", "bonus_action", "reaction", "minute", "hour", "special"]),
  combatCost: z.object({
    type: z.enum(["action", "bonus_action", "reaction"]),
    condition: z.string().optional(),
  }).optional(),
  explorationCost: z.object({
    value: z.number(),
    unit: z.enum(["minute", "hour"]),
  }).optional(),
});

const Range = z.object({
  type: z.enum(["self", "touch", "ranged", "special"]),
  distance: z.number().optional(),
});

const Components = z.object({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.boolean(),
  materialDescription: z.string().optional(),
  materialCost: z.number().optional(),
  isConsumed: z.boolean().optional(),
});

const Duration = z.object({
  type: z.enum(["instantaneous", "timed", "special", "until_dispelled", "until_dispelled_or_triggered"]),
  value: z.number().optional(),
  unit: z.enum(["round", "minute", "hour", "day"]).optional(),
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
});

const EffectTrigger = z.object({
  type: z.enum([
    "immediate",
    "after_primary",
    "turn_start",
    "turn_end",
    "on_enter_area",
    "on_exit_area",
    "on_end_turn_in_area",
    "on_target_move",
    "on_attack_hit",
    "on_target_attack",
    "on_target_cast",
    "on_caster_action"
  ]),
  frequency: z.enum(["every_time", "first_per_turn", "once", "once_per_creature"]).optional(),
  consumption: z.enum(["unlimited", "first_hit", "per_turn"]).optional(),
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

const TargetConditionFilter = z.object({
  creatureTypes: z.array(z.string()).optional(),
  excludeCreatureTypes: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  alignments: z.array(z.string()).optional(),
  hasCondition: z.array(z.string()).optional(),
  isNativeToPlane: z.boolean().optional(),
});

const SaveModifier = z.object({
  type: z.enum(["advantage", "disadvantage", "bonus", "penalty"]),
  value: z.number().optional(),
  appliesTo: TargetConditionFilter.optional(),
  reason: z.string().optional(),
  advantageOnDamage: z.boolean().optional(),
  sizeAdvantage: z.array(z.string()).optional(),
  sizeDisadvantage: z.array(z.string()).optional()
});

const RepeatSaveModifiers = z.object({
  advantageOnDamage: z.boolean().optional(),
  sizeAdvantage: z.array(z.string()).optional(),
  sizeDisadvantage: z.array(z.string()).optional()
});

const EffectCondition = z.object({
  type: z.enum(["hit", "save", "always"]),
  saveType: SavingThrowAbility.optional(),
  saveEffect: z.enum(["none", "half", "negates_condition"]).optional(),
  targetFilter: TargetConditionFilter.optional(),
  requiresStatus: z.array(z.string()).optional(),
  saveModifiers: z.array(SaveModifier).optional(),
});

const ScalingFormula = z.object({
  type: z.enum(["slot_level", "character_level", "custom"]),
  bonusPerLevel: z.string().optional(),
  customFormula: z.string().optional(),
});

const BaseEffect = z.object({
  trigger: EffectTrigger,
  condition: EffectCondition,
  scaling: ScalingFormula.optional(),
});

const DamageData = z.object({
  dice: z.string(),
  type: z.string(),
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
  repeatSave: z.object({
    timing: z.enum([
      "turn_end",           // End of target's turn
      "turn_start",         // Start of target's turn
      "on_damage",          // When target takes damage
      "on_action"           // Target must use action to attempt
    ]),
    saveType: z.enum([
      "Strength", "Dexterity", "Constitution",
      "Intelligence", "Wisdom", "Charisma",
      "strength_check",
      "wisdom_check"
    ]),
    successEnds: z.boolean(),
    useOriginalDC: z.boolean(),
    modifiers: RepeatSaveModifiers.optional()
  }).optional()
});

const StatusConditionEffect = BaseEffect.extend({
  type: z.literal("STATUS_CONDITION"),
  statusCondition: StatusCondition,
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
  rangeLimit: z.number().optional(),
  notes: z.string().optional(),
});

const AttackAugment = z.object({
  attackType: z.enum(["weapon", "melee_weapon", "ranged_weapon"]),
  additionalDamage: DamageData.optional(),
  appliesOn: z.enum(["hit"]).optional(),
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
const SummonedEntityStatBlock = z.object({
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
  skills: z.record(z.number()).optional(),
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
    countByCR: z.record(z.number()).optional(), // e.g. {"2": 1, "1": 2, "0.5": 4}

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
  grantedActions: z.array(GrantedAction).optional(),
  attackAugments: z.array(AttackAugment).optional(),
  controlOptions: z.array(ControlOption).optional(),
  taunt: TauntEffect.optional(),
  savePenalty: SavePenaltyData.optional(), // For effects like Mind Sliver that impose save penalties
  light: z.object({
    brightRadius: z.number(),
    dimRadius: z.number().optional(),
    attachedTo: z.enum(["caster", "target", "point"]).optional(),
    color: z.string().optional(),
  }).optional(),
});

const DefensiveEffect = BaseEffect.extend({
  type: z.literal("DEFENSIVE"),
  defenseType: z.enum([
    "ac_bonus",
    "set_base_ac",
    "ac_minimum",
    "resistance",
    "immunity",
    "temporary_hp",
    "advantage_on_saves"
  ]),
  value: z.number().optional(), // Used for AC bonus value or Temp HP amount
  baseACFormula: z.string().optional(), // For set_base_ac
  acMinimum: z.number().optional(), // For ac_minimum

  damageType: z.array(z.string()).optional(),
  savingThrow: z.array(SavingThrowAbility).optional(),
  duration: EffectDuration,

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

const SpellEffect = z.discriminatedUnion("type", [
  DamageEffect,
  HealingEffect,
  StatusConditionEffect,
  MovementEffect,
  SummoningEffect,
  TerrainEffect,
  UtilityEffect,
  DefensiveEffect,
]);

export const SpellValidator = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number(),
  school: z.string(),
  classes: z.array(ClassNameEnum),
  ritual: z.boolean().optional(),
  rarity: SpellRarity.optional(),
  castingTime: CastingTime,
  range: Range,
  components: Components,
  duration: Duration,
  targeting: z.any(),
  effects: z.array(SpellEffect),
  arbitrationType: z.string().optional(),
  description: z.string(),
  higherLevels: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
