/**
 * @file src/services/travelEventService.ts
 *
 * Service for generating procedural travel events during world map exploration.
 *
 * This file was recreated because PR #296 (feat(exploration): Add procedural travel event system)
 * claimed to create it but the file was never actually committed.
 *
 * How it works:
 * 1. When the player moves between world map tiles (in handleMovement.ts)
 * 2. generateTravelEvent() is called with the destination biome
 * 3. Based on probability (default 30%), an event may be selected
 * 4. Events are chosen from biome-specific + general pools using weighted random
 * 5. The event description is shown to the player
 * 6. If the event has an effect (e.g., delay), it's applied to gameplay
 *
 * Biome matching supports partial names (e.g., 'forest_ancient' matches 'forest' events)
 * to work with biome variants without needing duplicate event definitions.
 */

import { TravelEvent } from '../types/exploration';
import { TRAVEL_EVENTS } from '../data/travelEvents';

/** Default probability of a travel event occurring (30%) */
const DEFAULT_EVENT_CHANCE = 0.3;

/**
 * Generates a travel event based on the current biome
 * @param biomeId - The biome identifier (e.g., 'forest', 'mountain', 'swamp')
 * @param eventChance - Optional override for event probability (0-1). Default is 0.3
 * @returns A TravelEvent or null if no event occurs
 */
export function generateTravelEvent(
  biomeId: string,
  eventChance: number = DEFAULT_EVENT_CHANCE
): TravelEvent | null {
  // Check if an event should occur based on chance
  if (Math.random() > eventChance) {
    return null;
  }

  // Find matching biome events (support partial matching like 'forest_ancient' -> 'forest')
  let biomeEvents: TravelEvent[] = [];

  // Try exact match first
  if (TRAVEL_EVENTS[biomeId]) {
    biomeEvents = TRAVEL_EVENTS[biomeId];
  } else {
    // Try partial match (e.g., 'forest_ancient' matches 'forest')
    const biomeKeys = Object.keys(TRAVEL_EVENTS).filter(key => key !== 'general');
    for (const key of biomeKeys) {
      if (biomeId.includes(key) || key.includes(biomeId)) {
        biomeEvents = TRAVEL_EVENTS[key];
        break;
      }
    }
  }

  // Combine biome-specific events with general events
  const allEvents = [...biomeEvents, ...TRAVEL_EVENTS['general']];

  if (allEvents.length === 0) {
    return null;
  }

  // Calculate total weight (events without weight default to 1)
  const totalWeight = allEvents.reduce((sum, event) => sum + (event.weight ?? 1), 0);

  // Pick a random event based on weight
  let randomValue = Math.random() * totalWeight;

  for (const event of allEvents) {
    randomValue -= event.weight ?? 1;
    if (randomValue <= 0) {
      return event;
    }
  }

  // Fallback to last event (shouldn't normally reach here)
  return allEvents[allEvents.length - 1];
}
