import { describe, expect, it } from 'vitest';
import { isPositionInArea } from '../triggerHandler';
import { AoECalculator } from '../../targeting/AoECalculator';
import type { Position } from '../../../../types/combat';

/**
 * Locks in the direction-aware half of the old TODO #977/#978 markers.
 *
 * `isPositionInArea` is the containment predicate every persistent spell zone
 * uses -- entry, exit, start/end turn, move-within, proximity, the battle map
 * overlay, the VFX layer, and resistance lookups all call it. The markers said
 * its Cone and Line checks were "direction-agnostic (distance only)". That is
 * only true for a zone with no `direction`: when one is supplied the predicate
 * delegates to `AoECalculator.containsTile`, which delegates in turn to the
 * canonical `src/utils/combat/aoeCalculations.ts` geometry.
 *
 * These tests assert the delegation for real (parity with the calculator, and a
 * tile whose verdict the old fallback got WRONG), and pin the current policy
 * for a directional zone that carries no direction.
 *
 * GG-201 is closed by the ruling of 2026-09-13 (Q2): a cone or a line zone
 * always gets a direction at creation, from the cast target point or from the
 * caster facing. The permissive distance-only fallback is deleted, thus a
 * directionless cone or line zone now throws.
 */

const CENTER: Position = { x: 10, y: 10 };
const EAST: Position = { x: 1, y: 0 };
const NORTH: Position = { x: 0, y: -1 };

/** Every tile in a square window around the zone origin. */
function tilesAround(center: Position, reach: number): Position[] {
    const tiles: Position[] = [];
    for (let dx = -reach; dx <= reach; dx++) {
        for (let dy = -reach; dy <= reach; dy++) {
            tiles.push({ x: center.x + dx, y: center.y + dy });
        }
    }
    return tiles;
}

describe('isPositionInArea direction-aware AoE delegation', () => {
    it('resolves a directed Cone through the shared AoE geometry, not the distance fallback', () => {
        const aoe = { shape: 'Cone', size: 15 };

        // Parity over the whole neighbourhood: the predicate IS the calculator.
        for (const tile of tilesAround(CENTER, 4)) {
            expect(
                isPositionInArea(tile, CENTER, aoe, EAST),
                `cone tile ${tile.x},${tile.y}`
            ).toBe(AoECalculator.containsTile(tile, CENTER, { shape: 'Cone', size: 15 }, EAST));
        }

        // A tile directly BEHIND an east-facing cone. The old distance-only
        // fallback accepts it (dx = 2 <= 3 tiles and |dy| = 0 <= dx), so this
        // assertion fails the moment the delegation is removed.
        expect(isPositionInArea({ x: 8, y: 10 }, CENTER, aoe, EAST)).toBe(false);

        // ...and a tile straight ahead is still inside, so the cone is not
        // simply rejecting everything.
        expect(isPositionInArea({ x: 11, y: 10 }, CENTER, aoe, EAST)).toBe(true);
    });

    it('resolves a directed Line through the shared AoE geometry, not the distance fallback', () => {
        const aoe = { shape: 'Line', size: 15 };

        for (const tile of tilesAround(CENTER, 4)) {
            expect(
                isPositionInArea(tile, CENTER, aoe, NORTH),
                `line tile ${tile.x},${tile.y}`
            ).toBe(AoECalculator.containsTile(tile, CENTER, { shape: 'Line', size: 15 }, NORTH));
        }

        // A north-facing line runs along -y. The old fallback required dy === 0,
        // so it got every tile of a vertical line wrong.
        expect(isPositionInArea({ x: 10, y: 9 }, CENTER, aoe, NORTH)).toBe(true);

        // A tile beside the line is out, which the fallback also got wrong in
        // the other direction (dx <= size, dy === 0 accepted the whole row).
        expect(isPositionInArea({ x: 12, y: 10 }, CENTER, aoe, NORTH)).toBe(false);
    });

    it('resolves non-directional shapes through the shared geometry with or without a direction', () => {
        const sphere = { shape: 'Sphere', size: 10 };

        for (const tile of tilesAround(CENTER, 4)) {
            const expected = AoECalculator.containsTile(tile, CENTER, { shape: 'Sphere', size: 10 }, undefined);
            expect(isPositionInArea(tile, CENTER, sphere), `sphere tile ${tile.x},${tile.y}`).toBe(expected);
            expect(isPositionInArea(tile, CENTER, sphere, EAST), `sphere+dir tile ${tile.x},${tile.y}`).toBe(expected);
        }
    });
});

describe('isPositionInArea for a directional zone with no direction (GG-201, resolved)', () => {
    it('cannot delegate, because the shared geometry refuses a Cone or Line without a direction', () => {
        expect(() => AoECalculator.containsTile({ x: 11, y: 10 }, CENTER, { shape: 'Cone', size: 15 })).toThrow(
            /Cone requires direction/
        );
        expect(() => AoECalculator.containsTile({ x: 11, y: 10 }, CENTER, { shape: 'Line', size: 15 })).toThrow(
            /Line requires direction/
        );
    });

    it('throws instead of widening the area, because the permissive fallback is deleted', () => {
        const cone = { shape: 'Cone', size: 15 };
        const line = { shape: 'Line', size: 15 };

        // Ruling 2026-09-13 (Q2): a cone or a line zone always gets a direction
        // at creation, thus a zone that reaches this function without one is a
        // defect. The old symmetric fan and whole-row line are gone.
        expect(() => isPositionInArea({ x: 8, y: 10 }, CENTER, cone)).toThrow(
            /Cone or line zone needs a direction/
        );
        expect(() => isPositionInArea({ x: 8, y: 10 }, CENTER, line)).toThrow(
            /Cone or line zone needs a direction/
        );

        // A directed cone still answers normally.
        expect(isPositionInArea({ x: 8, y: 10 }, CENTER, cone, EAST)).toBe(false);
        expect(isPositionInArea({ x: 11, y: 10 }, CENTER, cone, EAST)).toBe(true);
    });

    it('keeps cube-like containment for a shape string the normalizer does not recognize', () => {
        // Unknown, non-directional shapes must not throw; they keep the
        // historical cube-like containment test.
        const wall = { shape: 'Wall', size: 15 };
        expect(isPositionInArea({ x: 11, y: 11 }, CENTER, wall)).toBe(true);
        expect(isPositionInArea({ x: 14, y: 10 }, CENTER, wall)).toBe(false);
    });
});
