/**
 * @file src/utils/historyUtils.ts
 * Utility functions for managing the World History system.
 */

import { GameState } from '../types';
import { WorldEvent, WorldEventType, WorldEventConsequence } from '../types/history';
import { GameDate } from '../types/memory';

/**
 * Creates a new historical event entry.
 */
export function createWorldEvent(
  id: string,
  type: WorldEventType,
  timestamp: GameDate,
  description: string,
  significance: number,
  locationId?: string,
  tags: string[] = []
): WorldEvent {
  return {
    id,
    type,
    timestamp,
    description,
    significance,
    locationId,
    consequences: [],
    knownBy: [],
    tags
  };
}

/**
 * Adds a consequence to a world event.
 */
export function addConsequence(
  event: WorldEvent,
  consequence: WorldEventConsequence
): WorldEvent {
  return {
    ...event,
    consequences: [...event.consequences, consequence]
  };
}

/**
 * Records an event into the global history state.
 * @param state The current GameState
 * @param event The event to record
 * @returns Updated GameState
 */
export function recordEvent(state: GameState, event: WorldEvent): GameState {
  const currentHistory = state.worldHistory || [];
  return {
    ...state,
    worldHistory: [event, ...currentHistory] // Newest first
  };
}

/**
 * Retrieves events relevant to a specific context or entity.
 * @param state GameState
 * @param entityId The ID of the entity (NPC/Player) recalling memory
 * @param minSignificance Filter out trivial events
 */
export function getKnownEvents(
  state: GameState,
  entityId: string,
  minSignificance: number = 0
): WorldEvent[] {
  const history = state.worldHistory || [];
  return history.filter(event =>
    event.significance >= minSignificance &&
    (event.knownBy.includes(entityId) || event.knownBy.includes('public'))
  );
}

/**
 * Marks an event as known by a specific entity.
 */
export function learnEvent(state: GameState, eventId: string, entityId: string): GameState {
  const history = state.worldHistory || [];
  const eventIndex = history.findIndex(e => e.id === eventId);

  if (eventIndex === -1) return state;

  const event = history[eventIndex];
  if (event.knownBy.includes(entityId)) return state;

  const updatedEvent = {
    ...event,
    knownBy: [...event.knownBy, entityId]
  };

  const newHistory = [...history];
  newHistory[eventIndex] = updatedEvent;

  return {
    ...state,
    worldHistory: newHistory
  };
}
