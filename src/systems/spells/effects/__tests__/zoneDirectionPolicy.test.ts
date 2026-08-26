import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpellZone, isPositionInArea } from '../triggerHandler';
import type { Position } from '../../../../types/combat';
import type { SpellEffect } from '../../../../types/spells';

/**
 * Policy gate for the direction of a cone or a line spell zone.
 *
 * Ruling 2026-09-13 (Q2, agora-79fa.3, GG-201): a directional zone always gets
 * a direction at creation. The cast direction comes first. The caster facing is
 * the second source. If neither exists, creation throws. There is no permissive
 * alternative, thus `isPositionInArea` can no longer widen the area.
 */

const ORIGIN: Position = { x: 10, y: 10 };
const EAST: Position = { x: 1, y: 0 };

/** One trigger effect, which is enough to keep the zone effect filter happy. */
const ENTRY_EFFECT = {
    type: 'DAMAGE',
    trigger: { type: 'on_enter_area' }
} as unknown as SpellEffect;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createSpellZone direction policy', () => {
    it('keeps the explicit cast direction', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

        const zone = createSpellZone(
            'burning-hands',
            'caster-1',
            ORIGIN,
            { shape: 'Cone', size: 15 },
            [ENTRY_EFFECT],
            1,
            2,
            EAST
        );

        expect(zone.direction).toEqual(EAST);
        expect(info).toHaveBeenCalledWith(expect.stringContaining('cast target point'));
    });

    it('falls to the caster facing when the cast has no target point', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

        const zone = createSpellZone(
            'burning-hands',
            'caster-1',
            ORIGIN,
            { shape: 'Cone', size: 15 },
            [ENTRY_EFFECT],
            1,
            2,
            undefined,
            undefined,
            undefined,
            'north'
        );

        // North is -y on this grid.
        expect(zone.direction).toEqual({ x: 0, y: -1 });
        expect(info).toHaveBeenCalledWith(expect.stringContaining('caster facing (north)'));
    });

    it('throws when the cast has no target point and the caster has no facing', () => {
        expect(() => createSpellZone(
            'burning-hands',
            'caster-1',
            ORIGIN,
            { shape: 'Line', size: 30 },
            [ENTRY_EFFECT],
            1,
            2
        )).toThrow('Cone or line zone needs a direction: burning-hands by caster-1');
    });

    it('leaves a non-directional shape alone', () => {
        const zone = createSpellZone(
            'fireball',
            'caster-1',
            ORIGIN,
            { shape: 'Sphere', size: 20 },
            [ENTRY_EFFECT],
            1,
            2
        );

        expect(zone.direction).toBeUndefined();
    });
});

describe('cone zone containment after the facing fallback', () => {
    it('hits only the cone tiles, not the tiles behind the caster', () => {
        vi.spyOn(console, 'info').mockImplementation(() => undefined);

        const zone = createSpellZone(
            'burning-hands',
            'caster-1',
            ORIGIN,
            { shape: 'Cone', size: 15 },
            [ENTRY_EFFECT],
            1,
            2,
            undefined,
            undefined,
            undefined,
            'east'
        );

        const inFront = { x: 11, y: 10 };
        const behind = { x: 9, y: 10 };
        const beside = { x: 10, y: 13 };

        expect(isPositionInArea(inFront, zone.position, zone.areaOfEffect!, zone.direction)).toBe(true);
        expect(isPositionInArea(behind, zone.position, zone.areaOfEffect!, zone.direction)).toBe(false);
        expect(isPositionInArea(beside, zone.position, zone.areaOfEffect!, zone.direction)).toBe(false);
    });
});
