import { describe, it, expect } from 'vitest';
import { createEnemyFromMonster } from '../createEnemyFromMonster';
import { canAffordActionCost } from '../actionEconomyUtils';
import { registerMonster } from '../../../data/adapters/runtimeMonsterRegistry';
import { Monster } from '../../../types';
import { MonsterData } from '../../../types/ui';

// A slot-based caster monster reaches the battle map through this converter.
// canAffordActionCost reads character.spellSlots['level_N'] and refuses the
// cast outright when that record is missing, so the pool parsed out of the
// 5eTools spellcasting block has to survive the monster-to-combatant handoff.
const baseStats = {
  strength: 11,
  dexterity: 12,
  constitution: 11,
  intelligence: 17,
  wisdom: 12,
  charisma: 11,
  baseInitiative: 1,
  speed: 30,
  cr: '6',
  senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 }
};

// registerMonster keys on `id`, while getMonster looks the name up as
// lowercase-with-underscores, so the two must agree for the registry to hit.
const makeCasterData = (name: string, spellSlots?: MonsterData['spellSlots']): MonsterData => ({
  id: name.toLowerCase().replace(/\s+/g, '_'),
  name,
  maxHP: 40,
  baseStats,
  abilities: [],
  tags: ['humanoid'],
  armorClass: 12,
  ...(spellSlots && { spellSlots })
});

const makeTemplate = (name: string): Monster => ({
  name,
  cr: '6',
  quantity: 1,
  description: 'Spell slot handoff test monster'
});

describe('createEnemyFromMonster spell slots', () => {
  it('maps a monster spell slot pool onto the combatant, full at the start of combat', () => {
    registerMonster(makeCasterData('Slot Mage Alpha', { 1: 4, 2: 3, 3: 3 }));

    const enemy = createEnemyFromMonster(makeTemplate('Slot Mage Alpha'), 0);

    expect(enemy.spellSlots).toBeDefined();
    expect(enemy.spellSlots?.level_1).toEqual({ current: 4, max: 4 });
    expect(enemy.spellSlots?.level_2).toEqual({ current: 3, max: 3 });
    expect(enemy.spellSlots?.level_3).toEqual({ current: 3, max: 3 });
  });

  it('zeroes every level the pool does not name instead of leaving it undefined', () => {
    registerMonster(makeCasterData('Slot Mage Beta', { 1: 2 }));

    const enemy = createEnemyFromMonster(makeTemplate('Slot Mage Beta'), 0);

    expect(enemy.spellSlots?.level_2).toEqual({ current: 0, max: 0 });
    expect(enemy.spellSlots?.level_9).toEqual({ current: 0, max: 0 });
  });

  it('lets the action economy afford a leveled monster spell it previously refused', () => {
    registerMonster(makeCasterData('Slot Mage Gamma', { 1: 4, 2: 3 }));

    const enemy = createEnemyFromMonster(makeTemplate('Slot Mage Gamma'), 0);

    expect(canAffordActionCost(enemy, { type: 'action', spellSlotLevel: 2 })).toBe(true);
    // Level 3 is outside the parsed pool, so the cast is still correctly refused.
    expect(canAffordActionCost(enemy, { type: 'action', spellSlotLevel: 3 })).toBe(false);
  });

  it('leaves spellSlots unset for an at-will caster with no parsed pool', () => {
    registerMonster(makeCasterData('At Will Mage'));

    const enemy = createEnemyFromMonster(makeTemplate('At Will Mage'), 0);

    expect(enemy.spellSlots).toBeUndefined();
  });
});
