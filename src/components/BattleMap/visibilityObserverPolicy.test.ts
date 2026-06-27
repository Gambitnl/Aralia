import { describe, expect, it } from 'vitest'
import type { CombatCharacter } from '../../types/combat'
import { createMockCombatCharacter } from '../../utils/factories'
import { selectVisibilityObserver } from './visibilityObserverPolicy'

/**
 * These tests protect the combat-map viewpoint policy.
 *
 * Shared senses from Find Familiar does not move the caster or cast spells from
 * the familiar. It does, however, make the familiar the tactical observer for
 * map visibility while preserving which character is controlling that view.
 */

describe('visibilityObserverPolicy', () => {
  it('uses a selected caster shared-senses familiar as the map observer', () => {
    const familiar = createMockCombatCharacter({
      id: 'familiar',
      name: 'Owl Familiar',
      team: 'player',
      isSummon: true
    })
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Caster',
      team: 'player',
      activeEffects: [{
        id: 'familiar-shared-senses-caster',
        spellId: 'find-familiar',
        casterId: 'caster',
        sourceName: 'Find Familiar',
        type: 'utility',
        duration: { type: 'rounds', value: 1 },
        startTime: 3,
        mechanics: {
          familiarSharedSenses: true,
          observerCharacterId: familiar.id,
          telepathyRange: 100,
          sharedSensesCost: 'action'
        }
      }]
    })

    const selection = selectVisibilityObserver({
      selectedCharacterId: caster.id,
      currentCharacterId: null,
      characters: [caster, familiar] as CombatCharacter[]
    })

    expect(selection.observerId).toBe(familiar.id)
    expect(selection.sharedSenses).toEqual({
      controllerId: caster.id,
      controllerName: caster.name,
      observerId: familiar.id,
      observerName: familiar.name,
      sourceName: 'Find Familiar'
    })
  })
})
