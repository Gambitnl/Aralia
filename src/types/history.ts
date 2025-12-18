/**
 * @file src/types/history.ts
 * Type definitions for the World History system.
 *
 * This module tracks significant events that have occurred in the world,
 * allowing them to be referenced by lore, dialogue, and faction logic.
 */

import { GameDate } from './memory';

/**
 * Categories of historical events.
 */
export type WorldEventType =
  | 'FACTION_SKIRMISH'
  | 'MARKET_SHIFT'
  | 'RUMOR_SPREAD'
  | 'MAJOR_EVENT'
  | 'QUEST_COMPLETION'
  | 'LOCATION_DISCOVERY';

/**
 * A measurable consequence of an event.
 */
export interface WorldEventConsequence {
  /** The type of change that occurred */
  type: 'faction_power' | 'economy_shift' | 'location_status' | 'npc_death' | 'reputation_change';
  /** The ID of the entity affected */
  targetId: string;
  /** The new value or magnitude of change */
  value: number | string;
  /** Narrative description of the consequence */
  description: string;
}

/**
 * A persistent record of a significant event in the game world.
 * Unlike rumors, these do not expire (though their relevance may fade).
 */
export interface WorldEvent {
  /** Unique ID for the event */
  id: string;
  /** When it happened (Game Date timestamp) */
  timestamp: GameDate;
  /** The category of event */
  type: WorldEventType;
  /** Where it happened (Location ID) */
  locationId?: string;
  /** Narrative description of the event */
  description: string;
  /** Mechanical consequences of the event */
  consequences: WorldEventConsequence[];
  /** IDs of entities (NPCs, Player) who are aware of this event */
  knownBy: string[];
  /**
   * Importance (0-100).
   * Used to determine if this event passes into legend or is forgotten.
   */
  significance: number;
  /** Tags for searching/filtering (e.g., ["war", "house_cormaeril", "tragedy"]) */
  tags: string[];
}
