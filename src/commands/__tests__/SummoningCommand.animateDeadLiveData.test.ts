import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import { UtilityCommand } from '../effects/UtilityCommand';
import * as CommandedSummonRuntime from '../effects/CommandedSummonCommand';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { SummoningEffect, UtilityEffect } from '../../types/spells';
import animateDead from '../../../public/data/spells/level-3/animate-dead.json';

/**
 * This file proves the live Animate Dead spell packet creates a commandable undead actor.
 *
 * Animate Dead is an instantaneous necromancy spell, but its result is a persistent
 * Skeleton or Zombie under the caster's control. This proof protects the bounded
 * combat-runtime bridge: the real spell data must produce a summon actor with
 * controller metadata and a visible bonus-action command surface. The broader
 * world-clock work for 24-hour expiry and recast reassertion remains outside this
 * proof until Aralia has a durable day-scale scheduler for persistent minions.
 */

describe('SummoningCommand live Animate Dead controlled-undead bridge', () => {
  it('creates a controlled undead actor with a bonus-action command surface', () => {
    // The caster only needs enough combat shape to own the animated undead and
    // provide a spawn point for the summon command.
    const caster = createMockCombatCharacter({
      id: 'animate-dead-caster',
      name: 'Animate Dead Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 12
    });

    // Use the live spell packet so this test fails if Animate Dead drops out of
    // the first-class summon path and returns to prose-only utility metadata.
    const summonEffect = animateDead.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;
    const context = {
      spellId: animateDead.id,
      spellName: animateDead.name,
      castAtLevel: 3,
      caster,
      targets: [],
      gameState: {},
      playerInput: 'Animate Skeleton from Bones'
    } as CommandContext;
    const state = {
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

    expect(summonEffect).toBeDefined();

    // Casting the live packet should materialize a controlled undead actor
    // rather than leaving the Skeleton/Zombie choice only in utility prose.
    const summonedState = new SummoningCommand(summonEffect!, context).execute(state);
    const undead = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === animateDead.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(undead).toBeDefined();
    expect(undead?.name).toContain('Skeleton');
    expect(undead?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'undead',
      formName: 'Skeleton',
      sourceName: animateDead.name,
      persistent: true,
      commandCost: 'bonus_action',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      initiativePolicy: 'shared',
      durationRemaining: 24,
      control: expect.objectContaining({
        entityType: 'controlled_undead',
        allegiance: 'caster_controlled',
        obedience: 'obeys_bonus_action_commands_within_60_feet',
        restrictions: expect.arrayContaining([
          'control_duration_24_hours',
          'recast_before_expiry_to_reassert_control'
        ])
      })
    }));

    // Animate Dead should expose a visible bonus-action command button on the
    // undead actor, then enforce the same once-per-turn command budget used by
    // other controlled summons.
    const commandAbility = undead?.abilities?.find(ability => ability.name === 'Mentally Command Animated Undead');

    expect(commandAbility).toBeDefined();
    expect(commandAbility?.cost.type).toBe('bonus');
    expect(commandAbility?.effects).toEqual([
      expect.objectContaining({
        type: 'commanded_summon',
        commandedSummonAction: 'issue_command'
      })
    ]);

    const firstCommands = AbilityCommandFactory.createCommands(
      commandAbility!,
      undead!,
      [undead!],
      {} as never
    );

    expect(firstCommands).toHaveLength(1);

    const afterFirstCommand = firstCommands[0].execute(summonedState);
    const undeadAfterFirstCommand = afterFirstCommand.characters.find(character => character.id === undead?.id);

    expect(undeadAfterFirstCommand?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterFirstCommand.combatLog.some(entry =>
      entry.data?.spellId === animateDead.id &&
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true);
  });

  it('locks expired control and renews the same undead on reassert without spawning a replacement', () => {
    const caster = createMockCombatCharacter({
      id: 'animate-dead-caster',
      name: 'Animate Dead Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 12
    });

    const summonEffect = animateDead.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;
    const utilityEffect = animateDead.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;

    const summonContext = {
      spellId: animateDead.id,
      spellName: animateDead.name,
      castAtLevel: 3,
      caster,
      targets: [],
      gameState: {},
      playerInput: 'Animate Skeleton from Bones'
    } as CommandContext;

    const state = {
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

    expect(summonEffect).toBeDefined();
    expect(utilityEffect).toBeDefined();

    const summonedState = new SummoningCommand(summonEffect!, summonContext).execute(state);
    const undead = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === animateDead.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(undead).toBeDefined();

    const expiredState = {
      ...summonedState,
      characters: summonedState.characters.map(character =>
        character.id === undead?.id
          ? {
              ...character,
              summonMetadata: {
                ...character.summonMetadata,
                durationRemaining: 0,
                commandsUsedThisTurn: 0
              }
            }
          : character
      )
    } as CombatState;

    const commandAbility = undead?.abilities?.find(ability => ability.name === 'Mentally Command Animated Undead');
    expect(commandAbility).toBeDefined();

    const expiredCommands = AbilityCommandFactory.createCommands(
      commandAbility!,
      undead!,
      [undead!],
      {} as never
    );

    const afterExpiredCommand = expiredCommands[0].execute(expiredState);
    const expiredUndead = afterExpiredCommand.characters.find(character => character.id === undead?.id);

    expect(expiredUndead?.summonMetadata?.durationRemaining).toBe(0);
    expect(expiredUndead?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    expect(afterExpiredCommand.combatLog.some(entry =>
      entry.type === 'status' &&
      entry.message.includes('Animate Dead control has expired') &&
      entry.data?.spellId === animateDead.id &&
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.controlState === 'expired' &&
      entry.data?.durationRemaining === 0
    )).toBe(true);

    const reassertContext = {
      spellId: animateDead.id,
      spellName: animateDead.name,
      castAtLevel: 3,
      caster,
      targets: [expiredUndead!],
      gameState: {},
      playerInput: 'Reassert Control'
    } as CommandContext;

    const reassertCommand = new UtilityCommand(utilityEffect!, reassertContext);
    const afterReassert = reassertCommand.execute(afterExpiredCommand);
    const renewedUndead = afterReassert.characters.find(character => character.id === undead?.id);
    const otherAnimateDeadSummons = afterReassert.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === animateDead.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(renewedUndead?.summonMetadata?.durationRemaining).toBe(24);
    expect(renewedUndead?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    expect(otherAnimateDeadSummons).toHaveLength(1);

    const renewedCommands = AbilityCommandFactory.createCommands(
      commandAbility!,
      undead!,
      [renewedUndead!],
      {} as never
    );

    const afterRenewedCommand = renewedCommands[0].execute(afterReassert);
    const renewedCommandedUndead = afterRenewedCommand.characters.find(character => character.id === undead?.id);

    expect(renewedCommandedUndead?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterRenewedCommand.combatLog.some(entry =>
      entry.data?.spellId === animateDead.id &&
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true);
  });

  it('advances the 24-hour control window from elapsed world time before command locking and reassertion', () => {
    const caster = createMockCombatCharacter({
      id: 'animate-dead-caster',
      name: 'Animate Dead Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 12
    });

    const summonEffect = animateDead.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;
    const utilityEffect = animateDead.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;

    const summonContext = {
      spellId: animateDead.id,
      spellName: animateDead.name,
      castAtLevel: 3,
      caster,
      targets: [],
      gameState: {},
      playerInput: 'Animate Skeleton from Bones'
    } as CommandContext;

    const state = {
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

    expect(summonEffect).toBeDefined();
    expect(utilityEffect).toBeDefined();
    expect(CommandedSummonRuntime.advanceAnimateDeadControlWindows).toBeTypeOf('function');

    const summonedState = new SummoningCommand(summonEffect!, summonContext).execute(state);
    const undead = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === animateDead.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(undead).toBeDefined();

    // The helper is the bounded world-clock bridge for Animate Dead: elapsed
    // hours reduce the same live actor's control window before command logic
    // decides whether the undead still obeys.
    const afterTwentyThreeHours = CommandedSummonRuntime.advanceAnimateDeadControlWindows(
      summonedState,
      { elapsedHours: 23 }
    );
    const nearlyExpiredUndead = afterTwentyThreeHours.characters.find(character => character.id === undead?.id);

    expect(nearlyExpiredUndead?.summonMetadata?.durationRemaining).toBe(1);

    const afterOneMoreHour = CommandedSummonRuntime.advanceAnimateDeadControlWindows(
      afterTwentyThreeHours,
      { elapsedHours: 1 }
    );
    const expiredUndead = afterOneMoreHour.characters.find(character => character.id === undead?.id);

    expect(expiredUndead?.summonMetadata?.durationRemaining).toBe(0);
    expect(afterOneMoreHour.combatLog.some(entry =>
      entry.type === 'status' &&
      entry.data?.spellId === animateDead.id &&
      entry.data?.controlState === 'expired_by_elapsed_time' &&
      entry.data?.elapsedHours === 1
    )).toBe(true);

    const commandAbility = expiredUndead?.abilities?.find(ability => ability.name === 'Mentally Command Animated Undead');
    expect(commandAbility).toBeDefined();

    const expiredCommands = AbilityCommandFactory.createCommands(
      commandAbility!,
      expiredUndead!,
      [expiredUndead!],
      {} as never
    );
    const afterExpiredCommand = expiredCommands[0].execute(afterOneMoreHour);

    expect(afterExpiredCommand.characters.find(character => character.id === undead?.id)?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    expect(afterExpiredCommand.combatLog.some(entry =>
      entry.data?.spellId === animateDead.id &&
      entry.data?.controlState === 'expired'
    )).toBe(true);

    const reassertContext = {
      spellId: animateDead.id,
      spellName: animateDead.name,
      castAtLevel: 3,
      caster,
      targets: [expiredUndead!],
      gameState: {},
      playerInput: 'Reassert Control'
    } as CommandContext;
    const afterReassert = new UtilityCommand(utilityEffect!, reassertContext).execute(afterExpiredCommand);
    const renewedUndead = afterReassert.characters.find(character => character.id === undead?.id);

    expect(renewedUndead?.summonMetadata?.durationRemaining).toBe(24);
  });
});
