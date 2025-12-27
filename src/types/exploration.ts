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
  type: 'buff' | 'map_reveal' | 'reputation' | 'damage' | 'debuff';
  targetId?: string; // factionId or buffId (e.g., 'blessing_of_vitality')
  duration?: number; // hours (for buffs/debuffs)
  value?: number; // reputation amount, radius (for map_reveal), or damage amount
  description: string;
}

export interface Discovery {
  id: string;
  name: string;
  type: string; // 'landmark', 'resource', 'secret'
  description: string;
  coordinates: { x: number; y: number };
  rewards?: DiscoveryReward[];
  consequences?: DiscoveryConsequence[];
  firstDiscoveredBy?: string; // Character ID
}

/**
 * Effect that can be applied when a travel event occurs.
 * Supports delays, health changes, item gains, and discoveries.
 */
export interface TravelEventEffect {
  type: 'delay' | 'health_change' | 'item_gain' | 'discovery' | 'buff' | 'gold_gain' | 'xp_gain';
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
 * Definition for a skill check requirement.
 */
export interface SkillCheck {
  skill: string; // e.g., 'survival', 'athletics', 'perception'
  dc: number;
}

/**
 * A branch of a travel event that executes if a skill check is passed (or failed).
 */
export interface TravelEventBranch {
  check: SkillCheck;
  /**
   * Effect applied if the check passes.
   * If not provided, it falls back to the default effect or simply avoids the default negative effect.
   */
  successEffect?: TravelEventEffect;
  successDescription: string;

  /**
   * Effect applied if the check fails.
   * If not provided, it typically falls back to the default effect of the parent event.
   */
  failureEffect?: TravelEventEffect;
  failureDescription?: string;
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

  /**
   * Optional skill check that can modify the outcome.
   * If present, the system will check the party leader's skill.
   * If passed, the 'successEffect' is used instead of the default 'effect'.
   * If failed, 'failureEffect' (or default 'effect') is used.
   */
  skillCheck?: TravelEventBranch;
}

/**
 * Maps biome identifiers to their available travel events.
 * The 'general' key contains events that can occur in any biome.
 */
export type BiomeEventMap = Record<string, TravelEvent[]>;
