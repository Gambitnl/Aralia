/**
 * This file proves that an attack-roll rider can bundle half-on-save damage.
 *
 * A rider such as Frostbite rolls one save and then decides what lands. Before
 * `agora-7dbd` that decision was all-or-nothing: a successful save dropped the
 * whole bundled payload, so any spell whose text reads "half damage on a
 * successful save" had to keep its damage on the plain damage path and make the
 * target roll the same save a second time. These tests keep the two outcomes
 * executable so the distinction is not re-collapsed later.
 *
 * Covers: AttackRollModifierCommand.
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/core';
import { AttackRollModifierCommand } from '../AttackRollModifierCommand';
import { AttackRollModifierEffect } from '../../../types/spells';
import type { EffectCondition } from '../../../types/spells';

// agora-f821.4: this file pins Math.random to make a roll deterministic. Game rolls now
// run on the audit log's own seed stream, so the pin only reaches them
// through the roller's supported injected-source seam. Feeding
// Math.random in as that source keeps every pin below meaning what it
// meant before the migration.
vi.mock('../../../systems/dice/rollers', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../systems/dice/rollers')>()
  return {
    ...actual,
    rollDice: (notation: string, options: { rng?: () => number } = {}) =>
      actual.rollDice(notation, { ...options, rng: options.rng ?? Math.random }),
    rollD20: (options: { rng?: () => number } = {}) =>
      actual.rollD20({ ...options, rng: options.rng ?? Math.random }),
    rollDamage: (
      notation: string,
      isCritical: boolean,
      minRoll = 1,
      rng?: () => number,
    ) => actual.rollDamage(notation, isCritical, minRoll, rng ?? Math.random),
  }
})


const RIDER_TRIGGER = {
  type: 'immediate',
  frequency: 'every_time',
  consumption: 'unlimited',
  attackFilter: { weaponType: 'any', attackType: 'any' },
  movementType: 'any',
  sustainCost: { actionType: 'action', optional: false }
} as AttackRollModifierEffect['trigger'];

const makeRider = (saveEffect: EffectCondition['saveEffect']): AttackRollModifierEffect => ({
  type: 'ATTACK_ROLL_MODIFIER',
  trigger: RIDER_TRIGGER,
  condition: {
    type: 'save',
    saveType: 'Constitution',
    saveEffect
  },
  attackRollModifier: {
    modifier: 'disadvantage',
    direction: 'incoming',
    attackKind: 'weapon',
    consumption: 'next_attack',
    duration: { type: 'rounds', value: 1 }
  },
  // Two d8 keep the halving observable: the mocked roll maxes every die, so the
  // full payload is 16 and the halved payload is 8.
  damage: {
    dice: '2d8',
    type: 'Cold'
  }
});

const runRider = async (effect: AttackRollModifierEffect, randomValue: number) => {
  const caster = createMockCombatCharacter({ id: 'rider-caster', name: 'Rider Caster' });
  const target = createMockCombatCharacter({ id: 'rider-target', name: 'Rider Target' });
  const state = createMockCombatState();
  state.characters = [caster, target];

  const command = new AttackRollModifierCommand(effect, {
    spellId: 'half-on-save-rider',
    spellName: 'Half On Save Rider',
    castAtLevel: 1,
    caster,
    targets: [target],
    gameState: null as unknown as never
  });

  const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(randomValue);
  try {
    const nextState = await command.execute(state);
    const affected = nextState.characters.find(character => character.id === target.id);

    return {
      nextState,
      hpLost: target.currentHP - (affected?.currentHP ?? target.currentHP),
      hasRider: Boolean(affected?.activeEffects?.some(active => active.spellId === 'half-on-save-rider')),
      saveMessages: nextState.combatLog.filter(entry => entry.message.includes('save (')),
      messages: nextState.combatLog.map(entry => entry.message)
    };
  } finally {
    randomSpy.mockRestore();
  }
};

// A mocked `Math.random` of 0.99 maxes the d20, so the save succeeds; 0 floors
// it, so the save fails. The same value drives the damage dice.
const SAVE_SUCCEEDS = 0.99;
const SAVE_FAILS = 0;

describe('AttackRollModifierCommand half-on-save bundling', () => {
  it('still deals half the rolled damage when a half-on-save rider is resisted', async () => {
    const result = await runRider(makeRider('half'), SAVE_SUCCEEDS);

    expect(result.hpLost).toBe(8);
    // The rider rule itself is negated even though the damage lands.
    expect(result.hasRider).toBe(false);
    // The single save rolled by this command is still the only one asked for.
    expect(result.saveMessages).toHaveLength(1);
    expect(result.messages.some(message => message.includes('takes half damage'))).toBe(true);
  });

  it('deals the full rolled damage and applies the rider when the save fails', async () => {
    const result = await runRider(makeRider('half'), SAVE_FAILS);

    expect(result.hpLost).toBeGreaterThan(0);
    expect(result.hasRider).toBe(true);
    expect(result.saveMessages).toHaveLength(1);
  });

  it('preserves all-or-nothing bundling for riders that are not half-on-save', async () => {
    const result = await runRider(makeRider('negates_condition'), SAVE_SUCCEEDS);

    expect(result.hpLost).toBe(0);
    expect(result.hasRider).toBe(false);
    expect(result.messages.some(message => message.includes('takes half damage'))).toBe(false);
  });

  it('composes the half-on-save fraction with a multiplier the caller already set', async () => {
    const caster = createMockCombatCharacter({ id: 'stacked-caster', name: 'Stacked Caster' });
    const target = createMockCombatCharacter({ id: 'stacked-target', name: 'Stacked Target' });
    const state = createMockCombatState();
    state.characters = [caster, target];

    const command = new AttackRollModifierCommand(makeRider('half'), {
      spellId: 'half-on-save-rider',
      spellName: 'Half On Save Rider',
      castAtLevel: 1,
      caster,
      targets: [target],
      // An already-halved payload must not be restored to full damage by the
      // save fraction; the two combine to a quarter of the rolled 16.
      damageMultiplier: 0.5,
      gameState: null as unknown as never
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(SAVE_SUCCEEDS);
    try {
      const nextState = await command.execute(state);
      const affected = nextState.characters.find(character => character.id === target.id);
      expect(target.currentHP - (affected?.currentHP ?? target.currentHP)).toBe(4);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
