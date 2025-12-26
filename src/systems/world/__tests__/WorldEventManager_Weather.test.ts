/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/__tests__/WorldEventManager_Weather.test.ts
 * Tests for the integration of Weather impacts on World Events.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processWorldEvents } from '../WorldEventManager';
import { GameState } from '../../../types';
import { createMockGameState } from '../../../utils/factories';
import { SeededRandom } from '../../../utils/seededRandom';
import { WeatherState } from '../../../types/environment';

// Mock SeededRandom correctly
vi.mock('../../../utils/seededRandom', () => {
  return {
    SeededRandom: class {
      constructor() {}
      next() { return 0.5; }
    }
  };
});

describe('WorldEventManager - Weather Integration', () => {
    let mockRngNext: any;

    const mockWeather: WeatherState = {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'calm' },
        visibility: 'clear'
    };

    const baseState: GameState = createMockGameState({
        worldSeed: 12345,
        weather: mockWeather,
        activeRumors: [],
        factions: {
            'f1': { id: 'f1', name: 'Faction 1', power: 50, relationships: {'f2': -50}, enemies: ['f2'] } as any,
            'f2': { id: 'f2', name: 'Faction 2', power: 50, relationships: {'f1': -50}, enemies: ['f1'] } as any
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockRngNext = vi.fn();

        // Update prototype of the mocked class
        (SeededRandom.prototype.next as any) = mockRngNext;
    });

    it('should suppress skirmishes during blizzards', () => {
        const blizzardState = {
            ...baseState,
            weather: { ...mockWeather, precipitation: 'blizzard' as const }
        };

        // Always return 0.1 to trigger event loop (0.1 < 0.2) and event type (0.1 < 0.4 for skirmish)
        // Then we need next() to return < 0.8 for the weather check to PASS suppression
        // Note: My implementation uses rng.next() < 0.8 to suppress.
        // So 0.1 triggers suppression.
        mockRngNext.mockReturnValue(0.1);

        const result = processWorldEvents(blizzardState, 1);

        const hasSkirmish = result.logs.some(l => l.text.includes('Skirmish between'));

        expect(hasSkirmish).toBe(false);
    });
});
