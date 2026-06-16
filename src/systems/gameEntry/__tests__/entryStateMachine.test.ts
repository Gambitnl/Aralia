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
});
