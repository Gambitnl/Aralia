/**
 * @file src/hooks/__tests__/useDialogueSystem.memoryWiring.test.ts
 *
 * Guards the two caller-side wirings this hook was missing (deepdive
 * `docs/deepdives/dialogue-models-boundary.md`, findings F7 / F8 / F9):
 *
 *  - agora-f821.6 — the speaker is resolved from `gameState.generatedNpcs` as
 *    well as the six hand-authored `NPCS`, so a town resident answers a topic
 *    with a model line instead of the literal string "..." and the disposition
 *    message names them.
 *  - agora-f821.12 / agora-db71.17 — what the NPC witnessed, and what reached
 *    them as a rumor or a propagated fact, is in the system prompt.
 *
 * The assertions are on the prompt the model is actually handed, not on an
 * intermediate builder: a builder with no caller is the exact defect this
 * packet exists to fix.
 *
 * Called by: focused Vitest runs for packet W4-D.
 * Depends on: useDialogueSystem.ts, dialogueService.ts, npcWitnessMemory.ts,
 * RumorMillSystem.ts, factPropagation.ts.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDialogueSystem } from '../useDialogueSystem';
import type { GameState } from '../../types';
import type { RichNPC } from '../../types/world';
import { getGameEpoch } from '../../utils/core';

const ollama = vi.hoisted(() => ({
    // Typed parameters so `mock.calls[n][i]` is a real tuple: the assertions
    // below read the NPC name (arg 0) and the system prompt (arg 2).
    generateNPCResponse: vi.fn(async (_npcName: string, _playerLine: string, _systemPrompt: string) => ({
        success: true,
        data: { text: 'I remember you well enough.' },
        metadata: {},
    })),
}));

vi.mock('../../services/ollamaTextService', () => ollama);

/** `getGameDay` counts the epoch as day 1, so three days later is day 4. */
const DAY_FOUR = new Date(getGameEpoch().getTime() + 3 * 24 * 60 * 60 * 1000);

const generatedNpc = (): RichNPC =>
    ({
        id: 'burg_resident_12',
        name: 'Maren Holt',
        baseDescription: 'A tanner with ink-stained hands.',
        initialPersonalityPrompt: 'You are Maren Holt, a tanner in Westhollow.',
        role: 'civilian',
    } as unknown as RichNPC);

const makeState = (overrides: Partial<GameState> = {}): GameState =>
    ({
        activeDialogueSession: {
            npcId: 'burg_resident_12',
            discussedTopicIds: [],
        },
        gameTime: DAY_FOUR,
        generatedNpcs: { burg_resident_12: generatedNpc() },
        npcMemory: {},
        townRumors: [],
        ...overrides,
    } as unknown as GameState);

describe('useDialogueSystem - generated NPCs reach the model (agora-f821.6)', () => {
    beforeEach(() => {
        ollama.generateNPCResponse.mockClear();
    });

    it('resolves the speaker from generatedNpcs and returns a real line, not "..."', async () => {
        const { result } = renderHook(() => useDialogueSystem(makeState(), vi.fn()));

        let reply = '';
        await act(async () => {
            reply = await result.current.generateResponse('Who runs this town?');
        });

        expect(ollama.generateNPCResponse).toHaveBeenCalledTimes(1);
        expect(ollama.generateNPCResponse.mock.calls[0][0]).toBe('Maren Holt');
        expect(reply).not.toBe('...');
        expect(reply).toContain('remember you');
    });

    it('still answers "..." when neither table holds the speaker', async () => {
        const state = makeState({ generatedNpcs: {} } as Partial<GameState>);
        const { result } = renderHook(() => useDialogueSystem(state, vi.fn()));

        let reply = '';
        await act(async () => {
            reply = await result.current.generateResponse('Hello?');
        });

        expect(reply).toBe('...');
        expect(ollama.generateNPCResponse).not.toHaveBeenCalled();
    });

    it('names the generated NPC in the disposition message instead of "NPC"', () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useDialogueSystem(makeState(), dispatch));

        act(() => {
            result.current.handleTopicOutcome(
                { dispositionChange: 5 } as never,
                'global_rumors'
            );
        });

        const messages = dispatch.mock.calls
            .map(([action]) => action as { type: string; payload?: { text?: string } })
            .filter((action) => action.type === 'ADD_MESSAGE');
        expect(messages).toHaveLength(1);
        expect(messages[0].payload?.text).toBe('Maren Holt approves of your words.');
    });
});

