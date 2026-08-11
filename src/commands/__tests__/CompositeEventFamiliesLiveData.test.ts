/**
 * This file proves the remaining live composite spell-event families.
 *
 * Elemental Bane covers a delayed on-damage rider shared by normal command and
 * combat-engine damage. Grasping Vine covers one attack that runs both on the
 * initial cast and through a later Bonus Action from a spell-created origin.
 * The tests load the canonical JSON records so schema-valid but inert metadata
 * cannot satisfy this lane by itself.
 *
 * Called by: the focused Vitest spell-runtime suite.
 * Depends on: live spell JSON, command factories, and the normal damage,
 * condition, movement, concentration, and granted-action execution paths.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PlayerCharacter } from '@/types/character'
import type { Spell, DamageEffect } from '@/types/spells'
import { CommandExecutor } from '@/commands/base/CommandExecutor'
import { DamageCommand } from '@/commands/effects/DamageCommand'
import { GrantedActionCommand } from '@/commands/effects/GrantedActionCommand'
import { SpellCommandFactory } from '@/commands/factory/SpellCommandFactory'
import { createAbilityFromSpell } from '@/utils/character/spellAbilityFactory'
import { useCombatEngine } from '@/hooks/combat/engine/useCombatEngine'
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockCommandContext,
  createMockGameState
} from '@/utils/core'
import * as combatUtils from '@/utils/combat'
import * as savingThrowUtils from '@/utils/character/savingThrowUtils'
import elementalBaneData from '../../../public/data/spells/level-4/elemental-bane.json'
import graspingVineData from '../../../public/data/spells/level-4/grasping-vine.json'

const elementalBane = elementalBaneData as unknown as Spell
const graspingVine = graspingVineData as unknown as Spell

// ============================================================================
// Shared Combat Fixtures
// ============================================================================
// Explicit positions and spell stats make each event result deterministic and
// keep the assertions focused on the authored timing rather than random rolls.
// ============================================================================

const makeCaster = () => createMockCombatCharacter({
  id: 'composite-caster',
  name: 'Composite Caster',
  level: 9,
  position: { x: 0, y: 0 },
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 12,
    intelligence: 18,
    wisdom: 12,
    charisma: 10,
    baseInitiative: 0,
    speed: 30,
    cr: '0'
  }
})

describe('live composite spell event families', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('applies Elemental Bane on a failed save and adds matching damage only once per turn', async () => {
    const caster = makeCaster()
    const target = createMockCombatCharacter({
      id: 'elemental-bane-target',
      name: 'Fire-Resistant Target',
      team: 'enemy',
      currentHP: 80,
      maxHP: 80,
      position: { x: 4, y: 0 },
      resistances: ['Fire']
    })
    vi.spyOn(savingThrowUtils, 'rollSavingThrow').mockReturnValue({
      total: 8,
      success: false,
      modifiersApplied: []
    } as ReturnType<typeof savingThrowUtils.rollSavingThrow>)

    const commands = await SpellCommandFactory.createCommands(
      elementalBane,
      caster,
      [target],
      4,
      createMockGameState(),
      'Fire',
      undefined,
      undefined,
      [{ kind: 'creature', id: target.id }]
    )
    const castResult = await CommandExecutor.execute(commands, createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    }))
    const affectedTarget = castResult.finalState.characters.find(character => character.id === target.id)!

    expect(affectedTarget.statusEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Elemental Bane (Fire)',
        resistanceSuppression: expect.objectContaining({ damageTypes: ['Fire'] }),
        onDamageSpellEffect: expect.objectContaining({
          frequency: 'first_per_turn',
          damageDice: '2d6',
          damageType: 'triggering_damage_type'
        })
      })
    ]))

    const fireDamage: DamageEffect = {
      type: 'DAMAGE',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      damage: { dice: '1d10', type: 'Fire' }
    }
    const coldDamage: DamageEffect = {
      ...fireDamage,
      damage: { dice: '1d10', type: 'Cold' }
    }
    const damageContext = createMockCommandContext({
      spellId: 'test-fire-source',
      spellName: 'Test Fire Source',
      caster,
      targets: [affectedTarget]
    })
    vi.spyOn(combatUtils, 'rollDamage')
      .mockReturnValueOnce(6)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(7)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(7)

    const wrongTypeDamage = await new DamageCommand(coldDamage, damageContext).execute(castResult.finalState)
    const afterWrongType = wrongTypeDamage.characters.find(character => character.id === target.id)!
    expect(afterWrongType.currentHP).toBe(74)
    expect(afterWrongType.statusEffects[0].onDamageSpellEffect?.lastTriggeredTurn).toBeUndefined()

    const firstDamage = await new DamageCommand(fireDamage, {
      ...damageContext,
      targets: [afterWrongType]
    }).execute(wrongTypeDamage)
    const afterFirstDamage = firstDamage.characters.find(character => character.id === target.id)!
    expect(afterFirstDamage.currentHP).toBe(57)
    expect(afterFirstDamage.statusEffects[0].onDamageSpellEffect?.lastTriggeredTurn).toBe(3)

    const secondDamage = await new DamageCommand(fireDamage, {
      ...damageContext,
      targets: [afterFirstDamage]
    }).execute(firstDamage)
    expect(secondDamage.characters.find(character => character.id === target.id)?.currentHP).toBe(47)

    const nextTurnState = {
      ...secondDamage,
      turnState: {
        ...secondDamage.turnState,
        currentTurn: 4
      }
    }
    const nextTurnDamage = await new DamageCommand(fireDamage, {
      ...damageContext,
      targets: [secondDamage.characters.find(character => character.id === target.id)!]
    }).execute(nextTurnState)
    expect(nextTurnDamage.characters.find(character => character.id === target.id)?.currentHP).toBe(30)
  })

  it('applies the same Elemental Bane rider through the combat-engine damage entry point', () => {
    const affectedTarget = createMockCombatCharacter({
      id: 'engine-elemental-bane-target',
      name: 'Engine Target',
      currentHP: 80,
      maxHP: 80,
      resistances: ['Fire'],
      statusEffects: [{
        id: 'engine-elemental-bane',
        name: 'Elemental Bane (Fire)',
        type: 'debuff',
        duration: 10,
        source: 'Elemental Bane',
        sourceSpellId: 'elemental-bane',
        resistanceSuppression: {
          damageTypes: ['Fire'],
          source: 'chosen_damage_type'
        },
        onDamageSpellEffect: {
          frequency: 'first_per_turn',
          damageDice: '2d6',
          damageType: 'triggering_damage_type'
        }
      }]
    })
    const props = {
      characters: [affectedTarget],
      mapData: null,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
      onMapUpdate: vi.fn(),
      addDamageNumber: vi.fn()
    }
    vi.spyOn(combatUtils, 'rollDice').mockReturnValue(7)

    const { result } = renderHook(() => useCombatEngine(props))
    const afterFirstDamage = result.current.handleDamage(
      affectedTarget,
      10,
      'Test Fire Source',
      'Fire',
      3
    )
    const afterSecondDamage = result.current.handleDamage(
      afterFirstDamage,
      10,
      'Test Fire Source',
      'Fire',
      3
    )

    expect(afterFirstDamage.currentHP).toBe(63)
    expect(afterFirstDamage.statusEffects[0].onDamageSpellEffect?.lastTriggeredTurn).toBe(3)
    expect(afterSecondDamage.currentHP).toBe(53)
    expect(combatUtils.rollDice).toHaveBeenCalledTimes(1)
  })

  it('uses one Grasping Vine owner for the initial attack and later Bonus Action', async () => {
    const caster = makeCaster()
    const firstTarget = createMockCombatCharacter({
      id: 'first-vine-target',
      name: 'First Vine Target',
      team: 'enemy',
      currentHP: 50,
      maxHP: 50,
      armorClass: 12,
      position: { x: 6, y: 0 }
    })
    vi.spyOn(combatUtils, 'rollD20').mockReturnValue(15)
    vi.spyOn(combatUtils, 'rollDamage').mockReturnValue(8)

    const initialCommands = await SpellCommandFactory.createCommands(
      graspingVine,
      caster,
      [firstTarget],
      4,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      [
        { kind: 'point', position: { x: 4, y: 0 }, purpose: 'vine_origin' },
        { kind: 'creature', id: firstTarget.id }
      ]
    )
    const initialResult = await CommandExecutor.execute(initialCommands, createMockCombatState({
      characters: [caster, firstTarget]
    }))
    const activeVine = initialResult.finalState.activeSpellForces?.find(force => force.kind === 'grasping_vine')
    const firstTargetAfterHit = initialResult.finalState.characters.find(character => character.id === firstTarget.id)!

    expect(activeVine).toEqual(expect.objectContaining({
      spellId: 'grasping-vine',
      position: { x: 4, y: 0 },
      reachFeet: 30,
      followUpEffects: expect.any(Array)
    }))
    expect(firstTargetAfterHit.currentHP).toBe(42)
    expect(firstTargetAfterHit.statusEffects.map(status => status.name)).toContain('Grappled')
    expect(firstTargetAfterHit.position.x).toBeLessThan(6)

    const ability = createAbilityFromSpell(graspingVine, caster as unknown as PlayerCharacter)
    const repeatAction = ability.grantedActions?.find(action => action.action === 'Repeat Vine Attack')
    expect(repeatAction).toEqual(expect.objectContaining({
      type: 'bonus_action',
      frequency: 'each_turn',
      attackType: 'melee_spell_attack',
      rangeLimit: 30,
      damage: { dice: '4d8', type: 'Bludgeoning' }
    }))

    const secondTarget = createMockCombatCharacter({
      id: 'second-vine-target',
      name: 'Second Vine Target',
      team: 'enemy',
      currentHP: 50,
      maxHP: 50,
      armorClass: 12,
      position: { x: 8, y: 0 }
    })
    const stateWithSecondTarget = {
      ...initialResult.finalState,
      characters: [...initialResult.finalState.characters, secondTarget]
    }
    const repeatContext = createMockCommandContext({
      spellId: 'grasping-vine',
      spellName: 'Grasping Vine',
      caster,
      targets: [secondTarget],
      selectedSpellTargets: [{ kind: 'creature', id: secondTarget.id }]
    })
    const repeatedState = await new GrantedActionCommand(repeatContext, {
      actionLabel: repeatAction?.action,
      actionCost: repeatAction?.type,
      frequency: repeatAction?.frequency,
      rangeLimit: repeatAction?.rangeLimit,
      attackType: repeatAction?.attackType,
      damageDice: repeatAction?.damage?.dice,
      damageType: repeatAction?.damage?.type as never
    }).execute(stateWithSecondTarget)
    const releasedFirstTarget = repeatedState.characters.find(character => character.id === firstTarget.id)!
    const secondTargetAfterHit = repeatedState.characters.find(character => character.id === secondTarget.id)!

    expect(releasedFirstTarget.statusEffects.map(status => status.name)).not.toContain('Grappled')
    expect(secondTargetAfterHit.currentHP).toBe(42)
    expect(secondTargetAfterHit.statusEffects.map(status => status.name)).toContain('Grappled')
    expect(secondTargetAfterHit.position.x).toBeLessThan(8)
  })
})
