import { describe, expect, it } from 'vitest'
import { DamageCommand, recordGuardianOfFaithDamage } from '../effects/DamageCommand'
import type { CombatCharacter } from '@/types/combat'
import type { DamageEffect, EffectDuration, Spell } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import guardianOfFaith from '../../../public/data/spells/level-4/guardian-of-faith.json'

/**
 * Guardian of Faith creates a stationary spectral guardian, not a summon actor.
 * This proof keeps its occupied space, trigger rules, invulnerability, damage
 * cap, and vanish behavior in combat state so later map-trigger work can use
 * structured state instead of scraping the spell description.
 */

describe('Guardian of Faith live guardian bridge', () => {
  it('records active guardian state and removes it after 60 total dealt damage', async () => {
    const spell = guardianOfFaith as unknown as Spell
    const damageEffects = spell.effects.filter((effect): effect is DamageEffect => effect.type === 'DAMAGE')

    expect(damageEffects).toHaveLength(2)
    expect(damageEffects.map(effect => effect.trigger.type)).toEqual(['on_enter_area', 'turn_start'])
    expect(damageEffects.every(effect =>
      effect.damage.dice === '20' &&
      effect.damage.type === 'Radiant' &&
      effect.condition.type === 'save' &&
      effect.condition.saveType === 'Dexterity' &&
      effect.condition.saveEffect === 'half'
    )).toBe(true)

    const caster = createMockCombatCharacter({
      id: 'guardian-caster',
      name: 'Guardian Caster',
      position: { x: 4, y: 4 },
      initiative: 12
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })

    const command = new DamageCommand(damageEffects[0], {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 6, y: 6 },
          purpose: 'ground_target'
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    })

    const afterCast = await command.execute(state)
    const guardian = afterCast.activeSpellGuardians?.find(record => record.spellId === spell.id)

    expect(guardian).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'guardian_of_faith',
      position: { x: 6, y: 6 },
      size: 'Large',
      occupiesSpace: true,
      invulnerable: true,
      threatRadiusFeet: 10,
      active: true,
      createdTurn: 3
    }))
    expect(guardian?.triggerPolicy).toEqual(expect.objectContaining({
      targets: 'enemy_creatures',
      onEnterFrequency: 'first_per_turn',
      turnStartTrigger: true,
      saveAbility: 'Dexterity',
      saveOutcome: 'half',
      damageAmount: 20,
      damageType: 'Radiant'
    }))
    expect(guardian?.damageCap).toEqual(expect.objectContaining({
      maxTotalDamage: 60,
      dealtDamage: 0,
      vanishWhenReached: true
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.data?.spellGuardianSurface === 'guardian_of_faith' &&
      (entry.data?.spellGuardian as { id?: string } | undefined)?.id === guardian?.id
    )).toBe(true)

    const afterPartialDamage = recordGuardianOfFaithDamage(afterCast, guardian!.id, 20, {
      targetId: 'enemy-1'
    })
    const stillActive = afterPartialDamage.activeSpellGuardians?.find(record => record.id === guardian?.id)

    expect(stillActive?.damageCap.dealtDamage).toBe(20)
    expect(stillActive?.active).toBe(true)

    const afterCapDamage = recordGuardianOfFaithDamage(afterPartialDamage, guardian!.id, 40, {
      targetId: 'enemy-2'
    })

    expect(afterCapDamage.activeSpellGuardians?.some(record => record.id === guardian?.id)).toBe(false)
    expect(afterCapDamage.combatLog.some(entry =>
      entry.data?.spellGuardianSurface === 'guardian_of_faith' &&
      entry.data?.vanishReason === 'damage_cap_reached' &&
      entry.data?.totalDamageDealt === 60
    )).toBe(true)
  })
})
