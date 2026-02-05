/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/WorldHistoryService.ts
 * Service for converting real-time game outcomes into permanent historical records.
 */

import { WorldHistoryEvent, HistoricalParticipant } from '../types/history';
import { Faction } from '../types/factions';
import { generateId } from '../utils/core/idGenerator';
import { getGameDay } from '../utils/core/timeUtils';

export class WorldHistoryService {
    /**
     * Converts a faction skirmish outcome into a WorldHistoryEvent.
     */
    static createSkirmishEvent(
        winner: Faction,
        loser: Faction,
        gameTime: Date
    ): WorldHistoryEvent {
        const gameDay = getGameDay(gameTime);
        
        const participants: HistoricalParticipant[] = [
            {
                id: winner.id,
                name: winner.name,
                role: 'instigator', // For simplicity, we assign roles
                type: 'faction'
            },
            {
                id: loser.id,
                name: loser.name,
                role: 'victim',
                type: 'faction'
            }
        ];

        return {
            id: `hist-${generateId()}`,
            timestamp: gameDay,
            realtime: Date.now(),
            type: 'MAJOR_BATTLE',
            title: `The Skirmish of ${winner.name} and ${loser.name}`,
            description: `A violent confrontation occurred between ${winner.name} and ${loser.name}. ${winner.name} emerged victorious, solidifying their influence while ${loser.name} was forced to retreat.`,
            participants,
            importance: 40, // Base importance for skirmishes
            tags: ['war', 'faction_conflict', winner.id, loser.id]
        };
    }
}
