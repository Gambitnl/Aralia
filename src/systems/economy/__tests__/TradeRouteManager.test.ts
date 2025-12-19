
import { describe, it, expect } from 'vitest';
import { TradeRouteManager } from '../TradeRouteManager';
import { GameState, EconomyState } from '../../../types';
import { createMockGameState } from '../../../utils/factories';

describe('TradeRouteManager', () => {
    it('initializes economy system state if missing', () => {
        const mockState = createMockGameState({
            economy: {
                marketFactors: { scarcity: [], surplus: [] },
                buyMultiplier: 1,
                sellMultiplier: 0.5
            }
        });

        // Simulate tick
        const result = TradeRouteManager.processEconomyTick(mockState);

        expect(result.economy?.system).toBeDefined();
        expect(Object.keys(result.economy!.system!.nodes).length).toBeGreaterThan(0);
    });

    it('generates new trade routes when production is high', () => {
        const mockState = createMockGameState({
            economy: {
                marketFactors: { scarcity: [], surplus: [] },
                buyMultiplier: 1,
                sellMultiplier: 0.5
            }
        });

        // First tick initializes
        let result = TradeRouteManager.processEconomyTick(mockState);
        let system = result.economy!.system!;

        // Manually boost inventory to trigger route generation
        const node = Object.values(system.nodes)[0];
        const product = node.production[0];
        node.inventoryLevel[product] = 100; // Force surplus

        // Update state with modified system
        const stateWithSystem = {
            ...mockState,
            economy: { ...mockState.economy, system }
        };

        // Advance time significantly to allow next update
        const futureTime = new Date(stateWithSystem.gameTime.getTime() + 1000 * 60 * 60 * 5); // +5 hours
        const nextState = { ...stateWithSystem, gameTime: futureTime };

        result = TradeRouteManager.processEconomyTick(nextState);

        expect(result.economy?.system?.routes.length).toBeGreaterThan(0);
        const route = result.economy!.system!.routes[0];
        expect(route.originLocationId).toBe(node.locationId);
        expect(route.goods[0].itemType).toBe(product);
    });

    it('completes routes and updates inventory', () => {
         const mockState = createMockGameState();
         const ecoSystem = TradeRouteManager.initializeState();

         // Setup a route near completion
         const origin = Object.values(ecoSystem.nodes)[0];
         const dest = Object.values(ecoSystem.nodes)[1];
         const good = origin.production[0];

         ecoSystem.routes.push({
             id: 'test-route',
             originLocationId: origin.locationId,
             destinationLocationId: dest.locationId,
             goods: [{ itemType: good, volume: 50 }],
             startTime: 0,
             durationHours: 4,
             progress: 0.95, // Almost done
             status: 'active',
             risk: 0
         });

         mockState.economy.system = ecoSystem;

         // Advance time
         const futureTime = new Date(mockState.gameTime.getTime() + 1000 * 60 * 60 * 5); // +5 hours
         const nextState = { ...mockState, gameTime: futureTime };

         const result = TradeRouteManager.processEconomyTick(nextState);
         const updatedSystem = result.economy!.system!;

         // Route should be gone (completed and filtered out)
         expect(updatedSystem.routes.find(r => r.id === 'test-route')).toBeUndefined();

         // Destination inventory should increase
         expect(updatedSystem.nodes[dest.locationId].inventoryLevel[good]).toBeGreaterThan(0);
    });
});
