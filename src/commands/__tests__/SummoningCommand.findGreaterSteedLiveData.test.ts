import { describe, expect, it } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import findGreaterSteed from '../../../public/data/spells/level-4/find-greater-steed.json'

/**
 * Find Greater Steed is currently authored as a utility packet with nested
 * summon metadata, not as a normal SUMMONING effect.
 *
 * This proof protects that utility-side bridge: the live spell must create a
 * persistent bonded mount actor, expose the same non-familiar dismissal path as
 * Find Steed, and enforce the one-bond limit shared by Find Steed and Find
 * Greater Steed.
 */

describe('UtilityCommand live Find Greater Steed mount bridge', () => {
  it('creates a persistent greater steed actor and exposes generic dismissal', () => {
    const utilityEffect = findGreaterSteed.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'greater-steed-caster',
      name: 'Greater Steed Caster',
      team: 'player',
      position: { x: 3, y: 3 },
      initiative: 12
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster]
    })

    const afterCast = new UtilityCommand(utilityEffect!, buildContext(caster, 'Pegasus')).execute(state)
    const updatedCaster = afterCast.characters.find(character => character.id === caster.id)
    const greaterSteed = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === findGreaterSteed.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(greaterSteed).toEqual(expect.objectContaining({
      name: expect.stringContaining('Pegasus'),
      team: caster.team,
      position: { x: 4, y: 3 },
      creatureTypes: expect.arrayContaining(['Celestial', 'Fey', 'Fiend'])
    }))
    expect(greaterSteed?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'greater_steed_mount',
      formName: 'Pegasus',
      sourceName: findGreaterSteed.name,
      persistent: true,
      dismissable: true,
      dismissAction: 'action',
      telepathyRange: 5280,
      lifecycle: expect.objectContaining({
        zeroHpEnding: 'mount disappears temporarily when it drops to 0 hit points',
        recastEnding: 'casting the spell again re-summons the bonded mount with all hit points restored and conditions removed'
      }),
      control: expect.objectContaining({
        entityType: 'greater_steed_mount',
        allegiance: 'loyal bonded mount controlled by caster in combat',
        bondLimit: 'cannot have more than one mount bonded by Find Steed or Find Greater Steed at same time'
      })
    }))

    const dismissAbility = updatedCaster?.abilities?.find(ability => ability.name === 'Dismiss Summon')
    expect(dismissAbility).toBeDefined()

    const dismissCommands = AbilityCommandFactory.createCommands(
      dismissAbility!,
      updatedCaster!,
      [updatedCaster!],
      {} as never
    )
    const dismissedState = dismissCommands[0].execute({
      ...afterCast,
      turnState: state.turnState
    }) as CombatState

    expect(dismissedState.characters.some(character => character.id === greaterSteed?.id)).toBe(false)
    expect(dismissedState.combatLog.some(entry => entry.data?.removedSummonId === greaterSteed?.id)).toBe(true)
  })

  it('replaces an existing Find Steed bond when the greater steed is summoned', () => {
    const utilityEffect = findGreaterSteed.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'greater-steed-caster',
      name: 'Greater Steed Caster',
      team: 'player',
      position: { x: 3, y: 3 },
      initiative: 12
    }) as CombatCharacter
    const existingFindSteed = createMockCombatCharacter({
      id: 'existing-find-steed',
      name: 'Existing Find Steed Horse',
      team: caster.team,
      position: { x: 4, y: 3 },
      initiative: caster.initiative
    }) as CombatCharacter
    existingFindSteed.isSummon = true
    existingFindSteed.summonMetadata = {
      casterId: caster.id,
      spellId: 'find-steed',
      entityType: 'mount',
      formName: 'Horse',
      sourceName: 'Find Steed',
      persistent: true,
      dismissable: true
    }

    const afterCast = new UtilityCommand(utilityEffect!, buildContext(caster, 'Griffon')).execute(createMockCombatState({
      characters: [caster, existingFindSteed]
    }))
    const bondedMounts = afterCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.casterId === caster.id &&
      ['find-steed', 'find-greater-steed'].includes(character.summonMetadata?.spellId ?? '')
    )

    expect(bondedMounts).toHaveLength(1)
    expect(bondedMounts[0].summonMetadata?.spellId).toBe(findGreaterSteed.id)
    expect(afterCast.combatLog.some(entry => {
      const removedBondedMountIds = entry.data?.removedBondedMountIds
      return Array.isArray(removedBondedMountIds) &&
        removedBondedMountIds.includes(existingFindSteed.id) &&
        entry.data?.bondLimit === 'find-steed-or-find-greater-steed'
    })).toBe(true)
  })
})

function buildContext(caster: CombatCharacter, playerInput: string): CommandContext {
  return {
    spellId: findGreaterSteed.id,
    spellName: findGreaterSteed.name,
    castAtLevel: findGreaterSteed.level,
    caster,
    targets: [],
    playerInput,
    gameState: createMockGameState()
  } satisfies CommandContext
}
