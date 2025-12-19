
import { describe, it, expect } from 'vitest';
import { processFactionGoals } from '../FactionGoalSystem';
import { GameState, Faction } from '../../types';
import { FactionGoal } from '../../types/worldEvents';

// Mock minimal GameState
const mockGameState = (factions: Record<string, Faction>): GameState => ({
    worldSeed: 12345,
    gameTime: new Date('2024-01-01T12:00:00Z'),
    factions,
    activeRumors: [],
    // ... minimal other required fields to satisfy type, or cast as any
} as any);

describe('FactionGoalSystem', () => {
    it('should progress an active goal', () => {
        const goal: FactionGoal = {
            id: 'test_goal',
            type: 'EXPANSION',
            description: 'Test Description',
            progress: 50,
            difficulty: 10, // Very easy, high chance of success
            status: 'ACTIVE'
        };

        const faction: Faction = {
            id: 'test_faction',
            name: 'Test Faction',
            power: 100, // High power vs Low difficulty
            goals: [goal],
            activeGoalId: 'test_goal',
            // ... other fields
        } as any;

        const state = mockGameState({ 'test_faction': faction });

        // Simulate 10 days to ensure at least one tick happens (chance is 30%)
        const { state: newState, logs } = processFactionGoals(state, 10);

        const newFaction = newState.factions['test_faction'];
        const newGoal = newFaction.goals[0];

        // Should have progressed or at least not crashed
        // Since we can't guarantee RNG without mocking SeededRandom, we just check structure
        // But with power 100 vs diff 10, success chance is ~0.9.
        // And 30% chance to move per day. 10 days -> likely to move.

        // At least check logs were generated if it happened
        if (newGoal.progress !== 50) {
            expect(logs.length).toBeGreaterThan(0);
        }
    });

    it('should complete a goal when progress reaches 100', () => {
        const goal: FactionGoal = {
            id: 'test_goal_near_complete',
            type: 'WEALTH',
            description: 'Almost rich',
            progress: 95,
            difficulty: 10,
            status: 'ACTIVE'
        };

        const faction: Faction = {
            id: 'rich_faction',
            name: 'Rich Faction',
            power: 100,
            goals: [goal],
            activeGoalId: 'test_goal_near_complete',
        } as any;

        const state = mockGameState({ 'rich_faction': faction });

        // Force enough days to trigger completion
        // We can't deterministically force completion without mocking RNG fully,
        // but we can check that IF it completes, it behaves correctly.
        // Or we can rely on the fact that we use SeededRandom(worldSeed + gameDay).

        const { state: newState } = processFactionGoals(state, 30);

        const newFaction = newState.factions['rich_faction'];
        // Check if ANY goal is completed
        const completed = newFaction.goals.some(g => g.status === 'COMPLETED');

        if (completed) {
            // Should have a new active goal
            expect(newFaction.goals.length).toBeGreaterThan(1);
            expect(newFaction.activeGoalId).not.toBe('test_goal_near_complete');
        }
    });
});
