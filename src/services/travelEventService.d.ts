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
/**
 * Generates a travel event based on the current biome
 * @param biomeId - The biome identifier (e.g., 'forest', 'mountain', 'wetland')
 * @param eventChance - Optional override for event probability (0-1). Default is 0.3
 * @param worldContext - Optional context for generating deterministic discoveries
 * @param rand - Optional random source (0 ≤ rand() < 1) replacing BOTH internal
 *   Math.random() draws (chance gate + weighted pick) so a caller-seeded stream
 *   makes the roll deterministic (mountains trip events). Omit for the legacy
 *   Math.random behavior — unchanged.
 * @returns A TravelEvent or null if no event occurs
 */
export declare function generateTravelEvent(biomeId: string, eventChance?: number, worldContext?: {
    worldSeed: number;
    x: number;
    y: number;
}, rand?: () => number): TravelEvent | null;
