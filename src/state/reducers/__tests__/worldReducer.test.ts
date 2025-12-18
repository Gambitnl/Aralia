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
import { createMockGameState } from '../../../utils/factories';

// Mock WorldEventManager to avoid RNG and check integration
vi.mock('../../../systems/world/WorldEventManager', () => ({
    processWorldEvents: vi.fn((state, daysPassed) => ({
        state: { ...state, mockChange: true }, // Simple change to verify it was called
        logs: [{ id: 1, text: 'Mock World Event', sender: 'system', timestamp: new Date() }]
    }))
}));

describe('worldReducer', () => {
    it('should trigger processWorldEvents when time advances by a day', () => {
        const baseState = createMockGameState({
            gameTime: new Date('2024-01-01T12:00:00Z')
        });

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 86400 } // 1 day
        };

        const result = worldReducer(baseState, action);

        expect(result.gameTime).toBeDefined();
        // Check if logs were added (implies processWorldEvents was called and result merged)
        expect(result.messages).toHaveLength(baseState.messages.length + 1);
        expect(result.messages?.[0].text).toBe('Mock World Event');
    });

    it('should NOT trigger processWorldEvents when time advances by less than a day', () => {
        const baseState = createMockGameState({
            gameTime: new Date('2024-01-01T12:00:00Z')
        });

        const action = {
            type: 'ADVANCE_TIME' as const,
            payload: { seconds: 3600 } // 1 hour
        };

        const result = worldReducer(baseState, action);

        expect(result.gameTime).toBeDefined();
        expect(result.messages).toBeUndefined(); // No changes to messages
    });
});
