import { EconomyState, MarketEvent } from '@/types';

// Simple string hash function to generate a numeric seed from a location ID
function stringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export const POSSIBLE_MARKET_EVENTS: MarketEvent[] = [
  { id: 'war', name: 'War Rumors', description: 'Conflict drives up the price of weapons and armor.', affectedTags: ['weapon', 'armor', 'shield'], effect: 'scarcity', duration: 7 },
  { id: 'famine', name: 'Famine', description: 'Food is scarce and expensive.', affectedTags: ['food_drink'], effect: 'scarcity', duration: 10 },
  { id: 'bumper_crop', name: 'Bumper Crop', description: 'Food is abundant and cheap.', affectedTags: ['food_drink'], effect: 'surplus', duration: 10 },
  { id: 'plague', name: 'Plague', description: 'Medicine is in high demand.', affectedTags: ['potion', 'herb', 'antidote'], effect: 'scarcity', duration: 5 },
  { id: 'magic_surge', name: 'Magic Surge', description: 'Magical items are volatile and abundant.', affectedTags: ['scroll', 'potion', 'wand', 'magic'], effect: 'surplus', duration: 3 },
  { id: 'festival', name: 'Festival', description: 'Luxuries and food are in high demand.', affectedTags: ['food_drink', 'luxury', 'instrument'], effect: 'scarcity', duration: 2 },
  { id: 'trade_caravan', name: 'Trade Caravan Arrival', description: 'A large shipment has arrived, lowering prices.', affectedTags: ['weapon', 'armor', 'tool', 'clothing'], effect: 'surplus', duration: 2 },
];

/**
 * Generates active market events based on a seed (e.g., current game time) and optionally a location.
 * This ensures deterministic events for a given time/location combination.
 */
export function generateMarketEvents(timeSeed: number, locationId?: string): MarketEvent[] {
  const events: MarketEvent[] = [];

  // Combine time seed with location seed if provided
  const locationSeed = locationId ? stringToNumber(locationId) : 0;
  // We use a combined seed. Multiplying time by a prime and adding location ensures variety.
  // Using a large multiplier for time to ensure small time changes cause big shifts.
  const combinedSeed = timeSeed + (locationSeed * 1337);

  // Simple pseudo-random generator
  // Use a large multiplier to sensitize the sine wave to small seed changes
  const rng = Math.abs(Math.sin(combinedSeed * 9999) * 10000);
  const index = Math.floor((rng - Math.floor(rng)) * POSSIBLE_MARKET_EVENTS.length);

  // 40% chance of an event being active at any given time/location combo
  // Use the decimal part for probability check to decouple from index selection
  if ((rng % 1) < 0.4) {
      events.push(POSSIBLE_MARKET_EVENTS[index]);
  }
  return events;
}

/**
 * Applies a list of market events to an economy state, modifying scarcity and surplus.
 */
export function applyEventsToEconomy(baseEconomy: EconomyState, events: MarketEvent[]): EconomyState {
  const newEconomy: EconomyState = {
      ...baseEconomy,
      marketFactors: {
          scarcity: [...baseEconomy.marketFactors.scarcity],
          surplus: [...baseEconomy.marketFactors.surplus]
      },
      activeEvents: events // Store active events for UI
  };

  events.forEach(event => {
      if (event.effect === 'scarcity') {
          event.affectedTags.forEach(tag => {
              // Add to scarcity if not present
              if (!newEconomy.marketFactors.scarcity.includes(tag)) {
                  newEconomy.marketFactors.scarcity.push(tag);
              }
              // Remove from surplus if present to avoid conflict (scarcity overrides surplus)
              newEconomy.marketFactors.surplus = newEconomy.marketFactors.surplus.filter(t => t !== tag);
          });
      } else { // surplus
          event.affectedTags.forEach(tag => {
              // Only add to surplus if NOT in scarcity (scarcity overrides surplus)
              const isScarce = newEconomy.marketFactors.scarcity.includes(tag);
              if (!isScarce && !newEconomy.marketFactors.surplus.includes(tag)) {
                  newEconomy.marketFactors.surplus.push(tag);
              }
          });
      }
  });

  return newEconomy;
}

/**
 * Calculates the potential profit for a trade route.
 * @param distance Distance in map units.
 * @param risk Risk factor (0-10).
 * @param baseValue Base value of goods being transported.
 */
export function calculateTradeRouteProfit(distance: number, risk: number, baseValue: number): number {
    // Longer distance = more profit multiplier
    const distanceMod = Math.max(1, 1 + (distance / 50));

    // Higher risk = higher potential reward (hazard pay), but also higher chance of loss (not handled here)
    const riskMod = 1 + (risk * 0.2);

    return Math.floor(baseValue * distanceMod * riskMod);
}
