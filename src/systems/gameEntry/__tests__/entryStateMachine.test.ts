/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/__tests__/entryStateMachine.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    gameEntryTransition,
    shouldGenerateOpening,
} from '../entryStateMachine';
import { INITIAL_GAME_ENTRY_STATE, type OpeningSituation } from '../types';

const SITUATION: OpeningSituation = {
    setting: { place: 'p', timeOfDay: 't', weather: 'w' },
    predicament: 'a predicament',
    npcs: [{ id: 'n1', name: 'N', role: 'r', disposition: 'd', goal: 'g' }],
    openingLine: { speakerId: 'n1', text: 'hi' },
};

describe('shouldGenerateOpening', () => {
    it('only generates for a brand-new game', () => {
        expect(shouldGenerateOpening('new-game')).toBe(true);
        expect(shouldGenerateOpening('load')).toBe(false);
        expect(shouldGenerateOpening('dummy')).toBe(false);
    });
});

describe('gameEntryTransition', () => {
    it('idle → generating on BEGIN', () => {
        const next = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' });
        expect(next.status).toBe('generating');
        expect(next.situation).toBeNull();
        expect(next.error).toBeNull();
    });

    it('ignores BEGIN when already generating (no double-fire)', () => {
        const generating = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' });
        const again = gameEntryTransition(generating, { type: 'BEGIN' });
        expect(again).toEqual(generating);
    });

    it('generating → in-situation on RESOLVED', () => {
        const generating = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' });
        const next = gameEntryTransition(generating, { type: 'RESOLVED', situation: SITUATION });
        expect(next.status).toBe('in-situation');
        expect(next.situation).toBe(SITUATION);
    });

    it('generating → model-unavailable on UNAVAILABLE', () => {
        const generating = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' });
        const next = gameEntryTransition(generating, { type: 'UNAVAILABLE', error: 'down' });
        expect(next.status).toBe('model-unavailable');
        expect(next.error).toBe('down');
        expect(next.situation).toBeNull();
    });

    it('model-unavailable → generating on RETRY', () => {
        const failed = gameEntryTransition(
            gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' }),
            { type: 'UNAVAILABLE', error: 'down' },
        );
        const next = gameEntryTransition(failed, { type: 'RETRY' });
        expect(next.status).toBe('generating');
        expect(next.error).toBeNull();
    });

    it('model-unavailable -> idle on SKIP so play can continue without a fake scene', () => {
        const failed = gameEntryTransition(
            gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' }),
            { type: 'UNAVAILABLE', error: 'down' },
        );

        // Skipping clears only the failed opening gate. The player gets normal
        // play back, while the generated situation remains absent.
        const next = gameEntryTransition(failed, { type: 'SKIP' });

        expect(next).toEqual(INITIAL_GAME_ENTRY_STATE);
    });

    it('RESET returns to idle from any state', () => {
        const generating = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' });
        expect(gameEntryTransition(generating, { type: 'RESET' }).status).toBe('idle');
        const inSit = gameEntryTransition(generating, { type: 'RESOLVED', situation: SITUATION });
        expect(gameEntryTransition(inSit, { type: 'RESET' }).status).toBe('idle');
    });

    it('does not RESOLVE from idle (invalid transition is a no-op)', () => {
        const next = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'RESOLVED', situation: SITUATION });
        expect(next).toEqual(INITIAL_GAME_ENTRY_STATE);
    });

    it('preserves an in-flight sceneImage across RESOLVED but resets it on RESET', () => {
        const generating = gameEntryTransition(INITIAL_GAME_ENTRY_STATE, { type: 'BEGIN' });
        // Simulate the scene request having been kicked off on the generating state.
        const withScene = { ...generating, sceneImage: { status: 'generating' as const, url: null, error: null } };

        const resolved = gameEntryTransition(withScene, { type: 'RESOLVED', situation: SITUATION });
        // The picture survives the status change — it's tracked by its own actions.
        expect(resolved.sceneImage).toEqual({ status: 'generating', url: null, error: null });

        const reset = gameEntryTransition(resolved, { type: 'RESET' });
        expect(reset.sceneImage).toEqual(INITIAL_GAME_ENTRY_STATE.sceneImage);
    });
});