describe('useDialogueSystem - memory reaches the prompt (agora-f821.12 / agora-db71.17)', () => {
    beforeEach(() => {
        ollama.generateNPCResponse.mockClear();
    });

    const promptFromLastCall = (): string =>
        ollama.generateNPCResponse.mock.calls[0][2];

    it('carries a witnessed act into the system prompt as first-hand memory', async () => {
        const state = makeState({
            npcMemory: {
                burg_resident_12: {
                    disposition: 0,
                    knownFacts: [],
                    suspicion: 'none',
                    goals: [],
                    witnessedActs: [
                        {
                            id: 'act-1',
                            domain: 'combat',
                            actorId: 'player',
                            observation: 'defeated_foes',
                            detail: 'town guards',
                            magnitude: 3,
                            channel: 'firsthand',
                            confidence: 1,
                            hops: 0,
                            day: 4,
                        },
                    ],
                },
            },
        } as unknown as Partial<GameState>);

        const { result } = renderHook(() => useDialogueSystem(state, vi.fn()));
        await act(async () => {
            await result.current.generateResponse('What happened here?');
        });

        const prompt = promptFromLastCall();
        expect(prompt).toContain('You are Maren Holt');
        expect(prompt).toContain('You personally remember this about them');
        expect(prompt).toContain('I saw you');
    });

    it('carries a rumor that reached this NPC, and withholds one that did not', async () => {
        const rumor = {
            id: 'rumor-1',
            text: 'the stranger burned the mill',
            kind: 'crime' as const,
            tone: 'negative' as const,
            originNpcId: 'burg_resident_1',
            reachedNpcs: ['burg_resident_12'],
            createdDay: 1,
            spreadDay: 1,
            strength: 1,
        };

        const heard = makeState({ townRumors: [rumor] } as unknown as Partial<GameState>);
        const { result } = renderHook(() => useDialogueSystem(heard, vi.fn()));
        await act(async () => {
            await result.current.generateResponse('Any news?');
        });
        expect(promptFromLastCall()).toContain('the stranger burned the mill');

        // A stranger the talk has not reached gets nothing: `reachedNpcs` is the gate.
        ollama.generateNPCResponse.mockClear();
        const unheard = makeState({
            townRumors: [{ ...rumor, reachedNpcs: ['someone_else'] }],
        } as unknown as Partial<GameState>);
        const second = renderHook(() => useDialogueSystem(unheard, vi.fn()));
        await act(async () => {
            await second.result.current.generateResponse('Any news?');
        });
        expect(promptFromLastCall()).not.toContain('the stranger burned the mill');
    });

    it('carries a propagated (gossip-sourced) fact, attributed to whoever passed it on', async () => {
        const state = makeState({
            generatedNpcs: {
                burg_resident_12: generatedNpc(),
                burg_resident_3: { ...generatedNpc(), id: 'burg_resident_3', name: 'Old Pell' },
            },
            npcMemory: {
                burg_resident_12: {
                    disposition: 0,
                    suspicion: 'none',
                    goals: [],
                    knownFacts: [
                        {
                            id: 'fact-1',
                            text: 'the adventurer paid off the tax collector',
                            source: 'gossip',
                            sourceNpcId: 'burg_resident_3',
                            isPublic: true,
                            timestamp: 4,
                            strength: 3,
                            lifespan: 30,
                        },
                        {
                            // A first-hand fact is NOT hearsay and must not be relabelled.
                            id: 'fact-2',
                            text: 'the adventurer bought two hides',
                            source: 'direct',
                            isPublic: true,
                            timestamp: 4,
                            strength: 3,
                            lifespan: 30,
                        },
                    ],
                },
            },
        } as unknown as Partial<GameState>);

        const { result } = renderHook(() => useDialogueSystem(state, vi.fn()));
        await act(async () => {
            await result.current.generateResponse('What are people saying?');
        });

        const prompt = promptFromLastCall();
        expect(prompt).toContain('Old Pell mentioned: the adventurer paid off the tax collector');
        expect(prompt).toContain('may be wrong');
        expect(prompt).not.toContain('bought two hides');
    });

    it('adds nothing when the NPC remembers nothing', async () => {
        const { result } = renderHook(() => useDialogueSystem(makeState(), vi.fn()));
        await act(async () => {
            await result.current.generateResponse('Hello.');
        });

        const prompt = promptFromLastCall();
        expect(prompt).toContain('You are Maren Holt');
        expect(prompt).not.toContain('You personally remember');
        expect(prompt).not.toContain('second-hand');
    });
});
