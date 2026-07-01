import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { SummoningCommand } from '../../../commands/effects/SummoningCommand';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../../types/combat';
import type { CommandContext } from '../../../commands/base/SpellCommand';
import type { SummoningEffect } from '../../../types/spells';
import fingerOfDeath from '../../../../public/data/spells/level-7/finger-of-death.json';

/**
 * This test proves a live Finger of Death summon with immediate initiative
 * joins directly after the current actor instead of falling through to the
 * generic append behavior.
 *
 * The packet's zombie creation rule is the representative non-shared summon
 * initiative policy for this slice.
 */
describe('useTurnManager immediate summon scheduling', () => {
  it('places a live Finger of Death zombie immediately after the current actor', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.95);
    randomSpy.mockReturnValueOnce(0);

    const caster = createMockCombatCharacter({
      id: 'finger-of-death-caster',
      name: 'Finger of Death Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      stats: {
        strength: 12,
        dexterity: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 14,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
      }
    });
    const ally = createMockCombatCharacter({
      id: 'finger-of-death-ally',
      name: 'Finger of Death Ally',
      team: 'player',
      position: { x: 1, y: 0 },
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
      }
    });
    const summonEffect = fingerOfDeath.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: fingerOfDeath.id,
      spellName: fingerOfDeath.name,
      castAtLevel: 7,
      caster,
      targets: [],
      gameState: {}
    } as CommandContext;
    const initialState = {
      isActive: true,
      characters: [caster, ally],
      turnState: {
        currentTurn: 1,
        turnOrder: [caster.id, ally.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [] as CombatLogEntry[],
      reactiveTriggers: [],
      activeLightSources: []
    } as CombatState;

    const summonState = new SummoningCommand(summonEffect, context).execute(initialState);
    const summonedZombie = summonState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === fingerOfDeath.id &&
      character.summonMetadata?.initiativePolicy === 'immediate'
    ) as CombatCharacter | undefined;

    expect(summonedZombie).toBeDefined();
    expect(summonedZombie?.summonMetadata?.initiativePolicy).toBe('immediate');

    const onCharacterUpdate = () => undefined;
    const onLogEntry = () => undefined;

    const { result } = renderHook(() => useTurnManager({
      characters: [caster, ally],
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }));

    act(() => {
      result.current.initializeCombat([caster, ally]);
    });

    act(() => {
      result.current.joinCombat(summonedZombie!, { initiative: summonedZombie!.initiative });
    });

    expect(result.current.turnState.turnOrder).toEqual([caster.id, summonedZombie!.id, ally.id]);
    expect(result.current.turnState.currentCharacterId).toBe(caster.id);

    randomSpy.mockRestore();
  });
});
