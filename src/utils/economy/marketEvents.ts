// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:26
 * Dependents: TradeRouteSystem.ts, economy/index.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { MarketEvent, MarketEventType } from '../../types/economy';
import { SeededRandom } from '../random/seededRandom';

export const MARKET_EVENT_TEMPLATES = [
  {
    name: 'Bumper Harvest',
    description: 'Farms are overflowing with produce, driving food prices down.',
    affectedCategories: ['food', 'ingredients'],
    priceModifier: 0.5,
    durationDays: 7,
    type: MarketEventType.SURPLUS
  },
  {
    name: 'War shortage',
    description: 'Military conflicts have restricted trade routes, increasing weapon costs.',
    affectedCategories: ['weapon', 'armor', 'ammo'],
    priceModifier: 1.5,
    durationDays: 14,
    type: MarketEventType.SHORTAGE
  },
  {
    name: 'Magic Surge',
    description: 'A surge of raw magic has made enchanting materials unstable and rare.',
    affectedCategories: ['potion', 'scroll', 'magic_item'],
    priceModifier: 2.0,
    durationDays: 5,
    type: MarketEventType.SHORTAGE
  },
  {
    name: 'Trade Fair',
    description: 'Merchants from all over have gathered, creating competitive pricing.',
    affectedCategories: ['all'],
    priceModifier: 0.8,
    durationDays: 3,
    type: MarketEventType.FESTIVAL
  },
  {
    name: 'Plague Outbreak',
    description: 'Sickness spreads, making medicine precious.',
    affectedCategories: ['medicine', 'potion', 'herb'],
    priceModifier: 3.0,
    durationDays: 10,
    type: MarketEventType.BUST
  },
  {
    name: 'Bandit Activity',
    description: 'Roads are dangerous, increasing transport risks.',
    affectedCategories: ['luxury', 'gold'], // Bandits target wealth
    priceModifier: 1.2,
    durationDays: 7,
    type: MarketEventType.BUST
  }
];

// Interface for the templates used above
// TODO(lint-intent): 'MarketEventTemplate' is declared but unused, suggesting an unfinished state/behavior hook in this block.
// TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
// TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
interface _MarketEventTemplate {
  name: string;
  description: string;
  affectedCategories: string[];
  priceModifier: number;
  durationDays: number;
  type: MarketEventType;
}

/**
 * Helper interface for events that includes the template data needed for calculation
 */
export interface EnrichedMarketEvent extends MarketEvent {
  affectedCategories: string[];
  priceModifier: number;
}

/**
 * Generates active market events based on the current game time
 * This is deterministic - same time always yields same events
 */
export function generateMarketEvents(gameTime: number): EnrichedMarketEvent[] {
  // Use day count as seed component to change events daily
  const dayCount = Math.floor(gameTime / (24 * 60 * 60 * 1000));

  // Create a seeded random based on the day
  const events: EnrichedMarketEvent[] = [];

  // Look back up to 14 days to see if an event started then and is still active
  for (let i = 0; i < 14; i++) {
    const checkDay = dayCount - i;
    const rng = new SeededRandom(checkDay);

    // 20% chance of an event starting on any given day
    if (rng.next() < 0.2) {
      const template = rng.pick(MARKET_EVENT_TEMPLATES);

      // Check if it's still active
      if (i < template.durationDays) {
        events.push({
          id: `evt_${checkDay}_${template.name.replace(/\s+/g, '_')}`,
          type: template.type,
          startTime: checkDay * 24 * 60 * 60 * 1000,
          duration: template.durationDays,
          intensity: 1.0,
          locationId: undefined, // Global by default
          // Extra properties for calculation logic
          affectedCategories: template.affectedCategories,
          priceModifier: template.priceModifier,
          // Just in case these are needed for UI
          // We can cast to any if the strict MarketEvent type forbids them,
          // but since EnrichedMarketEvent extends MarketEvent, we should be fine
          // if we pass this object where EnrichedMarketEvent is expected.
          // However, to satisfy strict MarketEvent where name/desc aren't there:
          // We might need to handle that. But for now let's assume Enriched is used internally.
          name: template.name,
          description: template.description
        } as EnrichedMarketEvent);
      }
    }
  }

  return events;
}

/**
 * Gets the total price modifier for a category based on active events
 */
export function getEventPriceModifier(category: string, events: MarketEvent[]): number {
  let modifier = 1.0;

  for (const event of events) {
    // We cast to EnrichedMarketEvent to access the extra properties
    // In a real DB backed system these would be looked up from a template ID
    const enriched = event as unknown as EnrichedMarketEvent;

    if (enriched.affectedCategories && (enriched.affectedCategories.includes('all') || enriched.affectedCategories.includes(category))) {
      modifier *= enriched.priceModifier;
    }
  }

  return modifier;
}

/**
 * RALPH: Market Intelligence.
 * Derives current scarcity/surplus factors directly from active events.
 * This eliminates the risk of desynchronized manual lists in the state.
 */
export function calculateMarketFactors(events: MarketEvent[]): { scarcity: string[], surplus: string[] } {
    const scarcity = new Set<string>();
    const surplus = new Set<string>();

    events.forEach(event => {
        // Handle both Enriched and base events
        const enriched = event as any;
        const tags = enriched.affectedCategories || enriched.affectedTags || [];
        const type = enriched.type;

        tags.forEach((tag: string) => {
            if (type === MarketEventType.SHORTAGE || type === MarketEventType.BUST) {
                scarcity.add(tag);
            } else if (type === MarketEventType.SURPLUS || type === MarketEventType.FESTIVAL) {
                surplus.add(tag);
            }
        });
    });

    return {
        scarcity: Array.from(scarcity),
        surplus: Array.from(surplus)
    };
}
