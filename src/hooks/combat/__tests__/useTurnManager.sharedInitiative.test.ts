import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { SummoningCommand } from '../../../commands/effects/SummoningCommand';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../../types/combat';
import type { CommandContext } from '../../../commands/base/SpellCommand';
import type { SummoningEffect } from '../../../types/spells';
import summonBeast from '../../../../public/data/spells/level-2/summon-beast.json';

/**
 * This test proves the live Summon Beast packet can create a summon that keeps
 * its shared-initiative policy and enters turn order directly after its caster.
 *
 * The combat hook is the nearest durable boundary for the scheduler bridge, so
 * the proof uses the real spell packet to create the summon and then asserts
 * the runtime join behavior.
 */
describe('useTurnManager shared-initiative summon scheduling', () => {
  it('places a live Summon Beast summon immediately after its caster', () => {
    const caster = createMockCombatCharacter({
      id: 'summon-beast-caster',
      name: 'Summon Beast Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 14,
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
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Air',
      gameState: {}
    } as CommandContext;
    const initialState = {
      isActive: true,
      characters: [caster],
      turnState: {
        currentTurn: 1,
        turnOrder: [caster.id],
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
    const summonedActor = summonState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonBeast.id &&
      character.summonMetadata?.initiativePolicy === 'shared'
    ) as CombatCharacter | undefined;

    expect(summonedActor).toBeDefined();
    expect(summonedActor?.summonMetadata?.initiativePolicy).toBe('shared');

    const onCharacterUpdate = () => undefined;
    const onLogEntry = () => undefined;

    const { result } = renderHook(() => useTurnManager({
      characters: [caster],
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }));

    act(() => {
      result.current.initializeCombat([caster]);
    });

    act(() => {
      result.current.joinCombat(summonedActor!, { initiative: summonedActor!.initiative });
    });

    expect(result.current.turnState.turnOrder).toEqual([caster.id, summonedActor!.id]);
    expect(result.current.turnState.currentCharacterId).toBe(caster.id);
  });
});
