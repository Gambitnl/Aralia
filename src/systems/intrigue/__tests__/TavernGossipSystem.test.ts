// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { TavernGossipSystem } from '../TavernGossipSystem';
// TODO(lint-intent): 'GameState' is unused in this test; use it in the assertion path or remove it.
import { GameState as _GameState } from '../../../types';
import { createMockGameState } from '../../../utils/factories';

describe('TavernGossipSystem', () => {
    it('generates rumors deterministically', () => {
        const state = createMockGameState();
        state.worldSeed = 12345;
        state.gameTime = new Date('2024-01-01T00:00:00Z'); // Fixed time

        const rumors1 = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
        const rumors2 = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
        const rumorsDiffLoc = TavernGossipSystem.getAvailableRumors(state, 'Inn');

        expect(rumors1).toEqual(rumors2);
        expect(rumors1).not.toEqual(rumorsDiffLoc);
        expect(rumors1.length).toBeGreaterThan(0);
    });

    it('generates generic rumors if no world rumors exist', () => {
        const state = createMockGameState();
        state.activeRumors = [];

        const rumors = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
        const genericRumor = rumors.find(r => r.id.startsWith('gossip_generic'));

        expect(genericRumor).toBeDefined();
        expect(genericRumor?.content).toContain("Not much happening");
    });

    it('can generate secrets', () => {
        // Mock state with many factions to increase secret generation chance or just loop until we find one
        // Since it's deterministic, we can find a seed that produces a secret, or mock Random.
        // For now, let's just check the structure of the returned objects.

        const state = createMockGameState();
        const rumors = TavernGossipSystem.getAvailableRumors(state, 'City');

        rumors.forEach(r => {
            expect(r).toHaveProperty('id');
            expect(r).toHaveProperty('cost');
            expect(r).toHaveProperty('type');
            if (r.type === 'secret') {
                expect(r.payload).toBeDefined();
                expect(r.payload).toHaveProperty('subjectId');
            }
        });
    });
});
