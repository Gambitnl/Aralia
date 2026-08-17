/**
 * This file proves the Beast Master Primal Companion binding, stat scaling,
 * Bonus Action command economy, and Beast's Strike transaction.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  bindPrimalBeast,
  calculatePrimalBeastAc,
  calculatePrimalBeastMaxHp,
  PRIMAL_COMPANION_FEATURE_ID,
  resolveBeastCommand,
  resolveBeastsStrike,
} from '../beastMasterUtils';

function createRanger(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'ranger',
    name: 'Ranger',
    team: 'player',
    level: 3,
    position: { x: 0, y: 0 },
    abilities: [{
      id: PRIMAL_COMPANION_FEATURE_ID,
      name: 'Primal Companion',
      description: 'Summon a loyal beast companion that acts on your turn.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [],
    }],
  });
}

function createBeastToken(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'beast',
    name: 'Beast',
    team: 'player',
    position: { x: 1, y: 0 },
  });
}

describe('scaling', () => {
  it('scales HP (5 + 5×level) and AC (13 + PB) by ranger level', () => {
    expect(calculatePrimalBeastMaxHp(3, 'land')).toBe(20); // 5 + 5*3
    expect(calculatePrimalBeastMaxHp(5, 'land')).toBe(30);
    expect(calculatePrimalBeastAc(3, 'land')).toBe(15); // 13 + PB(2)
    expect(calculatePrimalBeastAc(5, 'land')).toBe(16); // 13 + PB(3)
  });
});

describe('bindPrimalBeast', () => {
  it('binds ownership, scales HP/speed, and attaches the strike ability', () => {
    const bound = bindPrimalBeast(createRanger(), createBeastToken(), 'land');

    expect(bound.summonMetadata?.casterId).toBe('ranger');
    expect(bound.summonMetadata?.commandCost).toBe('bonus_action');
    expect(bound.maxHP).toBe(20);
    expect(bound.primalBeastForm).toBe('land');
    expect(bound.abilities.some(a => a.id === 'primal_beast_strike')).toBe(true);
    expect(bound.stats.speed).toBe(40);
  });
});

describe('resolveBeastCommand', () => {
  it('spends the ranger bonus action and grants one command per turn', () => {
    const ranger = createRanger();
    const beast = bindPrimalBeast(ranger, createBeastToken(), 'land');
    const state = createMockCombatState({ characters: [ranger, beast] });

    const result = resolveBeastCommand(state, { rangerId: 'ranger', beastId: 'beast' });
    expect(result.resolved).toBe(true);
    expect(result.commandsUsedThisTurn).toBe(1);

    const spent = result.state.characters.find(c => c.id === 'ranger');
    expect(spent?.actionEconomy.bonusAction.used).toBe(true);

    // Second command in the same turn is rejected.
    const second = resolveBeastCommand(result.state, { rangerId: 'ranger', beastId: 'beast' });
    expect(second.failure).toBe('commands_exhausted');
  });

  it('rejects an unbound or foreign beast', () => {
    const ranger = createRanger();
    const otherBeast = createBeastToken(); // never bound
    const state = createMockCombatState({ characters: [ranger, otherBeast] });

    expect(resolveBeastCommand(state, { rangerId: 'ranger', beastId: 'beast' }).failure)
      .toBe('not_bound_to_ranger');
  });
});

describe('resolveBeastsStrike', () => {
  it('applies scaled strike damage to an adjacent target', () => {
    const ranger = createRanger();
    const beast = bindPrimalBeast(ranger, createBeastToken(), 'land');
    const target = createMockCombatCharacter({
      id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 }, currentHP: 12, maxHP: 12,
    });
    const state = createMockCombatState({ characters: [ranger, beast, target] });

    const result = resolveBeastsStrike(state, {
      beastId: 'beast', targetId: 'goblin', rng: () => 0.999, // pins 1d8 at 8
    });
    expect(result.resolved).toBe(true);
    // 1d8 (8) + strikeModifier (2) + PB (2) = 12, floored at target HP 12
    expect(result.damageApplied).toBe(12);
    expect(result.state.characters.find(c => c.id === 'goblin')?.currentHP).toBe(0);
  });

  it('rejects a non-beast or out-of-reach target', () => {
    const ranger = createRanger();
    const notBeast = createBeastToken(); // no primalBeastForm
    const target = createMockCombatCharacter({
      id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 }, currentHP: 10, maxHP: 10,
    });
    const state = createMockCombatState({ characters: [ranger, notBeast, target] });

    expect(resolveBeastsStrike(state, { beastId: 'beast', targetId: 'goblin' }).failure)
      .toBe('not_a_primal_beast');

    const beast = bindPrimalBeast(ranger, createBeastToken(), 'land');
    const farTarget = createMockCombatCharacter({
      id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 5, y: 0 }, currentHP: 10, maxHP: 10,
    });
    const farState = createMockCombatState({ characters: [ranger, beast, farTarget] });
    expect(resolveBeastsStrike(farState, { beastId: 'beast', targetId: 'goblin' }).failure)
      .toBe('target_out_of_reach');
  });
});
