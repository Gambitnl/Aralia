/**
 * @file src/hooks/__tests__/useConversation.knowledge.test.ts
 *
 * Guards the chat lane's half of agora-f821.12 (deepdive finding F8).
 *
 * `useConversation.getParticipantData` sent name, race, class, sex, age,
 * physical description and a values/quirks string — and nothing the speaker had
 * seen, been told, or heard. The three dialogue-context builders written for
 * exactly this had no caller in either lane.
 *
 * The assertion is on the `personality` string handed to `continueConversation`,
 * because that is the one per-speaker field `buildContinuePrompt` interpolates
 * and therefore the only seam through which per-speaker knowledge can reach the
 * model without editing the prompt builder itself.
 *
 * Called by: focused Vitest runs for packet W4-D.
 * Depends on: useConversation.ts, useDialogueSystem.ts, dialogueService.ts.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReducer } from 'react';
import { conversationReducer } from '../../state/reducers/conversationReducer';
import type { AppAction } from '../../state/actionTypes';

import { useConversation } from '../useConversation';
import { getGameEpoch } from '../../utils/core';
import type { GameState } from '../../types';
import type { BanterMoment } from '../../types/companions';
import type { ConversationSummary } from '../../types/ollama';

const ollama = vi.hoisted(() => ({
    prepareForTask: vi.fn(async (_task?: string, _options?: { signal?: AbortSignal }): Promise<
        | { status: 'ready'; model: string }
        | { status: 'cancelled'; model?: string }
        | { status: 'error'; error: string; model?: string }
        | { status: 'not-required'; provider: 'groq' }
    > => ({ status: 'ready', model: 'test-model' })),
    summarizeConversation: vi.fn(async (): Promise<
        | { success: false; error: string }
        | { success: true; data: ConversationSummary }
    > => ({ success: false, error: 'offline' })),
    // Typed parameters so `mock.calls[0][0]` is a real tuple element: the
    // assertions read the participant list handed to the prompt builder.
    continueConversation: vi.fn(async (
        _participants: Array<{ id: string; name: string; personality: string }>,
        _history: unknown[],
        _context: unknown,
    ): Promise<any> => ({ success: false, error: 'offline' })),
}));

vi.mock('../../services/ollama', () => ({
    OllamaService: ollama,
}));

vi.mock('../../systems/worldforge/townsim/chronicleForLocation', () => ({
    townChronicleForLocation: () => [],
}));

/** Day 4: `getGameDay` counts the epoch as day 1. */
const DAY_FOUR = new Date(getGameEpoch().getTime() + 3 * 24 * 60 * 60 * 1000);

const makeState = (npcMemory: GameState['npcMemory']): GameState =>
    ({
        activeConversation: null,
        gameTime: DAY_FOUR,
        currentLocationId: 'westhollow',
        dynamicLocations: {},
        environment: {},
        questLog: [],
        generatedNpcs: {},
        townRumors: [],
        npcMemory,
        companions: {
            cmp_dara: {
                identity: {
                    name: 'Dara',
                    race: 'Human',
                    class: 'Ranger',
                    sex: 'female',
                    age: '28',
                    physicalDescription: 'Weatherworn and watchful.',
                },
                personality: { values: ['loyalty'], quirks: ['hums while walking'] },
            },
        },
    } as unknown as GameState);

