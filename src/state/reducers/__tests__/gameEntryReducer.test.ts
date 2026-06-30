/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/__tests__/gameEntryReducer.test.ts
 *
 * Pins the opening-situation entry slice: the entry actions drive the state
 * machine, and crucially an existing-save LOAD does NOT trigger generation.
 */

import { describe, it, expect } from 'vitest';
import { gameEntryReducer } from '../gameEntryReducer';
import { conversationReducer } from '../conversationReducer';
import { createMockGameState } from '../../../utils/factories';
import { INITIAL_GAME_ENTRY_STATE, INITIAL_SCENE_IMAGE_STATE, type OpeningSituation } from '../../../systems/gameEntry/types';
import type { ConversationMessage, ConversationNpcParticipant } from '../../../types/conversation';

const SITUATION: OpeningSituation = {
    setting: { place: 'the steps', timeOfDay: 'dusk', weather: 'rain' },
    predicament: 'A guard seizes a merchant.',
    npcs: [{ id: 'sit-1', name: 'Volk', role: 'guard', disposition: 'aggressive', goal: 'a bribe' }],
    openingLine: { speakerId: 'sit-1', text: 'Walk on.' },
};

describe('gameEntryReducer', () => {
    it('BEGIN moves idle → generating', () => {
        const state = createMockGameState();
        const next = gameEntryReducer({ ...state, gameEntry: INITIAL_GAME_ENTRY_STATE }, { type: 'BEGIN_OPENING_SITUATION' });
        expect(next.gameEntry?.status).toBe('generating');
    });

    it('full happy path: BEGIN → RESOLVE lands in-situation with the situation', () => {
        const state = createMockGameState();
        let entry = gameEntryReducer({ ...state, gameEntry: INITIAL_GAME_ENTRY_STATE }, { type: 'BEGIN_OPENING_SITUATION' });
        entry = gameEntryReducer({ ...state, ...entry }, { type: 'RESOLVE_OPENING_SITUATION', payload: SITUATION });
        expect(entry.gameEntry?.status).toBe('in-situation');
        expect(entry.gameEntry?.situation).toEqual(SITUATION);
    });

    it('FAIL moves generating → model-unavailable with the error (no fallback)', () => {
        const state = createMockGameState();
        const generating = gameEntryReducer({ ...state, gameEntry: INITIAL_GAME_ENTRY_STATE }, { type: 'BEGIN_OPENING_SITUATION' });
        const failed = gameEntryReducer({ ...state, ...generating }, { type: 'FAIL_OPENING_SITUATION', payload: 'NO_MODEL' });
        expect(failed.gameEntry?.status).toBe('model-unavailable');
        expect(failed.gameEntry?.error).toBe('NO_MODEL');
        expect(failed.gameEntry?.situation).toBeNull();
    });

    it('BEGIN after a failure RETRIES back into generating', () => {
        const state = createMockGameState();
        const failed = { gameEntry: { status: 'model-unavailable' as const, situation: null, error: 'NO_MODEL', sceneImage: INITIAL_SCENE_IMAGE_STATE } };
        const retried = gameEntryReducer({ ...state, ...failed }, { type: 'BEGIN_OPENING_SITUATION' });
        expect(retried.gameEntry?.status).toBe('generating');
        expect(retried.gameEntry?.error).toBeNull();
    });

    it('SKIP after a failure dismisses the opening gate without inventing a situation', () => {
        const state = createMockGameState();
        const failed = { gameEntry: { status: 'model-unavailable' as const, situation: null, error: 'NO_MODEL', sceneImage: INITIAL_SCENE_IMAGE_STATE } };

        // This is the player's escape hatch when Ollama is unavailable: the
        // failed entry gate clears, and no generated or canned situation appears.
        const skipped = gameEntryReducer({ ...state, ...failed }, { type: 'SKIP_OPENING_SITUATION' });

        expect(skipped.gameEntry).toEqual(INITIAL_GAME_ENTRY_STATE);
    });

    it('PLACE_SITUATION_NPCS registers NPCs and adds them to the active scene list', () => {
        const state = createMockGameState();
        const npc = {
            id: 'sit-1', name: 'Volk', role: 'guard', baseDescription: 'a guard',
            initialPersonalityPrompt: 'gruff', stats: {}, biography: {}, equippedItems: {},
        } as never;
        const next = gameEntryReducer(
            { ...state, currentLocationActiveDynamicNpcIds: ['existing-npc'] },
            { type: 'PLACE_SITUATION_NPCS', payload: { npcs: [npc] } },
        );
        expect(next.generatedNpcs?.['sit-1']).toBeDefined();
        expect(next.currentLocationActiveDynamicNpcIds).toContain('existing-npc');
        expect(next.currentLocationActiveDynamicNpcIds).toContain('sit-1');
        // Seeds a memory record so the opening conversation can persist met
        // state / a remembered fact / a disposition shift for the stranger.
        expect(next.npcMemory?.['sit-1']).toBeDefined();
        expect(next.npcMemory?.['sit-1'].disposition).toBe(0);
    });

    it('PLACE_SITUATION_NPCS with no NPCs is a no-op', () => {
        const state = createMockGameState();
        expect(gameEntryReducer(state, { type: 'PLACE_SITUATION_NPCS', payload: { npcs: [] } })).toEqual({});
    });

    it('does NOT trigger generation for unrelated actions (e.g. a load)', () => {
        const state = createMockGameState();
        // An existing-save load never dispatches BEGIN_OPENING_SITUATION, so the
        // slice stays idle for any other action.
        const next = gameEntryReducer(
            { ...state, gameEntry: INITIAL_GAME_ENTRY_STATE },
            { type: 'SET_CONVERSATION_PENDING', payload: true } as never,
        );
        expect(next).toEqual({});
    });

    // Scene-illustration lifecycle: orthogonal to the entry status (the picture is
    // optional enrichment), so these only touch sceneImage and leave status intact.
    const inSituation = () => ({ ...INITIAL_GAME_ENTRY_STATE, status: 'in-situation' as const, situation: SITUATION });

    it('SCENE_IMAGE_REQUEST_START marks the scene generating without touching status', () => {
        const state = createMockGameState();
        const next = gameEntryReducer({ ...state, gameEntry: inSituation() }, { type: 'SCENE_IMAGE_REQUEST_START' });
        expect(next.gameEntry?.sceneImage).toEqual({ status: 'generating', url: null, error: null });
        expect(next.gameEntry?.status).toBe('in-situation');
        expect(next.gameEntry?.situation).toEqual(SITUATION);
    });

    it('SCENE_IMAGE_REQUEST_SUCCESS stores the url and marks the scene ready', () => {
        const state = createMockGameState();
        const next = gameEntryReducer(
            { ...state, gameEntry: inSituation() },
            { type: 'SCENE_IMAGE_REQUEST_SUCCESS', payload: { url: 'assets/images/scenes/generated/opening_1.png' } },
        );
        expect(next.gameEntry?.sceneImage).toEqual({
            status: 'ready',
            url: 'assets/images/scenes/generated/opening_1.png',
            error: null,
        });
    });

    it('SCENE_IMAGE_REQUEST_ERROR records an honest error and no fallback url', () => {
        const state = createMockGameState();
        const next = gameEntryReducer(
            { ...state, gameEntry: inSituation() },
            { type: 'SCENE_IMAGE_REQUEST_ERROR', payload: { error: 'Scene illustration unavailable.' } },
        );
        expect(next.gameEntry?.sceneImage).toEqual({
            status: 'error',
            url: null,
            error: 'Scene illustration unavailable.',
        });
    });
});

