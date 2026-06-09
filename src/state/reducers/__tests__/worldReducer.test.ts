/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/__tests__/worldReducer.test.ts
 * Tests for the worldReducer.
 */

import { describe, it, expect, vi } from 'vitest';
import { worldReducer } from '../worldReducer';
import { GameState } from '../../../types';
import { WeatherState } from '../../../types/environment';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/factories';
import { createEmptyHistory } from '../../../utils/historyUtils';
import * as WeatherSystem from '../../../systems/environment/WeatherSystem';

// Mock WorldEventManager to avoid RNG and check integration
vi.mock('../../../systems/world/WorldEventManager', () => ({
    // TODO(lint-intent): 'daysPassed' is unused in this test; use it in the assertion path or remove it.
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
        expect(result.economy.activeEvents).toHaveLength(1);
        expect(result.activeRumors).toHaveLength(1);
        expect(result.activeRumors?.[0].id).toBe('rumor-moon');
        expect(result.worldHistory).toEqual(createEmptyHistory());
        expect(result.dynamicNPCs?.watchful_hunter).toEqual({
            id: 'watchful_hunter',
            name: 'Watchful Hunter',
        });
        expect(result.pendingCouriers).toHaveLength(1);
        expect(result.pendingCouriers?.[0].id).toBe('courier-moon');
        expect(result.environment).toEqual(weatherUpdate);
        expect(WeatherSystem.updateWeather).toHaveBeenCalledTimes(1);
        expect(WeatherSystem.updateWeather).toHaveBeenCalledWith(
            expect.anything(),
            'plains',
            expect.stringContaining('Day')
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

    it('uses the current coordinate tile biome for environment progression', () => {
        const baseState = createMockGameState({
            gameTime: new Date('2024-01-01T12:00:00Z'),
            currentLocationId: 'coord_2_3',
            mapData: {
                gridSize: { rows: 8, cols: 8 },
                tiles: Array.from({ length: 8 }, (_, y) =>
                    Array.from({ length: 8 }, (_, x) => ({
                        x,
                        y,
                        discovered: true,
                        isPlayerCurrent: false,
                        biomeId: y === 3 && x === 2 ? 'forest' : 'plains',
                    }))
                ),
            },
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
            'forest',
            expect.stringContaining('Day')
        );
        expect(result.environment).toEqual(weatherUpdate);
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
