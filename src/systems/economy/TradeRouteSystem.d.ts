import { GameState } from '../../types';
import { TradeRoute, MarketEvent } from '../../types/economy';
/**
 * System for managing trade routes between locations
 */
export declare class TradeRouteSystem {
    private static log;
    /**
     * Calculates the profitability of a route based on supply/demand and events.
     * Logic:
     * 1. Check if goods are Exported by Origin (Cheap buying price)
     * 2. Check if goods are Imported by Destination (Expensive selling price)
     * 3. Apply Market Event modifiers (e.g. War increases Weapon demand)
     * 4. Deduct risk factor
     *
     * @param route The trade route to evaluate
     * @param marketEvents Active global market events
     * @returns A score from 0-100 representing profit margin
     */
    static calculateProfitability(route: TradeRoute, marketEvents?: MarketEvent[]): number;
    /**
     * Calculates the risk level of a route
     */
    static calculateRisk(route: TradeRoute, marketEvents?: MarketEvent[]): number;
    /**
     * Generates a new trade route between two regions
     */
    static createRoute(originId: string, destinationId: string, goods: string[], baseRisk?: number): TradeRoute;
    /**
     * Simulates a caravan journey along a trade route
     * @returns true if successful, false if attacked/lost
     */
    static simulateCaravan(route: TradeRoute, gameState: GameState): boolean;
}
