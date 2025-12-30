import { describe, it, expect } from 'vitest';
import { WorldHistoryService } from '../WorldHistoryService';
import { GameState } from '../../types';
import { createMockGameState } from '../../utils/factories';

describe('WorldHistoryService', () => {
    const baseState = createMockGameState();

    it('should record a major event', () => {
        const newState = WorldHistoryService.recordEvent(baseState, {
            type: 'FACTION_WAR',
            title: 'The Great War',
            description: 'Two factions fought.',
            participants: [{ id: 'f1', name: 'Faction 1', role: 'instigator', type: 'faction' }],
            importance: 80,
            tags: ['war']
        });

        expect(newState.worldHistory).toBeDefined();
        expect(newState.worldHistory?.events).toHaveLength(1);
        expect(newState.worldHistory?.events[0].title).toBe('The Great War');
    });

    it('should ignore trivial events', () => {
        const newState = WorldHistoryService.recordEvent(baseState, {
            type: 'FACTION_WAR',
            title: 'Bar Fight',
            description: 'Two drunks fought.',
            participants: [],
            importance: 10, // Below threshold 20
        });

        expect(newState.worldHistory?.events || []).toHaveLength(0);
    });

    it('should retrieve events for an entity', () => {
        let state = WorldHistoryService.recordEvent(baseState, {
            type: 'FACTION_WAR',
            title: 'War A',
            description: '...',
            participants: [{ id: 'f1', name: 'F1', role: 'instigator', type: 'faction' }],
            importance: 50
        });

        state = WorldHistoryService.recordEvent(state, {
            type: 'FACTION_WAR',
            title: 'War B',
            description: '...',
            participants: [{ id: 'f2', name: 'F2', role: 'instigator', type: 'faction' }],
            importance: 50
        });

        const f1Events = WorldHistoryService.getHistoryForEntity(state.worldHistory, 'f1');
        expect(f1Events).toHaveLength(1);
        expect(f1Events[0].title).toBe('War A');
    });

    it('should format context string correctly', () => {
        let state = WorldHistoryService.recordEvent(baseState, {
            type: 'CATASTROPHE',
            title: 'Volcano Eruption',
            description: 'Boom.',
            participants: [],
            importance: 90
        });

        // Mock game day to match event timestamp (which is derived from state.gameTime)
        // Default mock state gameTime is 0 (Day 0) usually

        const context = WorldHistoryService.getRecentGlobalEventsContext(state.worldHistory, 10);
        expect(context).toContain('Volcano Eruption');
        expect(context).toContain('Boom');
    });
});
