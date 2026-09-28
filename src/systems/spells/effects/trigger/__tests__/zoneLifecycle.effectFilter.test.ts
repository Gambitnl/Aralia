/**
 * This file pins createSpellZone's effect filter, which used to read the
 * effect trigger through an `as any` binding.
 *
 * The filter decides what a persistent zone keeps: area trigger types, area
 * recurring mechanics, and defensive resistance/immunity payloads. Everything
 * else is dropped. Reading the trigger through its declared EffectTrigger shape
 * must not change that set.
 *
 * Exercises: systems/spells/effects/trigger/zoneLifecycle.
 */
import { describe, expect, it } from 'vitest';
import { createSpellZone } from '../zoneLifecycle';
import type { SpellEffect } from '../../../../../types/spells';

const makeEffect = (overrides: Record<string, unknown>): SpellEffect => ({
    type: 'DAMAGE',
    damage: { dice: '1d6', type: 'fire' },
    condition: { type: 'always' },
    trigger: { type: 'immediate' },
    ...overrides
} as unknown as SpellEffect);

const zoneFor = (effects: SpellEffect[]) => createSpellZone(
    'test-spell',
    'caster',
    { x: 0, y: 0 },
    { shape: 'square', size: 15 },
    effects,
    1,
    undefined,
    // A square zone uses the face-anchored cube geometry (ruling Q4, 2026-09-22), thus it needs a direction.
    { x: 1, y: 0 }
);

describe('createSpellZone effect filter', () => {
    it('keeps every area trigger type the area processors can fire', () => {
        const areaTriggerTypes = [
            'on_enter_area',
            'on_exit_area',
            'on_end_turn_in_area',
            'on_move_in_area',
            'turn_end',
            'turn_start'
        ];
        const effects = areaTriggerTypes.map(type => makeEffect({ trigger: { type } }));

        const zone = zoneFor(effects);

        expect(zone.effects).toHaveLength(areaTriggerTypes.length);
        expect(zone.effects.map(effect => effect.trigger?.type)).toEqual(areaTriggerTypes);
    });

    it('drops an effect whose trigger fires at cast time', () => {
        expect(zoneFor([makeEffect({ trigger: { type: 'immediate' } })]).effects).toHaveLength(0);
        expect(zoneFor([makeEffect({ trigger: { type: 'on_attack_hit' } })]).effects).toHaveLength(0);
    });

    it('keeps an effect that carries an area recurring mechanic instead of an area trigger', () => {
        const effect = makeEffect({
            trigger: { type: 'immediate' },
            recurringMechanics: [{ timing: 'on_entity_proximity' }]
        });

        expect(zoneFor([effect]).effects).toEqual([effect]);
    });

    it('keeps defensive resistance and immunity payloads the damage pipeline reads', () => {
        const resistance = makeEffect({ type: 'DEFENSIVE', defenseType: 'resistance' });
        const immunity = makeEffect({ type: 'DEFENSIVE', defenseType: 'immunity' });
        const otherDefense = makeEffect({ type: 'DEFENSIVE', defenseType: 'temporary_hit_points' });

        expect(zoneFor([resistance, immunity, otherDefense]).effects).toEqual([resistance, immunity]);
    });

    it('keeps an effect whose trigger record is missing entirely out of the zone', () => {
        const effect = makeEffect({ trigger: undefined });

        expect(zoneFor([effect]).effects).toHaveLength(0);
    });
});
