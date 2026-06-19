import { describe, it, expect } from 'vitest';
import {
    createEmptyHistory,
    addHistoryEvent,
    getRelevantHistory,
    findEventsByParticipant,
    pruneHistory
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

    it('should add an event and prune if capacity is exceeded', () => {
        let history = createEmptyHistory();
        
        // Add 1100 events
        for (let i = 0; i < 1100; i++) {
            history.events.push({
                ...mockEvent,
                id: `evt-${i}`,
                timestamp: i,
                importance: 50 // Unprotected
            });
        }

        // Adding the 1101th event should trigger pruning back to 1000
        const newEvent = { ...mockEvent, id: 'evt-1100', timestamp: 1100, importance: 50 };
        history = addHistoryEvent(history, newEvent);

        expect(history.events).toHaveLength(1000);
        // The oldest 101 events should have been pruned.
        // evt-0 to evt-100 should be gone. evt-101 should be the first one.
        expect(history.events[0].id).toBe('evt-101');
        // The newest event should be present
        expect(history.events[999].id).toBe('evt-1100');
    });

    it('should protect events with importance >= 80 from pruning', () => {
        let history = createEmptyHistory();
        
        // Add 1100 events, 50 of them are protected
        for (let i = 0; i < 1100; i++) {
            history.events.push({
                ...mockEvent,
                id: `evt-${i}`,
                timestamp: i,
                importance: i < 50 ? 90 : 50 // First 50 are protected
            });
        }

        // Add 1101th event
        const newEvent = { ...mockEvent, id: 'evt-1100', timestamp: 1100, importance: 50 };
        history = addHistoryEvent(history, newEvent);

        expect(history.events).toHaveLength(1000);
        
        // The first 50 protected events should still exist
        for (let i = 0; i < 50; i++) {
            expect(history.events.some(e => e.id === `evt-${i}`)).toBe(true);
        }

        // The oldest unprotected events were pruned.
        // Total unprotected = 1051. Target is 1000 total -> 950 unprotected.
        // We need to prune 101 unprotected events.
        // Unprotected are from i=50 to i=1100.
        // So events 50 through 150 should be pruned.
        expect(history.events.some(e => e.id === 'evt-50')).toBe(false);
        expect(history.events.some(e => e.id === 'evt-150')).toBe(false);
        expect(history.events.some(e => e.id === 'evt-151')).toBe(true);
    });

    it('should allow history to exceed target cap if too many events are protected', () => {
        let history = createEmptyHistory();
        
        // Add 1100 protected events
        for (let i = 0; i < 1100; i++) {
            history.events.push({
                ...mockEvent,
                id: `evt-${i}`,
                timestamp: i,
                importance: 85
            });
        }

        const newEvent = { ...mockEvent, id: 'evt-1100', timestamp: 1100, importance: 90 };
        history = addHistoryEvent(history, newEvent);

        // Cap should be exceeded because all 1101 events are protected
        expect(history.events).toHaveLength(1101);
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
