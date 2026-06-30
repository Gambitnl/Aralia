import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/factories';
import { AttackRollModifierCommand } from '../AttackRollModifierCommand';
import { AttackRollModifierEffect } from '../../../types/spells';

/**
 * This test file proves the shared attack-roll rider command can carry more
 * than a simple attack penalty.
 *
 * Shining Smite, Bane, and similar spells use this command when a spell needs
 * to leave behind a live combat rule after the initial hit or save resolves.
 * The tests keep that behavior executable so future agents do not have to read
 * spell prose to know which runtime payloads are supposed to travel together.
 */
describe('AttackRollModifierCommand', () => {
  it('bundles status condition logic so targets only roll one save', async () => {
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

  it('applies Frostbite damage and the next-weapon-attack rider on a failed Constitution save', async () => {
    const caster = createMockCombatCharacter({ id: 'frost-caster', name: 'Frost Caster' });
    const target = createMockCombatCharacter({ id: 'frost-target', name: 'Frost Target' });
    const state = createMockCombatState();
    state.characters = [caster, target];

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
        saveType: 'Constitution',
        saveEffect: 'negates_condition'
      },
      attackRollModifier: {
        modifier: 'disadvantage',
        direction: 'incoming',
        attackKind: 'weapon',
        consumption: 'next_attack',
        duration: { type: 'rounds', value: 1 }
      },
      damage: {
        dice: '1d6',
        type: 'Cold'
      }
    };

    const command = new AttackRollModifierCommand(effect, {
      spellId: 'frostbite',
      spellName: 'Frostbite',
      castAtLevel: 0,
      caster,
      targets: [target],
      gameState: null as unknown as any
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const newState = await command.execute(state);
    const affectedTarget = newState.characters.find(character => character.id === target.id);

    expect(affectedTarget?.currentHP).toBeLessThan(target.currentHP);
    expect(affectedTarget?.activeEffects?.some(activeEffect => activeEffect.spellId === 'frostbite')).toBe(true);

    randomSpy.mockRestore();
  });

  it('does not apply Frostbite damage or rider on a successful Constitution save', async () => {
    const caster = createMockCombatCharacter({ id: 'frost-caster', name: 'Frost Caster' });
    const target = createMockCombatCharacter({ id: 'frost-target', name: 'Frost Target' });
    const state = createMockCombatState();
    state.characters = [caster, target];

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
        saveType: 'Constitution',
        saveEffect: 'negates_condition'
      },
      attackRollModifier: {
        modifier: 'disadvantage',
        direction: 'incoming',
        attackKind: 'weapon',
        consumption: 'next_attack',
        duration: { type: 'rounds', value: 1 }
      },
      damage: {
        dice: '1d6',
        type: 'Cold'
      }
    };

    const command = new AttackRollModifierCommand(effect, {
      spellId: 'frostbite',
      spellName: 'Frostbite',
      castAtLevel: 0,
      caster,
      targets: [target],
      gameState: null as unknown as any
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const newState = await command.execute(state);
    const affectedTarget = newState.characters.find(character => character.id === target.id);

    expect(affectedTarget?.currentHP).toBe(target.currentHP);
    expect(affectedTarget?.activeEffects?.some(activeEffect => activeEffect.spellId === 'frostbite')).toBeFalsy();

    randomSpy.mockRestore();
  });

  it('materializes Shining Smite rider advantage, Invisible suppression, and target light together', async () => {
    const caster = createMockCombatCharacter({ id: 'paladin', name: 'Paladin' });
    const target = createMockCombatCharacter({
      id: 'glowing-target',
      name: 'Glowing Target',
      position: { x: 4, y: 2 }
    });

    const state = createMockCombatState();
    state.characters = [caster, target];
    state.activeLightSources = [{
      id: 'stale-shining-light',
      sourceSpellId: 'shining-smite',
      casterId: caster.id,
      brightRadius: 1,
      dimRadius: 0,
      attachedTo: 'target',
      attachedToCharacterId: target.id,
      createdTurn: 0
    }];

    const effect: AttackRollModifierEffect = {
      type: 'ATTACK_ROLL_MODIFIER',
      trigger: {
        type: 'on_attack_hit',
        frequency: 'every_time',
        consumption: 'first_hit',
        attackFilter: { weaponType: 'any', attackType: 'weapon' },
        movementType: 'any',
        sustainCost: { actionType: 'action', optional: false }
      },
      condition: { type: 'hit' },
      attackRollModifier: {
        modifier: 'advantage',
        direction: 'incoming',
        attackKind: 'any',
        consumption: 'while_active',
        duration: { type: 'minutes', value: 1 }
      },
      light: {
        brightRadius: 5,
        dimRadius: 0,
        attachedTo: 'target',
        colorChoice: 'not_applicable',
        opaqueCoverBlocks: 'not_applicable',
        emitsHeat: 'not_applicable',
        ignitesObjects: 'not_applicable',
        consumesFuel: 'not_applicable',
        canBeCoveredOrHidden: 'not_applicable',
        canBeSmotheredOrQuenched: 'not_applicable'
      },
      invisibilitySuppression: {
        suppressesConditionBenefit: 'Invisible',
        scope: 'target',
        duration: 'while_spell_active',
        description: 'The shining target cannot benefit from Invisible while the rider remains active.'
      }
    };

    const command = new AttackRollModifierCommand(effect, {
      spellId: 'shining-smite',
      spellName: 'Shining Smite',
      castAtLevel: 2,
      caster,
      targets: [target],
      gameState: null as unknown as any
    });

    const newState = await command.execute(state);
    const affectedTarget = newState.characters.find(character => character.id === target.id);
    const smiteRider = affectedTarget?.activeEffects?.find(activeEffect => activeEffect.spellId === 'shining-smite');
    const smiteLights = newState.activeLightSources.filter(light => light.sourceSpellId === 'shining-smite');

    // The attack rider is the mechanical half of Shining Smite: attacks
    // against the shining creature have Advantage while the spell remains up.
    expect(smiteRider?.sourceName).toBe('Shining Smite');
    expect(smiteRider?.mechanics?.attackRollModifier).toBe('advantage');
    expect(smiteRider?.mechanics?.attackRollDirection).toBe('incoming');

    // Invisible suppression stays on the same active effect so the attack
    // factory can ignore Invisible-target disadvantage without deleting the
    // target's actual Invisible condition record.
    expect(smiteRider?.mechanics?.suppressedConditionBenefit).toBe('Invisible');

    // The light payload becomes one target-attached map light, replacing the
    // stale light from the same caster/spell/target instead of duplicating it.
    expect(smiteLights).toHaveLength(1);
    expect(smiteLights[0]).toMatchObject({
      sourceSpellId: 'shining-smite',
      casterId: caster.id,
      brightRadius: 5,
      dimRadius: 0,
      attachedTo: 'target',
      attachedToCharacterId: target.id
    });
  });
});
