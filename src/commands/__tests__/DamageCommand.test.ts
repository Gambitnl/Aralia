import { describe, expect, it, vi } from 'vitest';
import { DamageCommand } from '../effects/DamageCommand';
import { SummoningCommand } from '../effects/SummoningCommand';
import { createMockCombatCharacter, createMockCombatState, createMockCommandContext, createMockGameState, createMockPlayerCharacter } from '../../utils/factories';
import type { DamageEffect } from '../../types/spells';
import type { SummoningEffect } from '../../types/spells';
import simulacrum from '../../../public/data/spells/level-7/simulacrum.json';

// This regression keeps the direct damage command honest: one hit should lower
// HP and leave a readable combat log entry behind. It intentionally stays tiny
// so Package 4 can cite a concrete HP/log proof without widening the pilot.
describe('DamageCommand', () => {
  it('reduces HP and logs a spell hit for a deterministic damage spell', async () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Maelis Quill'
    });

    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target Dummy',
      currentHP: 12,
      maxHP: 12
    });

    const context = createMockCommandContext({
      spellId: 'fire-bolt',
      spellName: 'Fire Bolt',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: createMockGameState({
        party: [
          createMockPlayerCharacter({ id: caster.id, name: caster.name }),
          createMockPlayerCharacter({ id: target.id, name: target.name })
        ],
        currentLocationId: 'arena',

      })
    });

    const effect: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '10d1', type: 'Force' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    };

    // Force the verb choice so the log assertion stays stable while the damage
    // amount itself remains deterministic because `10d1` always rolls 10.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const command = new DamageCommand(effect, context);
    const result = await command.execute(createMockCombatState({
      characters: [caster, target],
      combatLog: []
    }));

    vi.restoreAllMocks();

    const updatedTarget = result.characters.find(character => character.id === 'target');

    expect(updatedTarget?.currentHP).toBe(2);
    expect(result.combatLog.find(entry => entry.message === 'Maelis Quill blasts Target Dummy with Fire Bolt for 10 force damage')).toBeDefined();
  });

  it('applies Savage Attacks melee critical damage bonus correctly', async () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Half-Orc Barbarian',
      modifiers: {
        advantage: [],
        disadvantage: [],
        bonuses: [],
        savageAttacks: true
      } as any
    });

    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target Dummy',
      currentHP: 30,
      maxHP: 30
    });

    const context = createMockCommandContext({
      spellId: 'Attack',
      spellName: 'Attack',
      castAtLevel: 1,
      caster,
      isCritical: true,
      weaponProperties: ['heavy'], // Melee weapon attack (no 'ranged')
      targets: [target],
      gameState: createMockGameState({
        party: [
          createMockPlayerCharacter({ id: caster.id, name: caster.name }),
          createMockPlayerCharacter({ id: target.id, name: target.name })
        ],
        currentLocationId: 'arena',

      })
    });

    // 10d1 force damage: normal crit doubles to 20d1 (= 20).
    // Savage Attacks adds 1 extra die (1d1 = 1). Total damage = 21.
    const effect: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '10d1', type: 'Force' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    };

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const command = new DamageCommand(effect, context);
    const result = await command.execute(createMockCombatState({
      characters: [caster, target],
      combatLog: []
    }));

    vi.restoreAllMocks();

    const updatedTarget = result.characters.find(character => character.id === 'target');

    // 30 HP - 21 Damage = 9 HP.
    expect(updatedTarget?.currentHP).toBe(9);
    expect(result.combatLog.some(entry => entry.message.includes("Savage Attacks adds +1 (1d1) to critical damage"))).toBe(true);
  });

  it('removes a live Simulacrum summon when damage drops it to 0 HP', async () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Wizard'
    });
    const enemy = createMockCombatCharacter({
      id: 'enemy',
      name: 'Enemy Mage',
      team: 'enemy',
      featChoices: {}
    });
    const summonEffect = simulacrum.effects.find((entry): entry is SummoningEffect => entry.type === 'SUMMONING');

    expect(summonEffect).toBeDefined();

    // Build the summon through the real summon command so the proof uses the
    // live Simulacrum packet instead of a hand-written summon mock.
    const summonedState = new SummoningCommand(summonEffect!, createMockCommandContext({
      spellId: simulacrum.id,
      spellName: simulacrum.name,
      castAtLevel: 7,
      caster,
      targets: [],
      gameState: createMockGameState()
    })).execute(createMockCombatState({
      characters: [caster, enemy],
      combatLog: []
    }));

    const simulacrumSummon = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === simulacrum.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(simulacrumSummon?.summonMetadata?.lifecycle?.zeroHpEnding).toContain('0 Hit Points');

    const damageEffect: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '10d1', type: 'Force' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    };

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const command = new DamageCommand(damageEffect, createMockCommandContext({
      spellId: 'force-bolt',
      spellName: 'Force Bolt',
      castAtLevel: 1,
      caster: enemy,
      targets: [simulacrumSummon!],
      gameState: createMockGameState()
    }));

    const result = await command.execute(createMockCombatState({
      characters: [caster, enemy, simulacrumSummon!],
      combatLog: []
    }));

    vi.restoreAllMocks();

    expect(result.characters.some(character => character.id === simulacrumSummon?.id)).toBe(false);
    expect(result.combatLog.some(entry => entry.message.includes('disappears as the spell-created summon drops to 0 HP'))).toBe(true);
  });
});
