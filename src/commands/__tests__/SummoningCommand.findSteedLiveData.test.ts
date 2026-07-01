import { SummoningCommand } from '../effects/SummoningCommand';
import type { CommandContext } from '../base/SpellCommand';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import findSteed from '../../../public/data/spells/level-2/find-steed.json';

/**
 * This file proves live Find Steed data reaches a generic dismissal command.
 *
 * The live packet declares dismissAction and persistent dismissal lifecycle
 * language, so the summon command should expose a first-class dismiss action
 * and the resulting ability should remove the summon without using the
 * Find Familiar pocket-dimension bridge.
 *
 * Called by: focused summon runtime tests.
 * Depends on: SummoningCommand, AbilityCommandFactory, and the public Find
 * Steed spell packet.
 */

describe('SummoningCommand live Find Steed dismissal bridge', () => {
  it('exposes a generic dismiss command that removes the steed from combat state', () => {
    const caster = {
      id: 'find-steed-caster',
      name: 'Find Steed Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 30,
      maxHP: 30,
      stats: { size: 'medium' }
    } as unknown as CombatCharacter;
    const summonEffect = findSteed.effects.find(effect => effect.type === 'SUMMONING') as unknown as SummoningEffect;
    const context = {
      spellId: findSteed.id,
      spellName: findSteed.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Horse',
      gameState: {}
    } as unknown as CommandContext;
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
    } as unknown as CombatState;

    const summonedState = new SummoningCommand(summonEffect, context).execute(state);
    const updatedCaster = summonedState.characters.find((character: CombatCharacter) => character.id === caster.id);
    const summonedSteed = summonedState.characters.find((character: CombatCharacter) =>
      character.isSummon &&
      character.summonMetadata?.spellId === findSteed.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(summonedSteed).toBeDefined();
    expect(summonedSteed?.summonMetadata).toEqual(expect.objectContaining({
      dismissable: true,
      dismissAction: 'action',
      sourceName: findSteed.name
    }));

    const dismissAbility = updatedCaster?.abilities?.find(ability => ability.name === 'Dismiss Summon');

    expect(dismissAbility).toBeDefined();

    const dismissCommands = AbilityCommandFactory.createCommands(
      dismissAbility!,
      updatedCaster!,
      [updatedCaster!],
      {} as never
    );

    expect(dismissCommands).toHaveLength(1);

    const dismissedState = dismissCommands[0].execute({
      ...summonedState,
      turnState: state.turnState
    }) as CombatState;

    expect(dismissedState.characters.some((character: CombatCharacter) => character.id === summonedSteed?.id)).toBe(false);
    expect(dismissedState.characters.some((character: CombatCharacter) => character.id === caster.id)).toBe(true);
    expect(dismissedState.combatLog.some(entry => entry.data?.removedSummonId === summonedSteed?.id)).toBe(true);
    expect(dismissedState.pocketedSummons).toBeUndefined();
  });
});
