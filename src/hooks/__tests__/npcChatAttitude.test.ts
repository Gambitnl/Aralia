/**
 * @file src/hooks/__tests__/npcChatAttitude.test.ts
 *
 * NPC lives (2026-11-04, GG-596 follow-up 2): the free-text chat uses the same
 * attitude as the greeting. Two lanes carry free text to a model:
 *  - the dialogue window (useDialogueSystem.generateResponse): the system
 *    prompt gets the stance line, and a stance that fell to "shuns" during the
 *    talk gives an authored refusal with no model call;
 *  - the conversation panel (useConversation): a non-companion speaker gets the
 *    stance line in its personality string; a companion does not.
 *
 * The assertions read the prompt the model is actually handed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDialogueSystem } from '../useDialogueSystem';
import { useConversation } from '../useConversation';
import { NPC_SHUN_REPLY } from '../../systems/social/npcLifeReactions';
import type { GameState } from '../../types';
import type { RichNPC } from '../../types/world';
import { getGameEpoch } from '../../utils/core';

const text = vi.hoisted(() => ({
    generateNPCResponse: vi.fn(async (_npcName: string, _playerLine: string, _systemPrompt: string) => ({
        success: true,
        data: { text: 'Hm.' },
        metadata: {},
    })),
}));
vi.mock('../../services/ollamaTextService', () => text);

const ollama = vi.hoisted(() => ({
    prepareForTask: vi.fn(async () => ({ status: 'ready', model: 'test-model' })),
    summarizeConversation: vi.fn(async () => ({ success: false, error: 'offline' })),
    continueConversation: vi.fn(async (
        _participants: Array<{ id: string; name: string; personality: string }>,
        _history: unknown[],
        _context: unknown,
    ): Promise<unknown> => ({ success: false, error: 'offline' })),
}));
vi.mock('../../services/ollama', () => ({ OllamaService: ollama }));
vi.mock('../../systems/worldforge/townsim/chronicleForLocation', () => ({
    townChronicleForLocation: () => [],
}));

const DAY_FOUR = new Date(getGameEpoch().getTime() + 3 * 24 * 60 * 60 * 1000);
const NPC_ID = 'burg_resident_12';

const dialogueState = (disposition: number): GameState =>
    ({
        activeDialogueSession: { npcId: NPC_ID, discussedTopicIds: [] },
        gameTime: DAY_FOUR,
        worldSeed: 42,
        party: [],
        generatedNpcs: {
            [NPC_ID]: {
                id: NPC_ID,
                name: 'Maren Holt',
                baseDescription: 'A tanner.',
                initialPersonalityPrompt: 'You are Maren Holt, a tanner in Westhollow.',
                role: 'civilian',
            } as unknown as RichNPC,
        },
        npcMemory: { [NPC_ID]: { disposition, suspicion: 'none', goals: [], knownFacts: [], witnessedActs: [] } },
        townRumors: [],
    } as unknown as GameState);

describe('dialogue window free text reads the greeting attitude', () => {
    beforeEach(() => text.generateNPCResponse.mockClear());

    it('puts a cold stance into the system prompt', async () => {
        const { result } = renderHook(() => useDialogueSystem(dialogueState(-50), vi.fn()));
        await act(async () => { await result.current.generateResponse('Can you help me?'); });
        const systemPrompt = text.generateNPCResponse.mock.calls[0][2];
        expect(systemPrompt).toContain('Your attitude toward the player now:');
        expect(systemPrompt).toContain('Be cold and curt, and do not offer help.');
        expect(systemPrompt).toContain('disposition -50');
    });

    it('puts a warm stance into the system prompt', async () => {
        const { result } = renderHook(() => useDialogueSystem(dialogueState(60), vi.fn()));
        await act(async () => { await result.current.generateResponse('Good morning.'); });
        expect(text.generateNPCResponse.mock.calls[0][2]).toContain('Greet them warmly.');
    });

    it('gives the authored refusal with no model call when the NPC now shuns the player', async () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useDialogueSystem(dialogueState(-90), dispatch));
        let reply = '';
        await act(async () => { reply = await result.current.generateResponse('Please, listen.'); });
        expect(reply).toBe(NPC_SHUN_REPLY);
        expect(text.generateNPCResponse).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({ type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: NPC_ID, response: NPC_SHUN_REPLY } });
    });
});

describe('conversation panel reads the attitude for non-companion speakers', () => {
    beforeEach(() => {
        ollama.continueConversation.mockReset().mockResolvedValue({ success: false, error: 'offline' });
    });

    const panelState = (): GameState =>
        ({
            gameTime: DAY_FOUR,
            currentLocationId: 'westhollow',
            dynamicLocations: {},
            environment: {},
            questLog: [],
            party: [],
            generatedNpcs: {},
            townRumors: [],
            npcMemory: { stranger_1: { disposition: -30, suspicion: 'none', goals: [], knownFacts: [], witnessedActs: [] } },
            companions: {
                cmp_dara: {
                    identity: { name: 'Dara', race: 'Human', class: 'Ranger', sex: 'female', age: '28', physicalDescription: '' },
                    personality: { values: ['loyalty'], quirks: ['hums'] },
                },
            },
            activeConversation: {
                id: 'meet', participants: ['stranger_1', 'cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [],
                npcParticipants: [{ id: 'stranger_1', name: 'Hooded Stranger', personality: 'A nervous courier.' }],
            },
        } as unknown as GameState);

    it('adds the stance line to the stranger and not to the companion', async () => {
        const { result } = renderHook(() => useConversation(panelState(), vi.fn()));
        await act(async () => { await result.current.sendPlayerMessage('Who sent you?'); });
        const participants = ollama.continueConversation.mock.calls[0][0];
        const stranger = participants.find((p) => p.id === 'stranger_1')!;
        const companion = participants.find((p) => p.id === 'cmp_dara')!;
        expect(stranger.personality).toContain('A nervous courier.');
        expect(stranger.personality).toContain('You distrust this person. Be guarded and brief.');
        expect(companion.personality).not.toContain('Your attitude toward the player');
    });
});
