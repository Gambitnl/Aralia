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
import { INITIAL_GAME_ENTRY_STATE, INITIAL_SCENE_IMAGE_STATE } from './types';

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
            // A fresh opening: clear any prior scene illustration.
            return { ...state, status: 'generating', situation: null, error: null, sceneImage: INITIAL_SCENE_IMAGE_STATE };

        case 'RESOLVED':
            if (state.status !== 'generating') return state;
            // Preserve sceneImage — the scene request is fired by the orchestration
            // hook right after this transition and is tracked by its own actions.
            return { ...state, status: 'in-situation', situation: event.situation, error: null };

        case 'UNAVAILABLE':
            if (state.status !== 'generating') return state;
            return { ...state, status: 'model-unavailable', situation: null, error: event.error };

        case 'RETRY':
            if (state.status !== 'model-unavailable') return state;
            return { ...state, status: 'generating', situation: null, error: null, sceneImage: INITIAL_SCENE_IMAGE_STATE };

        case 'SKIP':
            // Two legitimate exits share this event:
            //  - model-unavailable: the player dismisses a FAILED opening and
            //    continues normal play (no-fallback: no scene is invented).
            //  - in-situation: the opening CONCLUDED — the de-escalation flow
            //    resolved a hostile standoff (talked down, snuck away, or the
            //    fight started), so the situation and its threat must clear or
            //    the conversation re-arms the same encounter forever.
            if (state.status !== 'model-unavailable' && state.status !== 'in-situation') return state;
            return { ...INITIAL_GAME_ENTRY_STATE };

        case 'RESET':
            return { ...INITIAL_GAME_ENTRY_STATE };

        default:
            return state;
    }
}
