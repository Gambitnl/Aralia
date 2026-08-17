/**
 * @file src/systems/combat/worldScenario/__tests__/battlefieldViability.test.ts
 *
 * Pins the gate that refuses an unfightable crop.
 *
 * The case that forced it, measured live on 2026-08-16: a 40x30 crop came back
 * 1163 water to 37 grass, the standoff-ring check passed anyway, and the whole
 * fight landed in one corner of an ocean. These tests reproduce that shape and
 * prove it is now refused with its real numbers.
 */
import { describe, expect, it } from 'vitest';
import {
    assessBattlefieldViability,
    MIN_WALKABLE_POCKET_TILES,
} from '../battlefieldViability';
import type { BattleMapData, BattleMapTile } from '../../../../types/combat';

/** Build a crop where `walkable(x, y)` decides each tile. */
function crop(
    width: number,
    height: number,
    walkable: (x: number, y: number) => boolean,
): BattleMapData {
    const tiles = new Map<string, BattleMapTile>();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ok = walkable(x, y);
            tiles.set(`${x}-${y}`, {
                id: `${x}-${y}`,
                coordinates: { x, y },
                terrain: ok ? 'grass' : 'water',
                elevation: 0,
                movementCost: ok ? 1 : 0,
                blocksLoS: false,
                blocksMovement: !ok,
                decoration: null,
                effects: [],
            } as BattleMapTile);
        }
    }
    return { dimensions: { width, height }, tiles, theme: 'forest', seed: 1 } as BattleMapData;
}

const tileAt = (map: BattleMapData, x: number, y: number) => map.tiles.get(`${x}-${y}`)!;

describe('assessBattlefieldViability', () => {
    it('accepts open ground', () => {
        const map = crop(40, 30, () => true);
        const result = assessBattlefieldViability(map, tileAt(map, 20, 15));

        expect(result.viable).toBe(true);
        expect(result.pocketTiles).toBe(1200);
        expect(result.reason).toBe('');
    });

    it('refuses the ocean sandbar that shipped a broken fight', () => {
        // A 6x6 patch of grass in a 40x30 sea: 36 walkable of 1200.
        const map = crop(40, 30, (x, y) => x >= 34 && x <= 39 && y >= 16 && y <= 21);
        const result = assessBattlefieldViability(map, tileAt(map, 36, 18));

        expect(result.viable).toBe(false);
        expect(result.pocketTiles).toBe(36);
        expect(result.walkableTiles).toBe(36);
        expect(result.totalTiles).toBe(1200);
    });

    it('states the real numbers in the refusal, not a vague message', () => {
        const map = crop(40, 30, (x, y) => x >= 34 && x <= 39 && y >= 16 && y <= 21);
        const result = assessBattlefieldViability(map, tileAt(map, 36, 18));

        // A player or a maintainer must be able to see WHY from the text alone.
        expect(result.reason).toContain('36 connected walkable tile(s)');
        expect(result.reason).toContain(`${MIN_WALKABLE_POCKET_TILES} needed`);
        expect(result.reason).toContain('36 of 1200');
        expect(result.reason).toContain('3%');
    });

    it('counts only ground the player can WALK to, not every walkable tile', () => {
        // Two pockets: a small one holding the player, and a big island the
        // player cannot reach. Tile tallies would pass this; a fight cannot.
        const map = crop(40, 30, (x, y) => {
            const playerPocket = x <= 3 && y <= 3;
            const unreachableIsland = x >= 20 && y >= 10;
            return playerPocket || unreachableIsland;
        });
        const result = assessBattlefieldViability(map, tileAt(map, 1, 1));

        expect(result.pocketTiles).toBe(16);
        expect(result.walkableTiles).toBeGreaterThan(MIN_WALKABLE_POCKET_TILES);
        expect(result.viable).toBe(false);
    });

    it('reaches diagonally, matching the movement rules the referee uses', () => {
        // Two blocks joined only at a corner. An orthogonal-only fill would see
        // 25 tiles and refuse; the referee allows the diagonal step, so it is 50.
        const map = crop(40, 30, (x, y) => {
            const a = x <= 4 && y <= 4;
            const b = x >= 5 && x <= 9 && y >= 5 && y <= 9;
            return a || b;
        });
        const result = assessBattlefieldViability(map, tileAt(map, 0, 0));

        expect(result.pocketTiles).toBe(50);
        expect(result.viable).toBe(true);
    });

    it('accepts a pocket exactly at the threshold', () => {
        const map = crop(40, 30, (x, y) => x < 8 && y < 5);
        const result = assessBattlefieldViability(map, tileAt(map, 0, 0));

        expect(result.pocketTiles).toBe(MIN_WALKABLE_POCKET_TILES);
        expect(result.viable).toBe(true);
    });

    it('refuses a pocket one tile under the threshold', () => {
        const map = crop(40, 30, (x, y) => (x < 8 && y < 5) && !(x === 7 && y === 4));
        const result = assessBattlefieldViability(map, tileAt(map, 0, 0));

        expect(result.pocketTiles).toBe(MIN_WALKABLE_POCKET_TILES - 1);
        expect(result.viable).toBe(false);
    });
});
