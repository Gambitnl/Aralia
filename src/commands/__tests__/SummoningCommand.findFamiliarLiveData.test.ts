import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import type { CommandContext } from '../base/SpellCommand';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import findFamiliar from '../../../public/data/spells/level-1/find-familiar.json';

/**
 * This file proves live Find Familiar spell data reaches executable summon actions.
 *
 * The dismissal and recall commands read the original spell id from generated
 * familiar actions. This focused proof executes the summon command with the
 * real Find Familiar packet, then confirms the generated actions move the
 * familiar between the combat roster and pocketed summon state.
 *
 * Called by: focused summon runtime tests.
 * Depends on: SummoningCommand and the public Find Familiar spell packet.
 */

describe('SummoningCommand live Find Familiar metadata bridge', () => {
  it('exposes live dismiss and recall commands on the caster after Find Familiar is summoned', () => {
    const caster = {
      id: 'find-familiar-caster',
      name: 'Find Familiar Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 20,
      maxHP: 20,
      stats: { size: 'medium' }
    } as unknown as CombatCharacter;
    const summonEffect = findFamiliar.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: findFamiliar.id,
      spellName: findFamiliar.name,
      castAtLevel: 1,
      caster,
      targets: [],
      playerInput: 'Owl',
      gameState: {}
    } as CommandContext;
    const state = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      turnState: {
        currentTurn: 1,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    } as CombatState;

    const summonedState = new SummoningCommand(summonEffect, context).execute(state);
    const updatedCaster = summonedState.characters.find(character => character.id === caster.id);
    const summonedFamiliar = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === findFamiliar.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(updatedCaster?.abilities?.some(ability => ability.name === 'Dismiss Familiar')).toBe(true);
    expect(updatedCaster?.abilities?.some(ability => ability.name === 'Recall Familiar')).toBe(true);
    expect(summonedFamiliar).toBeDefined();

    const dismissAbility = updatedCaster?.abilities?.find(ability => ability.name === 'Dismiss Familiar');
    const recallAbility = updatedCaster?.abilities?.find(ability => ability.name === 'Recall Familiar');

    expect(dismissAbility).toBeDefined();
    expect(recallAbility).toBeDefined();

    const dismissCommands = AbilityCommandFactory.createCommands(
      dismissAbility!,
      updatedCaster!,
      [updatedCaster!],
      {} as never
    );

    const dismissedState = dismissCommands[0].execute({
      ...summonedState,
      turnState: state.turnState
    });
    expect(dismissedState.characters.some(character => character.id === summonedFamiliar?.id)).toBe(false);
    expect(dismissedState.pocketedSummons?.map(entry => entry.summon.id)).toEqual([summonedFamiliar!.id]);

    const recallCommands = AbilityCommandFactory.createCommands(
      recallAbility!,
      updatedCaster!,
      [updatedCaster!],
      {} as never
    );

    const recalledState = recallCommands[0].execute({
      ...dismissedState,
      turnState: state.turnState
    });
    expect(recalledState.characters.some(character => character.id === summonedFamiliar?.id)).toBe(true);
    expect(recalledState.pocketedSummons).toEqual([]);
  });
});
