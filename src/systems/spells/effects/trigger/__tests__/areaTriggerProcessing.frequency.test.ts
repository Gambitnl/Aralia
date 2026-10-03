/**
 * This file pins the trigger-frequency and movement-type reads that used to go
 * through `as any` casts in areaTriggerProcessing.
 *
 * The casts hid a real shape difference: EffectTrigger.frequency is one of four
 * executable gates, while RecurringMechanic.frequency is a source-backed string
 * that may carry a label no gate implements. These tests state what each side
 * does now that both are read through their declared types.
 *
 * Exercises: systems/spells/effects/trigger/areaTriggerProcessing.
 */
import { describe, expect, it } from 'vitest';
import {
    normalizeTriggerFrequency,
    processAreaEndTurnTriggers,
    processAreaEntryTriggers,
    processAreaProximityTriggers,
    processMovementTriggers
} from '../areaTriggerProcessing';
import type { ActiveSpellZone, MovementTriggerDebuff } from '../types';
import type { CombatCharacter } from '../../../../../types/combat';
import type { SpellEffect } from '../../../../../types/spells';

const makeCharacter = (position = { x: 0, y: 0 }): CombatCharacter => ({
    id: 'traveler',
    name: 'Traveler',
    level: 1,
    class: {} as CombatCharacter['class'],
    position,
    stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
    },
    abilities: [],
    team: 'enemy',
    currentHP: 10,
    maxHP: 10,
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: 30 },
        freeActions: 1
    },
    activeEffects: []
} as unknown as CombatCharacter);

const makeEffect = (overrides: Record<string, unknown>): SpellEffect => ({
    type: 'DAMAGE',
    damage: { dice: '1d6', type: 'fire' },
    condition: { type: 'always' },
    ...overrides
} as unknown as SpellEffect);

const makeZone = (effects: SpellEffect[]): ActiveSpellZone => ({
    id: 'zone-under-test',
    spellId: 'test-spell',
    casterId: 'caster',
    position: { x: 0, y: 0 },
    areaOfEffect: { shape: 'square', size: 15 }, direction: { x: 1, y: 0 },
    effects,
    triggeredThisTurn: new Set(),
    triggeredEver: new Set()
});

describe('normalizeTriggerFrequency', () => {
    it('keeps each gate the module can execute', () => {
        for (const gate of ['every_time', 'first_per_turn', 'once', 'once_per_creature'] as const) {
            expect(normalizeTriggerFrequency(gate)).toBe(gate);
        }
    });

    it("resolves an absent or unimplemented label to 'every_time' rather than a stricter gate", () => {
        expect(normalizeTriggerFrequency(undefined)).toBe('every_time');
        // 'once_per_turn' is the proximity adapter's authored default. It is not an
        // EffectTrigger frequency, and it must not be promoted to 'first_per_turn'.
        expect(normalizeTriggerFrequency('once_per_turn')).toBe('every_time');
        expect(normalizeTriggerFrequency('every_other_tuesday')).toBe('every_time');
    });
});

describe('area trigger frequency gates', () => {
    it("applies a trigger's own first_per_turn gate on entry", () => {
        const zone = makeZone([makeEffect({ trigger: { type: 'on_enter_area', frequency: 'first_per_turn' } })]);
        const character = makeCharacter();

        const first = processAreaEntryTriggers([zone], character, { x: 0, y: 0 }, { x: 9, y: 9 }, 1);
        const second = processAreaEntryTriggers([zone], character, { x: 0, y: 0 }, { x: 9, y: 9 }, 1);

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(0);
    });

    it('applies a recurring mechanic first_per_turn gate at end of turn', () => {
        const zone = makeZone([makeEffect({
            trigger: { type: 'immediate' },
            recurringMechanics: [{ timing: 'turn_end', frequency: 'first_per_turn' }]
        })]);
        const character = makeCharacter();

        expect(processAreaEndTurnTriggers([zone], character, 1)).toHaveLength(1);
        expect(processAreaEndTurnTriggers([zone], character, 1)).toHaveLength(0);
    });

    it('keeps firing a recurring mechanic whose frequency label has no gate', () => {
        const zone = makeZone([makeEffect({
            trigger: { type: 'immediate' },
            recurringMechanics: [{ timing: 'turn_end', frequency: 'each_round_while_inside' }]
        })]);
        const character = makeCharacter();

        expect(processAreaEndTurnTriggers([zone], character, 1)).toHaveLength(1);
        expect(processAreaEndTurnTriggers([zone], character, 1)).toHaveLength(1);
    });

    it('treats a REACTIVE effect as having no trigger-level gate of its own', () => {
        // ReactiveEffect overrides `trigger` with its own four reaction events and
        // declares no frequency, so only the recurring mechanic's gate applies here.
        const zone = makeZone([makeEffect({
            type: 'REACTIVE',
            trigger: { type: 'on_target_cast' },
            recurringMechanics: [{ timing: 'turn_end', frequency: 'first_per_turn' }]
        })]);
        const character = makeCharacter();

        expect(processAreaEndTurnTriggers([zone], character, 1)).toHaveLength(1);
        expect(processAreaEndTurnTriggers([zone], character, 1)).toHaveLength(0);
    });

    it("keeps the proximity adapter's unimplemented default firing on every evaluation", () => {
        const zone = makeZone([makeEffect({
            trigger: { type: 'immediate' },
            recurringMechanics: [{ timing: 'on_entity_proximity' }]
        })]);
        const character = makeCharacter();

        expect(processAreaProximityTriggers([zone], character, { x: 0, y: 0 }, undefined, true)).toHaveLength(1);
        expect(processAreaProximityTriggers([zone], character, { x: 0, y: 0 }, undefined, true)).toHaveLength(1);
    });
});

describe('movement trigger movementType', () => {
    const makeDebuff = (movementType: string): MovementTriggerDebuff => ({
        id: 'debuff-under-test',
        spellId: 'test-spell',
        casterId: 'caster',
        targetId: 'traveler',
        effects: [makeEffect({ trigger: { type: 'on_target_move', movementType } })],
        expiresAtRound: 5,
        hasTriggered: false
    });

    it('fires a forced-movement trigger only on forced movement', () => {
        const character = makeCharacter({ x: 3, y: 0 });

        expect(processMovementTriggers([makeDebuff('forced')], character, 1, {
            movementType: 'willing',
            previousPosition: { x: 0, y: 0 }
        })).toHaveLength(0);

        expect(processMovementTriggers([makeDebuff('forced')], character, 1, {
            movementType: 'forced',
            previousPosition: { x: 0, y: 0 }
        })).toHaveLength(1);
    });

    it('fires a willing-movement trigger on willing movement', () => {
        const character = makeCharacter({ x: 3, y: 0 });

        expect(processMovementTriggers([makeDebuff('willing')], character, 1, {
            movementType: 'willing',
            previousPosition: { x: 0, y: 0 }
        })).toHaveLength(1);
    });
});
