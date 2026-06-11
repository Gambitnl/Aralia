import { describe, expect, it } from 'vitest'
import {
  createSpellZone,
  createSpellZoneFromAoEParams,
  isPositionInArea,
  processAreaEndTurnTriggers,
  processAreaEntryTriggers,
  processAreaExitTriggers,
  processMovementTriggers,
  resetZoneTurnTracking,
  type ActiveSpellZone,
  type MovementTriggerDebuff
} from '../triggerHandler'
import { AoECalculator } from '@/systems/spells/targeting/AoECalculator'
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
} as unknown as CombatCharacter)

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

describe('isPositionInArea', () => {
  it('uses supplied direction for directional persistent zones', () => {
    // Directional zones need to share AoECalculator geometry once the casting
    // path can supply orientation; without this guard they silently fall back
    // to the older direction-agnostic approximation.
    const cone = { shape: 'cone', size: 15 }

    expect(isPositionInArea({ x: 2, y: 0 }, { x: 0, y: 0 }, cone, { x: 1, y: 0 })).toBe(true)
    expect(isPositionInArea({ x: -2, y: 0 }, { x: 0, y: 0 }, cone, { x: 1, y: 0 })).toBe(false)
  })

  it('matches AoECalculator containment for persistent zone shapes', () => {
    // Persistent spell zones and targeting previews must agree about covered
    // tiles. This parity guard keeps future geometry changes from fixing the
    // preview while leaving delayed area triggers on a different footprint.
    const center = { x: 0, y: 0 }
    const east = { x: 1, y: 0 }
    const cases = [
      { area: { shape: 'cube', size: 10 }, direction: undefined, samples: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }] },
      { area: { shape: 'sphere', size: 10 }, direction: undefined, samples: [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 3, y: 0 }] },
      { area: { shape: 'cone', size: 15 }, direction: east, samples: [{ x: 2, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 1 }] },
      { area: { shape: 'line', size: 15 }, direction: east, samples: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 }] }
    ]

    for (const testCase of cases) {
      for (const sample of testCase.samples) {
        expect(isPositionInArea(sample, center, testCase.area, testCase.direction)).toBe(
          AoECalculator.containsTile(sample, center, {
            ...testCase.area,
            shape: testCase.area.shape === 'sphere' ? 'Sphere' : testCase.area.shape === 'cube' ? 'Cube' : testCase.area.shape === 'cone' ? 'Cone' : 'Line'
          }, testCase.direction)
        )
      }
    }
  })
})

describe('createSpellZone', () => {
  it('preserves directional zone orientation when supplied by casting code', () => {
    // This protects the handoff between future casting/targeting integration and
    // persistent zone processing: the factory must not drop cone/line direction.
    const zone = createSpellZone(
      'burning-cone',
      'caster',
      { x: 0, y: 0 },
      { shape: 'cone', size: 15 },
      [],
      1,
      2,
      { x: 1, y: 0 }
    )

    expect(zone.direction).toEqual({ x: 1, y: 0 })
  })

  it('can build a directional zone from shared AoE targeting params', () => {
    // This is the bridge shape the casting path needs: use the same origin and
    // compass direction computed for AoE previews instead of inventing separate
    // zone orientation math.
    const zone = createSpellZoneFromAoEParams(
      'burning-cone',
      'caster',
      {
        shape: 'Cone',
        origin: { x: 0, y: 0 },
        size: 15,
        direction: 90
      },
      { shape: 'cone', size: 15 },
      [],
      1,
      2
    )

    expect(zone.position).toEqual({ x: 0, y: 0 })
    expect(zone.direction?.x).toBeCloseTo(1)
    expect(zone.direction?.y).toBeCloseTo(0)
  })

  it('preserves defensive resistance and immunity effects for zone-based damage checks', () => {
    // Area defense spells need their resistance/immunity payload to survive
    // zone registration so downstream damage math can inspect the live map.
    const defensiveEffect = {
      type: 'DEFENSIVE',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      defenseType: 'resistance',
      damageType: ['Fire'],
      duration: { type: 'minutes', value: 10 },
      description: 'Targets inside the area have fire resistance.'
    } as unknown as SpellEffect

    const zone = createSpellZone(
      'protective-circle',
      'caster',
      { x: 0, y: 0 },
      { shape: 'sphere', size: 20 },
      [defensiveEffect],
      1,
      10,
      undefined,
      undefined,
      ['point']
    )

    expect(zone.effects).toHaveLength(1)
    expect(zone.effects[0]).toMatchObject({
      type: 'DEFENSIVE',
      defenseType: 'resistance',
      damageType: ['Fire']
    })
    expect(zone.targetingValidTargets).toEqual(['point'])
  })
})

