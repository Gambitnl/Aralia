import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import unseenServant from '../../../public/data/spells/level-1/unseen-servant.json';

/**
 * This file proves the live Unseen Servant spell packet creates a commandable helper.
 *
 * Unseen Servant has already been structured in spell data and routed through the
 * generic controlled-summon command bridge. This proof makes that bridge concrete
 * by casting the real spell packet, inspecting the summoned actor, and executing
 * the generated Move and Interact command twice to protect the once-per-turn limit.
 *
 * Called by: focused summon runtime tests.
 * Depends on: SummoningCommand, AbilityCommandFactory, and the public Unseen
 * Servant spell packet.
 */

describe('SummoningCommand live Unseen Servant command bridge', () => {
  it('creates a commandable servant and enforces its once-per-turn command budget', () => {
    // The caster is intentionally small: the summon command only needs an owner,
    // a position, and combat identity to create the spell helper.
    const caster = {
      id: 'unseen-servant-caster',
      name: 'Unseen Servant Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 30,
      maxHP: 30
    } as unknown as CombatCharacter;

    // Use the live spell packet so this proof fails if future data loses the
    // servant stat block, command cost, special action, or lifecycle metadata.
    const summonEffect = unseenServant.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: unseenServant.id,
      spellName: unseenServant.name,
      castAtLevel: 1,
      caster,
      targets: [],
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
        phase: 'bonus',
        actionsThisTurn: []
      },
      combatLog: []
    } as CombatState;

    // Casting the spell should materialize a real actor, not leave the servant
    // as prose-only metadata in the JSON packet.
    const summonedState = new SummoningCommand(summonEffect, context).execute(state);
    const servant = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === unseenServant.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(servant).toBeDefined();
    expect(servant?.name).toContain('Unseen Servant');
    expect(servant?.stats.speed).toBe(15);
    expect(servant?.currentHP).toBe(1);
    expect(servant?.maxHP).toBe(1);
    expect(servant?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'servant',
      sourceName: unseenServant.name,
      commandCost: 'bonus_action',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      lifecycle: summonEffect.summon?.lifecycle,
      conditionalEndings: summonEffect.conditionalEndings
    }));

    // The live special action should become a normal bonus-action ability with
    // a commanded-summon gate, so the player has a visible command surface.
    const moveAndInteract = servant?.abilities?.find(ability => ability.name === 'Move and Interact');

    expect(moveAndInteract).toBeDefined();
    expect(moveAndInteract?.cost.type).toBe('bonus');
    expect(moveAndInteract?.effects).toEqual([
      expect.objectContaining({
        type: 'commanded_summon',
        commandedSummonAction: 'issue_command'
      })
    ]);

    // The first command should be accepted, logged, and stored on the servant
    // so later button presses know the turn's command budget is already spent.
    const firstCommands = AbilityCommandFactory.createCommands(
      moveAndInteract!,
      servant!,
      [servant!],
      {} as never
    );

    expect(firstCommands).toHaveLength(1);

    const afterFirstCommand = firstCommands[0].execute(summonedState);
    const servantAfterFirstCommand = afterFirstCommand.characters.find(character => character.id === servant?.id);

    expect(servantAfterFirstCommand?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterFirstCommand.combatLog.some(entry =>
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true);

    // A second command in the same turn should be rejected rather than letting
    // the helper perform unlimited simple tasks from repeated button presses.
    const secondCommands = AbilityCommandFactory.createCommands(
      moveAndInteract!,
      servantAfterFirstCommand!,
      [servantAfterFirstCommand!],
      {} as never
    );

    expect(secondCommands).toHaveLength(1);

    const afterSecondCommand = secondCommands[0].execute(afterFirstCommand);
    const servantAfterSecondCommand = afterSecondCommand.characters.find(character => character.id === servant?.id);

    expect(servantAfterSecondCommand?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterSecondCommand.combatLog.some(entry =>
      entry.message.includes('has already followed its command this turn') &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true);
  });
});
