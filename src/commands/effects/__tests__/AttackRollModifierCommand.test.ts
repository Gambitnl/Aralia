import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/factories';
import { AttackRollModifierCommand } from '../AttackRollModifierCommand';
import { AttackRollModifierEffect } from '../../../types/spells';

describe('AttackRollModifierCommand', () => {
  it('bundles status condition logic so targets only roll one save', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const state = createMockCombatState();
    state.characters = [caster, target];

    // We add a fake active effect with a penalty just to ensure it executes.
    // The main test is that it logs the save once, and applies BOTH the rider and the status condition.
    const effect: AttackRollModifierEffect = {
      type: 'ATTACK_ROLL_MODIFIER',
      trigger: {
        type: 'immediate',
        frequency: 'every_time',
        consumption: 'unlimited',
        attackFilter: { weaponType: 'any', attackType: 'any' },
        movementType: 'any',
        sustainCost: { actionType: 'action', optional: false }
      },
      condition: {
        type: 'save',
        saveType: 'Charisma',
        saveEffect: 'negates_condition'
      },
      attackRollModifier: {
        modifier: 'penalty',
        direction: 'outgoing',
        attackKind: 'any',
        consumption: 'while_active',
        duration: { type: 'minutes', value: 1 },
        dice: '1d4'
      },
      statusCondition: {
        name: 'Bane' as unknown as any,
        duration: { type: 'minutes', value: 1 },
        level: 0
      }
    };

    const command = new AttackRollModifierCommand(effect, {
      spellId: 'bane',
      spellName: 'Bane',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: null as unknown as any
    });

    // To ensure the target fails the save, we can manipulate their save bonus or just observe the outcome.
    // By default, the mock DC is probably around 13 and target has stats=10 (mod +0). So sometimes they fail, sometimes succeed.
    // Let's force a failure by setting target's Charisma to 1.
    target.stats.charisma = 1;
    target.stats.saveBonuses = { cha: -20 } as unknown as any;

    const newState = await command.execute(state);

    const logMessages = newState.combatLog.map(l => l.message);

    // There should be exactly one save message
    const saveMessages = logMessages.filter(m => m.includes('save ('));
    expect(saveMessages).toHaveLength(1);

    // Because they failed the save, they should get the rider
    const affectedTarget = newState.characters.find(c => c.id === 'target');

    // They should have the ActiveEffect
    const hasRider = affectedTarget?.activeEffects?.some(e => e.spellId === 'bane');
    expect(hasRider).toBe(true);

    // They should have the Status Condition
    const hasCondition = affectedTarget?.conditions?.some(c => c.name === 'Bane');
    expect(hasCondition).toBe(true);
  });
});
