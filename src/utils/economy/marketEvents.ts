// @dependencies-start
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
// @dependencies-end

import { MarketEvent, MarketEventType, type TradeRoute, type MarketEventImpactDirection } from '../../types/economy';
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

/**
 * Helper interface for events that includes the template data needed for calculation
 */
export interface EnrichedMarketEvent extends MarketEvent {
  affectedCategories: string[];
  priceModifier: number;
}

/** Existing saved route-event IDs remain stable across producer and quote readers. */
export const ROUTE_MARKET_EVENT_PREFIX = 'route_event_';

export function routeMarketEventId(routeId: string, good: string, direction: MarketEventImpactDirection): string {
  return ROUTE_MARKET_EVENT_PREFIX + routeId + '_' + good + '_' + direction;
}

/**
 * Select one already-matching report per known route and direction for pricing.
 * A single haul can report food and consumables; it must not discount a ration
 * twice. Keep the strongest matching intensity at the first cause's position,
 * preserving independent world multipliers and their established order.
 * Saved reports, IDs and input objects stay intact. Unknown, ambiguous or
 * custom multiplier reports remain independent rather than guessing provenance.
 */
export function deduplicateRouteMarketEvents(
  matchingEvents: readonly MarketEvent[],
  routes: readonly Pick<TradeRoute, 'id' | 'goods'>[],
): MarketEvent[] {
  const causes = new Map<string, { key: string; type: MarketEventType } | null>();
  if (Array.isArray(routes)) for (const route of routes) {
    if (!route || typeof route.id !== 'string' || !route.id || !Array.isArray(route.goods)) continue;
    for (const good of route.goods) {
      if (typeof good !== 'string' || !good) continue;
      for (const direction of ['surplus', 'scarcity'] as const) {
        const id = routeMarketEventId(route.id, good, direction);
        const key = JSON.stringify([route.id, direction]);
        const type = direction === 'scarcity' ? MarketEventType.SHORTAGE : MarketEventType.SURPLUS;
        if (causes.has(id) && causes.get(id)?.key !== key) causes.set(id, null);
        else if (!causes.has(id)) causes.set(id, { key, type });
      }
    }
  }
  const result: MarketEvent[] = [];
  const selected = new Map<string, number>();
  // Preserve the same legacy fallback used by the price engine for zero/missing intensity.
  const intensity = (event: MarketEvent) => event.intensity || (event.type === MarketEventType.SHORTAGE ? 0.5 : 0.3);
  for (const event of matchingEvents) {
    const cause = causes.get(event.id);
    if (!cause || cause.type !== event.type || (typeof event.priceModifier === 'number' && event.priceModifier > 0)) {
      result.push(event);
      continue;
    }
    const index = selected.get(cause.key);
    if (index === undefined) {
      selected.set(cause.key, result.length);
      result.push(event);
    } else if (intensity(event) > intensity(result[index])) {
      result[index] = event;
    }
  }
  return result;
}

const normalizeTag = (tag: string): string => tag.toLowerCase().trim();

const normalizeNameToTags = (name: string): string[] => {
  const scrubbed = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return scrubbed
    .split(/\s+/)
    .map(normalizeTag)
    .filter(Boolean);
};

export function getMarketEventTags(event: MarketEvent): string[] {
  const tags = new Set<string>();

  if (event.affectedTags?.length) {
    event.affectedTags.forEach(tag => {
      if (tag) tags.add(normalizeTag(tag));
    });
  }

  if (event.affectedCategories?.length) {
    event.affectedCategories.forEach(tag => {
      if (tag) tags.add(normalizeTag(tag));
    });
  }

  if (tags.size === 0 && event.name) {
    normalizeNameToTags(event.name).forEach(tag => tags.add(tag));
  }

  return Array.from(tags);
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
    if (checkDay < 0) continue;
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
          duration: template.durationDays - i,
          intensity: 1.0,
          locationId: undefined, // Global by default
          // Extra properties for calculation logic
          affectedCategories: template.affectedCategories,
          affectedTags: template.affectedCategories,
          priceModifier: template.priceModifier,
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
  const normalizedCategory = category.toLowerCase();

  for (const event of events) {
    const tags = getMarketEventTags(event);

    if (tags.includes('all') || tags.includes(normalizedCategory)) {
      const { priceModifier } = event as Partial<Pick<EnrichedMarketEvent, 'priceModifier'>>;
      modifier *= priceModifier ?? 1;
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
    const tags = getMarketEventTags(event);
    const type = event.type;

    tags.forEach((tag: string) => {
      if (
        type === MarketEventType.SHORTAGE ||
        type === MarketEventType.BUST ||
        type === MarketEventType.WAR_TAX
      ) {
        scarcity.add(tag);
      } else if (
        type === MarketEventType.SURPLUS ||
        type === MarketEventType.FESTIVAL ||
        type === MarketEventType.BOOM
      ) {
        surplus.add(tag);
      }
    });
  });

  return {
    scarcity: Array.from(scarcity),
    surplus: Array.from(surplus)
  };
}
