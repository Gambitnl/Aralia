import { describe, expect, it } from 'vitest';
import { UtilityCommand } from '../effects/UtilityCommand';
import { CommandedSummonCommand } from '../effects/CommandedSummonCommand';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';
import summonGreaterDemon from '../../../public/data/spells/level-4/summon-greater-demon.json';

/**
 * Summon Greater Demon is the command-economy stress case for controlled
 * summons: it obeys no-action verbal commands, has an authored no-command
 * fallback, repeats a control save, and becomes hostile after control breaks.
 *
 * This proof keeps those boundaries in live combat state instead of relying on
 * the long spell description or adjacent lesser-demon/devil implementations.
 */
describe('UtilityCommand live Summon Greater Demon command economy bridge', () => {
  it('creates a commanded Demon actor with no-command, control-save, and control-break metadata', () => {
    const caster = createMockCombatCharacter({
      id: 'summon-greater-demon-caster',
      name: 'Summon Greater Demon Caster',
      team: 'player',
      position: { x: 1, y: 1 },
      initiative: 13
    });
    const utilityEffect = summonGreaterDemon.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const state = createCombatState([caster]);
    const context = createContext(caster, {
      demonForm: 'Barlgura',
      trueNameSpoken: true,
      useBloodCircle: true,
      position: { x: 2, y: 1 }
    });

    expect(utilityEffect).toBeDefined();

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state);
    const demons = afterCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonGreaterDemon.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(demons).toHaveLength(1);
    expect(demons[0]).toEqual(expect.objectContaining({
      name: 'Barlgura',
      team: 'enemy',
      creatureTypes: expect.arrayContaining(['Fiend', 'Demon']),
      position: { x: 2, y: 1 },
      isSummon: true
    }));
    expect(demons[0].summonMetadata).toEqual(expect.objectContaining({
      entityType: 'chosen_demon',
      formName: 'Barlgura',
      sourceName: summonGreaterDemon.name,
      initiativePolicy: 'rolled',
      commandCost: 'none',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      persistent: false,
      control: expect.objectContaining({
        entityType: 'chosen_demon',
        source: 'summon-greater-demon',
        allegiance: 'caster_commanded_until_control_break',
        obedience: 'no-action verbal command each caster turn',
        noCommandBehavior: 'attacks a creature within reach that attacked it',
        restrictions: expect.arrayContaining([
          'demon_repeats_charisma_save_at_end_of_each_turn',
          'true_name_imposes_disadvantage_on_control_save',
          'control_break_pursues_nearest_non_demons',
          'optional_blood_circle_blocks_crossing_harming_or_targeting_inside_creatures'
        ])
      }),
      aftermathState: expect.objectContaining({
        kind: 'summon_greater_demon_control',
        maxChallengeRating: '5 or lower, +1 per slot level above 4',
        trueNameSpoken: true,
        bloodCircleUsed: true,
        controlSave: 'Charisma save at end of each demon turn, disadvantage if true name spoken',
        controlBreak: 'on successful save, control ends and demon attacks nearest non-demons',
        uncontrolledObedience: 'pursues_and_attacks_nearest_non_demons',
        materialComponentConsumption: 'consumed_when_spell_ends_if_used_to_create_the_protective_blood_circle'
      })
    }));
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'summon' &&
      entry.data?.spellId === summonGreaterDemon.id &&
      entry.data?.summonSurface === 'summon-greater-demon' &&
      entry.data?.demonForm === 'Barlgura' &&
      entry.data?.trueNameSpoken === true &&
      entry.data?.bloodCircleUsed === true
    )).toBe(true);
  });

  it('spends the authored no-action command budget without allowing repeat orders in the same turn', () => {
    const caster = createMockCombatCharacter({
      id: 'summon-greater-demon-caster',
      name: 'Summon Greater Demon Caster',
      team: 'player',
      position: { x: 1, y: 1 },
      initiative: 13
    });
    const utilityEffect = summonGreaterDemon.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const afterCast = new UtilityCommand(utilityEffect!, createContext(caster)).execute(createCombatState([caster]));
    const demon = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonGreaterDemon.id
    );

    expect(demon).toBeDefined();

    const commandContext = {
      spellId: summonGreaterDemon.id,
      spellName: summonGreaterDemon.name,
      castAtLevel: 4,
      caster: demon!,
      targets: [],
      gameState: {}
    } as unknown as CommandContext;
    const afterFirstCommand = new CommandedSummonCommand(commandContext, {
      description: 'Command Summoned Demon'
    }).execute(afterCast);
    const demonAfterFirstCommand = afterFirstCommand.characters.find(character => character.id === demon!.id);
    const afterSecondCommand = new CommandedSummonCommand(commandContext, {
      description: 'Command Summoned Demon'
    }).execute(afterFirstCommand);
    const demonAfterSecondCommand = afterSecondCommand.characters.find(character => character.id === demon!.id);

    expect(demonAfterFirstCommand?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(demonAfterSecondCommand?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterFirstCommand.combatLog.some(entry =>
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.spellId === summonGreaterDemon.id &&
      entry.data?.commandsUsedThisTurn === 1 &&
      entry.data?.commandDescription === 'Command Summoned Demon'
    )).toBe(true);
    expect(afterSecondCommand.combatLog.some(entry =>
      entry.message.includes('has already followed its command this turn') &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true);
  });
});

function createContext(
  caster: CombatCharacter,
  playerInput: Record<string, unknown> = {}
): CommandContext {
  return {
    spellId: summonGreaterDemon.id,
    spellName: summonGreaterDemon.name,
    castAtLevel: 4,
    caster,
    targets: [],
    gameState: {},
    playerInput
  } as unknown as CommandContext;
}

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
