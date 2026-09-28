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
import { renderHook, act } from '@testing-library/react';

import { useConversation } from '../useConversation';
import { getGameEpoch } from '../../utils/core';
import type { GameState } from '../../types';

const ollama = vi.hoisted(() => ({
    // Typed parameters so `mock.calls[0][0]` is a real tuple element: the
    // assertions read the participant list handed to the prompt builder.
    continueConversation: vi.fn(async (
        _participants: Array<{ id: string; name: string; personality: string }>,
        _history: unknown[],
        _context: unknown,
    ) => ({ success: false, error: 'offline' })),
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

describe('useConversation - NPC knowledge reaches the chat prompt (agora-f821.12)', () => {
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
});
