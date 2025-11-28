import { z } from 'zod';

const SpellRarity = z.enum(["common", "uncommon", "rare", "very_rare", "legendary"]);

const SavingThrowAbility = z.enum(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);

const CastingTime = z.object({
  value: z.number(),
  unit: z.enum(["action", "bonus_action", "reaction", "minute", "hour", "special"]),
  combatCost: z.enum(["action", "bonus_action", "reaction"]).optional(),
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
  unit: z.enum(["round", "minute", "hour"]).optional(),
  concentration: z.boolean(),
});

const EffectDuration = z.object({
    type: z.enum(["rounds", "minutes", "special"]),
    value: z.number().optional()
});

const EffectTrigger = z.object({
  type: z.enum(["immediate", "after_primary", "turn_start", "turn_end"]),
});

const EffectCondition = z.object({
  type: z.enum(["hit", "save", "always"]),
  saveType: SavingThrowAbility.optional(),
  saveEffect: z.enum(["none", "half", "negates_condition"]).optional(),
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
});

const SummoningEffect = BaseEffect.extend({
  type: z.literal("SUMMONING"),
  summonType: z.enum(["creature", "object"]),
  creatureId: z.string().optional(),
  objectDescription: z.string().optional(),
  count: z.number(),
  duration: EffectDuration,
});

const AreaOfEffect = z.object({
    shape: z.enum(["Cone", "Cube", "Cylinder", "Line", "Sphere"]),
    size: z.number(),
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
});

const UtilityEffect = BaseEffect.extend({
  type: z.literal("UTILITY"),
  utilityType: z.enum(["light", "communication", "creation", "information", "control", "sensory", "other"]),
  description: z.string(),
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
  classes: z.array(z.string()),
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
