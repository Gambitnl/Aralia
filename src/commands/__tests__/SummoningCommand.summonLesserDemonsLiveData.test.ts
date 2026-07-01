import { describe, expect, it, vi } from 'vitest';
import { UtilityCommand } from '../effects/UtilityCommand';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';
import summonLesserDemons from '../../../public/data/spells/level-3/summon-lesser-demons.json';

/**
 * Summon Lesser Demons is authored as a utility packet because the GM chooses
 * the demon stat blocks and the caster only chooses visible arrival spaces.
 *
 * This proof protects the runtime bridge that still needs to create hostile
 * demon actors, preserve the random count table and blood-circle restriction
 * facts, and keep those demons on a rolled group initiative surface instead of
 * leaving the spell as a prose-only combat-log entry.
 */

describe('UtilityCommand live Summon Lesser Demons hostile summon bridge', () => {
  it('creates hostile demon actors from the live utility packet with group initiative metadata', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const caster = createMockCombatCharacter({
      id: 'summon-lesser-demons-caster',
      name: 'Summon Lesser Demons Caster',
      team: 'player',
      position: { x: 3, y: 3 },
      initiative: 12
    });
    const utilityEffect = summonLesserDemons.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const context = {
      spellId: summonLesserDemons.id,
      spellName: summonLesserDemons.name,
      castAtLevel: 3,
      caster,
      targets: [],
      gameState: {},
      playerInput: {
        demonForm: 'Dretch',
        useBloodCircle: true,
        positions: [
          { x: 4, y: 3 },
          { x: 5, y: 3 }
        ]
      }
    } as unknown as CommandContext;
    const state = createCombatState([caster]);

    expect(utilityEffect).toBeDefined();

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state);
    const demons = afterCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonLesserDemons.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(demons).toHaveLength(2);
    expect(demons.every(demon => demon.team === 'enemy')).toBe(true);
    expect(demons.every(demon => demon.creatureTypes?.includes('Fiend'))).toBe(true);
    expect(demons[0].summonMetadata).toEqual(expect.objectContaining({
      entityType: 'hostile_demon',
      formName: 'Dretch',
      sourceName: summonLesserDemons.name,
      initiativePolicy: 'rolled',
      commandCost: 'none',
      commandsPerTurn: 0,
      persistent: false,
      control: expect.objectContaining({
        entityType: 'hostile_demons',
        allegiance: 'hostile_to_all_creatures',
        obedience: 'pursues_and_attacks_nearest_non_demons',
        restrictions: expect.arrayContaining([
          'gm_chooses_demon_stat_blocks',
          'caster_places_visible_unoccupied_spaces',
          'optional_blood_circle_blocks_crossing_harming_or_targeting_inside_creatures'
        ])
      }),
      aftermathState: expect.objectContaining({
        groupInitiative: true,
        bloodCircleUsed: true,
        materialComponentConsumption: 'consumed_when_spell_ends_if_used_to_create_the_protective_blood_circle'
      })
    }));
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'summon' &&
      entry.data?.spellId === summonLesserDemons.id &&
      entry.data?.summonSurface === 'summon-lesser-demons' &&
      entry.data?.rolledCount === 2 &&
      entry.data?.bloodCircleUsed === true
    )).toBe(true);

    randomSpy.mockRestore();
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
