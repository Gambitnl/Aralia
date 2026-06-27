import { describe, expect, it } from 'vitest'
import { FamiliarSharedSensesCommand } from '../effects/FamiliarSharedSensesCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../utils/factories'

/**
 * These tests protect the Find Familiar shared-senses command.
 *
 * Shared senses is not just flavor: it creates a one-round active effect on the
 * caster that tells later visibility and camera work which familiar is acting
 * as the observer. The command must therefore choose the familiar created by
 * the same spell button, not any familiar-shaped summon owned by the caster.
 */

describe('FamiliarSharedSensesCommand', () => {
  it('uses only the familiar created by the command spell', () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Caster',
      position: { x: 0, y: 0 },
      activeEffects: []
    })
    const otherSpellFamiliar = createMockCombatCharacter({
      id: 'other-spell-familiar',
      name: 'Other Spell Familiar',
      position: { x: 1, y: 0 },
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'other-familiar-spell',
        entityType: 'familiar',
        sharedSenses: true,
        telepathyRange: 100,
        dismissable: true
      }
    })
    const ownFamiliar = createMockCombatCharacter({
      id: 'own-familiar',
      name: 'Own Familiar',
      position: { x: 2, y: 0 },
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'find-familiar',
        entityType: 'familiar',
        sharedSenses: true,
        sharedSensesCost: 'action',
        telepathyRange: 100,
        dismissable: true
      }
    })
    const state = createMockCombatState({
      characters: [caster, otherSpellFamiliar, ownFamiliar],
      combatLog: []
    })
    const command = new FamiliarSharedSensesCommand({
      spellId: 'find-familiar',
      spellName: 'Find Familiar',
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    })

    const newState = command.execute(state)
    const updatedCaster = newState.characters.find(character => character.id === caster.id)
    const sharedSensesEffect = updatedCaster?.activeEffects?.find(effect =>
      effect.mechanics?.familiarSharedSenses === true
    )

    // The first familiar in the roster belongs to another spell. The command
    // should skip it and attach the observer effect to the familiar created by
    // the same owning spell id used by the generated button.
    expect(sharedSensesEffect?.mechanics?.observerCharacterId).toBe(ownFamiliar.id)
    expect(sharedSensesEffect?.spellId).toBe('find-familiar')
    expect(newState.combatLog.at(-1)?.message).toContain("Own Familiar's senses")
  })
})
