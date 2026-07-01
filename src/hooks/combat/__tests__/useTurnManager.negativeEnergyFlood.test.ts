import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';

/**
 * Negative Energy Flood raises its killed target at the start of the caster's
 * next turn, so the turn manager owns the delayed actor materialization after
 * DamageCommand has recorded the pending aftermath on the caster.
 */
describe('useTurnManager Negative Energy Flood delayed zombie aftermath', () => {
  it('creates an uncontrolled Zombie actor and clears the pending caster effect at turn start', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95);

    const caster = createMockCombatCharacter({
      id: 'negative-energy-flood-caster',
      name: 'Negative Energy Flood Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      activeEffects: [
        {
          id: 'negative-energy-flood-zombie-rise-target-1-3',
          spellId: 'negative-energy-flood',
          casterId: 'negative-energy-flood-caster',
          sourceName: 'Negative Energy Flood',
          type: 'utility',
          duration: { type: 'rounds', value: 1 },
          startTime: 3,
          mechanics: {
            negativeEnergyFloodZombieRise: {
              targetId: 'target-1',
              targetName: 'Doomed Guard',
              targetCreatureTypes: ['Humanoid'],
              position: { x: 4, y: 2 },
              entityType: 'zombie_from_killed_target',
              timing: 'start_of_caster_next_turn',
              behavior: 'The zombie pursues the closest creature it can see.',
              statBlock: 'Zombie'
            }
          }
        }
      ]
    });
    const enemy = createMockCombatCharacter({
      id: 'enemy-1',
      name: 'Nearby Bandit',
      team: 'enemy',
      position: { x: 5, y: 2 }
    });
    const updatedCharacters: CombatCharacter[] = [];
    const combatLog: CombatLogEntry[] = [];

    const { result } = renderHook(() => useTurnManager({
      characters: [caster, enemy],
      mapData: null,
      onCharacterUpdate: character => {
        const existingIndex = updatedCharacters.findIndex(candidate => candidate.id === character.id);
        if (existingIndex >= 0) {
          updatedCharacters[existingIndex] = character;
        } else {
          updatedCharacters.push(character);
        }
      },
      onLogEntry: entry => combatLog.push(entry)
    }));

    act(() => {
      result.current.initializeCombat([caster, enemy]);
    });

    vi.restoreAllMocks();

    const updatedCaster = updatedCharacters.find(character => character.id === caster.id);
    const raisedZombie = updatedCharacters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === 'negative-energy-flood' &&
      character.summonMetadata?.entityType === 'zombie_from_killed_target'
    );

    expect(updatedCaster?.activeEffects?.some(effect =>
      effect.mechanics?.negativeEnergyFloodZombieRise?.targetId === 'target-1'
    )).toBe(false);
    expect(raisedZombie).toEqual(expect.objectContaining({
      name: 'Doomed Guard Zombie',
      team: 'enemy',
      creatureTypes: expect.arrayContaining(['Undead']),
      position: { x: 4, y: 2 },
      isSummon: true
    }));
    expect(raisedZombie?.summonMetadata).toEqual(expect.objectContaining({
      casterId: caster.id,
      spellId: 'negative-energy-flood',
      sourceName: 'Negative Energy Flood',
      persistent: true,
      commandCost: 'none',
      commandsPerTurn: 0,
      initiativePolicy: 'immediate',
      control: expect.objectContaining({
        allegiance: 'uncontrolled_hostile',
        obedience: 'pursues_closest_visible_creature'
      }),
      aftermathState: expect.objectContaining({
        kind: 'death_triggered_zombie_rise',
        sourceTargetId: 'target-1'
      })
    }));
    expect(combatLog.some(entry =>
      entry.data?.spellId === 'negative-energy-flood' &&
      entry.data?.pendingAftermath === 'negative_energy_flood_zombie_rise_consumed'
    )).toBe(true);
  });
});
