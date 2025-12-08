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
  type: z.enum(["immediate", "after_primary", "turn_start", "turn_end", "on_enter_area", "on_target_move", "on_attack_hit"]),
  frequency: z.enum(["every_time", "first_per_turn", "once"]).optional(),
});

const TargetConditionFilter = z.object({
  creatureType: z.array(z.string()).optional(),
  size: z.array(z.string()).optional(),
  alignment: z.array(z.string()).optional(),
});

const SaveModifier = z.object({
  type: z.enum(["advantage", "disadvantage", "bonus", "penalty"]),
  value: z.number().optional(),
  appliesTo: TargetConditionFilter.optional(),
  reason: z.string().optional(),
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

const FamiliarContract = z.object({
  forms: z.array(z.string()),
  telepathyRange: z.number(),
  actionEconomy: z.object({
    actsIndependently: z.boolean(),
    canAttack: z.boolean(),
  }),
  sensesSharing: z.object({
    actionType: z.enum(["action", "bonus_action", "reaction"]),
    range: z.number(),
  }).optional(),
  touchDelivery: z.object({
    enabled: z.boolean(),
    range: z.number(),
    usesReactionOf: z.enum(["familiar", "caster"]),
  }).optional(),
  dismissal: z.object({
    method: z.literal("pocket_dimension"),
    actionType: z.enum(["action", "bonus_action"]),
  }).optional(),
  notes: z.string().optional(),
});

const SummoningEffect = BaseEffect.extend({
  type: z.literal("SUMMONING"),
  summonType: z.enum(["creature", "object"]),
  creatureId: z.string().optional(),
  objectDescription: z.string().optional(),
  count: z.number(),
  duration: EffectDuration,
  familiarContract: FamiliarContract.optional(),
});

const AreaOfEffect = z.object({
  shape: z.enum(["Cone", "Cube", "Cylinder", "Line", "Sphere", "Square"]),
  size: z.number(),
  height: z.number().optional(),
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
});

const UtilityEffect = BaseEffect.extend({
  type: z.literal("UTILITY"),
  utilityType: z.enum(["light", "communication", "creation", "information", "control", "sensory", "other"]),
  description: z.string(),
  grantedActions: z.array(GrantedAction).optional(),
  attackAugments: z.array(AttackAugment).optional(),
  controlOptions: z.array(ControlOption).optional(),
  taunt: TauntEffect.optional(),
});

const DefensiveEffect = BaseEffect.extend({
  type: z.literal("DEFENSIVE"),
  defenseType: z.enum(["ac_bonus", "resistance", "immunity", "temporary_hp", "advantage_on_saves"]),
  value: z.number().optional(),
  damageType: z.array(z.string()).optional(),
  savingThrow: z.array(SavingThrowAbility).optional(),
  duration: EffectDuration,
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
