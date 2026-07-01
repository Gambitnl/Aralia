import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { SummoningCommand } from '../../../commands/effects/SummoningCommand';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../../types/combat';
import type { CommandContext } from '../../../commands/base/SpellCommand';
import type { SummoningEffect } from '../../../types/spells';
import conjureAnimals from '../../../../public/data/spells/level-3/conjure-animals.json';

/**
 * This test proves a live Conjure Animals summon with rolled initiative keeps
 * its authored initiative policy and is placed by initiative order instead of
 * being appended at the end of the turn list.
 *
 * The summon's initiative is fixed to a deterministic value in the test so the
 * scheduler boundary can be verified without inventing random rolling logic.
 */
describe('useTurnManager rolled summon scheduling', () => {
  it('places a live Conjure Animals summon by initiative instead of appending it', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.75);
    randomSpy.mockReturnValueOnce(0.45);

    const caster = createMockCombatCharacter({
      id: 'conjure-animals-caster',
      name: 'Conjure Animals Caster',
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
      id: 'conjure-animals-ally',
      name: 'Conjure Animals Ally',
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
    const summonEffect = conjureAnimals.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: conjureAnimals.id,
      spellName: conjureAnimals.name,
      castAtLevel: 3,
      caster,
      targets: [],
      playerInput: 'Wolf',
      gameState: {}
    } as CommandContext;
    const summonState = new SummoningCommand(summonEffect, context).execute({
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
    } as CombatState);

    const summonedAnimal = summonState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === conjureAnimals.id &&
      character.summonMetadata?.initiativePolicy === 'rolled'
    ) as CombatCharacter | undefined;

    expect(summonedAnimal).toBeDefined();
    expect(summonedAnimal?.summonMetadata?.initiativePolicy).toBe('rolled');

    // Use a deterministic initiative value so the scheduler proof can focus on
    // turn-order placement instead of random roll generation.
    summonedAnimal!.initiative = 12;

    let charactersState: CombatCharacter[] = [caster, ally];
    const onCharacterUpdate = (updatedCharacter: CombatCharacter) => {
      charactersState = charactersState.map(character =>
        character.id === updatedCharacter.id ? updatedCharacter : character
      );
    };
    const onLogEntry = () => undefined;

    const { result, rerender } = renderHook(({ chars }: { chars: CombatCharacter[] }) => useTurnManager({
      characters: chars,
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }), {
      initialProps: { chars: charactersState }
    });

    act(() => {
      result.current.initializeCombat(charactersState);
    });

    rerender({ chars: charactersState });

    act(() => {
      result.current.joinCombat(summonedAnimal!, { initiative: summonedAnimal!.initiative });
    });

    expect(result.current.turnState.turnOrder).toEqual([caster.id, summonedAnimal!.id, ally.id]);
    expect(result.current.turnState.currentCharacterId).toBe(caster.id);

    randomSpy.mockRestore();
  });
});
