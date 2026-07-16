
/**
 * This file proves that battle setup generation is stable and safe.
 *
 * The combat screen depends on this helper to turn a seed, biome, and roster
 * into a shared tactical map with real character positions. These tests keep
 * that setup deterministic, object-aware, and able to recover when preferred
 * spawn zones are too dense for ordinary placement.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    generateProceduralSandboxBattleSetup,
    generateWorldBattleSetup,
} from '../useBattleMapGeneration';
import { createMockCombatCharacter } from '../../utils/factories';
import type { BattleMapData, BattleMapTile } from '../../types/combat';

// ============================================================================
// Dense Map Test Helpers
// ============================================================================
// This section creates tiny generated maps for edge-case placement tests.
// Building the map in the test keeps the production generator untouched while
// still proving how the setup helper behaves when its usual spawn zones fail.
// ============================================================================

const createDenseFallbackMap = (): BattleMapData => {
    const width = 10;
    const height = 10;
    const tiles = new Map<string, BattleMapTile>();

    // Start with a fully blocked battlefield so both preferred spawn zones are
    // exhausted. The center tiles below are the only legal fallback positions.
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x}-${y}`;
            tiles.set(key, {
                id: key,
                coordinates: { x, y },
                terrain: 'wall',
                elevation: 0,
                movementCost: 5,
                blocksLoS: true,
                blocksMovement: true,
                decoration: null,
                effects: []
            });
        }
    }

    // Leave a small central island walkable. This proves fallback placement can
    // move outside the preferred zone instead of dropping character positions.
    for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]]) {
        const tile = tiles.get(`${x}-${y}`)!;
        tile.terrain = 'floor';
        tile.elevation = 1;
        tile.blocksLoS = false;
        tile.blocksMovement = false;
    }

    return {
        dimensions: { width, height },
        tiles,
        targetableObjects: [],
        theme: 'dungeon',
        seed: 999
    };
};

/** Build a small referee map whose only authored surface is one real road. */
const createRoadAmbushMap = (): BattleMapData => {
    const width = 30;
    const height = 25;
    const tiles = new Map<string, BattleMapTile>();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x}-${y}`;
            tiles.set(key, {
                id: key,
                coordinates: { x, y },
                terrain: 'grass',
                elevation: 0,
                movementCost: 5,
                blocksLoS: false,
                blocksMovement: false,
                decoration: null,
                effects: [],
                ...(x >= 2 && x <= width - 3 && y === 12
                    ? {
                        surface: {
                            kind: 'road' as const,
                            source: 'worldforge-road' as const,
                            sourceRole: 'regional-route' as const,
                            sourceIndex: 3,
                            widthMeters: 4
                        }
                    }
                    : {})
            });
        }
    }

    // Blockers beside the expected flanks make nearby cells tactically useful
    // without fabricating cover inside the deployment helper itself.
    for (const [x, y] of [[13, 4], [17, 4], [13, 20], [17, 20]]) {
        const tile = tiles.get(`${x}-${y}`)!;
        tile.decoration = 'boulder';
        tile.blocksLoS = true;
        tile.blocksMovement = true;
        tile.providesCover = true;
    }

    return {
        dimensions: { width, height },
        tiles,
        targetableObjects: [],
        theme: 'forest',
        seed: 42,
        encounterContext: {
            kind: 'road-ambush',
            source: 'worldforge-road',
            sourceRoadRole: 'regional-route',
            sourceRoadIndex: 3,
            anchorTile: { x: 15, y: 12 },
            routeDirection: { x: 1, y: 0 },
            deployment: {
                player: 'traveling-column',
                enemy: 'concealed-flanks'
            }
        }
    };
};

/** Build a source-backed bridge with blocked river water on either side. */
const createRiverCrossingMap = (): BattleMapData => {
    const width = 50;
    const height = 30;
    const tiles = new Map<string, BattleMapTile>();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x}-${y}`;
            const isRiver = x >= 18 && x <= 31;
            const isRoad = y === 15;
            const isBridge = isRiver && y >= 14 && y <= 16;
            tiles.set(key, {
                id: key,
                coordinates: { x, y },
                terrain: isRiver ? 'water' : 'grass',
                elevation: 0,
                movementCost: isBridge ? 1 : isRiver ? 0 : 1,
                blocksLoS: false,
                blocksMovement: isRiver && !isBridge,
                decoration: null,
                effects: [],
                ...(isRoad || isBridge
                    ? {
                        surface: {
                            kind: 'road' as const,
                            source: 'worldforge-road' as const,
                            sourceRole: 'regional-route' as const,
                            sourceIndex: 5,
                            widthMeters: 4.5
                        }
                    }
                    : {}),
                ...(isBridge
                    ? {
                        crossing: {
                            kind: 'bridge' as const,
                            source: 'worldforge-crossing' as const,
                            sourceCrossingId: 'crossing:5:9:0',
                            roadSourceIndex: 5,
                            riverSourceIndex: 0,
                            roadDirection: { x: 1, y: 0 },
                            centerWorldMeters: { x: 25 * 1.524, z: 15 * 1.524 },
                            spanMeters: 14 * 1.524,
                            widthMeters: 4.5
                        }
                    }
                    : {})
            });
        }
    }

    return {
        dimensions: { width, height },
        tiles,
        targetableObjects: [],
        theme: 'forest',
        seed: 42,
        encounterContext: {
            kind: 'river-crossing',
            source: 'worldforge-crossing',
            sourceCrossingId: 'crossing:5:9:0',
            crossingKind: 'bridge',
            anchorTile: { x: 25, y: 15 },
            routeDirection: { x: 1, y: 0 },
            deployment: {
                player: 'near-bank',
                enemy: 'far-bank'
            }
        }
    };
};

