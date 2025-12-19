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

export interface DiscoveryReward {
  type: 'item' | 'xp' | 'health' | 'gold';
  resourceId?: string; // itemId for items
  amount: number;
  description: string;
}

export interface DiscoveryConsequence {
  type: 'buff' | 'map_reveal' | 'reputation';
  targetId?: string; // factionId or buffId (e.g., 'blessing_of_vitality')
  duration?: number; // hours (for buffs)
  value?: number; // reputation amount or radius (for map_reveal)
  description: string;
}

/**
 * Represents a choice the player can make at a discovery site.
 */
export interface DiscoveryOption {
  id: string;
  label: string;
  description: string;
  skillCheck?: {
    skill: string; // e.g., 'Arcana', 'Athletics', 'Religion'
    difficulty: number;
  };
  successRewards?: DiscoveryReward[];
  successConsequences?: DiscoveryConsequence[];
  failureConsequences?: DiscoveryConsequence[]; // e.g., damage, curse
}

export interface Discovery {
  id: string;
  name: string;
  type: string; // 'landmark', 'resource', 'secret'
  description: string;
  coordinates: { x: number; y: number };
  rewards?: DiscoveryReward[]; // Immediate/Passive rewards
  consequences?: DiscoveryConsequence[]; // Immediate/Passive consequences
  interactions?: DiscoveryOption[]; // Interactive choices
  firstDiscoveredBy?: string; // Character ID
}

/**
 * Effect that can be applied when a travel event occurs.
 * Supports delays, health changes, item gains, and discoveries.
 */
export interface TravelEventEffect {
  type: 'delay' | 'health_change' | 'item_gain' | 'discovery' | 'buff';
  /**
   * The numerical value of the effect:
   * - delay: hours
   * - health_change: HP amount (negative for damage, positive for healing)
   * - item_gain: quantity
   * - buff: duration or magnitude
   */
  amount: number;
  description?: string;
  data?: Discovery; // For 'discovery' type
  itemId?: string; // For 'item_gain' type
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
