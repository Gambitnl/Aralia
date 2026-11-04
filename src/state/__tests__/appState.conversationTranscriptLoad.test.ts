import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/core/factories';
import type { BanterMoment } from '../../types/companions';
import { COMPANIONS } from '../../data/companions';

describe('LOAD_GAME_SUCCESS preserves saved delivered conversation speech', () => {
    const savedConversation = () => createMockGameState({
        worldSeed: 7741,
        currentLocationId: 'cell_3052',
        companions: { elara_vance: COMPANIONS.elara_vance },
        activeConversation: {
            id: 'load-open-transcript',
            participants: ['elara_vance'],
            startedAt: 1234,
            isPlayerTurn: false,
            pendingResponse: true,
            messages: [
                { id: 'opening', speakerId: 'elara_vance', text: 'I wanted to restore the temple.', timestamp: 1200 },
                { id: 'question', speakerId: 'player', text: 'Why did you want to restore the temple to begin with?', timestamp: 1230 },
                { id: 'note', speakerId: 'narrator', text: 'Persuasion check: 18, success.', timestamp: 1232, memoryHandled: true },
            ],
        },
    });

    it('archives saved delivered lines before clearing transient conversation UI and preserves old archives', () => {
        const ambient: BanterMoment = {
            id: 'load-open-transcript', timestamp: 10, locationId: 'cell_1', participants: ['one'],
            lines: [{ speakerId: 'one', speakerName: 'One', text: 'Ambient archive remains.' }],
        };
        const saved = { ...savedConversation(), archivedBanters: [ambient] };

        const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });

        expect(loaded.activeConversation).toBeNull();
        expect(loaded.isDialogueInterfaceOpen).toBe(false);
        expect(loaded.archivedBanters).toHaveLength(2);
        expect(loaded.archivedBanters.find(entry => entry.id === ambient.id)).toEqual(ambient);
        const retainedConversation = loaded.archivedBanters.find(entry => entry.source?.kind === 'player-conversation');
        expect(retainedConversation).toMatchObject({
            id: expect.not.stringMatching(/^load-open-transcript$/),
            locationId: 'cell_3052',
            participants: ['elara_vance'],
            source: {
                kind: 'player-conversation', conversationId: 'load-open-transcript', worldSeed: 7741,
                capture: 'loaded-open', pendingAtCapture: true, semanticStatus: 'not-run',
            },
            lines: [
                { messageId: 'opening', speakerId: 'elara_vance', speakerName: 'Elara Vance', text: 'I wanted to restore the temple.' },
                { messageId: 'question', speakerId: 'player', speakerName: 'You', text: 'Why did you want to restore the temple to begin with?' },
                { messageId: 'note', speakerId: 'narrator', speakerName: 'Narration', text: 'Persuasion check: 18, success.', memoryHandled: true },
            ],
        });
        expect(loaded.playerGroundPos).toEqual(saved.playerGroundPos);
        expect(loaded.inventory).toEqual(saved.inventory);
        expect(loaded.questLog).toEqual(saved.questLog);
        expect(loaded.worldSeed).toBe(saved.worldSeed);
        expect(loaded.currentLocationId).toBe(saved.currentLocationId);
        expect(loaded.companions).toEqual(saved.companions);
        expect(loaded.npcMemory).toEqual(saved.npcMemory);
    });

    it('does not duplicate the captured transcript on repeated loads', () => {
        const saved = savedConversation();
        const first = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
        const second = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: first });

        expect(second.activeConversation).toBeNull();
        expect(second.archivedBanters.filter(entry => entry.id === 'load-open-transcript')).toHaveLength(1);
        expect(second.archivedBanters.find(entry => entry.id === 'load-open-transcript')).toEqual(
            first.archivedBanters.find(entry => entry.id === 'load-open-transcript'),
        );
    });
});
