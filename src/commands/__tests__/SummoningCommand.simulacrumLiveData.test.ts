import { describe, expect, it, vi } from 'vitest'
import { SummoningCommand } from '../effects/SummoningCommand'
import { DamageCommand } from '../effects/DamageCommand'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState } from '../../types/combat'
import type { DamageEffect, SummoningEffect } from '../../types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import simulacrum from '../../../public/data/spells/level-7/simulacrum.json'

/**
 * This file proves the live Simulacrum spell packet reaches the combat summon
 * runtime as one continuous player-facing behavior.
 *
 * Earlier proof lived in lower-level regression files. This focused live-data
 * proof keeps the G16 summon/control tracker honest by showing the actual
 * public spell JSON creates a persistent commanded construct, replaces the
 * previous same-caster Simulacrum on recast, and disappears when damage drops
 * it to 0 HP.
 *
 * Called by: focused G16 summon runtime checks.
 * Depends on: SummoningCommand, DamageCommand, and the public Simulacrum spell packet.
 */

describe('SummoningCommand live Simulacrum lifecycle bridge', () => {
  it('creates a persistent commanded construct and replaces the prior copy on recast', () => {
    const caster = createCaster()
    const summonEffect = getSimulacrumSummonEffect()
    const state = createMockCombatState({
      characters: [caster]
    })

    const firstState = new SummoningCommand(summonEffect, buildContext(caster)).execute(state)
    const firstSimulacrum = findCasterSimulacrum(firstState, caster)

    expect(firstSimulacrum).toEqual(expect.objectContaining({
      name: expect.stringContaining('Simulacrum'),
      team: caster.team,
      isSummon: true
    }))
    expect(firstSimulacrum?.summonMetadata).toEqual(expect.objectContaining({
      casterId: caster.id,
      spellId: simulacrum.id,
      entityType: 'creature',
      persistent: true,
      commandCost: 'none',
      commandsPerTurn: 1,
      initiativePolicy: 'shared',
      lifecycle: expect.objectContaining({
        hitPointMaximum: 'half the original creature Hit Point maximum',
        repairOnly: 'damaged simulacrum HP restored only by Long Rest repair costing 100 GP per Hit Point',
        zeroHpEnding: 'at 0 Hit Points, simulacrum reverts to snow and melts away',
        recastEnding: 'casting Simulacrum again instantly destroys any existing simulacrum from this spell'
      }),
      control: expect.objectContaining({
        entityType: 'simulacrum_construct_duplicate',
        allegiance: 'friendly to caster and creatures caster designates',
        obedience: 'obeys spoken commands',
        destruction: '0 HP melts to snow; recasting destroys prior simulacrum'
      })
    }))

    const recastState = new SummoningCommand(summonEffect, buildContext(caster)).execute(firstState)
    const casterSimulacra = recastState.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === simulacrum.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(casterSimulacra).toHaveLength(1)
    expect(casterSimulacra[0].id).not.toBe(firstSimulacrum?.id)
    expect(recastState.characters.some(character => character.id === firstSimulacrum?.id)).toBe(false)
  })

  it('removes the live Simulacrum actor when damage drops it to 0 HP', async () => {
    const caster = createCaster()
    const enemy = createMockCombatCharacter({
      id: 'simulacrum-attacker',
      name: 'Enemy Mage',
      team: 'enemy',
      featChoices: {}
    }) as CombatCharacter
    const summonEffect = getSimulacrumSummonEffect()
    const summonedState = new SummoningCommand(summonEffect, buildContext(caster)).execute(createMockCombatState({
      characters: [caster, enemy],
      combatLog: []
    }))
    const liveSimulacrum = findCasterSimulacrum(summonedState, caster)

    expect(liveSimulacrum?.summonMetadata?.lifecycle?.zeroHpEnding).toContain('0 Hit Points')

    const damageEffect: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '10d1', type: 'Force' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const damagedState = await new DamageCommand(damageEffect, {
      spellId: 'force-bolt',
      spellName: 'Force Bolt',
      castAtLevel: 1,
      caster: enemy,
      targets: [liveSimulacrum!],
      gameState: createMockGameState()
    } satisfies CommandContext).execute(createMockCombatState({
      characters: [caster, enemy, liveSimulacrum!],
      combatLog: []
    }))

    vi.restoreAllMocks()

    expect(damagedState.characters.some(character => character.id === liveSimulacrum?.id)).toBe(false)
    expect(damagedState.combatLog.some(entry =>
      entry.data?.removedSummonId === liveSimulacrum?.id ||
      entry.message.includes('disappears as the spell-created summon drops to 0 HP')
    )).toBe(true)
  })
})

function createCaster(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'simulacrum-caster',
    name: 'Simulacrum Caster',
    team: 'player',
    position: { x: 2, y: 2 },
    initiative: 14
  }) as CombatCharacter
}

function getSimulacrumSummonEffect(): SummoningEffect {
  const effects = simulacrum.effects as unknown as SummoningEffect[]
  const summonEffect = effects.find(effect => effect.type === 'SUMMONING')

  expect(summonEffect).toBeDefined()

  return summonEffect!
}

function buildContext(caster: CombatCharacter): CommandContext {
  return {
    spellId: simulacrum.id,
    spellName: simulacrum.name,
    castAtLevel: simulacrum.level,
    caster,
    targets: [],
    gameState: createMockGameState()
  } satisfies CommandContext
}

function findCasterSimulacrum(state: CombatState, caster: CombatCharacter): CombatCharacter | undefined {
  return state.characters.find(character =>
    character.isSummon &&
    character.summonMetadata?.spellId === simulacrum.id &&
    character.summonMetadata?.casterId === caster.id
  )
}
