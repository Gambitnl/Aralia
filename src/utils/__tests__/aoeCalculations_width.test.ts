
import { describe, it, expect } from 'vitest';
import { calculateAffectedTiles } from '../aoeCalculations';

describe('AoE Calculations - Line Width', () => {
    it('generates a 1-tile wide line for 5ft width (East)', () => {
        const origin = { x: 0, y: 0 };
        const tiles = calculateAffectedTiles({
            shape: 'Line',
            origin,
            size: 30,
            direction: 90, // East
            width: 5
        });

        // At x=5 (5ft away)
        // Should be just y=0
        const width = tiles.filter(t => t.x === 1).length;
        expect(width).toBe(1);
    });

    it('generates 2-tile wide line for 10ft width (East) with even-width fix', () => {
        const origin = { x: 0, y: 0 };
        const tiles = calculateAffectedTiles({
            shape: 'Line',
            origin,
            size: 30,
            direction: 90, // East
            width: 10
        });

        // 10ft width = radius 5.
        // With offset 0.5 tiles (2.5ft):
        // Center becomes y=0.5.
        // y=0: dist 2.5ft (<=5). In.
        // y=1: dist 2.5ft (<=5). In.
        // y=-1: dist 7.5ft (>5). Out.
        // So 2 tiles.
        const width = tiles.filter(t => t.x === 1).length;

        expect(width).toBe(2);
    });

    it('generates 4-tile wide line for 20ft width (East) with even-width fix', () => {
        const origin = { x: 0, y: 0 };
        const tiles = calculateAffectedTiles({
            shape: 'Line',
            origin,
            size: 30,
            direction: 90, // East
            width: 20
        });

        // 20ft width = 4 tiles.
        const width = tiles.filter(t => t.x === 1).length;
        expect(width).toBe(4);
    });
});