describe('conversationReducer — situational participants extension', () => {
    it('seeds a situation conversation with multiple messages + npcParticipants', () => {
        const state = createMockGameState();
        const messages: ConversationMessage[] = [
            { id: 'm1', speakerId: 'narrator', text: 'A guard seizes a merchant.', timestamp: 1 },
            { id: 'm2', speakerId: 'sit-1', text: 'Walk on.', timestamp: 2 },
        ];
        const npcParticipants: ConversationNpcParticipant[] = [
            { id: 'sit-1', name: 'Volk', personality: 'aggressive guard' },
        ];
        const next = conversationReducer(state, {
            type: 'START_CONVERSATION',
            payload: { companionIds: ['sit-1'], initialMessages: messages, kind: 'situation', npcParticipants },
        });
        expect(next.activeConversation?.messages).toHaveLength(2);
        expect(next.activeConversation?.kind).toBe('situation');
        expect(next.activeConversation?.npcParticipants?.[0].name).toBe('Volk');
        expect(next.activeConversation?.isPlayerTurn).toBe(true);
    });

    it('keeps legacy companion conversations working (single initialMessage, no npcParticipants)', () => {
        const state = createMockGameState();
        const initialMessage: ConversationMessage = { id: 'm1', speakerId: 'comp-1', text: 'Hello.', timestamp: 1 };
        const next = conversationReducer(state, {
            type: 'START_CONVERSATION',
            payload: { companionIds: ['comp-1'], initialMessage },
        });
        expect(next.activeConversation?.messages).toHaveLength(1);
        expect(next.activeConversation?.participants).toEqual(['comp-1']);
        expect(next.activeConversation?.kind).toBeUndefined();
        expect(next.activeConversation?.npcParticipants).toBeUndefined();
    });
});
