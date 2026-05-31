/**
 * This test file checks the bridge from battle-map abilities into command objects.
 *
 * Combat abilities are lightweight button data, while commands are the objects
 * that actually roll attacks, apply healing, and write effect logs. These tests
 * protect the important split: attacks create attack commands, but Dash-style
 * movement does not masquerade as a weapon attack.
 */
import { describe, expect, it } from 'vitest';
import { Ability } from '../../../types/combat';
import { GameState } from '../../../types';
import { createMockCombatCharacter } from '../../../utils/factories';
import { AbilityCommandFactory, WeaponAttackCommand } from '../AbilityCommandFactory';

// ============================================================================
// Ability Translation
// ============================================================================
// This section keeps non-attack actions from accidentally re-entering the weapon
// attack path while preserving command support for true attacks and direct
// non-attack effects like healing.
// ============================================================================

describe('AbilityCommandFactory', () => {
  it('creates a weapon attack command for attack abilities', () => {
    const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker' });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A normal melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    // Real attacks should still roll through WeaponAttackCommand so hit/miss,
    // cover, riders, and damage command behavior stay centralized.
    const commands = AbilityCommandFactory.createCommands(attack, attacker, [target], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(WeaponAttackCommand);
  });

  it('does not create an attack command for Dash movement', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const dash: Ability = {
      id: 'dash',
      name: 'Dash',
      description: 'Gain extra movement for the turn.',
      type: 'movement',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'movement', value: 30 }]
    };

    // Dash is resolved by useActionExecutor because it changes movement economy
    // for the current turn. Returning no command prevents the old self-attack.
    const commands = AbilityCommandFactory.createCommands(dash, actor, [actor], {} as any);

    expect(commands).toHaveLength(0);
  });

  it('keeps direct healing effects on the command path', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const secondWind: Ability = {
      id: 'second_wind',
      name: 'Second Wind',
      description: 'Regain hit points.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'heal', value: 11 }]
    };

    // Non-attack utility effects still use commands when they have a concrete
    // command-side effect. This preserves future class-feature behavior while
    // removing the accidental weapon attack.
    const commands = AbilityCommandFactory.createCommands(secondWind, actor, [actor], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0].metadata.effectType).toBe('HEALING');
  });
});

describe('WeaponAttackCommand Proficiency Penalties', () => {
  it('omits proficiency bonus when attacking with a non-proficient weapon', () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      level: 1, // pb = 2
      stats: { baseInitiative: 0, speed: 30, cr: '0',
        strength: 14, // +2 mod
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      }
    });

    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const attack: Ability = {
      id: 'unproficient_attack',
      name: 'Unproficient Attack',
      description: 'A melee strike with a non-proficient weapon.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: false, // Explicitly not proficient
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    const command = new WeaponAttackCommand(attack, attacker, [target], {
      spellId: attack.id,
      spellName: attack.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);

    const logMessage = newState.combatLog[0].message;
    expect(logMessage).toContain('+ 2 =');
  });
});


describe('Active Effect Riders (Bless/Bane)', () => {
  it('consumes a bonus die from an active effect on the attacker', () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      level: 1, // pb = 2
      stats: { baseInitiative: 0, speed: 30, cr: '0',
        strength: 14, // +2 mod
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      activeEffects: [{
        id: 'bless_effect',
        spellId: 'bless',
        casterId: 'cleric',
        sourceName: 'Bless',
        type: 'buff',
        duration: { type: 'minutes', value: 1 },
        startTime: 1,
        mechanics: {
          attackRollDirection: 'outgoing',
          attackRollModifier: 'bonus',
          attackRollConsumption: 'while_active',
          attackRollKind: 'any',
          attackRollDice: '1d4' // Using dice, but we will mock rollDice if possible, or just verify 'Mods: ' is in log
        }
      }]
    });

    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true, // pb + str = 2 + 2 = +4
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    const command = new WeaponAttackCommand(attack, attacker, [target], {
      spellId: attack.id,
      spellName: attack.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);

    const logMessage = newState.combatLog[0].message;
    // The base modifier is 4, but with bless it should be > 4
    // We expect the log to contain '(Mods: '
    expect(logMessage).toMatch(/Mods: \+\d+ \[Bless\]/);
  });

  it('consumes a penalty die from an active effect on the attacker', () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      level: 1, // pb = 2
      stats: { baseInitiative: 0, speed: 30, cr: '0',
        strength: 14, // +2 mod
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      activeEffects: [{
        id: 'bane_effect',
        spellId: 'bane',
        casterId: 'cleric',
        sourceName: 'Bane',
        type: 'debuff',
        duration: { type: 'minutes', value: 1 },
        startTime: 1,
        mechanics: {
          attackRollDirection: 'outgoing',
          attackRollModifier: 'penalty',
          attackRollConsumption: 'while_active',
          attackRollKind: 'any',
          attackRollDice: '1d4'
        }
      }]
    });

    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    const command = new WeaponAttackCommand(attack, attacker, [target], {
      spellId: attack.id,
      spellName: attack.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);

    const logMessage = newState.combatLog[0].message;
    expect(logMessage).toMatch(/Mods: -\d+ \[Bane\]/);
  });
});
