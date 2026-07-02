import { describe, expect, it } from 'vitest'
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory'
import { UtilityCommand } from '../effects/UtilityCommand'
import { createMockCombatCharacter } from '../../utils/factories'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'
import danseMacabre from '../../../public/data/spells/level-5/danse-macabre.json'

/**
 * This file proves the live Danse Macabre spell packet creates commandable undead.
 *
 * Danse Macabre is authored as utility data because it animates selected corpses
 * rather than using the ordinary summon effect shape. This focused proof keeps
 * the G16 controlled-entity lane honest by requiring the real spell JSON to
 * create Skeleton/Zombie actors, preserve the group command rules, and expose a
 * visible bonus-action command surface.
 *
 * Called by: focused G16 summon runtime checks.
 * Depends on: UtilityCommand and the public Danse Macabre spell packet.
 */

describe('UtilityCommand live Danse Macabre controlled-undead bridge', () => {
  it('creates commandable Skeleton or Zombie actors from selected corpses', () => {
    const caster = createMockCombatCharacter({
      id: 'danse-macabre-caster',
      name: 'Danse Macabre Caster',
      team: 'player',
      position: { x: 4, y: 4 },
      initiative: 13
    }) as CombatCharacter
    const utilityEffect = danseMacabre.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined
    const context = {
      spellId: danseMacabre.id,
      spellName: danseMacabre.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: {},
      playerInput: {
        undeadForms: ['Skeleton', 'Zombie'],
        corpseIds: ['corpse-1', 'corpse-2'],
        positions: [
          { x: 5, y: 4 },
          { x: 6, y: 4 }
        ]
      }
    } as unknown as CommandContext
    const state = createCombatState([caster])

    expect(utilityEffect).toBeDefined()

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state)
    const undead = afterCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === danseMacabre.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(undead).toHaveLength(2)
    expect(undead.map(character => character.summonMetadata?.formName)).toEqual(['Skeleton', 'Zombie'])
    expect(undead[0]).toEqual(expect.objectContaining({
      team: caster.team,
      position: { x: 5, y: 4 },
      creatureTypes: expect.arrayContaining(['Undead'])
    }))
    expect(undead[0].summonMetadata).toEqual(expect.objectContaining({
      entityType: 'undead',
      sourceName: danseMacabre.name,
      persistent: false,
      commandCost: 'bonus_action',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      initiativePolicy: 'shared',
      durationRemaining: 1,
      control: expect.objectContaining({
        entityType: 'animated_skeletons_or_zombies',
        allegiance: 'caster_controlled',
        obedience: 'same mental command to all Danse Macabre undead within 60 feet',
        restrictions: expect.arrayContaining([
          'small_or_medium_corpses_only',
          'become_inanimate_when_spell_ends',
          'attack_and_damage_bonus_from_caster_spellcasting_ability_modifier'
        ])
      }),
      formTraits: expect.arrayContaining([
        expect.objectContaining({
          name: 'Danse Macabre undead bonus',
          notes: expect.stringContaining('spellcasting ability modifier')
        })
      ])
    }))

    const commandAbility = undead[0].abilities?.find(ability => ability.name === 'Command Danse Macabre Undead')

    expect(commandAbility).toBeDefined()
    expect(commandAbility?.cost.type).toBe('bonus')
    expect(commandAbility?.range).toBe(60)

    const afterCommand = AbilityCommandFactory.createCommands(
      commandAbility!,
      undead[0],
      [undead[0]],
      {} as never
    )[0].execute(afterCast)
    const commandedUndead = afterCommand.characters.find(character => character.id === undead[0].id)

    expect(commandedUndead?.summonMetadata?.commandsUsedThisTurn).toBe(1)
    expect(afterCommand.combatLog.some(entry =>
      entry.data?.spellId === danseMacabre.id &&
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1
    )).toBe(true)
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'summon' &&
      entry.data?.spellId === danseMacabre.id &&
      entry.data?.summonSurface === 'danse-macabre' &&
      entry.data?.animatedCount === 2
    )).toBe(true)
  })
})

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
  } as CombatState
}
