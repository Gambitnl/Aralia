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

import { TravelEvent, Discovery } from '../types/exploration';
import { TRAVEL_EVENTS } from '../data/travelEvents';
import { generateLandmark } from './landmarkService';

/** Default probability of a travel event occurring (30%) */
const DEFAULT_EVENT_CHANCE = 0.3;

/**
 * Generates a travel event based on the current biome
 * @param biomeId - The biome identifier (e.g., 'forest', 'mountain', 'swamp')
 * @param eventChance - Optional override for event probability (0-1). Default is 0.3
 * @param worldContext - Optional context for generating deterministic discoveries
 * @returns A TravelEvent or null if no event occurs
 */
export function generateTravelEvent(
  biomeId: string,
  eventChance: number = DEFAULT_EVENT_CHANCE,
  worldContext?: { worldSeed: number; x: number; y: number }
): TravelEvent | null {

  // 1. Check for Discoveries first (if context provided)
  // This allows landmarks to override random events, making them feel significant
  if (worldContext) {
    const landmark = generateLandmark(worldContext.worldSeed, { x: worldContext.x, y: worldContext.y }, biomeId);
    if (landmark) {
      const discovery: Discovery = {
        id: landmark.id,
        name: landmark.name,
        type: 'landmark',
        description: landmark.description,
        coordinates: { x: worldContext.x, y: worldContext.y },
        rewards: landmark.rewards,
        consequences: landmark.consequences,
      };

      // Construct a description that hints at consequences
      let desc = `You discovered ${landmark.name}! ${landmark.description}`;
      if (landmark.consequences.length > 0) {
         desc += ` ${landmark.consequences.map(c => c.description).join(' ')}`;
      }

      return {
        id: `discovery_${landmark.id}`,
        description: desc,
        effect: {
          type: 'discovery',
          amount: 0,
          description: `Discovered ${landmark.name}`,
          data: discovery,
        },
        weight: 100, // Always returned if generated
      };
    }
  }

  // 2. Standard Random Events
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
