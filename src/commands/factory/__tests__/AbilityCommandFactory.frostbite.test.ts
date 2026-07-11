import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, AbilityCommandFactory } from './AbilityCommandFactory.testHelpers';
import type { Ability } from './AbilityCommandFactory.testHelpers';

// ============================================================================
// Hit-Or-Miss Attack Riders
// ============================================================================
// Lightning Arrow is not a normal "extra damage on hit" rider. It spends the
// next matching ranged weapon attack whether that attack hits or misses, applies
// half primary damage on a miss, and still creates the secondary burst around
// the attack target. These tests protect that shared rider behavior so future
// next-attack spells can reuse it instead of becoming one-off weapon code.
// ============================================================================

describe('Frostbite next-weapon-attack rider', () => {
  const createFrostbiteRider = () => ({
    id: 'frostbite-rider',
    spellId: 'frostbite',
    casterId: 'caster',
    sourceName: 'Frostbite',
    type: 'debuff',
    duration: { type: 'rounds', value: 2 },
    startTime: 1,
    mechanics: {
      attackRollDirection: 'outgoing',
      attackRollModifier: 'disadvantage' as const,
      attackRollKind: 'weapon' as const,
      attackRollConsumption: 'next_attack' as const
    }
  });

  it('spends Frostbite when the target makes a matching weapon attack', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      attackBonus: 99,
      activeEffects: [createFrostbiteRider()]
    });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target'
    });
    const weaponAttack: Ability = {
      id: 'weapon_attack',
      name: 'Weapon Attack',
      description: 'A weapon attack used to spend Frostbite.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      attackBonus: 99,
      effects: []
    };

    const [command] = AbilityCommandFactory.createCommands(weaponAttack, attacker, [target], {} as any);
    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);
    const updatedAttacker = newState.characters.find(character => character.id === attacker.id);

    expect(updatedAttacker?.activeEffects ?? []).toHaveLength(0);
  });

  it('keeps target-scoped outgoing disadvantage riders for attacks against other defenders', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      attackBonus: 99,
      activeEffects: [{
        ...createFrostbiteRider(),
        id: 'chill-touch-undead-rider',
        spellId: 'chill-touch',
        sourceName: 'Chill Touch',
        mechanics: {
          attackRollDirection: 'outgoing' as const,
          attackRollModifier: 'disadvantage' as const,
          attackRollKind: 'any' as const,
          attackRollConsumption: 'while_active' as const,
          attackRollTargetId: 'original-caster'
        }
      }]
    });
    const otherDefender = createMockCombatCharacter({
      id: 'other-defender',
      name: 'Other Defender'
    });
    const weaponAttack: Ability = {
      id: 'weapon_attack',
      name: 'Weapon Attack',
      description: 'A weapon attack that should not consume the target-scoped Chill Touch rider.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      attackBonus: 99,
      effects: []
    };

    const [command] = AbilityCommandFactory.createCommands(weaponAttack, attacker, [otherDefender], {} as any);
    const newState = await command.execute({ characters: [attacker, otherDefender], combatLog: [] } as any);
    const updatedAttacker = newState.characters.find(character => character.id === attacker.id);

    // Chill Touch's Undead rider is scoped to the caster who applied it. An
    // attack against a different defender must not apply or consume that rider.
    expect(updatedAttacker?.activeEffects?.some(effect => effect.id === 'chill-touch-undead-rider')).toBe(true);
  });

  it('keeps Frostbite intact on a spell attack so the rider only spends on weapons', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      attackBonus: 99,
      activeEffects: [createFrostbiteRider()]
    });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target'
    });
    const spellAttack: Ability = {
      id: 'spell_attack',
      name: 'Spell Attack',
      description: 'A spell attack that should not spend Frostbite.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 12,
      isProficient: true,
      attackBonus: 99,
      effects: [],
      attackType: 'spell'
    };

    const [command] = AbilityCommandFactory.createCommands(spellAttack, attacker, [target], {} as any);
    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);
    const updatedAttacker = newState.characters.find(character => character.id === attacker.id);

    expect(updatedAttacker?.activeEffects?.some(effect => effect.spellId === 'frostbite')).toBe(true);
  });
});