describe('processAreaEndTurnTriggers', () => {
  it('fires once per turn per creature when configured with first_per_turn', () => {
    const effect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_end_turn_in_area', frequency: 'first_per_turn' },
      condition: { type: 'always' },
      damage: { dice: '1d6', type: 'Fire' }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as unknown as SpellEffect

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

describe('processAreaEntryTriggers', () => {
  it('passes zone direction into directional containment checks', () => {
    const effect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_enter_area', frequency: 'every_time' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Fire' }
    } as unknown as SpellEffect

    const zone: ActiveSpellZone = {
      ...makeZone([effect]),
      areaOfEffect: { shape: 'cone', size: 15 },
      direction: { x: 1, y: 0 }
    }

    const mover = makeCharacter({ x: -2, y: 0 })

    expect(processAreaEntryTriggers([zone], mover, { x: -2, y: 0 }, { x: -3, y: 0 }, 1)).toHaveLength(0)
    expect(processAreaEntryTriggers([zone], mover, { x: 2, y: 0 }, { x: -2, y: 0 }, 1)).toHaveLength(1)
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
    } as unknown as SpellEffect

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
    } as unknown as SpellEffect

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
    } as unknown as SpellEffect

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

describe('trigger source context', () => {
  it('carries zone source context through entry, exit, and end-turn helpers', () => {
    // Trigger helper callers use these processed effects after the original
    // spell cast has already finished. The source context is what lets later
    // save and audit code use the original spell and caster instead of guessing
    // from the affected target.
    const entryEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_enter_area', frequency: 'every_time' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Fire' }
    } as unknown as SpellEffect
    const exitEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_exit_area', frequency: 'every_time' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Cold' }
    } as unknown as SpellEffect
    const endTurnEffect = {
      type: 'DAMAGE',
      trigger: { type: 'on_end_turn_in_area', frequency: 'every_time' },
      condition: { type: 'always' },
      damage: { dice: '1d4', type: 'Poison' }
    } as unknown as SpellEffect
    const zone: ActiveSpellZone = {
      ...makeZone([entryEffect, exitEffect, endTurnEffect]),
      spellId: 'source-zone',
      casterId: 'source-caster',
      saveDC: 19
    }
    const mover = makeCharacter({ x: 0, y: 0 })

    expect(processAreaEntryTriggers([zone], mover, { x: 0, y: 0 }, { x: 2, y: 0 }, 1)[0].effects[0].sourceContext).toEqual({
      spellId: 'source-zone',
      casterId: 'source-caster',
      saveDC: 19
    })
    expect(processAreaExitTriggers([zone], mover, { x: 2, y: 0 }, { x: 0, y: 0 })[0].effects[0].sourceContext).toEqual({
      spellId: 'source-zone',
      casterId: 'source-caster',
      saveDC: 19
    })
    expect(processAreaEndTurnTriggers([zone], mover, 1)[0].effects[0].sourceContext).toEqual({
      spellId: 'source-zone',
      casterId: 'source-caster',
      saveDC: 19
    })
  })

  it('carries movement-debuff source context into processed target-move effects', () => {
    // Booming Blade-style movement debuffs fire from state saved at cast time.
    // The processed effect must carry the original caster and DC so downstream
    // save handling does not accidentally use the moving target as the source.
    const effect = {
      type: 'DAMAGE',
      trigger: { type: 'on_target_move', frequency: 'once' },
      condition: { type: 'always' },
      damage: { dice: '1d8', type: 'Thunder' }
    } as unknown as SpellEffect
    const debuff: MovementTriggerDebuff = {
      id: 'movement-source',
      spellId: 'booming-source',
      casterId: 'blade-caster',
      targetId: 'target',
      effects: [effect],
      expiresAtRound: 3,
      hasTriggered: false,
      saveDC: 18
    }

    const results = processMovementTriggers([debuff], makeCharacter({ x: 1, y: 0 }), 2)

    expect(results[0].effects[0].sourceContext).toEqual({
      spellId: 'booming-source',
      casterId: 'blade-caster',
      saveDC: 18
    })
  })
})
