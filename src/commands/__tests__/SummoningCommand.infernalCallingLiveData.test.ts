import { describe, expect, it } from 'vitest';
import { UtilityCommand } from '../effects/UtilityCommand';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';
import infernalCalling from '../../../public/data/spells/level-5/infernal-calling.json';

/**
 * Infernal Calling is authored as a utility packet because the caster chooses a
 * devil and then negotiates or contests commands during later turns.
 *
 * This proof protects the missing runtime bridge: the spell should create a
 * hostile Devil actor with its challenge-rating limit, rolled initiative,
 * no-action command contest, true-name/talisman modifiers, and command-immunity
 * aftermath preserved on the actor instead of leaving those rules as prose.
 */
describe('UtilityCommand live Infernal Calling hostile devil bridge', () => {
  it('creates an unfriendly Devil actor with command-contest and command-immunity metadata', () => {
    const caster = createMockCombatCharacter({
      id: 'infernal-calling-caster',
      name: 'Infernal Calling Caster',
      team: 'player',
      position: { x: 1, y: 1 },
      initiative: 11
    });
    const utilityEffect = infernalCalling.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const context = {
      spellId: infernalCalling.id,
      spellName: infernalCalling.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: {},
      playerInput: {
        devilForm: 'Barbed Devil',
        trueNameSpoken: true,
        hasTalisman: false,
        position: { x: 2, y: 1 }
      }
    } as unknown as CommandContext;
    const state = createCombatState([caster]);

    expect(utilityEffect).toBeDefined();

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state);
    const devils = afterCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === infernalCalling.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(devils).toHaveLength(1);
    expect(devils[0]).toEqual(expect.objectContaining({
      name: 'Barbed Devil',
      team: 'enemy',
      creatureTypes: expect.arrayContaining(['Fiend', 'Devil']),
      position: { x: 2, y: 1 },
      isSummon: true
    }));
    expect(devils[0].summonMetadata).toEqual(expect.objectContaining({
      entityType: 'called_devil',
      formName: 'Barbed Devil',
      sourceName: infernalCalling.name,
      initiativePolicy: 'rolled',
      commandCost: 'none',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      persistent: false,
      control: expect.objectContaining({
        entityType: 'called_devil',
        source: 'infernal-calling',
        allegiance: 'unfriendly_to_caster_and_companions',
        obedience: 'obeys_only_after_favorable_or_successful_command_contest',
        restrictions: expect.arrayContaining([
          'dm_controls_by_nature',
          'charisma_deception_intimidation_or_persuasion_vs_devil_wisdom_insight',
          'true_name_grants_advantage',
          'failed_contest_grants_command_immunity'
        ])
      }),
      aftermathState: expect.objectContaining({
        kind: 'called_devil_control',
        maxChallengeRating: '6 or lower',
        trueNameSpoken: true,
        hasTalisman: false,
        failedCommandEffect: 'devil_becomes_immune_to_caster_verbal_commands_for_duration',
        earlyConcentrationAfterCommandImmunity: 'remains_uncontrolled_for_3d6_minutes_then_disappears'
      })
    }));
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'summon' &&
      entry.data?.spellId === infernalCalling.id &&
      entry.data?.summonSurface === 'infernal-calling' &&
      entry.data?.devilForm === 'Barbed Devil' &&
      entry.data?.trueNameSpoken === true
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