/** Build a gate-centered settlement crop with one reserved resident cell. */
const createSettlementEdgeMap = (): BattleMapData => {
    const width = 40;
    const height = 30;
    const tiles = new Map<string, BattleMapTile>();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x}-${y}`;
            tiles.set(key, {
                id: key,
                coordinates: { x, y },
                terrain: x > 20 && y > 8 && y < 22 ? 'floor' : 'grass',
                elevation: 0,
                movementCost: 1,
                blocksLoS: false,
                blocksMovement: false,
                decoration: null,
                effects: []
            });
        }
    }

    return {
        dimensions: { width, height },
        tiles,
        targetableObjects: [],
        worldOccupants: [{
            id: 'worldforge-occupant:14:7',
            name: 'Gate Resident',
            position: { x: 15, y: 13 },
            activity: 'out',
            moving: true,
            source: {
                kind: 'worldforge-occupant',
                burgId: 14,
                occupantId: 7,
                worldMeters: { x: 100, z: 100 }
            }
        }],
        theme: 'forest',
        seed: 42,
        encounterContext: {
            kind: 'settlement-edge',
            source: 'worldforge-settlement',
            sourceBurgId: 14,
            sourceGatehouseId: 'gatehouse:14:10000:10000',
            anchorTile: { x: 20, y: 15 },
            routeDirection: { x: 1, y: 0 },
            deployment: {
                player: 'outside-approach',
                enemy: 'inside-gate'
            }
        }
    };
};

describe('useBattleMapGeneration', () => {
    it('should be deterministic when given the same seed', () => {
        const seed = 12345;
        const characters = [
            createMockCombatCharacter({ id: 'hero', team: 'player' }),
            createMockCombatCharacter({ id: 'enemy', team: 'enemy' })
        ];

        // Run 1
        const result1 = generateProceduralSandboxBattleSetup('forest', seed, characters);
        const positions1 = result1.positionedCharacters.map(c => c.position);

        // Run 2
        const result2 = generateProceduralSandboxBattleSetup('forest', seed, characters);
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
            const result = generateProceduralSandboxBattleSetup('dungeon', seed, characters);
            const posString = JSON.stringify(result.positionedCharacters.map(c => c.position));
            results.add(posString);
        }

        expect(results.size).toBe(1);
    });

    it('realizes a source road ambush as travelers on-route and enemies on both flanks', () => {
        const mapData = createRoadAmbushMap();
        const characters = [
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `p${index}`, team: 'player' })),
            ...[1, 2, 3, 4].map(index => createMockCombatCharacter({ id: `e${index}`, team: 'enemy' }))
        ];

        const first = generateWorldBattleSetup(mapData, 42, characters);
        const second = generateWorldBattleSetup(mapData, 42, characters);
        const players = first.positionedCharacters.filter(character => character.team === 'player');
        const enemies = first.positionedCharacters.filter(character => character.team === 'enemy');

        expect(first.positionedCharacters.map(character => character.position))
            .toEqual(second.positionedCharacters.map(character => character.position));
        expect(players.every(character => (
            first.mapData.tiles.get(`${character.position.x}-${character.position.y}`)?.surface?.sourceIndex === 3
        ))).toBe(true);
        expect(enemies.every(character => (
            first.mapData.tiles.get(`${character.position.x}-${character.position.y}`)?.surface == null
        ))).toBe(true);
        expect(enemies.some(character => character.position.y < 12)).toBe(true);
        expect(enemies.some(character => character.position.y > 12)).toBe(true);
        expect(new Set(first.positionedCharacters.map(character => `${character.position.x}-${character.position.y}`)).size)
            .toBe(characters.length);
    });

    it('keeps an opening party on its live anchor and uses a deterministic terrain-fit constellation', () => {
        const mapData = createRoadAmbushMap();
        mapData.encounterContext = {
            kind: 'opening-standoff',
            source: 'worldforge-opening',
            sourceReceiptId: 'opening:42:cell:476',
            sourceWorldCellId: 476,
            anchorTile: { x: 15, y: 12 },
            deployment: {
                player: 'current-position',
                enemy: 'terrain-fit-standoff-constellation'
            },
            omittedFacts: {
                enemyWorldPositions: 'not-authored',
                approachDirection: 'not-authored'
            }
        };
        const characters = [
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `opening-p${index}`, team: 'player' })),
            ...[1, 2, 3, 4].map(index => createMockCombatCharacter({ id: `opening-e${index}`, team: 'enemy' }))
        ];

        const first = generateWorldBattleSetup(mapData, 42, characters);
        const second = generateWorldBattleSetup(mapData, 42, characters);
        const players = first.positionedCharacters.filter(character => character.team === 'player');
        const enemies = first.positionedCharacters.filter(character => character.team === 'enemy');

        expect(first.positionedCharacters.map(character => character.position))
            .toEqual(second.positionedCharacters.map(character => character.position));
        expect(players[0]?.position).toEqual({ x: 15, y: 12 });
        const enemyDistances = enemies.map(character => Math.hypot(
            character.position.x - 15,
            character.position.y - 12
        ));
        const enemyCentroid = enemies.reduce((sum, character) => ({
            x: sum.x + character.position.x / enemies.length,
            y: sum.y + character.position.y / enemies.length
        }), { x: 0, y: 0 });
        expect(enemyDistances.every(distance => distance >= 4 && distance <= 8.5)).toBe(true);
        expect(Math.hypot(enemyCentroid.x - 15, enemyCentroid.y - 12)).toBeGreaterThan(2);
        expect(new Set(first.positionedCharacters.map(character => `${character.position.x}-${character.position.y}`)).size)
            .toBe(characters.length);
    });

    it('deploys a source river crossing on opposite walkable banks', () => {
        const mapData = createRiverCrossingMap();
        const characters = [
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `bridge-p${index}`, team: 'player' })),
            ...[1, 2, 3, 4].map(index => createMockCombatCharacter({ id: `bridge-e${index}`, team: 'enemy' }))
        ];

        const first = generateWorldBattleSetup(mapData, 42, characters);
        const second = generateWorldBattleSetup(mapData, 42, characters);
        const players = first.positionedCharacters.filter(character => character.team === 'player');
        const enemies = first.positionedCharacters.filter(character => character.team === 'enemy');

        expect(first.positionedCharacters.map(character => character.position))
            .toEqual(second.positionedCharacters.map(character => character.position));
        expect(players.every(character => character.position.x < 18)).toBe(true);
        expect(enemies.every(character => character.position.x > 31)).toBe(true);
        expect(first.positionedCharacters.every(character => {
            const tile = first.mapData.tiles.get(`${character.position.x}-${character.position.y}`);
            return tile && !tile.blocksMovement && !tile.crossing;
        })).toBe(true);
        expect(new Set(first.positionedCharacters.map(character => `${character.position.x}-${character.position.y}`)).size)
            .toBe(characters.length);
    });

    it('deploys a settlement approach on opposite gate sides without stacking on residents', () => {
        const mapData = createSettlementEdgeMap();
        const characters = [
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `gate-p${index}`, team: 'player' })),
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `gate-e${index}`, team: 'enemy' }))
        ];

        const first = generateWorldBattleSetup(mapData, 42, characters);
        const second = generateWorldBattleSetup(mapData, 42, characters);
        const players = first.positionedCharacters.filter(character => character.team === 'player');
        const enemies = first.positionedCharacters.filter(character => character.team === 'enemy');
        const residentCells = new Set(mapData.worldOccupants?.map((occupant) => (
            `${occupant.position.x}-${occupant.position.y}`
        )));

        expect(first.positionedCharacters.map(character => character.position))
            .toEqual(second.positionedCharacters.map(character => character.position));
        expect(players.every(character => character.position.x < 20)).toBe(true);
        expect(enemies.every(character => character.position.x > 20)).toBe(true);
        expect(first.positionedCharacters.every(character => (
            !residentCells.has(`${character.position.x}-${character.position.y}`)
        ))).toBe(true);
        expect(new Set(first.positionedCharacters.map(character => `${character.position.x}-${character.position.y}`)).size)
            .toBe(characters.length);
    });

    it('keeps a live watch confrontation at the player anchor while the watch intercepts from town', () => {
        const mapData = createSettlementEdgeMap();
        mapData.encounterContext = {
            kind: 'settlement-watch',
            source: 'worldforge-settlement',
            sourceBurgId: 14,
            sourceConfrontationId: 'talk:legium-watch',
            anchorTile: { x: 20, y: 15 },
            routeDirection: { x: 1, y: 0 },
            deployment: {
                player: 'current-position',
                enemy: 'watch-interception'
            }
        };
        const characters = [
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `watch-p${index}`, team: 'player' })),
            ...[1, 2, 3, 4].map(index => createMockCombatCharacter({ id: `watch-e${index}`, team: 'enemy' }))
        ];

        const first = generateWorldBattleSetup(mapData, 42, characters);
        const second = generateWorldBattleSetup(mapData, 42, characters);
        const players = first.positionedCharacters.filter(character => character.team === 'player');
        const enemies = first.positionedCharacters.filter(character => character.team === 'enemy');

        expect(first.positionedCharacters.map(character => character.position))
            .toEqual(second.positionedCharacters.map(character => character.position));
        expect(players.some(character => (
            character.position.x === 20 && character.position.y === 15
        ))).toBe(true);
        expect(players.every(character => character.position.x <= 20)).toBe(true);
        expect(enemies.every(character => character.position.x > 20)).toBe(true);
        expect(new Set(first.positionedCharacters.map(character => `${character.position.x}-${character.position.y}`)).size)
            .toBe(characters.length);
    });

    it('uses the same current-position formation for an honestly labeled state patrol event', () => {
        const mapData = createSettlementEdgeMap();
        mapData.encounterContext = {
            kind: 'settlement-state-patrol',
            source: 'worldforge-settlement',
            sourceBurgId: 14,
            sourceFactionId: 'worldforge-state:7',
            sourceConfrontationId: 'worldforge-state-patrol:42:829:14:7:day-12',
            anchorTile: { x: 20, y: 15 },
            routeDirection: { x: 1, y: 0 },
            deployment: {
                player: 'current-position',
                enemy: 'state-patrol-interception'
            }
        };
        const characters = [
            ...[1, 2, 3].map(index => createMockCombatCharacter({ id: `patrol-p${index}`, team: 'player' })),
            ...[1, 2, 3, 4].map(index => createMockCombatCharacter({ id: `patrol-e${index}`, team: 'enemy' }))
        ];

        const setup = generateWorldBattleSetup(mapData, 42, characters);
        const players = setup.positionedCharacters.filter(character => character.team === 'player');
        const enemies = setup.positionedCharacters.filter(character => character.team === 'enemy');

        expect(players.some(character => character.position.x === 20 && character.position.y === 15)).toBe(true);
        expect(players.every(character => character.position.x <= 20)).toBe(true);
        expect(enemies.every(character => character.position.x > 20)).toBe(true);
        expect(new Set(setup.positionedCharacters.map(character => `${character.position.x}-${character.position.y}`)).size)
            .toBe(characters.length);
    });

    it('uses the actual center of context-sized extracted maps without an encounter frame', () => {
        const mapData = createRoadAmbushMap();
        mapData.encounterContext = undefined;
        const characters = [
            createMockCombatCharacter({ id: 'center-player', team: 'player' }),
            createMockCombatCharacter({ id: 'nearby-enemy', team: 'enemy' })
        ];

        const { positionedCharacters } = generateWorldBattleSetup(mapData, 42, characters);

        expect(positionedCharacters[0].position).toEqual({ x: 15, y: 12 });
        expect(positionedCharacters[1].position).toEqual({ x: 19, y: 15 });
    });

    // Spell object targeting depends on live maps publishing object facts, not
    // later systems guessing from decorative tiles. Generated obstacles are
    // fixed map features, so the generator should expose them as explicit
    // object candidates while still marking them as fixed-to-surface.
    it('publishes generated obstacles as explicit fixed map object candidates', () => {
        const { mapData } = generateProceduralSandboxBattleSetup('forest', 24680, []);

        const decoratedTiles = [...mapData.tiles.values()].filter(tile => tile.decoration);
        const targetableObjects = mapData.targetableObjects ?? [];

        expect(decoratedTiles.length).toBeGreaterThan(0);
        expect(targetableObjects.length).toBe(decoratedTiles.length);
        expect(targetableObjects.every(targetObject => targetObject.isFixedToSurface)).toBe(true);
        expect(targetableObjects.every(targetObject => targetObject.isWornOrCarried === false)).toBe(true);
        expect(targetableObjects.every(targetObject => targetObject.isMagical === false)).toBe(true);

        for (const targetObject of targetableObjects) {
            const sourceTile = mapData.tiles.get(`${targetObject.position.x}-${targetObject.position.y}`);

            expect(sourceTile?.decoration).not.toBeNull();
            expect(targetObject.id).toContain(sourceTile!.id);
            expect(targetObject.name).toContain(sourceTile!.decoration!.replace('_', ' '));
        }
    });

    // Battle-map G6 / GOAL #64 (task 74): spawns prefer tactically valuable
    // terrain — high ground and cover-adjacent tiles — over open ground.
    it('places characters on tiles scoring at least the zone average (tactical spawn scoring)', () => {
        const seed = 424242;
        const characters = [
            ...[1, 2, 3, 4].map(i => createMockCombatCharacter({ id: `p${i}`, team: 'player' })),
            ...[1, 2, 3, 4].map(i => createMockCombatCharacter({ id: `e${i}`, team: 'enemy' })),
        ];
        const { mapData, positionedCharacters } = generateProceduralSandboxBattleSetup('desert', seed, characters);

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
            const { mapData, positionedCharacters } = generateProceduralSandboxBattleSetup('desert', seed, characters);
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

    it('keeps 120x90 tactical spawn generation within the documented budget', () => {
        const characters = [
            ...[1, 2, 3, 4, 5, 6].map(i => createMockCombatCharacter({ id: `p${i}`, team: 'player' })),
            ...[1, 2, 3, 4, 5, 6].map(i => createMockCombatCharacter({ id: `e${i}`, team: 'enemy' }))
        ];

        // Measure only the setup call. Vitest import and transform time is not
        // part of the gameplay budget; the budget scales with tile count
        // (40x30 <=50ms → 80x60 <=200ms → 120x90 <=450ms, 2026-07-06).
        const startedAt = performance.now();
        const { mapData, positionedCharacters } = generateProceduralSandboxBattleSetup('forest', 13579, characters);
        const durationMs = performance.now() - startedAt;

        expect(mapData.dimensions).toEqual({ width: 120, height: 90 });
        expect(positionedCharacters.every(character => character.position)).toBe(true);
        expect(durationMs).toBeLessThanOrEqual(450);
    });

    it('falls back to nearest walkable tiles when preferred spawn zones are exhausted', async () => {
        // Mock only the procedural generator for this test. The setup helper
        // still runs its real spawn-zone logic, which is the behavior under
        // proof for dense generated maps.
        vi.resetModules();
        vi.doMock('../../services/battleMapGenerator', () => ({
            BattleMapGenerator: class {
                generate() {
                    return createDenseFallbackMap();
                }
            }
        }));

        const { generateProceduralSandboxBattleSetup: generateWithDenseMap } = await import('../useBattleMapGeneration');
        const characters = [
            createMockCombatCharacter({ id: 'p1', team: 'player' }),
            createMockCombatCharacter({ id: 'p2', team: 'player' }),
            createMockCombatCharacter({ id: 'e1', team: 'enemy' }),
            createMockCombatCharacter({ id: 'e2', team: 'enemy' })
        ];

        const { positionedCharacters, mapData } = generateWithDenseMap('dungeon', 999, characters);
        const positions = positionedCharacters.map(character => character.position);

        // Every character must get a real walkable tile even when the normal
        // side/corner zones have no legal candidates.
        expect(positions.every(Boolean)).toBe(true);
        expect(new Set(positions.map(position => `${position!.x}-${position!.y}`)).size).toBe(characters.length);

        for (const position of positions) {
            const tile = mapData.tiles.get(`${position!.x}-${position!.y}`);
            expect(tile?.blocksMovement).toBe(false);
        }

        vi.doUnmock('../../services/battleMapGenerator');
        vi.resetModules();
    });
});
