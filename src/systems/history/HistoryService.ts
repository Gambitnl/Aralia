/**
 * @file src/systems/history/HistoryService.ts
 * Service for managing the creation and standardized formatting of World History events.
 *
 * This service ensures that events like faction wars, political shifts, and major discoveries
 * are recorded with consistent metadata, impact scores, and tagging.
 */
// TODO(lint-intent): 'HistoricalParticipant' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { WorldHistoryEvent, WorldHistoryEventType, HistoricalParticipant as _HistoricalParticipant } from '../../types/history';
import { GameState } from '../../types';
import { getGameDay } from '../../utils/core';

export class HistoryService {
  /**
   * Generates a unique ID for a history event.
   */
  private static generateId(): string {
    return `HIST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Creates a basic history event with common defaults.
   */
  private static createBaseEvent(
    state: GameState,
    type: WorldHistoryEventType,
    title: string,
    description: string,
    importance: number,
    tags: string[]
  ): WorldHistoryEvent {
    return {
      id: this.generateId(),
      timestamp: getGameDay(state.gameTime),
      realtime: Date.now(),
      type,
      title,
      description,
      importance,
      tags,
      participants: [],
      // locationId is optional
    };
  }

  /**
   * Creates an event for a Faction War or Skirmish.
   */
  static createFactionConflictEvent(
    state: GameState,
    title: string,
    description: string,
    aggressorId: string,
    defenderId: string,
    victorId: string | null, // null if stalemate
    locationId?: string
  ): WorldHistoryEvent {
    const event = this.createBaseEvent(
      state,
      'FACTION_WAR',
      title,
      description,
      7, // High default importance
      ['war', 'conflict', 'faction']
    );

    event.locationId = locationId;

    const aggressorName = state.factions[aggressorId]?.name || aggressorId;
    const defenderName = state.factions[defenderId]?.name || defenderId;

    event.participants.push(
      { id: aggressorId, name: aggressorName, role: 'instigator', type: 'faction' },
      { id: defenderId, name: defenderName, role: 'victim', type: 'faction' }
    );

    if (victorId) {
      event.tags.push('victory');
    } else {
      event.tags.push('stalemate');
    }

    return event;
  }

  /**
   * Creates an event for a Major Political Shift (e.g. alliance, betrayal).
   */
  static createPoliticalShiftEvent(
    state: GameState,
    title: string,
    description: string,
    factionA: string,
    factionB: string,
    shiftType: 'alliance' | 'war' | 'peace' | 'betrayal'
  ): WorldHistoryEvent {
    const event = this.createBaseEvent(
      state,
      'POLITICAL_SHIFT',
      title,
      description,
      6,
      ['politics', shiftType]
    );

    const nameA = state.factions[factionA]?.name || factionA;
    const nameB = state.factions[factionB]?.name || factionB;

    event.participants.push(
      { id: factionA, name: nameA, role: 'observer', type: 'faction' }, // Roles are ambiguous in politics
      { id: factionB, name: nameB, role: 'observer', type: 'faction' }
    );

    return event;
  }

  /**
   * Creates an event for a major Player Discovery or Achievement.
   */
  static createDiscoveryEvent(
    state: GameState,
    title: string,
    description: string,
    locationId: string
  ): WorldHistoryEvent {
    const event = this.createBaseEvent(
      state,
      'DISCOVERY',
      title,
      description,
      5,
      ['discovery', 'exploration']
    );

    event.locationId = locationId;
    event.participants.push({
      id: 'player',
      name: 'The Party',
      role: 'hero',
      type: 'player'
    });

    return event;
  }

  /**
   * Creates an event for a Catastrophe (natural disaster, plague).
   */
  static createCatastropheEvent(
    state: GameState,
    title: string,
    description: string,
    locationId: string
  ): WorldHistoryEvent {
    const event = this.createBaseEvent(
      state,
      'CATASTROPHE',
      title,
      description,
      8,
      ['disaster', 'environment']
    );

    event.locationId = locationId;
    return event;
  }
}
