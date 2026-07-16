/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/__tests__/worldReducer.test.ts
 * Tests for the worldReducer.
 */

import { describe, it, expect, vi } from 'vitest';
import { worldReducer } from '../worldReducer';
import { GameState, MapData } from '../../../types';
import { WeatherState } from '../../../types/environment';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/factories';
import { createEmptyHistory } from '../../../utils/historyUtils';
import * as WeatherSystem from '../../../systems/environment/WeatherSystem';
import type { AppAction } from '../../actionTypes';
import type { WorldDelta } from '../../../systems/worldforge/delta/types';

// Mock WorldEventManager to avoid RNG and check integration
vi.mock('../../../systems/world/WorldEventManager', () => ({
    processWorldEvents: vi.fn((state, _daysPassed) => ({
        state: {
            ...state,
            factions: {
                ...state.factions,
                moon: {
                    id: 'moon',
                    name: 'Moon',
                    description: 'A mock daily-simulation faction.',
                    type: 'GOVERNMENT',
                    colors: { primary: '#111111', secondary: '#eeeeee' },
                    ranks: [],
                    allies: [],
                    enemies: [],
                    rivals: [],
                    relationships: {},
                    values: [],
                    hates: [],
                    power: 61,
                    assets: [],
                    treasury: 0,
                    taxRate: 0,
                    controlledRegionIds: [],
                    controlledRouteIds: [],
                    economicPolicy: 'mercantile',
                    tradeGoodPriorities: [],
                }
            },
            playerFactionStandings: {
                ...state.playerFactionStandings,
                moon: {
                    factionId: 'moon',
                    publicStanding: 42,
                    secretStanding: 7,
                    rankId: 'ally',
                    favorsOwed: 1,
                    joinedDate: 1704103200000,
                    renown: 9,
                    history: [],
                }
            },
            economy: {
                ...state.economy,
                activeEvents: [{
                    id: 'event-surplus-moon',
                    type: 'SURPLUS',
                    startTime: 1704103200000,
                    duration: 3,
                    intensity: 1,
                }]
            },
            activeRumors: [{
                id: 'rumor-moon',
                text: 'Daily simulation rumor survives the reducer boundary.',
                type: 'misc',
                timestamp: 19724,
                expiration: 19730,
                spreadDistance: 0,
                virality: 0.5,
            }],
            worldHistory: createEmptyHistory(),
            dynamicNPCs: {
                watchful_hunter: {
                    id: 'watchful_hunter',
                    name: 'Watchful Hunter',
                } as never,
            },
            pendingCouriers: [{
                id: 'courier-moon',
                sourceRegionId: 'moon-landing',
                deliveryDay: 19725,
                messageText: 'Moon courier delivery survives the reducer boundary.',
                accuracy: 1,
                type: 'market_intel',
            }],
        } as GameState,
        logs: [{ id: 1, text: 'Mock World Event', sender: 'system', timestamp: new Date() }]
    }))
}));

afterEach(() => {
    vi.restoreAllMocks();
});

