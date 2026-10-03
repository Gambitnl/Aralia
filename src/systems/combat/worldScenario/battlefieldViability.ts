/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/combat/worldScenario/battlefieldViability.ts
 *
 * Asks the question nothing else asked: is this crop a place a fight can happen?
 *
 * The projector used to accept a battlefield on one check — that the ring 4.5 to
 * 9 tiles from the player held enough walkable tiles to seat the enemy roster.
 * A crop can pass that and still be unfightable. Measured live on 2026-08-16:
 * a 40x30 crop (1200 tiles) came back with 1163 water tiles and 37 grass. Every
 * water tile blocks movement, so 3% of the board was standable. Two grass tiles
 * happened to fall in the standoff ring, so the fight launched, and all four
 * combatants ended up jammed into one corner of an ocean.
 *
 * This gate measures the pocket of connected walkable ground the player actually
 * stands in. Scattered islands do not count: ground you cannot walk to is not
 * room to fight in, so the measure is a flood fill, not a tile tally.
 *
 * NO FALLBACK: an unfightable crop is refused with its real numbers. It is never
 * quietly patched, widened, or swapped for open ground somewhere else.
 */
import type { BattleMapData, BattleMapTile } from '../../../types/combat';

/**
 * Smallest connected walkable pocket that can host a fight, in tiles.
 *
 * One tile is 5 ft. A creature with a 30 ft move crosses 6 tiles in one turn, so
 * a pocket under this size cannot hold a single round of ordinary movement for
 * two sides. 40 tiles is a pocket of roughly 6 by 7.
 */
export const MIN_WALKABLE_POCKET_TILES = 40;

export interface BattlefieldViability {
    viable: boolean;
    /** Walkable tiles reachable on foot from the player's anchor. */
    pocketTiles: number;
    /** Walkable tiles anywhere in the crop, reachable or not. */
    walkableTiles: number;
    totalTiles: number;
    /** Player-facing cause when `viable` is false; empty when viable. */
    reason: string;
}

function tileKey(x: number, y: number): string {
    return `${x}-${y}`;
}

/**
 * Measure the fightable ground around an anchor.
 *
 * @param mapData - The extracted tactical crop.
 * @param anchor - The tile the player occupies.
 */
export function assessBattlefieldViability(
    mapData: BattleMapData,
    anchor: BattleMapTile,
): BattlefieldViability {
    const totalTiles = mapData.tiles.size;
    const walkableTiles = [...mapData.tiles.values()].filter((t) => !t.blocksMovement).length;

    // Flood fill from the anchor across the 8 neighbors the movement rules use,
    // so the pocket measured here is the same ground the referee would let a
    // combatant walk.
    const seen = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [anchor.coordinates];
    seen.add(tileKey(anchor.coordinates.x, anchor.coordinates.y));
    let pocketTiles = 0;

    while (queue.length > 0) {
        const current = queue.pop()!;
        pocketTiles += 1;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = current.x + dx;
                const ny = current.y + dy;
                const key = tileKey(nx, ny);
                if (seen.has(key)) continue;
                const neighbor = mapData.tiles.get(key);
                if (!neighbor || neighbor.blocksMovement) continue;
                seen.add(key);
                queue.push({ x: nx, y: ny });
            }
        }
    }

    if (pocketTiles < MIN_WALKABLE_POCKET_TILES) {
        const percent = totalTiles > 0 ? Math.round((walkableTiles / totalTiles) * 100) : 0;
        return {
            viable: false,
            pocketTiles,
            walkableTiles,
            totalTiles,
            reason:
                `only ${pocketTiles} connected walkable tile(s) around the player `
                + `(${MIN_WALKABLE_POCKET_TILES} needed). The crop is ${walkableTiles} of `
                + `${totalTiles} tiles walkable (${percent}%), so there is no room to fight here.`,
        };
    }

    return { viable: true, pocketTiles, walkableTiles, totalTiles, reason: '' };
}
