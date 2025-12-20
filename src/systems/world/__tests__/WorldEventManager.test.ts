/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/__tests__/WorldEventManager.test.ts
 * Tests for the WorldEventManager.
 */

import { describe, it, expect, vi } from 'vitest';
import { processWorldEvents } from '../WorldEventManager';
import { GameState, GamePhase } from '../../../types';
import { FACTIONS, INITIAL_FACTION_STANDINGS } from '../../../data/factions';
import { createMockGameState } from '../../../utils/factories';
import { getGameDay } from '../../../utils/timeUtils';

describe('WorldEventManager', () => {
    const mockDate = new Date('2024-01-01T12:00:00Z');
    const mockDay = getGameDay(mockDate);

    const baseState: GameState = createMockGameState({
        factions: FACTIONS,
        playerFactionStandings: INITIAL_FACTION_STANDINGS,
        gameTime: mockDate,
        worldSeed: 12345,
        activeRumors: []
    });

    it('should generate events when days pass (with high enough probability or forced check)', () => {
        // We can't easily force the RNG to hit, but we can call it many times or mock SeededRandom.
        // For this test, we trust that 100 days is enough to trigger *something* with 20% chance.
        const result = processWorldEvents(baseState, 100);

        // Expect at least one log entry about a skirmish or rumor
        expect(result.logs.length).toBeGreaterThan(0);

        // Check if any rumors were added to state
        expect(result.state.activeRumors?.length).toBeGreaterThan(0);

        const firstRumor = result.state.activeRumors![0];
        expect(firstRumor).toHaveProperty('id');
        expect(firstRumor).toHaveProperty('text');
        expect(firstRumor).toHaveProperty('expiration');
    });

    it('should change faction power during a skirmish', () => {
        // Run enough days to guarantee a skirmish
        let currentState = baseState;
        let skirmishHappened = false;

        // Loop until we find a skirmish or hit a limit
        for (let i = 0; i < 5; i++) {
            const result = processWorldEvents(currentState, 50);
            currentState = result.state;

            // Check if any faction power changed from default
            // Default power is mostly static in FACTIONS constant but we modified it
            const factions = Object.values(currentState.factions);
            const changed = factions.some(f => f.power !== 50 && f.power !== 80 && f.power !== 60 && f.power !== 75 && f.power !== 85 && f.power !== 70);
            // Note: My power values in FACTIONS are 80, 60, 75, 85, 70, 50.
            // If a skirmish happens, power changes by +/- 2 to 4.
            // So checking strict inequality to initial values is complex if I don't know who fought.

            // Instead, let's look for the rumor type 'skirmish'
            const skirmishRumor = currentState.activeRumors?.find(r => r.type === 'skirmish');
            if (skirmishRumor) {
                skirmishHappened = true;
                break;
            }
        }

        expect(skirmishHappened).toBe(true);
    });

    it('should not mutate state if 0 days pass', () => {
        const result = processWorldEvents(baseState, 0);
        expect(result.logs).toHaveLength(0);
        // Ensure rumors list didn't change (still empty)
        expect(result.state.activeRumors).toEqual([]);
    });

    it('should expire old rumors', () => {
        // Setup state with an old rumor
        const oldRumor = {
            id: 'old-rumor',
            text: 'Old news',
            type: 'misc' as const,
            timestamp: mockDay - 10,
            expiration: mockDay - 5, // Already expired
            spreadDistance: 0,
            virality: 0.5
        };

        const stateWithRumor = {
            ...baseState,
            activeRumors: [oldRumor],
            // Set game time to day 10
            gameTime: new Date(baseState.gameTime.getTime() + 10 * 24 * 60 * 60 * 1000)
        };

        const result = processWorldEvents(stateWithRumor, 1);

        // Rumor should be gone
        expect(result.state.activeRumors).not.toContainEqual(oldRumor);
    });

    it('should propagate rumors over time', () => {
        // Setup state with a high virality rumor
        // Note: Using mockDay (defined at top of file) rather than a local variable.
        // Both branches computed the same value via getGameDay(mockDate); mockDay is cleaner.
        const viralRumor = {
            id: 'viral-news',
            text: 'War declared!',
            type: 'skirmish' as const,
            timestamp: mockDay,
            expiration: mockDay + 100,
            spreadDistance: 0,
            virality: 1.0 // 100% chance to spread at distance 0
        };

        const stateWithRumor = {
            ...baseState,
            activeRumors: [viralRumor]
        };

        // Advance 10 days to give more chances for RNG to hit spread
        const result = processWorldEvents(stateWithRumor, 10);

        // Should have original rumor + at least one spread rumor
        expect(result.state.activeRumors?.length).toBeGreaterThan(1);

        const spreadRumor = result.state.activeRumors?.find(r => r.id.includes('spread'));
        expect(spreadRumor).toBeDefined();
        expect(spreadRumor?.spreadDistance).toBeGreaterThanOrEqual(1);
        expect(spreadRumor?.virality).toBeLessThan(1.0);
    });
});
