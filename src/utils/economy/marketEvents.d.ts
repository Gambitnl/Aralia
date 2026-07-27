/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/06/2026, 17:21:33
 * Dependents: systems/economy/TradeRouteManager.ts, systems/economy/TradeRouteSystem.ts, systems/world/WorldEventManager.ts, utils/economy/economyUtils.ts, utils/economy/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { MarketEvent, MarketEventType } from '../../types/economy';
export declare const MARKET_EVENT_TEMPLATES: {
    name: string;
    description: string;
    affectedCategories: string[];
    priceModifier: number;
    durationDays: number;
    type: MarketEventType;
}[];
/**
 * Helper interface for events that includes the template data needed for calculation
 */
export interface EnrichedMarketEvent extends MarketEvent {
    affectedCategories: string[];
    priceModifier: number;
}
export declare function getMarketEventTags(event: MarketEvent): string[];
/**
 * Generates active market events based on the current game time
 * This is deterministic - same time always yields same events
 */
export declare function generateMarketEvents(gameTime: number): EnrichedMarketEvent[];
/**
 * Gets the total price modifier for a category based on active events
 */
export declare function getEventPriceModifier(category: string, events: MarketEvent[]): number;
/**
 * RALPH: Market Intelligence.
 * Derives current scarcity/surplus factors directly from active events.
 * This eliminates the risk of desynchronized manual lists in the state.
 */
export declare function calculateMarketFactors(events: MarketEvent[]): {
    scarcity: string[];
    surplus: string[];
};