const personalityFromLastCall = (): string => {
    return ollama.continueConversation.mock.calls[0][0][0].personality;
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

describe('useConversation - NPC knowledge reaches the chat prompt (agora-f821.12)', () => {
    beforeEach(() => {
        ollama.prepareForTask.mockReset().mockResolvedValue({ status: 'ready', model: 'test-model' });
        ollama.continueConversation.mockReset().mockResolvedValue({ success: false, error: 'offline' });
        ollama.summarizeConversation.mockReset().mockResolvedValue({ success: false, error: 'offline' });
    });
    it('returns the actual reducer turn to the player after an unavailable reply', async () => {
        const initial = makeState({});
        initial.activeConversation = { id: 'failed-turn', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        const { result } = renderHook(() => {
            const [state, dispatch] = useReducer((state: GameState, action: AppAction) => ({ ...state, ...conversationReducer(state, action) }), initial);
            return { state, chat: useConversation(state, dispatch) };
        });
        await act(async () => { await result.current.chat.sendPlayerMessage('What are your plans?'); });
        expect(result.current.state.activeConversation).toMatchObject({ isPlayerTurn: true, pendingResponse: false });
        expect(result.current.state.activeConversation!.messages).toHaveLength(1);
        expect(result.current.state.activeConversation!.messages[0].speakerId).toBe('player');
        expect(result.current.chat.isInteractionLocked).toBe(false);
        expect(result.current.chat.responseError).toContain('No reply was received.');
    });

    it('returns delivered when the player line is recorded even if continuation fails', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'delivered-failure', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        const { result } = renderHook(() => useConversation(state, vi.fn()));
        let turn!: unknown;
        await act(async () => { turn = await result.current.sendPlayerMessage('One line only.'); });
        expect(turn).toEqual({ delivery: 'delivered', reply: 'failed' });
    });
    it('does not apply a failed reply to a replacement conversation', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'old', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        let finish!: (result: { success: boolean; error: string }) => void;
        ollama.continueConversation.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const dispatch = vi.fn();
        const view = renderHook(({ state }) => useConversation(state, dispatch), { initialProps: { state } });
        let pending!: Promise<unknown>;
        act(() => { pending = view.result.current.sendPlayerMessage('Hello.'); });
        await waitFor(() => expect(ollama.continueConversation).toHaveBeenCalledOnce());
        view.rerender({ state: { ...state, activeConversation: { ...state.activeConversation, id: 'new' } } });
        const calls = dispatch.mock.calls.length;
        await act(async () => { finish({ success: false, error: 'offline' }); await pending; });
        expect(view.result.current.responseError).toBeNull();
        expect(dispatch.mock.calls).toHaveLength(calls);
    });

    it('cancels preparation without publishing an ordinary player line or stranding the turn', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'cancel-prep', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        ollama.prepareForTask.mockImplementationOnce((_task?: string, { signal }: { signal?: AbortSignal } = {}) => new Promise(resolve => {
            signal?.addEventListener('abort', () => resolve({ status: 'cancelled' }), { once: true });
        }));
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        const controller = new AbortController();
        let pending!: Promise<unknown>;
        act(() => { pending = result.current.sendPlayerMessage('A single deliberate line.', undefined, controller.signal); });
        await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CONVERSATION_PENDING', payload: true }));
        await act(async () => { controller.abort(); await pending; });
        expect(await pending).toEqual({ delivery: 'not-delivered', reason: 'cancelled' });
        expect(dispatch.mock.calls.some(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE')).toBe(false);
        expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_CONVERSATION_PENDING', payload: false });
        expect(ollama.continueConversation).not.toHaveBeenCalled();
    });

    it('keeps a resolved skill result attributed when continuation preparation is canceled', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'cancel-resolved-check', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        ollama.prepareForTask.mockImplementationOnce((_task?: string, { signal }: { signal?: AbortSignal } = {}) => new Promise(resolve => {
            signal?.addEventListener('abort', () => resolve({ status: 'cancelled' }), { once: true });
        }));
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        const controller = new AbortController();
        let pending!: Promise<unknown>;
        act(() => { pending = result.current.sendPlayerMessage('I try to persuade them.', 'Persuasion check: 18 — success.', controller.signal); });
        await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CONVERSATION_PENDING', payload: true }));
        await act(async () => { controller.abort(); await pending; });
        expect(await pending).toEqual({ delivery: 'delivered', reply: 'cancelled' });
        const lines = dispatch.mock.calls.filter(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE').map(([action]) => action.payload);
        expect(lines.map((line) => [line.speakerId, line.text])).toEqual([
            ['player', 'I try to persuade them.'],
            ['narrator', 'Persuasion check: 18 — success.'],
        ]);
        expect(ollama.continueConversation).not.toHaveBeenCalled();
    });

    it('does not let a canceled preparation clear a newer turn in the same conversation', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'same-conversation', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        const firstReady = deferred<{ status: 'cancelled' }>();
        const secondReady = deferred<{ status: 'ready'; model: string }>();
        ollama.prepareForTask.mockImplementationOnce(() => firstReady.promise).mockImplementationOnce(() => secondReady.promise);
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        let first!: Promise<unknown>;
        act(() => { first = result.current.sendPlayerMessage('First turn.'); });
        await waitFor(() => expect(ollama.prepareForTask).toHaveBeenCalledTimes(1));
        act(() => { result.current.cancelPreparation(); });
        let second!: Promise<unknown>;
        act(() => { second = result.current.sendPlayerMessage('Retry in same conversation.'); });
        await waitFor(() => expect(ollama.prepareForTask).toHaveBeenCalledTimes(2));
        expect(result.current.preparationStatus).toBe('preparing-unsent');
        const secondPendingIndex = dispatch.mock.calls.map(([action]) => action.type).lastIndexOf('SET_CONVERSATION_PENDING');
        firstReady.resolve({ status: 'cancelled' });
        await act(async () => { await first; });
        expect(await first).toEqual({ delivery: 'not-delivered', reason: 'cancelled' });
        expect(result.current.preparationStatus).toBe('preparing-unsent');
        expect(dispatch.mock.calls.slice(secondPendingIndex + 1).some(([action]) => action.type === 'SET_CONVERSATION_PENDING' && action.payload === false)).toBe(false);
        secondReady.resolve({ status: 'ready', model: 'test-model' });
        await act(async () => { await second; });
    });

    it('reports one delivered player line separately from a successful NPC reply', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'successful-reply', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        ollama.continueConversation.mockResolvedValueOnce({
            success: true,
            data: { speakerId: 'cmp_dara', text: 'I will answer once.', emotion: 'neutral' },
        });
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        let turn!: unknown;
        await act(async () => { turn = await result.current.sendPlayerMessage('Exactly one line.'); });
        expect(turn).toEqual({ delivery: 'delivered', reply: 'received' });
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE' && action.payload.speakerId === 'player')).toHaveLength(1);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE' && action.payload.speakerId === 'cmp_dara')).toHaveLength(1);
    });

    it('does not let a canceled older continuation publish or clear a newer same-conversation turn', async () => {
        const state = makeState({});
        state.activeConversation = { id: 'same-conversation-reply', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false, messages: [] };
        const oldReply = deferred<{ success: true; data: { speakerId: string; text: string; emotion: string } }>();
        const newReply = deferred<{ success: true; data: { speakerId: string; text: string; emotion: string } }>();
        ollama.continueConversation.mockImplementationOnce(() => oldReply.promise).mockImplementationOnce(() => newReply.promise);
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        let first!: Promise<unknown>;
        act(() => { first = result.current.sendPlayerMessage('First delivered line.'); });
        await waitFor(() => expect(ollama.continueConversation).toHaveBeenCalledTimes(1));
        act(() => { result.current.cancelPreparation(); });
        let second!: Promise<unknown>;
        act(() => { second = result.current.sendPlayerMessage('New delivered line.'); });
        await waitFor(() => expect(ollama.continueConversation).toHaveBeenCalledTimes(2));
        const afterSecondTurn = dispatch.mock.calls.length;
        oldReply.resolve({ success: true, data: { speakerId: 'cmp_dara', text: 'Stale reply.', emotion: 'neutral' } });
        await act(async () => { await first; });
        expect(dispatch.mock.calls.slice(afterSecondTurn).some(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE' && action.payload.speakerId === 'cmp_dara')).toBe(false);
        expect(dispatch.mock.calls.slice(afterSecondTurn).some(([action]) => action.type === 'SET_CONVERSATION_PENDING' && action.payload === false)).toBe(false);
        newReply.resolve({ success: true, data: { speakerId: 'cmp_dara', text: 'Current reply.', emotion: 'neutral' } });
        await act(async () => { await second; });
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE' && action.payload.speakerId === 'cmp_dara')).toHaveLength(1);
    });

    it('reports a failed reply without inventing companion words or approval', async () => {
        const state = makeState({});
        state.activeConversation = {
            id: 'failed-reply', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [{ id: 'greet', speakerId: 'cmp_dara', text: 'Hello.', timestamp: 1 }],
        };
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        await act(async () => { await result.current.sendPlayerMessage('What do you want to do next?'); });
        expect(result.current.responseError).toContain('No reply was received.');
        const messages = dispatch.mock.calls.filter(([action]) => action.type === 'ADD_CONVERSATION_MESSAGE');
        expect(messages).toHaveLength(1);
        expect(messages[0][0].payload.speakerId).toBe('player');
        expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_CONVERSATION_PENDING', payload: false });
        expect(dispatch.mock.calls.some(([action]) => action.type === 'UPDATE_COMPANION_APPROVAL')).toBe(false);
    });
    it('ends an authored exchange without a model summary or a second approval award', async () => {
        const state = makeState({});
        state.activeConversation = {
            id: 'authored-promise', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [
                { id: 'greet', speakerId: 'cmp_dara', text: 'Hello.', timestamp: 1 },
                { id: 'promise', speakerId: 'player', text: 'I will help.', timestamp: 2, memoryHandled: true },
                { id: 'answer', speakerId: 'cmp_dara', text: 'I will remember your promise.', timestamp: 2, memoryHandled: true },
            ],
        };
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));
        await act(async () => { await result.current.endConversation(); });
        expect(ollama.summarizeConversation).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({ type: 'END_CONVERSATION' });
        expect(dispatch.mock.calls.some(([action]) => action.type === 'UPDATE_COMPANION_APPROVAL')).toBe(false);
    });
    it('archives exact delivered words when an ordinary short conversation ends without a summary', async () => {
        const state = makeState({});
        state.activeConversation = {
            id: 'short-delivered-exchange', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [
                { id: 'greet', speakerId: 'cmp_dara', text: 'I am trying to restore the temple.', timestamp: 1 },
                { id: 'player-question', speakerId: 'player', text: 'Why did you want to restore the temple to begin with?', timestamp: 2 },
            ],
        };
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));

        await act(async () => { await result.current.endConversation(); });

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ARCHIVE_BANTER',
            payload: expect.objectContaining({
                id: 'short-delivered-exchange',
                participants: ['cmp_dara'],
                lines: [
                    expect.objectContaining({ speakerId: 'cmp_dara', text: 'I am trying to restore the temple.' }),
                    expect.objectContaining({ speakerId: 'player', text: 'Why did you want to restore the temple to begin with?' }),
                ],
            }),
        }));
        expect(ollama.summarizeConversation).not.toHaveBeenCalled();
        expect(dispatch.mock.calls.some(([action]) => action.type === 'UPDATE_COMPANION_APPROVAL')).toBe(false);
    });
    it('keeps the transcript archived and closes once when summary transport throws', async () => {
        const state = makeState({});
        state.activeConversation = {
            id: 'throwing-summary', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [
                { id: 'greet', speakerId: 'cmp_dara', text: 'Hello.', timestamp: 1 },
                { id: 'question', speakerId: 'player', text: 'Why?', timestamp: 2 },
                { id: 'reply', speakerId: 'cmp_dara', text: 'For the people here.', timestamp: 3 },
            ],
        };
        ollama.summarizeConversation.mockRejectedValueOnce(new Error('summary transport failed'));
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));

        await act(async () => {
            await Promise.all([result.current.endConversation(), result.current.endConversation()]);
        });

        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ARCHIVE_BANTER')).toHaveLength(1);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'END_CONVERSATION')).toHaveLength(1);
        expect(dispatch.mock.calls).toContainEqual([{ type: 'SET_CONVERSATION_PENDING', payload: false }]);
        expect(dispatch.mock.calls.some(([action]) => action.type === 'UPDATE_COMPANION_APPROVAL')).toBe(false);
    });
    it('does not let an older end publish summary effects or close its replacement conversation', async () => {
        const state = makeState({});
        state.activeConversation = {
            id: 'old-close', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [
                { id: 'one', speakerId: 'cmp_dara', text: 'First.', timestamp: 1 },
                { id: 'two', speakerId: 'player', text: 'Second.', timestamp: 2 },
                { id: 'three', speakerId: 'cmp_dara', text: 'Third.', timestamp: 3 },
            ],
        };
        const summary = deferred<{ success: true; data: { text: string; tags: string[]; approvalChange: number } }>();
        ollama.summarizeConversation.mockImplementationOnce(() => summary.promise);
        const dispatch = vi.fn();
        const view = renderHook(({ state }) => useConversation(state, dispatch), { initialProps: { state } });

        let ending!: Promise<void>;
        act(() => { ending = view.result.current.endConversation(); });
        await waitFor(() => expect(ollama.summarizeConversation).toHaveBeenCalledOnce());
        view.rerender({ state: { ...state, activeConversation: {
            id: 'replacement', participants: ['cmp_dara'], startedAt: 4, isPlayerTurn: true, pendingResponse: false, messages: [],
        } } });
        await act(async () => {
            summary.resolve({ success: true, data: { text: 'A semantic summary.', tags: ['conversation'], approvalChange: 3 } });
            await ending;
        });

        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ARCHIVE_BANTER')).toHaveLength(1);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'END_CONVERSATION')).toHaveLength(0);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ADD_COMPANION_MEMORY')).toHaveLength(0);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'UPDATE_COMPANION_APPROVAL')).toHaveLength(0);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'SET_CONVERSATION_PENDING')).toHaveLength(1);
    });
    it('closes an older same-ID save after a prior close without retaining a hook-local block', async () => {
        const state = makeState({});
        state.archivedBanters = [];
        state.activeConversation = {
            id: 'same-id-old-save', participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [{ id: 'question', speakerId: 'player', text: 'Why?', timestamp: 1 }],
        };
        const dispatch = vi.fn();
        const view = renderHook(({ state }) => useConversation(state, dispatch), { initialProps: { state } });

        await act(async () => { await view.result.current.endConversation(); });
        view.rerender({ state: { ...state, activeConversation: { ...state.activeConversation! } } });
        await act(async () => { await view.result.current.endConversation(); });

        expect(dispatch.mock.calls.filter(([action]) => action.type === 'ARCHIVE_BANTER')).toHaveLength(2);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'END_CONVERSATION')).toHaveLength(2);
    });
    it('closes a loaded conversation already present in the archive without duplicating its summary', async () => {
        const state = makeState({});
        const archived: BanterMoment = {
            id: 'already-archived', timestamp: 1, locationId: 'westhollow', participants: ['cmp_dara'],
            source: { kind: 'player-conversation', conversationId: 'already-archived', worldSeed: 77, capture: 'ended', pendingAtCapture: false, semanticStatus: 'attempted' },
            lines: [{ messageId: 'question', speakerId: 'player', speakerName: 'You', text: 'Why?' }],
        };
        state.worldSeed = 77;
        state.archivedBanters = [archived];
        state.activeConversation = {
            id: archived.id, participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [{ id: 'question', speakerId: 'player', text: 'Why?', timestamp: 1 }],
        };
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));

        await act(async () => { await result.current.endConversation(); });

        expect(dispatch.mock.calls.filter(([action]) => action.type === 'END_CONVERSATION')).toHaveLength(1);
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'UPDATE_COMPANION_APPROVAL')).toHaveLength(0);
        expect(ollama.summarizeConversation).not.toHaveBeenCalled();
    });
    it('does not treat a load-captured archive as proof that End summary effects ran', async () => {
        const state = makeState({});
        state.worldSeed = 77;
        const loadedOpen: BanterMoment = {
            id: 'load-captured-not-ended', timestamp: 1, locationId: 'westhollow', participants: ['cmp_dara'],
            source: { kind: 'player-conversation', conversationId: 'load-captured-not-ended', worldSeed: 77, capture: 'loaded-open', pendingAtCapture: true, semanticStatus: 'not-run' },
            lines: [
                { messageId: 'hello', speakerId: 'cmp_dara', speakerName: 'Dara', text: 'Hello.' },
                { messageId: 'question', speakerId: 'player', speakerName: 'You', text: 'Why?' },
                { messageId: 'reply', speakerId: 'cmp_dara', speakerName: 'Dara', text: 'For the town.' },
            ],
        };
        state.archivedBanters = [loadedOpen];
        state.activeConversation = {
            id: loadedOpen.id, participants: ['cmp_dara'], startedAt: 1, isPlayerTurn: true, pendingResponse: false,
            messages: [
                { id: 'hello', speakerId: 'cmp_dara', text: 'Hello.', timestamp: 1 },
                { id: 'question', speakerId: 'player', text: 'Why?', timestamp: 2 },
                { id: 'reply', speakerId: 'cmp_dara', text: 'For the town.', timestamp: 3 },
            ],
        };
        const dispatch = vi.fn();
        const { result } = renderHook(() => useConversation(state, dispatch));

        await act(async () => { await result.current.endConversation(); });

        expect(ollama.summarizeConversation).toHaveBeenCalledOnce();
        expect(dispatch.mock.calls.find(([action]) => action.type === 'ARCHIVE_BANTER')?.[0].payload.source.semanticStatus).toBe('attempted');
        expect(dispatch.mock.calls.filter(([action]) => action.type === 'END_CONVERSATION')).toHaveLength(1);
    });
    beforeEach(() => {
        ollama.continueConversation.mockClear();
    });

    it('sends a witnessed act and a propagated fact alongside the values/quirks string', async () => {
        const state = makeState({
            cmp_dara: {
                disposition: 20,
                suspicion: 'none',
                goals: [],
                knownFacts: [
                    {
                        id: 'fact-1',
                        text: 'the adventurer bribed the gate watch',
                        source: 'gossip',
                        sourceNpcId: 'unknown_teller',
                        isPublic: true,
                        timestamp: 4,
                        strength: 3,
                        lifespan: 30,
                    },
                ],
                witnessedActs: [
                    {
                        id: 'act-1',
                        domain: 'combat',
                        observation: 'spared_surrendering',
                        actorId: 'player',
                        channel: 'firsthand',
                        confidence: 1,
                        hops: 0,
                        magnitude: 1,
                        detail: 'a beaten bandit',
                        day: 4,
                    },
                ],
            },
        } as unknown as GameState['npcMemory']);

        const { result } = renderHook(() => useConversation(state, vi.fn()));
        await act(async () => {
            await result.current.startConversation('cmp_dara');
        });

        expect(ollama.continueConversation).toHaveBeenCalledTimes(1);
        const personality = personalityFromLastCall();
        // The original identity string is preserved, not replaced.
        expect(personality).toContain('Values: loyalty');
        expect(personality).toContain('Quirks: hums while walking');
        // First-hand memory, in the NPC's own mouth.
        expect(personality).toContain('You personally remember this about them');
        expect(personality).toContain('I saw you spare a beaten bandit.');
        // Second-hand knowledge, attributed and hedged.
        expect(personality).toContain('someone in town mentioned: the adventurer bribed the gate watch');
        expect(personality).toContain('may be wrong');
    });

    it('sends the unchanged values/quirks string when the companion remembers nothing', async () => {
        const { result } = renderHook(() => useConversation(makeState({}), vi.fn()));
        await act(async () => {
            await result.current.startConversation('cmp_dara');
        });

        expect(personalityFromLastCall()).toBe(
            'Values: loyalty. Quirks: hums while walking.'
        );
    });
    it('recalls exact prior speech only in the same world for current participants who witnessed it', async () => {
        const transcript = {
            id: 'remembered-question', timestamp: 10, locationId: 'temple', participants: ['cmp_dara'],
            source: { kind: 'player-conversation', worldSeed: 77, capture: 'ended', pendingAtCapture: false, semanticStatus: 'attempted' },
            lines: [
                { messageId: 'asked', speakerId: 'player', speakerName: 'You', text: 'Why did you want to restore the temple to begin with?' },
                { messageId: 'answered', speakerId: 'cmp_dara', speakerName: 'Dara', text: 'I wanted the doors open to everyone.' },
            ],
        };
        const unansweredTranscript = {
            ...transcript,
            id: 'remembered-unanswered-question',
            timestamp: 20,
            source: { ...transcript.source, conversationId: 'remembered-unanswered-question', capture: 'loaded-open', semanticStatus: 'not-run' },
            lines: [
                { messageId: 'unanswered-player', speakerId: 'player', speakerName: 'You', text: 'Will you join this expedition?' },
                { messageId: 'unanswered-note', speakerId: 'narrator', speakerName: 'Narration', text: 'Persuasion check: 18, success.', memoryHandled: true },
            ],
        };
        const promptFor = async (worldSeed: number, currentParticipants: string[], archived: unknown[]) => {
            const state = makeState({});
            state.worldSeed = worldSeed;
            state.archivedBanters = archived as GameState['archivedBanters'];
            state.activeConversation = {
                id: `current-${worldSeed}-${currentParticipants.length}`, participants: currentParticipants,
                startedAt: 20, isPlayerTurn: true, pendingResponse: false, messages: [],
            };
            const { result } = renderHook(() => useConversation(state, vi.fn()));
            await act(async () => { await result.current.sendPlayerMessage('What do you remember?'); });
            return ollama.continueConversation.mock.calls.at(-1)![0].map((participant: { personality: string }) => participant.personality).join('\n');
        };

        const matching = await promptFor(77, ['cmp_dara'], [transcript, unansweredTranscript]);
        expect(matching).toContain('Why did you want to restore the temple to begin with?');
        expect(matching).toContain('I wanted the doors open to everyone.');
        expect(matching).toContain('speech only');
        expect(matching).toContain('You: "Will you join this expedition?"');
        expect(matching).toContain('Narration: "Persuasion check: 18, success."');
        expect(matching).toContain('Previously resolved authored event speech; not a new choice');
        expect(matching).toContain('No NPC reply was recorded after the player’s final line.');

        const otherWorld = await promptFor(78, ['cmp_dara'], [transcript]);
        expect(otherWorld).not.toContain('I wanted the doors open to everyone.');
        const otherParticipant = await promptFor(77, ['cmp_other'], [transcript]);
        expect(otherParticipant).not.toContain('I wanted the doors open to everyone.');
        const groupWithAbsentPerson = await promptFor(77, ['cmp_dara', 'cmp_other'], [transcript]);
        expect(groupWithAbsentPerson).not.toContain('I wanted the doors open to everyone.');
        const witnessedGroupTranscript = {
            ...transcript,
            id: 'remembered-witnessed-group',
            timestamp: 30,
            participants: ['cmp_dara', 'cmp_faelan'],
            source: { ...transcript.source, conversationId: 'remembered-witnessed-group' },
            lines: [
                ...transcript.lines,
                { messageId: 'faelan-line', speakerId: 'cmp_faelan', speakerName: 'Faelan', text: 'I heard the bell from the lower ward.' },
            ],
        };
        const returningWitness = await promptFor(77, ['cmp_dara'], [witnessedGroupTranscript]);
        expect(returningWitness).toContain('Faelan: "I heard the bell from the lower ward."');
        const groupWithAbsentOutsider = await promptFor(77, ['cmp_dara', 'cmp_other'], [witnessedGroupTranscript]);
        expect(groupWithAbsentOutsider).not.toContain('I heard the bell from the lower ward.');
        const unknownLegacy = await promptFor(77, ['cmp_dara'], [{ ...transcript, source: undefined }]);
        expect(unknownLegacy).not.toContain('I wanted the doors open to everyone.');
        const conflictedBranch = await promptFor(77, ['cmp_dara'], [{
            ...transcript,
            source: { ...transcript.source, capture: 'conflict' },
        }]);
        expect(conflictedBranch).not.toContain('I wanted the doors open to everyone.');
    });
});
