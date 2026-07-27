/**
 * @file src/systems/history/HistoryService.ts
 * Service for managing the creation and standardized formatting of World History events.
 *
 * This service ensures that events like faction wars, political shifts, and major discoveries
 * are recorded with consistent metadata, impact scores, and tagging.
 */
import { WorldHistoryEvent } from '../../types/history';
import { GameState } from '../../types';
export declare class HistoryService {
    /**
     * Generates a unique ID for a history event.
     */
    private static generateId;
    /**
     * Creates a basic history event with common defaults.
     */
    private static createBaseEvent;
    /**
     * Creates an event for a Faction War or Skirmish.
     */
    static createFactionConflictEvent(state: GameState, title: string, description: string, aggressorId: string, defenderId: string, victorId: string | null, // null if stalemate
    locationId?: string): WorldHistoryEvent;
    /**
     * Creates an event for a Major Political Shift (e.g. alliance, betrayal).
     */
    static createPoliticalShiftEvent(state: GameState, title: string, description: string, factionA: string, factionB: string, shiftType: 'alliance' | 'war' | 'peace' | 'betrayal'): WorldHistoryEvent;
    /**
     * Creates an event for a major Player Discovery or Achievement.
     */
    static createDiscoveryEvent(state: GameState, title: string, description: string, locationId: string): WorldHistoryEvent;
    /**
     * Creates an event for a Catastrophe (natural disaster, plague).
     */
    static createCatastropheEvent(state: GameState, title: string, description: string, locationId: string): WorldHistoryEvent;
}
