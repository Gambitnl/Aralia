import { describe, expect, it } from 'vitest'
import { BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { UtilityCommand } from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { EffectDuration, Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import spiritualWeapon from '../../../public/data/spells/level-2/spiritual-weapon.json'

/**
 * Spiritual Weapon is a spell-created controlled force, not a creature summon.
 * This proof keeps its position, repeat attack, movement, and cleanup facts in
 * combat state without pretending the force has a full actor turn.
 */

describe('Spiritual Weapon live controlled force bridge', () => {
  it('records active force state, repeat-attack metadata, and concentration cleanup', () => {
    const spell = spiritualWeapon as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()
    expect(utilityEffect?.grantedActions?.[0]).toEqual(expect.objectContaining({
      action: 'Move and Attack',
      type: 'bonus_action',
      rangeLimit: 20,
      attackType: 'melee_spell_attack',
      damageDice: '1d8+spellcasting_mod',
      damageType: 'force',
      damageAbilityModifier: 'spellcasting_ability'
    }))

    const caster = createMockCombatCharacter({
      id: 'spiritual-caster',
      name: 'Spiritual Caster',
      position: { x: 4, y: 4 },
      initiative: 16,
      concentratingOn: {
        spellId: spell.id,
        spellName: spell.name,
        spellLevel: 2,
        startedTurn: 2,
        effectIds: [],
        canDropAsFreeAction: true
      }
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 2,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })

    const command = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 2,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 6, y: 5 },
          purpose: 'ground_target'
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    })

    const afterCast = command.execute(state)
    const force = afterCast.activeSpellForces?.find(record => record.spellId === spell.id)

    expect(force).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'spiritual_weapon',
      position: { x: 6, y: 5 },
      reachFeet: 5,
      moveDistanceFeet: 20,
      moveAction: 'Bonus Action on later turns',
      repeatAttack: 'melee spell attack against creature within 5 feet',
      damage: '1d8 + spellcasting ability modifier Force',
      active: true,
      createdTurn: 2,
      expiresAtRound: 12
    }))
    expect(force?.grantedAction).toEqual(expect.objectContaining({
      action: 'Move and Attack',
      type: 'bonus_action',
      frequency: 'each_turn',
      rangeLimit: 20,
      attackType: 'melee_spell_attack',
      damageDice: '1d8+spellcasting_mod',
      damageType: 'force',
      damageAbilityModifier: 'spellcasting_ability'
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.data?.spellForceSurface === 'spiritual_weapon' &&
      (entry.data?.spellForce as { id?: string } | undefined)?.id === force?.id
    )).toBe(true)

    const breakCommand = new BreakConcentrationCommand({
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 2,
      caster,
      targets: [],
      gameState: createMockGameState()
    })
    const afterBreak = breakCommand.execute(afterCast)

    expect(afterBreak.activeSpellForces?.some(record => record.id === force?.id)).toBe(false)
    expect(afterBreak.combatLog.some(entry =>
      entry.message.includes('stops concentrating on Spiritual Weapon')
    )).toBe(true)
  })
})
