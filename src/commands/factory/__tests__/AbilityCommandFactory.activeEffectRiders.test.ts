import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, WeaponAttackCommand } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState } from './AbilityCommandFactory.testHelpers';

describe('Active Effect Riders (Bless/Bane)', () => {
  it('consumes a bonus die from an active effect on the attacker', async () => {
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

  it('consumes a penalty die from an active effect on the attacker', async () => {
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