describe('worldReducer', () => {
    // ============================================================================
    // Reducer Payload Contracts
    // ============================================================================
    // Grid retirement: the SET_MAP_DATA action + the minimap-focus-from-mapData
    // test are removed — the 30x20 mapData grid no longer exists in game state.
    // The inspected-tile-description test was removed with the legacy 2D submap
    // view (UPDATE_INSPECTED_TILE_DESCRIPTION action + state field retired).

    // ============================================================================
    // Ground Position Persistence
    // ============================================================================
    // Ground mode uses tile-local meters, not the continent-meter coordinate space
    // stored in playerWorldPos. These tests keep that save contract separate so a
    // resume cannot accidentally feed ground camera coordinates into atlas travel.
    // ============================================================================

    it('sets, replaces, and clears the player ground position immutably', () => {
        const firstPosition = { tileX: 12, tileY: 7, xM: 128.5, zM: 384.25 };
        const secondPosition = { tileX: 12, tileY: 7, xM: 256.75, zM: 192.5 };
        const baseState = createMockGameState({
            playerGroundPos: null,
        });

        // Setting a position should produce a new state slice while leaving the
        // original state empty for callers that still hold the old object.
        const setAction: AppAction = {
            type: 'SET_PLAYER_GROUND_POS',
            payload: { position: firstPosition },
        };
        const setResult = worldReducer(baseState, setAction);

        expect(setResult.playerGroundPos).toEqual(firstPosition);
        expect(setResult.playerGroundPos).not.toBe(firstPosition);
        expect(baseState.playerGroundPos).toBeNull();

        // Replacing the position should overwrite the old camera anchor instead
        // of appending a movement history or merging partial coordinates.
        const replaceAction: AppAction = {
            type: 'SET_PLAYER_GROUND_POS',
            payload: { position: secondPosition },
        };
        const replaceResult = worldReducer(
            { ...baseState, playerGroundPos: setResult.playerGroundPos },
            replaceAction
        );

        expect(replaceResult.playerGroundPos).toEqual(secondPosition);
        expect(replaceResult.playerGroundPos).not.toBe(setResult.playerGroundPos);

        // Clearing the position leaves the separate continent-space playerWorldPos
        // untouched; renderer wiring decides when to synchronize those domains.
        const clearAction: AppAction = {
            type: 'SET_PLAYER_GROUND_POS',
            payload: { position: null },
        };
        const clearResult = worldReducer(
            { ...baseState, playerGroundPos: replaceResult.playerGroundPos },
            clearAction
        );

        expect(clearResult.playerGroundPos).toBeNull();
    });

    // ------------------------------------------------------------------------
    // Stage 3 (cell-native world): SET_PLAYER_GROUND_POS also mirrors the new
    // position into playerCell.localeCoords as continuous Locale FEET, so the
    // 2D Locale view and 3D ground view stay synced through one reducer. The
    // legacy playerGroundPos write is byte-identical to before (compat guard).
    // ------------------------------------------------------------------------

    it('SET_PLAYER_GROUND_POS mirrors the position into playerCell.localeCoords as feet', () => {
        // 1.524 m = 5 ft; 3.048 m = 10 ft.
        const position = { tileX: 4, tileY: 9, xM: 1.524, zM: 3.048 };
        const baseState = createMockGameState({
            playerGroundPos: null,
            playerCell: { cellId: 77, localeCoords: { x: 15, y: 10 } },
        });

        const result = worldReducer(baseState, {
            type: 'SET_PLAYER_GROUND_POS',
            payload: { position },
        });

        // Compat guard: playerGroundPos write is unchanged.
        expect(result.playerGroundPos).toEqual(position);

        // Feet mirror, cell preserved.
        expect(result.playerCell).toBeDefined();
        expect(result.playerCell!.cellId).toBe(77);
        expect(result.playerCell!.localeCoords).not.toBeNull();
        expect(result.playerCell!.localeCoords!.x).toBeCloseTo(5, 9);
        expect(result.playerCell!.localeCoords!.y).toBeCloseTo(10, 9);
    });

    it('SET_PLAYER_GROUND_POS is a no-op on playerCell when none is recorded yet', () => {
        const baseState = createMockGameState({ playerGroundPos: null, playerCell: null });
        const result = worldReducer(baseState, {
            type: 'SET_PLAYER_GROUND_POS',
            payload: { position: { tileX: 1, tileY: 2, xM: 5, zM: 5 } },
        });
        expect(result.playerGroundPos).toEqual({ tileX: 1, tileY: 2, xM: 5, zM: 5 });
        // playerCell stays null (honest unknown) — the mirror does not invent a cell.
        expect(result.playerCell ?? null).toBeNull();
    });

    it('SET_PLAYER_GROUND_POS clear (null) leaves playerCell untouched', () => {
        const playerCell = { cellId: 12, localeCoords: { x: 3, y: 4 } };
        const baseState = createMockGameState({
            playerGroundPos: { tileX: 0, tileY: 0, xM: 9, zM: 9 },
            playerCell,
        });
        const result = worldReducer(baseState, {
            type: 'SET_PLAYER_GROUND_POS',
            payload: { position: null },
        });
        expect(result.playerGroundPos).toBeNull();
        // The cell presence outlives a transient ground-anchor clear.
        expect(result.playerCell ?? playerCell).toEqual(playerCell);
    });

    it('REVEAL_HIDDEN_SITE records a discovered hidden place (by cell), deduped by id', () => {
        const a = { id: 'hp:2', cellId: 34, name: 'Cave', kind: 'cave' };
        const b = { id: 'hp:5', cellId: 71, name: 'Ruins', kind: 'ruin' };
        const baseState = createMockGameState({ discoveredHiddenSites: [] });
        const first = worldReducer(baseState, { type: 'REVEAL_HIDDEN_SITE', payload: a });
        expect(first.discoveredHiddenSites).toEqual([a]);

        // Re-revealing the same id is idempotent (no duplicate, empty slice).
        const again = worldReducer(
            { ...baseState, discoveredHiddenSites: first.discoveredHiddenSites! },
            { type: 'REVEAL_HIDDEN_SITE', payload: { ...a } },
        );
        expect(again.discoveredHiddenSites).toBeUndefined();

        // A different id appends.
        const second = worldReducer(
            { ...baseState, discoveredHiddenSites: [a] },
            { type: 'REVEAL_HIDDEN_SITE', payload: b },
        );
        expect(second.discoveredHiddenSites).toEqual([a, b]);
    });

    it('DUNGEON_CLEARED records a cleared site (by sitePath), deduped, round-trips (Task 8)', () => {
        const pathA = 'wf:7/cell:34/dungeon:m2';
        const pathB = 'wf:7/burg:5/dungeon:crypt';
        const baseState = createMockGameState({});
        // Default uncleared: nothing tracked yet.
        expect(baseState.clearedDungeons ?? []).toEqual([]);

        const first = worldReducer(baseState, { type: 'DUNGEON_CLEARED', payload: { sitePath: pathA } });
        expect(first.clearedDungeons).toEqual([pathA]);

        // Re-clearing the same path is idempotent (empty slice, no duplicate).
        const again = worldReducer(
            { ...baseState, clearedDungeons: first.clearedDungeons! },
            { type: 'DUNGEON_CLEARED', payload: { sitePath: pathA } },
        );
        expect(again.clearedDungeons).toBeUndefined();

        // A different path appends.
        const second = worldReducer(
            { ...baseState, clearedDungeons: [pathA] },
            { type: 'DUNGEON_CLEARED', payload: { sitePath: pathB } },
        );
        expect(second.clearedDungeons).toEqual([pathA, pathB]);
    });

    // ============================================================================
    // ADD_RUMORS — living-world chronicle → tavern-gossip bridge
    // ============================================================================
    // The reducer appends rumors but dedups BY ID, so re-running the chronicle sync
    // on the same town news never grows activeRumors. The TavernGossipSystem reads
    // activeRumors directly; this bridge only feeds it.
    // ============================================================================

    it('ADD_RUMORS dedups by id — dispatching the same rumors twice adds them once', () => {
        const rumors = [
            { id: 'chronicle-coord_3_4-1', text: 'Market boomed.', type: 'market' as const, timestamp: 100, expiration: 130 },
            { id: 'chronicle-coord_3_4-2', text: 'A flood struck.', type: 'event' as const, timestamp: 101, expiration: 131 },
        ];
        const baseState = createMockGameState({ activeRumors: [] });

        const first = worldReducer(baseState, { type: 'ADD_RUMORS', payload: { rumors } });
        expect(first.activeRumors).toEqual(rumors);

        // Re-dispatching the identical rumors is idempotent (empty slice, no growth).
        const again = worldReducer(
            { ...baseState, activeRumors: first.activeRumors! },
            { type: 'ADD_RUMORS', payload: { rumors } },
        );
        expect(again.activeRumors).toBeUndefined();
    });

    it('ADD_RUMORS appends only the rumors whose id is new', () => {
        const existing = [
            { id: 'chronicle-coord_3_4-1', text: 'Market boomed.', type: 'market' as const, timestamp: 100, expiration: 130 },
        ];
        const incoming = [
            { id: 'chronicle-coord_3_4-1', text: 'Market boomed.', type: 'market' as const, timestamp: 100, expiration: 130 },
            { id: 'chronicle-coord_3_4-9', text: 'New lord crowned.', type: 'event' as const, timestamp: 105, expiration: 135 },
        ];
        const baseState = createMockGameState({ activeRumors: existing });

        const result = worldReducer(baseState, { type: 'ADD_RUMORS', payload: { rumors: incoming } });
        expect(result.activeRumors).toEqual([
            existing[0],
            incoming[1],
        ]);
    });

    // ============================================================================
    // Worldforge Delta Persistence
    // ============================================================================
    // These tests protect the small state bridge between Worldforge plot edits and
    // save files. The reducer does not replay deltas itself; it only preserves the
    // append-only record that the 3D village layer can replay after a load.
    // ============================================================================

    const createWorldforgeDelta = (id: string, sequence: number): WorldDelta => ({
        id,
        schemaVersion: 1,
        opVersion: 1,
        artifactSeedPath: 'wf:123/cell:test/village:demo',
        entityKey: `plot:${sequence}`,
        sequence,
        operation: {
            kind: 'modify-plot',
            plotId: sequence,
            role: sequence % 2 === 0 ? 'home' : 'shop',
            storeys: 1 + sequence,
        },
    });

    it('appends worldforge deltas immutably, ignores duplicate ids, and keeps order deterministic', () => {
        const firstDelta = createWorldforgeDelta('delta-1', 1);
        const secondDelta = createWorldforgeDelta('delta-2', 2);
        const baseState = createMockGameState({
            worldforgeDeltas: [firstDelta],
        });
        const originalDeltas = baseState.worldforgeDeltas;

        const appendAction: AppAction = {
            type: 'APPLY_WORLDFORGE_DELTA',
            payload: { delta: secondDelta },
        };
        const appendResult = worldReducer(baseState, appendAction);

        expect(appendResult.worldforgeDeltas).toEqual([firstDelta, secondDelta]);
        expect(appendResult.worldforgeDeltas).not.toBe(originalDeltas);
        expect(baseState.worldforgeDeltas).toEqual([firstDelta]);

        const duplicateAction: AppAction = {
            type: 'APPLY_WORLDFORGE_DELTA',
            payload: { delta: firstDelta },
        };
        const duplicateResult = worldReducer(
            { ...baseState, worldforgeDeltas: appendResult.worldforgeDeltas! },
            duplicateAction
        );

        expect(duplicateResult.worldforgeDeltas).toEqual([firstDelta, secondDelta]);
        expect(duplicateResult.worldforgeDeltas).toBe(appendResult.worldforgeDeltas);
    });

    // ============================================================================
    // Generated Encounter Receipt Persistence
    // ============================================================================
    // Combat-event receipts use their deterministic event id as a save-safe
    // de-duplication key. They are intentionally separate from terrain deltas.
    // ============================================================================

    it('records generated encounter receipts once without changing their causal order', () => {
        const receipt = {
            id: 'worldforge-state-patrol:42:829:14:7:day-12',
            kind: 'state-patrol-interception' as const,
            worldSeed: 42,
            gameDay: 12,
            triggeredAtGameTimeMs: 123_456,
            sourceCellId: 829,
            burgId: 14,
            stateId: 7,
            factionId: 'worldforge-state:7',
            playerGroundMeters: { x: 10, z: 20 },
        };
        const baseState = createMockGameState({ worldforgeEncounterReceipts: [] });
        const action: AppAction = {
            type: 'RECORD_WORLDFORGE_ENCOUNTER',
            payload: { receipt },
        };

        const first = worldReducer(baseState, action);
        const repeated = worldReducer({
            ...baseState,
            worldforgeEncounterReceipts: first.worldforgeEncounterReceipts!,
        }, action);

        expect(first.worldforgeEncounterReceipts).toEqual([receipt]);
        expect(repeated.worldforgeEncounterReceipts).toBe(first.worldforgeEncounterReceipts);
    });

    it('should trigger processWorldEvents when time advances by a day', () => {
        const baseState = createMockGameState({
            gameTime: new Date('2024-01-01T12:00:00Z')
        });
        const weatherUpdate: WeatherState = {
            precipitation: 'storm',
            temperature: 'cold',
            wind: { direction: 'north', speed: 'gale' },
            visibility: 'heavily_obscured',
            baseTemperature: 'cold',
            baseVisibility: 'heavily_obscured'
        };
        vi.spyOn(WeatherSystem, 'updateWeather').mockReturnValue(weatherUpdate);

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 86400 } // 1 day
        };

        const result = worldReducer(baseState, action);

        expect(result.gameTime).toBeDefined();
        // ADVANCE_TIME remains the authoritative Chronos Loop: the same action
        // updates gameTime and then gives downstream daily world systems a
        // chance to react.
        expect(result.gameTime?.toISOString()).toBe('2024-01-02T12:00:00.000Z');
        // Check if logs were added (implies processWorldEvents was called and result merged).
        expect(result.messages).toHaveLength(baseState.messages.length + 1);
        expect(result.messages?.[0].text).toBe('Mock World Event');
        // The reducer should now keep the full daily-world payload instead of
        // dropping non-message outputs at the boundary.
        expect(result.economy!.activeEvents).toHaveLength(1);
        expect(result.activeRumors).toHaveLength(1);
        expect(result.activeRumors?.[0].id).toBe('rumor-moon');
        expect(result.worldHistory).toEqual(createEmptyHistory());
        expect(result.dynamicNPCs?.watchful_hunter).toEqual({
            id: 'watchful_hunter',
            name: 'Watchful Hunter',
        });
        expect(result.pendingCouriers).toHaveLength(1);
        expect(result.pendingCouriers?.[0].id).toBe('courier-moon');
        expect(result.environment).toMatchObject(weatherUpdate);
        expect(WeatherSystem.updateWeather).toHaveBeenCalledTimes(1);
        expect(WeatherSystem.updateWeather).toHaveBeenCalledWith(
            expect.anything(),
            'plains',
            expect.stringContaining('Day'),
            expect.anything()
        );
    });

    it('should NOT trigger processWorldEvents when time advances by less than a day', () => {
        const baseState = createMockGameState({
            gameTime: new Date('2024-01-01T12:00:00Z')
        });
        const weatherSpy = vi.spyOn(WeatherSystem, 'updateWeather');

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 3600 } // 1 hour
        };

        const result = worldReducer(baseState, action);

        expect(result.gameTime).toBeDefined();
        // Small action chunks still use ADVANCE_TIME, even when they do not
        // cross a daily boundary or trigger world-event logs.
        expect(result.gameTime?.toISOString()).toBe('2024-01-01T13:00:00.000Z');
        expect(result.messages).toEqual([]); // Expect empty array, not undefined
        expect(weatherSpy).not.toHaveBeenCalled();
    });

    it('uses the cell-native resolved biome for environment progression (Stage 6: no grid tile biome)', () => {
        // Grid retirement: resolveBiomeId no longer reads coord_X_Y -> mapData.tiles.
        // With no canonical cell and a non-static (coord) location it resolves to the
        // neutral 'plains' default; weather is driven by that resolved biome.
        const baseState = createMockGameState({
            gameTime: new Date('2024-01-01T12:00:00Z'),
            currentLocationId: 'coord_2_3',
            playerCell: null,
        });
        const weatherUpdate: WeatherState = {
            precipitation: 'light_rain',
            temperature: 'temperate',
            wind: { direction: 'south', speed: 'moderate' },
            visibility: 'lightly_obscured',
            baseTemperature: 'temperate',
            baseVisibility: 'lightly_obscured'
        };
        vi.spyOn(WeatherSystem, 'updateWeather').mockReturnValue(weatherUpdate);

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 86400 } // 1 day
        };

        const result = worldReducer(baseState, action);

        expect(WeatherSystem.updateWeather).toHaveBeenCalledTimes(1);
        expect(WeatherSystem.updateWeather).toHaveBeenCalledWith(
            expect.anything(),
            'plains',
            expect.stringContaining('Day'),
            expect.anything()
        );
        expect(result.environment).toMatchObject(weatherUpdate);
    });

    it('produces the same environment for identical seeded day advances', () => {
        const baseStateA = createMockGameState({
            worldSeed: 24680,
            gameTime: new Date('2024-01-01T12:00:00Z'),
            currentLocationId: 'coord_2_3',
        });
        const baseStateB = createMockGameState({
            worldSeed: 24680,
            gameTime: new Date('2024-01-01T12:00:00Z'),
            currentLocationId: 'coord_2_3',
        });

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 86400 } // 1 day
        };

        const resultA = worldReducer(baseStateA, action);
        const resultB = worldReducer(baseStateB, action);

        expect(resultA.environment).toEqual(resultB.environment);
        expect(resultA.gameTime?.toISOString()).toBe(resultB.gameTime?.toISOString());
    });

    it('resets shortRestTracker when advancing across multiple days', () => {
        const gameTime = new Date('2024-01-01T12:00:00Z');
        const baseState = createMockGameState({
            gameTime,
            shortRestTracker: {
                restsTakenToday: 3,
                lastRestDay: getGameDay(gameTime),
                lastRestEndedAtMs: gameTime.getTime(),
            },
        });
        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 172800 } // 2 days
        };

        const result = worldReducer(baseState, action);

        expect(result.gameTime?.toISOString()).toBe('2024-01-03T12:00:00.000Z');
        expect(result.shortRestTracker).toEqual({
            restsTakenToday: 0,
            lastRestDay: getGameDay(new Date('2024-01-03T12:00:00Z')),
            lastRestEndedAtMs: baseState.shortRestTracker?.lastRestEndedAtMs || null,
        });
    });

    it('initializes missing shortRestTracker before day-boundary reset', () => {
        const gameTime = new Date('2024-01-01T23:00:00Z');
        const baseState = {
            ...(createMockGameState({ gameTime })),
            shortRestTracker: undefined,
        } as unknown as Parameters<typeof worldReducer>[0];

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 3600 } // 1 hour to next day
        };

        const result = worldReducer(baseState, action);

        expect(result.shortRestTracker).toEqual({
            restsTakenToday: 0,
            lastRestDay: getGameDay(result.gameTime || new Date()),
            lastRestEndedAtMs: null,
        });
    });
});
