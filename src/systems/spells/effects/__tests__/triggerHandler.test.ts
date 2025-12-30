import { describe, expect, it } from 'vitest'
import {
  processAreaEndTurnTriggers,
  processAreaExitTriggers,
  resetZoneTurnTracking,
  type ActiveSpellZone
} from '../triggerHandler'
import type { CombatCharacter, Position } from '@/types/combat'
import type { SpellEffect } from '@/types/spells'

const baseStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  baseInitiative: 0,
  speed: 30,
  cr: '0'
}

const baseEconomy = {
  action: { used: false, remaining: 1 },
  bonusAction: { used: false, remaining: 1 },
  reaction: { used: false, remaining: 1 },
  movement: { used: 0, total: 30 },
  freeActions: 0
}

const makeCharacter = (position: Position): CombatCharacter => ({
  id: 'target',
  name: 'Target',
  level: 1,
  // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
  class: 'Wizard' as unknown,
  position,
  stats: { ...baseStats },
  abilities: [],
  team: 'player',
  currentHP: 10,
  maxHP: 10,
  initiative: 0,
  statusEffects: [],
  actionEconomy: { ...baseEconomy }
})

const makeZone = (effects: SpellEffect[]): ActiveSpellZone => ({
  id: 'zone-1',
  spellId: 'test-zone',
  casterId: 'caster',
  position: { x: 0, y: 0 },
  areaOfEffect: { shape: 'cube', size: 5 },
  effects,
  triggeredThisTurn: new Set(),
  triggeredEver: new Set()
})

describe('processAreaEndTurnTriggers', () => {
  it('fires once per turn per creature when configured with first_per_turn', () => {
    const effect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_end_turn_in_area', frequency: 'first_per_turn' },
      condition: { type: 'always' },
      damage: { dice: '1d6', type: 'Fire' }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as unknown

    const zone = makeZone([effect])
    const occupant = makeCharacter({ x: 0, y: 0 })

    const first = processAreaEndTurnTriggers([zone], occupant, 1)
    expect(first.length).toBe(1)
    const second = processAreaEndTurnTriggers([zone], occupant, 1)
    expect(second.length).toBe(0)

    resetZoneTurnTracking([zone])
    const nextRound = processAreaEndTurnTriggers([zone], occupant, 2)
    expect(nextRound.length).toBe(1)
  })
})

describe('processAreaExitTriggers', () => {
  it('respects once_per_creature frequency gating', () => {
    const effect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_exit_area', frequency: 'once_per_creature' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Fire' }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as unknown

    const zone = makeZone([effect])
    const mover = makeCharacter({ x: 0, y: 0 })

    const first = processAreaExitTriggers([zone], mover, { x: 2, y: 0 }, { x: 0, y: 0 })
    expect(first.length).toBe(1)
    const second = processAreaExitTriggers([zone], mover, { x: 3, y: 0 }, { x: 2, y: 0 })
    expect(second.length).toBe(0)
  })

  it('allows different creatures to trigger once_per_creature independently', () => {
    const effect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_exit_area', frequency: 'once_per_creature' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Fire' }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as unknown

    const zone = makeZone([effect])
    const moverA = makeCharacter({ x: 0, y: 0 })
    const moverB = { ...makeCharacter({ x: 0, y: 0 }), id: 'target-b', name: 'Target B' }

    // First creature triggers
    const firstA = processAreaExitTriggers([zone], moverA, { x: 2, y: 0 }, { x: 0, y: 0 })
    expect(firstA.length).toBe(1)

    // Second creature can also trigger (once_per_creature allows each creature once)
    const firstB = processAreaExitTriggers([zone], moverB, { x: 2, y: 0 }, { x: 0, y: 0 })
    expect(firstB.length).toBe(1)

    // But same creatures cannot trigger again
    const secondA = processAreaExitTriggers([zone], moverA, { x: 3, y: 0 }, { x: 2, y: 0 })
    expect(secondA.length).toBe(0)
  })

  it('blocks all creatures after first trigger with "once" frequency', () => {
    const effect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_exit_area', frequency: 'once' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Fire' }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as unknown

    const zone = makeZone([effect])
    const moverA = makeCharacter({ x: 0, y: 0 })
    const moverB = { ...makeCharacter({ x: 0, y: 0 }), id: 'target-b', name: 'Target B' }

    // First creature triggers
    const firstA = processAreaExitTriggers([zone], moverA, { x: 2, y: 0 }, { x: 0, y: 0 })
    expect(firstA.length).toBe(1)

    // Second creature should NOT trigger (once = zone-global, only first trigger counts)
    const firstB = processAreaExitTriggers([zone], moverB, { x: 2, y: 0 }, { x: 0, y: 0 })
    expect(firstB.length).toBe(0)

    // Even if moverA tries again, still blocked
    const secondA = processAreaExitTriggers([zone], moverA, { x: 3, y: 0 }, { x: 2, y: 0 })
    expect(secondA.length).toBe(0)
  })
})
