
import { describe, expect, it, vi } from 'vitest'
import { AreaEffectTracker } from '../AreaEffectTracker'
import { combatEvents } from '../../../events/CombatEvents'
import type { CombatCharacter, Position } from '@/types/combat'
import type { Class } from '@/types/character'
import type { ActiveSpellZone } from '@/systems/spells/effects/triggerHandler'
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
    class: 'Wizard' as unknown as Class,
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

const makeZone = (effects: SpellEffect[], position: Position = { x: 0, y: 0 }): ActiveSpellZone => ({
    id: 'zone-1',
    spellId: 'test-zone',
    casterId: 'caster',
    position,
    areaOfEffect: { shape: 'cube', size: 5 }, // 5ft cube = 1x1 tile
    effects,
    triggeredThisTurn: new Set(),
    triggeredEver: new Set()
})

describe('AreaEffectTracker', () => {
    it('emits unit_enter_area event even with no effects', () => {
        const tracker = new AreaEffectTracker([makeZone([])])
        const spy = vi.fn()
        combatEvents.on('unit_enter_area', spy)

        const character = makeCharacter({ x: 0, y: 0 })
        // Move from outside (x: 2) to inside (x: 0)
        tracker.handleMovement(character, { x: 0, y: 0 }, { x: 2, y: 0 }, 1)

        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'unit_enter_area',
            unitId: character.id,
            position: { x: 0, y: 0 }
        }))
    })

    it('triggers on_enter_area effects', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_enter_area' },
            condition: { type: 'always' },
            damage: { dice: '1d6', type: 'Fire' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const tracker = new AreaEffectTracker([makeZone([effect])])
        const character = makeCharacter({ x: 0, y: 0 })

        const results = tracker.handleMovement(character, { x: 0, y: 0 }, { x: 2, y: 0 }, 1)

        expect(results.length).toBe(1)
        expect(results[0].triggered).toBe(true)
        expect(results[0].effects[0].type).toBe('damage')
        expect(results[0].triggerType).toBe('on_enter_area')
    })

    it('handles first_per_turn frequency on entry', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_enter_area', frequency: 'first_per_turn' },    
            condition: { type: 'always' },
            damage: { dice: '1d6', type: 'Fire' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const zone = makeZone([effect])
        const tracker = new AreaEffectTracker([zone])
        const character = makeCharacter({ x: 0, y: 0 })

        // First entry
        const results1 = tracker.handleMovement(character, { x: 0, y: 0 }, { x: 2, y: 0 }, 1)
        expect(results1.length).toBe(1)

        // Exit
        tracker.handleMovement(character, { x: 2, y: 0 }, { x: 0, y: 0 }, 1)

        // Re-enter same turn
        const results2 = tracker.handleMovement(character, { x: 0, y: 0 }, { x: 2, y: 0 }, 1)
        expect(results2.length).toBe(0) // Should not trigger again
    })

    it('emits unit_exit_area event', () => {
        const tracker = new AreaEffectTracker([makeZone([])])
        const spy = vi.fn()
        combatEvents.on('unit_exit_area', spy)

        const character = makeCharacter({ x: 0, y: 0 })
        // Move from inside (x: 0) to outside (x: 2)
        tracker.handleMovement(character, { x: 2, y: 0 }, { x: 0, y: 0 }, 1)

        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'unit_exit_area',
            unitId: character.id,
            position: { x: 2, y: 0 }
        }))
    })

    it('triggers on_exit_area effects with correct trigger type', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_exit_area' },
            condition: { type: 'always' },
            damage: { dice: '1d6', type: 'Fire' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const tracker = new AreaEffectTracker([makeZone([effect])])
        const character = makeCharacter({ x: 0, y: 0 })

        const results = tracker.handleMovement(character, { x: 2, y: 0 }, { x: 0, y: 0 }, 1)

        expect(results.length).toBe(1)
        expect(results[0].triggered).toBe(true)
        expect(results[0].effects[0].type).toBe('damage')
        expect(results[0].triggerType).toBe('on_exit_area')
    })

    it('processes end turn triggers', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_end_turn_in_area' },
            condition: { type: 'always' },
            damage: { dice: '1d6', type: 'Fire' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const tracker = new AreaEffectTracker([makeZone([effect])])
        const character = makeCharacter({ x: 0, y: 0 })

        const results = tracker.processEndTurn(character, 1)
        expect(results.length).toBe(1)
        expect(results[0].triggerType).toBe('on_end_turn_in_area')
    })
})
