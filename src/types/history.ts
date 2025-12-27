/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/history.ts
 * Defines the types for the World History system, providing long-term memory for major game events.
 * This fills the gap between ephemeral WorldRumors and static lore.
 */

export type WorldHistoryEventType =
  | 'FACTION_WAR'
  | 'POLITICAL_SHIFT'
  | 'MAJOR_BATTLE'
  | 'HEROIC_DEED'
  | 'CATASTROPHE'
  | 'DISCOVERY'
  | 'MYSTERY_SOLVED';

/**
 * Represents a reference to an entity involved in a historical event.
 */
export interface HistoricalParticipant {
  id: string;
  name: string;
  role: 'instigator' | 'victim' | 'hero' | 'observer';
  type: 'faction' | 'npc' | 'player';
}

/**
 * A permanent record of a significant event in the world's history.
 * Unlike rumors, these do not expire.
 */
export interface WorldHistoryEvent {
  id: string;
  timestamp: number; // Game day
  realtime: number; // Date.now() when it happened
  type: WorldHistoryEventType;

  /** Short summary for lists */
  title: string;

  /** Detailed account of the event */
  description: string;

  /** Where it happened */
  locationId?: string;

  /** Who was involved */
  participants: HistoricalParticipant[];

  /**
   * Impact score (1-100).
   * Used to filter "what everyone knows" vs "obscure history".
   */
  importance: number;

  /**
   * Tags for searching/filtering
   * e.g., ["war", "magic", "targaryen"]
   */
  tags: string[];
}

/**
 * The global registry of world history.
 */
export interface WorldHistory {
  events: WorldHistoryEvent[];

  /**
   * Helper to find events relevant to a specific faction or location.
   * Implementation will be in a service/utility.
   */
}

// TODO(Chronicler): Implement the event recording logic in WorldEventManager or a dedicated HistoryService.
// This should listen for major changes (e.g., Faction Skirmish results) and convert them into WorldHistoryEvents.
// [Recorder Update]: NPC Memory system has been integrated into GeminiService. World History recording is the next major missing system.
