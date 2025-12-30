/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/WorldHistoryService.ts
 * Service for managing the global World History.
 * Records major events like wars, plagues, and player achievements.
 */

import { v4 as uuidv4 } from 'uuid';
import { GameState } from '../types';
import { WorldHistory, WorldHistoryEvent, WorldHistoryEventType, HistoricalParticipant } from '../types/history';
import { getGameDay } from '../utils/timeUtils';

// Threshold for event importance to be recorded permanently
const MIN_IMPORTANCE_THRESHOLD = 20;

export class WorldHistoryService {
    /**
     * Creates a new WorldHistoryEvent and adds it to the game state.
     * Returns the updated GameState.
     */
    static recordEvent(
        state: GameState,
        params: {
            type: WorldHistoryEventType;
            title: string;
            description: string;
            participants: HistoricalParticipant[];
            importance: number;
            locationId?: string;
            tags?: string[];
        }
    ): GameState {
        // 1. Filter out trivial events
        if (params.importance < MIN_IMPORTANCE_THRESHOLD) {
            return state;
        }

        const gameDay = getGameDay(state.gameTime);

        // 2. Create the event
        const newEvent: WorldHistoryEvent = {
            id: `hist-${gameDay}-${uuidv4().substring(0, 8)}`,
            timestamp: gameDay,
            realtime: Date.now(),
            type: params.type,
            title: params.title,
            description: params.description,
            locationId: params.locationId,
            participants: params.participants,
            importance: params.importance,
            tags: params.tags || []
        };

        // 3. Update State
        // Initialize worldHistory if it doesn't exist
        const currentHistory: WorldHistory = state.worldHistory || { events: [] };

        // Append new event
        // We might want to limit the total history size eventually, but for "Permanent History"
        // we should keep it growing. We can archive older low-importance events later if needed.
        const updatedHistory: WorldHistory = {
            ...currentHistory,
            events: [...currentHistory.events, newEvent]
        };

        return {
            ...state,
            worldHistory: updatedHistory
        };
    }

    /**
     * Retrieves events relevant to a specific entity (faction, NPC, etc).
     */
    static getHistoryForEntity(history: WorldHistory | undefined, entityId: string): WorldHistoryEvent[] {
        if (!history) return [];
        return history.events.filter(e =>
            e.participants.some(p => p.id === entityId)
        ).sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Retrieves events relevant to a location.
     */
    static getHistoryForLocation(history: WorldHistory | undefined, locationId: string): WorldHistoryEvent[] {
        if (!history) return [];
        return history.events.filter(e =>
            e.locationId === locationId
        ).sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Formats recent history for AI context.
     * @param history The world history
     * @param daysLookback How many days back to look
     * @param limit Max number of events
     */
    static getRecentGlobalEventsContext(history: WorldHistory | undefined, currentGameDay: number, daysLookback: number = 30, limit: number = 5): string {
        if (!history || history.events.length === 0) return "Recent History: None.";

        const recentEvents = history.events
            .filter(e => currentGameDay - e.timestamp <= daysLookback)
            .sort((a, b) => b.importance - a.importance) // Most important first
            .slice(0, limit);

        if (recentEvents.length === 0) return "Recent History: Quiet.";

        return "Recent Global Events:\n" + recentEvents.map(e =>
            `- [Day ${e.timestamp}] ${e.title}: ${e.description} (Impact: ${e.importance})`
        ).join('\n');
    }
}
