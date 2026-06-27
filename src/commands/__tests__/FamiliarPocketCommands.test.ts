import { describe, expect, it } from 'vitest'
import { DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand } from '../effects/FamiliarPocketCommands'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../utils/factories'

/**
 * These tests protect the runtime commands that move Find Familiar-style
 * summoned actors between the battle map and their pocket dimension.
 *
 * The commands are small, but they sit on a sensitive ownership boundary:
 * pocketed summons are no longer in the visible combat roster, so recall and
 * dismissal must use spell/caster metadata instead of grabbing whichever
 * familiar-shaped actor appears first.
 */

describe('FamiliarPocketCommands', () => {
  it('dismisses only the on-map familiar created by the command spell', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' })
    const ownFamiliar = createMockCombatCharacter({
      id: 'own-familiar',
      name: 'Own Familiar',
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'find-familiar',
        entityType: 'familiar',
        dismissable: true
      }
    })
    const otherSpellFamiliar = createMockCombatCharacter({
      id: 'other-spell-familiar',
      name: 'Other Spell Familiar',
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'other-familiar-spell',
        entityType: 'familiar',
        dismissable: true
      }
    })
    const state = createMockCombatState({
      characters: [caster, otherSpellFamiliar, ownFamiliar],
      pocketedSummons: [],
      combatLog: []
    })
    const command = new DismissFamiliarToPocketCommand({
      spellId: 'find-familiar',
      spellName: 'Find Familiar',
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    })

    const newState = command.execute(state)

    // The other familiar belongs to the same caster, but not to this spell.
    // It must stay on the map while the command's own familiar moves into the
    // pocket state.
    expect(newState.characters.some(character => character.id === otherSpellFamiliar.id)).toBe(true)
    expect(newState.characters.some(character => character.id === ownFamiliar.id)).toBe(false)
    expect(newState.pocketedSummons?.map(entry => entry.summon.id)).toEqual([ownFamiliar.id])
  })

  it('recalls only the pocketed familiar created by the command spell', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' })
    const otherSpellFamiliar = createMockCombatCharacter({
      id: 'other-pocketed-familiar',
      name: 'Other Pocketed Familiar',
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'other-familiar-spell',
        entityType: 'familiar',
        dismissable: true
      }
    })
    const ownFamiliar = createMockCombatCharacter({
      id: 'own-pocketed-familiar',
      name: 'Own Pocketed Familiar',
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'find-familiar',
        entityType: 'familiar',
        dismissable: true
      }
    })
    const state = createMockCombatState({
      characters: [caster],
      pocketedSummons: [
        {
          summon: otherSpellFamiliar,
          casterId: caster.id,
          spellId: 'other-familiar-spell',
          dismissedTurn: 1,
          lastKnownPosition: { x: 4, y: 4 },
          reason: 'familiar_pocket'
        },
        {
          summon: ownFamiliar,
          casterId: caster.id,
          spellId: 'find-familiar',
          dismissedTurn: 1,
          lastKnownPosition: { x: 2, y: 2 },
          reason: 'familiar_pocket'
        }
      ],
      combatLog: []
    })
    const command = new RecallFamiliarFromPocketCommand({
      spellId: 'find-familiar',
      spellName: 'Find Familiar',
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    })

    const newState = command.execute(state)

    // Recall should not grab the first familiar-shaped pocket entry. It should
    // restore the familiar owned by this spell and leave the unrelated pocketed
    // summon available for its own command path.
    expect(newState.characters.some(character => character.id === ownFamiliar.id)).toBe(true)
    expect(newState.characters.some(character => character.id === otherSpellFamiliar.id)).toBe(false)
    expect(newState.pocketedSummons?.map(entry => entry.summon.id)).toEqual([otherSpellFamiliar.id])
  })

  it('recalls a pocketed familiar to a nearby open tile when its last position is occupied', () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Caster',
      position: { x: 1, y: 1 }
    })
    const blocker = createMockCombatCharacter({
      id: 'blocker',
      name: 'Blocking Ally',
      position: { x: 2, y: 2 }
    })
    const familiar = createMockCombatCharacter({
      id: 'pocketed-familiar',
      name: 'Pocketed Familiar',
      isSummon: true,
      position: { x: 2, y: 2 },
      summonMetadata: {
        casterId: caster.id,
        spellId: 'find-familiar',
        entityType: 'familiar',
        dismissable: true
      }
    })
    const state = createMockCombatState({
      characters: [caster, blocker],
      pocketedSummons: [{
        summon: familiar,
        casterId: caster.id,
        spellId: 'find-familiar',
        dismissedTurn: 1,
        lastKnownPosition: { x: 2, y: 2 },
        reason: 'familiar_pocket'
      }],
      combatLog: []
    })
    const command = new RecallFamiliarFromPocketCommand({
      spellId: 'find-familiar',
      spellName: 'Find Familiar',
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    })

    const newState = command.execute(state)
    const recalled = newState.characters.find(character => character.id === familiar.id)

    // The familiar's old position is occupied, so recall should preserve the
    // familiar and place it in an adjacent open tile instead of stacking on the
    // blocker.
    expect(recalled).toBeDefined()
    expect(recalled?.position).not.toEqual(blocker.position)
    expect(newState.pocketedSummons).toEqual([])
  })
})
