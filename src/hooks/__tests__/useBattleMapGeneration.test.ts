
import { describe, it, expect } from 'vitest';
import { generateBattleSetup } from '../useBattleMapGeneration';
import { createMockCombatCharacter } from '../../utils/factories';

describe('useBattleMapGeneration', () => {
    it('should be deterministic when given the same seed', () => {
        const seed = 12345;
        const characters = [
            createMockCombatCharacter({ id: 'hero', team: 'player' }),
            createMockCombatCharacter({ id: 'enemy', team: 'enemy' })
        ];

        // Run 1
        const result1 = generateBattleSetup('forest', seed, characters);
        const positions1 = result1.positionedCharacters.map(c => c.position);

        // Run 2
        const result2 = generateBattleSetup('forest', seed, characters);
        const positions2 = result2.positionedCharacters.map(c => c.position);

        expect(positions1).toEqual(positions2);
    });

    it('should be deterministic across multiple runs with shuffle', () => {
        const seed = 67890;
        const characters = [
            createMockCombatCharacter({ id: 'p1', team: 'player' }),
            createMockCombatCharacter({ id: 'p2', team: 'player' }),
            createMockCombatCharacter({ id: 'e1', team: 'enemy' }),
            createMockCombatCharacter({ id: 'e2', team: 'enemy' })
        ];

        const results = new Set<string>();

        // Run 10 times, all should yield exactly the same positions
        for (let i = 0; i < 10; i++) {
            const result = generateBattleSetup('dungeon', seed, characters);
            const posString = JSON.stringify(result.positionedCharacters.map(c => c.position));
            results.add(posString);
        }

        expect(results.size).toBe(1);
    });

    // Battle-map G6 / GOAL #64 (task 74): spawns prefer tactically valuable
    // terrain — high ground and cover-adjacent tiles — over open ground.
    it('places characters on tiles scoring at least the zone average (tactical spawn scoring)', () => {
        const seed = 424242;
        const characters = [
            ...[1, 2, 3, 4].map(i => createMockCombatCharacter({ id: `p${i}`, team: 'player' })),
            ...[1, 2, 3, 4].map(i => createMockCombatCharacter({ id: `e${i}`, team: 'enemy' })),
        ];
        const { mapData, positionedCharacters } = generateBattleSetup('desert', seed, characters);

        // Recompute the same score the generator uses.
        const score = (x: number, y: number): number => {
            const tile = mapData.tiles.get(`${x}-${y}`)!;
            let coverNeighbors = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const n = mapData.tiles.get(`${x + dx}-${y + dy}`);
                    if (n && (n.blocksMovement || n.blocksLoS || n.providesCover)) coverNeighbors++;
                }
            }
            const coverScore = coverNeighbors === 0 ? 0 : coverNeighbors <= 2 ? 3 : coverNeighbors <= 4 ? 1 : -2;
            return tile.elevation * 2 + coverScore + (tile.providesCover ? 1 : 0);
        };

        const walkable = [...mapData.tiles.values()].filter(t => !t.blocksMovement);
        const zoneMean = walkable.reduce((s, t) => s + score(t.coordinates.x, t.coordinates.y), 0) / walkable.length;
        const spawnScores = positionedCharacters
            .filter(c => c.position)
            .map(c => score(c.position.x, c.position.y));
        const spawnMean = spawnScores.reduce((s, v) => s + v, 0) / spawnScores.length;

        // Scored placement must beat the map-wide average; random-in-zone
        // placement (the old behavior) hovers at the average by construction.
        expect(spawnMean).toBeGreaterThan(zoneMean);
    });

    it('keeps the teams in separated zones despite tactical scoring', () => {
        const characters = [
            ...[1, 2, 3, 4].map(i => createMockCombatCharacter({ id: `p${i}`, team: 'player' })),
            ...[1, 2, 3, 4].map(i => createMockCombatCharacter({ id: `e${i}`, team: 'enemy' })),
        ];
        // Several seeds → several spawn configs; centroids must stay far apart
        // in all of them (scoring sorts WITHIN a zone, never across zones).
        for (const seed of [424242, 12345, 67890, 9, 31337]) {
            const { mapData, positionedCharacters } = generateBattleSetup('desert', seed, characters);
            const centroid = (team: string) => {
                const ps = positionedCharacters.filter(c => c.team === team && c.position);
                return {
                    x: ps.reduce((s, c) => s + c.position.x, 0) / ps.length,
                    y: ps.reduce((s, c) => s + c.position.y, 0) / ps.length,
                };
            };
            const p = centroid('player');
            const e = centroid('enemy');
            const dist = Math.hypot(p.x - e.x, p.y - e.y);
            const mapDiag = Math.hypot(mapData.dimensions.width, mapData.dimensions.height);
            expect(dist).toBeGreaterThan(mapDiag * 0.3);
        }
    });
});
