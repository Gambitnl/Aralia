/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/entryStateMachine.ts
 *
 * Pure state machine for the opening-situation entry flow:
 *
 *   idle ──BEGIN──▶ generating ──RESOLVED──▶ in-situation
 *                       │
 *                       └──UNAVAILABLE──▶ model-unavailable ──RETRY──▶ generating
 *
 * RESET returns to `idle` from any state (used when an existing save loads, so a
 * resumed game never re-generates an opening).
 *
 * Kept side-effect free so the entry behaviour is deterministic under test while
 * the actual model call (the only source of non-determinism) lives in the
 * generator and is injected at the orchestration layer.
 */

import type { GameEntryState, OpeningSituation } from './types';
import { INITIAL_GAME_ENTRY_STATE } from './types';

export type GameEntryEvent =
    | { type: 'BEGIN' }
    | { type: 'RESOLVED'; situation: OpeningSituation }
    | { type: 'UNAVAILABLE'; error: string }
    | { type: 'RETRY' }
    | { type: 'SKIP' }
    | { type: 'RESET' };

/**
 * How the player arrived at PLAYING. Only a brand-new game generates an opening.
 */
export type GameEntryReason = 'new-game' | 'load' | 'dummy';

/**
 * Whether an opening situation should be generated for this entry vector.
 * A truly-random opening is a new-game-only experience; loading an existing save
 * resumes whatever the player left, and dev/dummy starts skip the narrative gate.
 */
export function shouldGenerateOpening(reason: GameEntryReason): boolean {
    return reason === 'new-game';
}

/**
 * Apply an entry event to the current state, returning the next state.
 * Invalid transitions are no-ops (return the input state unchanged).
 */
export function gameEntryTransition(
    state: GameEntryState,
    event: GameEntryEvent,
): GameEntryState {
    switch (event.type) {
        case 'BEGIN':
            // Only start generating from idle. Re-entry while already generating
            // or in-situation is ignored so we never double-fire a model call.
            if (state.status !== 'idle') return state;
            return { status: 'generating', situation: null, error: null };

        case 'RESOLVED':
            if (state.status !== 'generating') return state;
            return { status: 'in-situation', situation: event.situation, error: null };

        case 'UNAVAILABLE':
            if (state.status !== 'generating') return state;
            return { status: 'model-unavailable', situation: null, error: event.error };

        case 'RETRY':
            if (state.status !== 'model-unavailable') return state;
            return { status: 'generating', situation: null, error: null };

        case 'SKIP':
            // Let the player continue normal play when the optional generated
            // opening cannot be made. This preserves the no-fallback rule: the
            // game returns to ordinary play instead of pretending a scene exists.
            if (state.status !== 'model-unavailable') return state;
            return { ...INITIAL_GAME_ENTRY_STATE };

        case 'RESET':
            return { ...INITIAL_GAME_ENTRY_STATE };

        default:
            return state;
    }
}
