/**
 * This file tests the active spell-zone tracker.
 *
 * Spell zones are areas on the battle map that can react when a creature
 * enters, exits, ends a turn inside, or moves through the zone. These tests keep
 * that behavior visible so zone spells such as Grease, Cloud of Daggers, and
 * Spike Growth do not silently fall back to prose-only handling.
 *
 * Called by: the Vitest spell effects test suite.
 * Depends on: AreaEffectTracker for runtime area-trigger behavior and
 * triggerHandler types for active spell zone shape.
 */
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

// ============================================================================
// Test Fixture Builders
// ============================================================================
// These helpers create the smallest combat character and spell zone objects
// needed to exercise area-trigger behavior. They intentionally keep the objects
// plain so each test can show the specific trigger rule it is protecting.
// ============================================================================

const makeZone = (
    effects: SpellEffect[],
    position: Position = { x: 0, y: 0 },
    areaOfEffect: { shape: string; size: number } = { shape: 'cube', size: 5 }
): ActiveSpellZone => ({
    id: 'zone-1',
    spellId: 'test-zone',
    casterId: 'caster',
    position,
    areaOfEffect,
    effects,
    triggeredThisTurn: new Set(),
    triggeredEver: new Set()
})

// ============================================================================
// AreaEffectTracker Behavior
// ============================================================================
// This suite covers the public tracker API that future combat flow should call
// when a creature moves through or ends a turn inside spell-created zones.
// ============================================================================

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

    it('triggers on_move_in_area once per tile moved inside the zone', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_move_in_area' },
            condition: { type: 'always' },
            damage: { dice: '1d4', type: 'Piercing' }
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        // A 30ft cube gives enough interior space for a three-tile movement
        // while keeping both the old and new positions inside the same zone.
        const tracker = new AreaEffectTracker([
            makeZone([effect], { x: 0, y: 0 }, { shape: 'cube', size: 30 })
        ])
        const character = makeCharacter({ x: 4, y: 1 })

        const results = tracker.handleMovement(character, { x: 4, y: 1 }, { x: 1, y: 1 }, 1)

        expect(results.length).toBe(3)
        expect(results.every(result => result.triggerType === 'on_move_in_area')).toBe(true)
    })

    it('uses Chebyshev distance for diagonal on_move_in_area movement', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_move_in_area' },
            condition: { type: 'always' },
            damage: { dice: '1d4', type: 'Piercing' }
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const tracker = new AreaEffectTracker([
            makeZone([effect], { x: 0, y: 0 }, { shape: 'cube', size: 30 })
        ])
        const character = makeCharacter({ x: 4, y: 4 })

        const results = tracker.handleMovement(character, { x: 4, y: 4 }, { x: 1, y: 1 }, 1)

        expect(results.length).toBe(3)
    })

    it('does not trigger on_move_in_area when a move crosses a zone but starts and ends outside', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_move_in_area' },
            condition: { type: 'always' },
            damage: { dice: '1d4', type: 'Piercing' }
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const tracker = new AreaEffectTracker([
            makeZone([effect], { x: 0, y: 0 }, { shape: 'cube', size: 30 })
        ])
        const character = makeCharacter({ x: 7, y: 0 })

        const results = tracker.handleMovement(character, { x: 7, y: 0 }, { x: -7, y: 0 }, 1)

        expect(results.length).toBe(0)
    })

    it('honors first_per_turn on on_move_in_area regardless of distance moved', () => {
        const effect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_move_in_area', frequency: 'first_per_turn' },
            condition: { type: 'always' },
            damage: { dice: '1d4', type: 'Piercing' }
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown as SpellEffect

        const tracker = new AreaEffectTracker([
            makeZone([effect], { x: 0, y: 0 }, { shape: 'cube', size: 30 })
        ])
        const character = makeCharacter({ x: 4, y: 1 })

        const results = tracker.handleMovement(character, { x: 4, y: 1 }, { x: 1, y: 1 }, 1)

        expect(results.length).toBe(1)
        expect(results[0].triggerType).toBe('on_move_in_area')
    })
})


// ============================================================================
// Source Context Coverage
// ============================================================================
// These tests protect delayed area effects from losing the spell/caster context
// captured at cast time. Without this context, downstream save handling can fall
// back to the target's own spell DC instead of the original caster's DC.
// ============================================================================

describe('AreaEffectTracker source context', () => {
    it('carries snapshotted save DC into processed area-trigger effects', () => {
        const effect = {
            type: 'STATUS_CONDITION',
            statusCondition: { name: 'Restrained' },
            condition: { type: 'save', saveType: 'Dexterity' },
            duration: { type: 'rounds', value: 1 },
            trigger: { type: 'on_enter_area', frequency: 'every_time', movementType: 'any' }
        } as unknown as SpellEffect
        const zone = {
            ...makeZone([effect]),
            spellId: 'web-zone',
            casterId: 'caster-17',
            saveDC: 17
        }
        const tracker = new AreaEffectTracker([zone])

        const results = tracker.processEntry(makeCharacter({ x: 0, y: 0 }), { x: 0, y: 0 }, { x: 2, y: 0 }, 0)

        expect(results[0].effects[0].sourceContext).toEqual({
            spellId: 'web-zone',
            casterId: 'caster-17',
            saveDC: 17
        })
    })
})
