import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDialogueSystem } from '../useDialogueSystem';
import type { GameState, Action } from '../../types';

/**
 * Guards the "Invite to party" producer side of the party-join flow.
 *
 * `inviteToParty(npcId)` must emit a `talk` action carrying a `recruitOffer`
 * so the NPC-interaction handler (handleNpcInteraction → handleRecruitOffer)
 * can run consent → convert → RECRUIT_COMPANION. The `talk` action is routed
 * through `processAction` (NOT the Redux reducer), so the hook prefers the
 * supplied processor and only falls back to `dispatch` when none is given.
 *
 * Called by: focused Vitest runs for the dialogue-invite packet (W2).
 * Depends on: useDialogueSystem.ts.
 */

const makeGameState = (): GameState =>
    ({
        activeDialogueSession: null,
        gameTime: 0,
        npcMemory: {},
    } as unknown as GameState);

describe('useDialogueSystem - inviteToParty', () => {
    it('routes a talk-with-recruitOffer action through processAction when provided', () => {
        const dispatch = vi.fn();
        const processAction = vi.fn();

        const { result } = renderHook(() =>
            useDialogueSystem(makeGameState(), dispatch, processAction)
        );

        act(() => {
            result.current.inviteToParty('npc-grizelda');
        });

        expect(processAction).toHaveBeenCalledTimes(1);
        const action = processAction.mock.calls[0][0] as Action;
        expect(action.type).toBe('talk');
        expect((action.payload as { targetNpcId?: string }).targetNpcId).toBe('npc-grizelda');
        expect((action.payload as { recruitOffer?: { targetNpcId: string } }).recruitOffer)
            .toEqual({ targetNpcId: 'npc-grizelda' });
        // Must NOT also go through the raw reducer dispatch.
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('falls back to dispatch when no processAction is supplied', () => {
        const dispatch = vi.fn();

        const { result } = renderHook(() =>
            useDialogueSystem(makeGameState(), dispatch)
        );

        act(() => {
            result.current.inviteToParty('npc-aldous');
        });

        expect(dispatch).toHaveBeenCalledTimes(1);
        const action = dispatch.mock.calls[0][0] as Action;
        expect(action.type).toBe('talk');
        expect((action.payload as { recruitOffer?: { targetNpcId: string } }).recruitOffer)
            .toEqual({ targetNpcId: 'npc-aldous' });
    });

    it('exposes the existing generateResponse and handleTopicOutcome callbacks', () => {
        const { result } = renderHook(() =>
            useDialogueSystem(makeGameState(), vi.fn())
        );

        expect(typeof result.current.generateResponse).toBe('function');
        expect(typeof result.current.handleTopicOutcome).toBe('function');
        expect(typeof result.current.inviteToParty).toBe('function');
    });
});

describe('useDialogueSystem - handleTopicOutcome unlock propagation (DIAL-002/DIAL-004)', () => {
    const makeSessionState = (): GameState =>
        ({
            activeDialogueSession: {
                npcId: 'npc-teller',
                availableTopicIds: [],
                discussedTopicIds: [],
                sessionDispositionMod: 0,
            },
            gameTime: 5000,
            npcMemory: {},
        } as unknown as GameState);

    it('dispatches a durable LEARN_WORLD_FACT for every unlocked topic, with provenance', () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useDialogueSystem(makeSessionState(), dispatch));

        act(() => {
            result.current.handleTopicOutcome(
                {
                    status: 'success',
                    responsePrompt: 'You did not hear this from me...',
                    unlocks: ['ask_about_ruins', 'ask_about_smugglers'],
                },
                'bribe_guard'
            );
        });

        const factActions = dispatch.mock.calls
            .map(call => call[0])
            .filter(a => a.type === 'LEARN_WORLD_FACT');

        expect(factActions).toHaveLength(2);
        expect(factActions[0].payload.fact).toEqual({
            key: 'topic_unlocked:ask_about_ruins',
            sourceNpcId: 'npc-teller',
            sourceTopicId: 'bribe_guard',
            learnedAt: 5000,
        });
        expect(factActions[1].payload.fact.key).toBe('topic_unlocked:ask_about_smugglers');
    });

    it('dispatches no fact actions when the outcome unlocks nothing', () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useDialogueSystem(makeSessionState(), dispatch));

        act(() => {
            result.current.handleTopicOutcome(
                { status: 'neutral', responsePrompt: 'Nice weather.', unlocks: [] },
                'weather'
            );
        });

        const factActions = dispatch.mock.calls
            .map(call => call[0])
            .filter(a => a.type === 'LEARN_WORLD_FACT');
        expect(factActions).toHaveLength(0);
    });
});
