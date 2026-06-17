/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/gameEntryReducer.ts
 *
 * Slice reducer for the opening-situation entry state machine. Owns the
 * `gameEntry` field of GameState and translates entry actions through the pure
 * {@link gameEntryTransition} machine so the transitions stay testable.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { gameEntryTransition } from '../../systems/gameEntry/entryStateMachine';
import { INITIAL_GAME_ENTRY_STATE } from '../../systems/gameEntry/types';

export function gameEntryReducer(state: GameState, action: AppAction): Partial<GameState> {
    const current = state.gameEntry ?? INITIAL_GAME_ENTRY_STATE;

    switch (action.type) {
        case 'BEGIN_OPENING_SITUATION':
            // From idle this BEGINs generation; from a prior failure it RETRIES.
            // Both land in `generating` so the orchestration hook fires the model.
            return {
                gameEntry: gameEntryTransition(
                    current,
                    current.status === 'model-unavailable' ? { type: 'RETRY' } : { type: 'BEGIN' },
                ),
            };

        case 'RESOLVE_OPENING_SITUATION':
            return {
                gameEntry: gameEntryTransition(current, { type: 'RESOLVED', situation: action.payload }),
            };

        case 'FAIL_OPENING_SITUATION':
            return {
                gameEntry: gameEntryTransition(current, { type: 'UNAVAILABLE', error: action.payload }),
            };

        case 'RESET_OPENING_SITUATION':
            return { gameEntry: gameEntryTransition(current, { type: 'RESET' }) };

        case 'PLACE_SITUATION_NPCS': {
            // Place the generated strangers into the world: register them in the
            // runtime NPC registry AND add them to the current location's active
            // dynamic NPC list so the scene actually shows the event. They drop
            // off naturally when the player moves (the list is recomputed on move).
            const { npcs } = action.payload;
            if (npcs.length === 0) return {};

            const generatedNpcs = { ...state.generatedNpcs };
            for (const npc of npcs) generatedNpcs[npc.id] = npc;

            const existing = state.currentLocationActiveDynamicNpcIds ?? [];
            const merged = [...existing];
            for (const npc of npcs) {
                if (!merged.includes(npc.id)) merged.push(npc.id);
            }

            return {
                generatedNpcs,
                currentLocationActiveDynamicNpcIds: merged,
            };
        }

        default:
            return {};
    }
}
