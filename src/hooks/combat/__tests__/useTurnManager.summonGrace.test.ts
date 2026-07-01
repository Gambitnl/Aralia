import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useTurnManager } from '../useTurnManager';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';

/**
 * This file proves summon-specific cleanup that must happen at the turn-manager
 * boundary instead of inside a spell command.
 *
 * Summon Greater Demon can leave an uncontrolled demon on the board after
 * concentration ends. Once that grace countdown expires, the combat coordinator
 * must remove the actor and its initiative entry together so the roster and
 * turn loop do not disagree.
 */
describe('useTurnManager summon grace cleanup', () => {
  it('removes an expired Summon Greater Demon grace actor from roster and turn order', async () => {
    const initiativeSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0);
    const caster = createMockCombatCharacter({
      id: 'demon-caster',
      name: 'Demon Caster',
      team: 'player',
      initiative: 12,
      position: { x: 0, y: 0 }
    });
    const lingeringDemon = createMockCombatCharacter({
      id: 'greater-demon',
      name: 'Summoned Barlgura',
      team: 'enemy',
      initiative: 8,
      position: { x: 1, y: 0 },
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'summon-greater-demon',
        entityType: 'chosen_demon',
        dismissable: false,
        aftermathState: {
          kind: 'uncontrolled_demon_grace_period',
          remainingRounds: 1,
          source: 'early_concentration_ends_while_uncontrolled_and_demon_has_hp'
        }
      }
    });
    const logEntries: CombatLogEntry[] = [];

    const { result } = renderHook(() => {
      const [characters, setCharacters] = useState<CombatCharacter[]>([caster, lingeringDemon]);
      const manager = useTurnManager({
        characters,
        mapData: null,
        onCharacterUpdate: updatedCharacter => {
          setCharacters(currentCharacters => currentCharacters.map(character =>
            character.id === updatedCharacter.id ? updatedCharacter : character
          ));
        },
        onCharacterRemove: characterId => {
          setCharacters(currentCharacters => currentCharacters.filter(character => character.id !== characterId));
        },
        onLogEntry: entry => {
          logEntries.push(entry);
        }
      });

      return { characters, manager };
    });

    act(() => {
      result.current.manager.initializeCombat([caster, lingeringDemon]);
    });

    act(() => {
      result.current.manager.skipToCharacter(lingeringDemon.id);
    });

    await act(async () => {
      await result.current.manager.endTurn();
    });

    // The demon grace countdown expires at the next round boundary. Removing
    // both the actor and initiative id together prevents a future turn from
    // pointing at a summon that no longer exists.
    expect(result.current.characters.some(character => character.id === lingeringDemon.id)).toBe(false);
    expect(result.current.manager.turnState.turnOrder).toEqual([caster.id]);
    expect(logEntries.map(entry => entry.message).join(' ')).toContain('Summoned Barlgura disappears as its uncontrolled grace period ends');

    initiativeSpy.mockRestore();
  });
});
