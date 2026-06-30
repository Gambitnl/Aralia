import { describe, it, expect } from 'vitest';
import simulacrum from '../../../../public/data/spells/level-7/simulacrum.json';
import { SummoningCommand } from '../SummoningCommand';
import { CommandContext } from '../../base/SpellCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories';
import type { SummoningEffect } from '@/types/spells';

describe('SummoningCommand', () => {
  it('preserves Simulacrum lifecycle and control metadata on the spawned summon actor', () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Wizard',
      position: { x: 2, y: 2 },
      initiative: 14
    });
    const state = createMockCombatState({
      characters: [caster]
    });
    const effect = simulacrum.effects.find((entry): entry is SummoningEffect => entry.type === 'SUMMONING');

    expect(effect).toBeDefined();

    const command = new SummoningCommand(effect!, {
      spellId: simulacrum.id,
      spellName: simulacrum.name,
      castAtLevel: 7,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext);

    const nextState = command.execute(state);
    const summon = nextState.characters.find(character => character.isSummon);

    // The runtime summon actor should keep the structured packet that the
    // validator already preserves so downstream cleanup, turn, and UI systems
    // can read it without re-parsing spell JSON.
    expect(summon?.summonMetadata).toEqual(expect.objectContaining({
      casterId: 'caster',
      spellId: 'simulacrum',
      persistent: true,
      commandsPerTurn: 1,
      initiativePolicy: 'shared',
      lifecycle: expect.objectContaining({
        hitPointMaximum: 'half the original creature Hit Point maximum',
        repairOnly: 'damaged simulacrum HP restored only by Long Rest repair costing 100 GP per Hit Point',
        zeroHpEnding: 'at 0 Hit Points, simulacrum reverts to snow and melts away',
        recastEnding: 'casting Simulacrum again instantly destroys any existing simulacrum from this spell'
      }),
      control: expect.objectContaining({
        entityType: 'simulacrum_construct_duplicate',
        source: 'Beast or Humanoid present through casting and snow/ice duplicate material',
        allegiance: 'friendly to caster and creatures caster designates',
        obedience: 'obeys spoken commands',
        destruction: '0 HP melts to snow; recasting destroys prior simulacrum'
      })
    }));
  });

  it('replaces an existing Simulacrum from the same caster when the spell is recast', () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Wizard',
      position: { x: 2, y: 2 },
      initiative: 14
    });
    const existingSimulacrum = createMockCombatCharacter({
      id: 'old-simulacrum',
      name: 'Simulacrum 1',
      position: { x: 3, y: 2 },
      team: caster.team,
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: simulacrum.id,
        persistent: true,
        lifecycle: {
          recastEnding: 'casting Simulacrum again instantly destroys any existing simulacrum from this spell'
        }
      }
    });
    const state = createMockCombatState({
      characters: [caster, existingSimulacrum]
    });
    const effect = simulacrum.effects.find((entry): entry is SummoningEffect => entry.type === 'SUMMONING');

    expect(effect).toBeDefined();

    const command = new SummoningCommand(effect!, {
      spellId: simulacrum.id,
      spellName: simulacrum.name,
      castAtLevel: 7,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext);

    const nextState = command.execute(state);
    const simulacra = nextState.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === simulacrum.id &&
      character.summonMetadata?.casterId === caster.id
    );

    // Recasting the live Simulacrum packet should replace the previous summon
    // from the same caster instead of stacking a second copy on the roster.
    expect(simulacra).toHaveLength(1);
    expect(simulacra[0].id).not.toBe(existingSimulacrum.id);
    expect(nextState.characters.some(character => character.id === existingSimulacrum.id)).toBe(false);
  });
});
