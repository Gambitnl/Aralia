/**
 * This file proves the Armorer Arcane Armor model selection and the Guardian
 * Thunder Gauntlets / Infiltrator Lightning Launcher attack transactions.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applyArmorerModel,
  ARCANE_ARMOR_FEATURE_ID,
  getArmorerModel,
  isArmorerModel,
  resolveLightningLauncher,
  resolveThunderGauntlet,
} from '../armorerUtils';

function createArmorer(model?: string): CombatCharacter {
  const base = createMockCombatCharacter({
    id: 'armorer',
    name: 'Armorer',
    team: 'player',
    position: { x: 0, y: 0 },
    abilities: [{
      id: ARCANE_ARMOR_FEATURE_ID, name: 'Arcane Armor',
      description: 'Turn heavy armor into a conduit for your magic.',
      type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [],
    }],
  });
  return model ? applyArmorerModel(base, model) : base;
}

describe('model selection', () => {
  it('recognizes the two models and persists a valid choice', () => {
    expect(isArmorerModel('guardian')).toBe(true);
    expect(isArmorerModel('infiltrator')).toBe(true);
    expect(isArmorerModel('artillerist')).toBe(false);
    expect(getArmorerModel(createArmorer('guardian'))).toBe('guardian');
  });

  it('rejects an unknown model without persisting', () => {
    expect(getArmorerModel(createArmorer('bogus'))).toBeUndefined();
  });
});

describe('Guardian Thunder Gauntlets', () => {
  it('deals thunder damage and taunts the target', () => {
    const armorer = createArmorer('guardian');
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', currentHP: 12, maxHP: 12 });
    const state = createMockCombatState({ characters: [armorer, target] });

    const result = resolveThunderGauntlet(state, {
      armorerId: 'armorer', targetId: 'goblin', rng: () => 0.999, // pins 1d8 at 8
    });
    expect(result.resolved).toBe(true);
    expect(result.damageApplied).toBe(8);
    const next = result.state.characters.find(c => c.id === 'goblin');
    expect(next?.currentHP).toBe(4);
    expect(next?.statusEffects.some(e => e.name === 'Taunted')).toBe(true);
  });

  it('rejects a non-Guardian model', () => {
    const infiltrator = createArmorer('infiltrator');
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy' });
    const state = createMockCombatState({ characters: [infiltrator, target] });
    expect(resolveThunderGauntlet(state, { armorerId: 'armorer', targetId: 'goblin' }).failure)
      .toBe('wrong_model');
  });
});

describe('Infiltrator Lightning Launcher', () => {
  it('deals lightning damage', () => {
    const armorer = createArmorer('infiltrator');
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', currentHP: 12, maxHP: 12 });
    const state = createMockCombatState({ characters: [armorer, target] });

    const result = resolveLightningLauncher(state, {
      armorerId: 'armorer', targetId: 'goblin', rng: () => 0.999, // pins 1d6 at 6
    });
    expect(result.resolved).toBe(true);
    expect(result.damageApplied).toBe(6);
    expect(result.state.characters.find(c => c.id === 'goblin')?.currentHP).toBe(6);
  });

  it('rejects a non-Infiltrator model', () => {
    const guardian = createArmorer('guardian');
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy' });
    const state = createMockCombatState({ characters: [guardian, target] });
    expect(resolveLightningLauncher(state, { armorerId: 'armorer', targetId: 'goblin' }).failure)
      .toBe('wrong_model');
  });
});
