
import { describe, it, expect } from 'vitest';
import { processDailyRoutes } from '../TradeRouteManager';
import { GameState, TradeRoute } from '../../../types';
import { SeededRandom } from '../../../utils/seededRandom';

describe('TradeRouteManager', () => {
    // Helper to create a minimal mock state
    const createMockState = (): GameState => ({
        economy: {
            marketFactors: { scarcity: [], surplus: [] },
            buyMultiplier: 1.0,
            sellMultiplier: 0.5,
            activeEvents: [],
            tradeRoutes: [
                {
                    id: 'test_route',
                    name: 'Test Route',
                    description: 'Test',
                    originId: 'A',
                    destinationId: 'B',
                    goods: ['iron'],
                    status: 'active',
                    riskLevel: 0.5, // High risk
                    profitability: 0.0,
                    daysInStatus: 0
                }
            ]
        },
        gameTime: new Date('2024-01-01T12:00:00Z'),
        worldSeed: 12345,
    } as unknown as GameState);

    it('should initialize routes if missing', () => {
        const state = createMockState();
        state.economy.tradeRoutes = undefined;
        const rng = new SeededRandom(1);

        const result = processDailyRoutes(state, 1, rng);
        expect(result.state.economy.tradeRoutes).toBeDefined();
        expect(result.state.economy.tradeRoutes!.length).toBeGreaterThan(0);
    });

    it('should block a route on high risk roll', () => {
        const state = createMockState();
        const route = state.economy.tradeRoutes![0];
        route.riskLevel = 1.0; // Guaranteed risk trigger in logic (if roll < risk*0.1)
        // logic: roll < risk * 0.1. So if risk is 10, check is roll < 1.0.
        // Wait, max risk is 1.0. So check is roll < 0.1.

        // Let's force RNG to be low
        const rng = new SeededRandom(1);
        // We need to find a seed or mock rng.
        // Or just trust the logic: roll < 0.1

        // Let's mock RNG or find a seed that produces low value.
        // Or just rely on probability if we loop?
        // Let's try to mock next() by extending or casting?
        // Since SeededRandom is a class, we can just spy on it?
        // But the function takes an instance.

        const mockRng = {
            next: () => 0.01 // Very low roll
        } as SeededRandom;

        const result = processDailyRoutes(state, 1, mockRng);
        const updatedRoute = result.state.economy.tradeRoutes![0];

        expect(updatedRoute.status).toBe('blocked');
        expect(result.logs.length).toBeGreaterThan(0);
        expect(result.logs[0].text).toContain('blocked');
    });

    it('should generate scarcity event when blocked', () => {
        const state = createMockState();
        const mockRng = {
            next: () => 0.01 // Trigger block
        } as SeededRandom;

        const result = processDailyRoutes(state, 1, mockRng);

        const events = result.state.economy.activeEvents!;
        const scarcityEvent = events.find(e => e.effect === 'scarcity');

        expect(scarcityEvent).toBeDefined();
        expect(scarcityEvent!.affectedTags).toContain('iron');
        expect(result.state.economy.marketFactors.scarcity).toContain('iron');
    });

    it('should recover a blocked route', () => {
        const state = createMockState();
        const route = state.economy.tradeRoutes![0];
        route.status = 'blocked';
        route.daysInStatus = 10; // Increase recovery chance

        const mockRng = {
            next: () => 0.01 // Trigger recovery (roll < chance)
        } as SeededRandom;

        const result = processDailyRoutes(state, 1, mockRng);
        const updatedRoute = result.state.economy.tradeRoutes![0];

        expect(updatedRoute.status).toBe('active');
        expect(result.logs[0].text).toContain('clear');
    });
});
