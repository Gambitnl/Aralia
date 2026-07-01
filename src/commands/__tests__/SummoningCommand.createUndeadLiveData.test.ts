import { describe, expect, it } from 'vitest';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import { UtilityCommand } from '../effects/UtilityCommand';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';
import createUndead from '../../../public/data/spells/level-6/create-undead.json';

/**
 * Create Undead is the higher-level sibling of Animate Dead, but the live spell
 * packet is utility/control data rather than a normal SUMMONING row.
 *
 * This proof protects the missing bridge: casting the real spell data should
 * create controlled Ghoul actors, give them the same visible command surface as
 * other commanded summons, and let a later recast renew control on the existing
 * undead instead of silently logging prose.
 */

describe('UtilityCommand live Create Undead controlled-undead bridge', () => {
  it('creates controlled Ghoul actors with 120-foot bonus-action command metadata', () => {
    const caster = createMockCombatCharacter({
      id: 'create-undead-caster',
      name: 'Create Undead Caster',
      team: 'player',
      position: { x: 2, y: 2 },
      initiative: 14
    });
    const utilityEffect = createUndead.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const context = {
      spellId: createUndead.id,
      spellName: createUndead.name,
      castAtLevel: 6,
      caster,
      targets: [],
      gameState: {},
      playerInput: 'Animate Ghouls'
    } as CommandContext;
    const state = createCombatState([caster]);

    expect(utilityEffect).toBeDefined();

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state);
    const createdGhouls = afterCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === createUndead.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(createdGhouls).toHaveLength(3);
    expect(createdGhouls[0].name).toContain('Ghoul');
    expect(createdGhouls[0].creatureTypes).toContain('Undead');
    expect(createdGhouls[0].summonMetadata).toEqual(expect.objectContaining({
      entityType: 'undead',
      formName: 'Ghoul',
      sourceName: createUndead.name,
      persistent: true,
      commandCost: 'bonus_action',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      initiativePolicy: 'shared',
      durationRemaining: 24,
      control: expect.objectContaining({
        entityType: 'controlled_undead',
        source: 'create-undead',
        allegiance: 'caster_controlled',
        obedience: 'obeys_bonus_action_commands_within_120_feet',
        restrictions: expect.arrayContaining([
          'control_duration_24_hours',
          'recast_before_expiry_to_reassert_control',
          'same_command_to_multiple_controlled_undead'
        ])
      })
    }));

    const commandAbility = createdGhouls[0].abilities?.find(ability => ability.name === 'Mentally Command Created Undead');

    expect(commandAbility).toBeDefined();
    expect(commandAbility?.cost.type).toBe('bonus');
    expect(commandAbility?.range).toBe(120);
    expect(commandAbility?.effects).toEqual([
      expect.objectContaining({
        type: 'commanded_summon',
        commandedSummonAction: 'issue_command'
      })
    ]);

    const command = AbilityCommandFactory.createCommands(
      commandAbility!,
      createdGhouls[0],
      [createdGhouls[0]],
      {} as never
    )[0];
    const afterCommand = command.execute(afterCast);
    const commandedGhoul = afterCommand.characters.find(character => character.id === createdGhouls[0].id);

    expect(commandedGhoul?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterCommand.combatLog.some(entry =>
      entry.data?.spellId === createUndead.id &&
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true);
  });

  it('locks expired Create Undead control and renews the same actor on reassert', () => {
    const caster = createMockCombatCharacter({
      id: 'create-undead-caster',
      name: 'Create Undead Caster',
      team: 'player',
      position: { x: 2, y: 2 },
      initiative: 14
    });
    const utilityEffect = createUndead.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const context = {
      spellId: createUndead.id,
      spellName: createUndead.name,
      castAtLevel: 6,
      caster,
      targets: [],
      gameState: {},
      playerInput: 'Animate Ghouls'
    } as CommandContext;
    const afterCast = new UtilityCommand(utilityEffect!, context).execute(createCombatState([caster]));
    const createdGhoul = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === createUndead.id
    ) as CombatCharacter | undefined;

    expect(createdGhoul).toBeDefined();

    const expiredState = {
      ...afterCast,
      characters: afterCast.characters.map(character =>
        character.id === createdGhoul?.id
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
    const commandAbility = createdGhoul?.abilities?.find(ability => ability.name === 'Mentally Command Created Undead');
    const expiredCommand = AbilityCommandFactory.createCommands(
      commandAbility!,
      createdGhoul!,
      [createdGhoul!],
      {} as never
    )[0];
    const afterExpiredCommand = expiredCommand.execute(expiredState);

    expect(afterExpiredCommand.characters.find(character => character.id === createdGhoul?.id)?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    expect(afterExpiredCommand.combatLog.some(entry =>
      entry.type === 'status' &&
      entry.data?.spellId === createUndead.id &&
      entry.data?.controlState === 'expired'
    )).toBe(true);

    const expiredGhoul = afterExpiredCommand.characters.find(character => character.id === createdGhoul?.id) as CombatCharacter;
    const reassertContext = {
      ...context,
      targets: [expiredGhoul],
      playerInput: 'Mental Command'
    } as CommandContext;
    const afterReassert = new UtilityCommand(utilityEffect!, reassertContext).execute(afterExpiredCommand);
    const renewedGhoul = afterReassert.characters.find(character => character.id === createdGhoul?.id);
    const createUndeadActors = afterReassert.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === createUndead.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(renewedGhoul?.summonMetadata?.durationRemaining).toBe(24);
    expect(renewedGhoul?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    expect(createUndeadActors).toHaveLength(3);
    expect(afterReassert.combatLog.some(entry =>
      entry.data?.spellId === createUndead.id &&
      entry.data?.controlState === 'renewed'
    )).toBe(true);
  });
});

function createCombatState(characters: CombatCharacter[]): CombatState {
  return {
    isActive: true,
    characters,
    turnState: {
      currentTurn: 1,
      turnOrder: characters.map(character => character.id),
      currentCharacterId: characters[0]?.id ?? '',
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
}
