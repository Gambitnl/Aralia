/**
 * @file src/types/exploration.ts
 *
 * Type definitions for the procedural travel event system.
 *
 * This file was recreated because PR #296 (feat(exploration): Add procedural travel event system)
 * claimed to create it but the file was never actually committed. The types here support
 * random events that trigger during world map travel to make exploration more dynamic.
 *
 * Used by:
 * - src/services/travelEventService.ts - Generates events based on biome
 * - src/data/travelEvents.ts - Stores event definitions by biome
 * - src/hooks/actions/handleMovement.ts - Triggers events during movement
 */

export interface Discovery {
  id: string;
  name: string;
  type: string; // 'landmark', 'resource', 'secret'
  description: string;
  coordinates: { x: number; y: number };
}

/**
 * Effect that can be applied when a travel event occurs.
 * Currently supports travel delays, with room for future expansion
 * (damage from hazards, temporary buffs, discovery of locations, etc.)
 */
export interface TravelEventEffect {
  type: 'delay' | 'damage' | 'buff' | 'discovery';
  amount: number;
  description?: string;
  data?: Discovery; // For 'discovery' type
}

/**
 * A single travel event that can occur during world map movement.
 * Events display flavor text and can optionally affect gameplay (e.g., delays).
 */
export interface TravelEvent {
  id: string;
  description: string;
  effect?: TravelEventEffect;
  weight?: number; // Higher weight = more likely to occur (default: 1)
}

/**
 * Maps biome identifiers to their available travel events.
 * The 'general' key contains events that can occur in any biome.
 */
export type BiomeEventMap = Record<string, TravelEvent[]>;
