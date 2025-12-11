import {
  Spell,
  SpellSchool,
  SpellRarity,
  SpellAttackType,
  CastingTime,
  Range,
  Components,
  Duration,
  SpellTargeting,
  SpellEffect,
  BaseEffect,
  DamageEffect
} from '@/types/spells';

/**
 * Creates a mock Spell object with sensible defaults.
 * @param overrides Partial<Spell> to override default values.
 * @returns A complete Spell object.
 */
export function createMockSpell(overrides: Partial<Spell> = {}): Spell {
  const defaultDamageEffect: DamageEffect = {
    type: "DAMAGE",
    trigger: { type: "immediate" },
    condition: { type: "hit" },
    damage: { dice: "1d8", type: "Fire" }
  };

  return {
    id: `spell-${crypto.randomUUID()}`,
    name: "Mock Spell",
    level: 1,
    school: "Evocation" as SpellSchool,
    classes: ["Wizard"],
    description: "A mock spell for testing.",
    rarity: "common" as SpellRarity,
    attackType: "ranged" as SpellAttackType,

    castingTime: {
      value: 1,
      unit: "action"
    },

    range: {
      type: "ranged",
      distance: 60
    },

    components: {
      verbal: true,
      somatic: true,
      material: false
    },

    duration: {
      type: "instantaneous",
      concentration: false
    },

    targeting: {
      type: "single",
      range: 60,
      validTargets: ["creatures", "enemies"]
    },

    effects: [defaultDamageEffect],

    ...overrides
  };
}
