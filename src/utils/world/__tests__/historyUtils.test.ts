
import { describe, it, expect } from 'vitest';
import {
    createEmptyHistory,
    addHistoryEvent,
    getRelevantHistory,
    findEventsByParticipant
} from '../historyUtils';
// TODO(lint-intent): 'WorldHistory' is unused in this test; use it in the assertion path or remove it.
import { WorldHistory as _WorldHistory, WorldHistoryEvent } from '../../../types/history';

describe('historyUtils', () => {
    const mockEvent: WorldHistoryEvent = {
        id: 'evt-1',
        timestamp: 100,
        realtime: 1234567890,
        type: 'FACTION_WAR',
        title: 'The Great Skirmish',
        description: 'Two factions fought.',
        participants: [
            { id: 'faction-a', name: 'Faction A', role: 'instigator', type: 'faction' }
        ],
        importance: 80,
        tags: ['war', 'skirmish']
    };

    it('should create an empty history', () => {
        const history = createEmptyHistory();
        expect(history.events).toEqual([]);
    });

    it('should add an event', () => {
        const history = createEmptyHistory();
        const updated = addHistoryEvent(history, mockEvent);
        expect(updated.events).toHaveLength(1);
        expect(updated.events[0]).toEqual(mockEvent);
    });

    it('should not add duplicate events', () => {
        const history = createEmptyHistory();
        const updated1 = addHistoryEvent(history, mockEvent);
        const updated2 = addHistoryEvent(updated1, mockEvent);
        expect(updated2.events).toHaveLength(1);
    });

    it('should filter by tags', () => {
        const history = { events: [mockEvent] };
        const results = getRelevantHistory(history, ['war']);
        expect(results).toHaveLength(1);

        const noMatch = getRelevantHistory(history, ['peace']);
        expect(noMatch).toHaveLength(0);
    });

    it('should filter by participant', () => {
        const history = { events: [mockEvent] };
        const results = findEventsByParticipant(history, 'faction-a');
        expect(results).toHaveLength(1);

        const noMatch = findEventsByParticipant(history, 'faction-b');
        expect(noMatch).toHaveLength(0);
    });
});
