/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/historyUtils.ts
 * Utility functions for managing and retrieving world history events.
 * Provides the functional interface for the World History memory system.
 */

import { WorldHistory, WorldHistoryEvent } from '../types/history';

/**
 * Initializes an empty WorldHistory if one doesn't exist.
 */
export function createEmptyHistory(): WorldHistory {
    return {
        events: []
    };
}

/**
 * Adds a new event to the world history.
 * @param history The current world history.
 * @param event The event to add.
 * @returns A new WorldHistory object with the added event.
 */
export function addHistoryEvent(history: WorldHistory, event: WorldHistoryEvent): WorldHistory {
    // Basic validation to ensure we don't add duplicate IDs
    if (history.events.some(e => e.id === event.id)) {
        return history;
    }

    return {
        ...history,
        events: [...history.events, event]
    };
}

/**
 * Retrieves history events filtered by tags and minimum importance.
 * Useful for querying specific topics (e.g., "Tell me about the 'dragon' wars").
 *
 * @param history The world history.
 * @param tags Array of tags to filter by (OR logic: match any). If empty, ignores tag filter.
 * @param minImportance Minimum importance score (0-100) to include.
 * @returns Array of matching events, sorted by timestamp (newest first).
 */
export function getRelevantHistory(
    history: WorldHistory,
    tags: string[] = [],
    minImportance: number = 0
): WorldHistoryEvent[] {
    return history.events
        .filter(event => {
            if (event.importance < minImportance) return false;
            if (tags.length === 0) return true;
            return event.tags.some(tag => tags.includes(tag));
        })
        .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Finds all historical events involving a specific entity (Faction, NPC, or Player).
 *
 * @param history The world history.
 * @param entityId The ID of the participant.
 * @returns Array of events where the entity was a participant.
 */
export function findEventsByParticipant(history: WorldHistory, entityId: string): WorldHistoryEvent[] {
    return history.events
        .filter(event => event.participants.some(p => p.id === entityId))
        .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Finds events that occurred at a specific location.
 *
 * @param history The world history.
 * @param locationId The ID of the location.
 * @returns Array of events at that location.
 */
export function findEventsByLocation(history: WorldHistory, locationId: string): WorldHistoryEvent[] {
    return history.events
        .filter(event => event.locationId === locationId)
        .sort((a, b) => b.timestamp - a.timestamp);
}
