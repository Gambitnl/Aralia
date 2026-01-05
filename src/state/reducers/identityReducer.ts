/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/identityReducer.ts
 * Reducer for identity and intrigue actions.
 */

import { GameState } from '../../types/index';
import { AppAction } from '../actionTypes';
import { IdentityManager } from '../../systems/intrigue/IdentityManager';
import { PlayerIdentityState } from '../../types/identity';

// Helper to ensure identity state exists
function ensureIdentityState(state: GameState): PlayerIdentityState {
    if (state.playerIdentity) {
        return state.playerIdentity;
    }
    // Fallback if not initialized (shouldn't happen with proper init)
    return IdentityManager.createInitialState(
        state.party[0]?.id || 'unknown',
        state.party[0]?.name || 'Unknown',
        'A mysterious traveler.'
    );
}

export function identityReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'CREATE_ALIAS': {
            const currentIdentity = ensureIdentityState(state);
            const { alias } = action.payload as import('../payloads/identityPayloads').CreateAliasPayload;
            // TODO(2026-01-03 pass 4 Codex-CLI): Replace placeholder alias defaults once history/regions are guaranteed from the caller.
            const aliasHistory = alias.history ?? 'Unknown';
            const aliasRegion = alias.establishedIn?.[0] ?? 'Unknown';
            const newIdentityState = IdentityManager.createAlias(currentIdentity, alias.name, aliasHistory, aliasRegion);

            return {
                playerIdentity: newIdentityState,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You have established a new alias: "${alias.name}".`,
                        sender: 'system',
                        timestamp: new Date()
                    }
                ]
            };
        }

        case 'EQUIP_DISGUISE': {
            const currentIdentity = ensureIdentityState(state);
            const { disguise } = action.payload;
            const newIdentityState = IdentityManager.equipDisguise(currentIdentity, disguise);

            return {
                playerIdentity: newIdentityState,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You are now disguised as: ${disguise.targetAppearance}.`,
                        sender: 'system',
                        timestamp: new Date()
                    }
                ]
            };
        }

        case 'REMOVE_DISGUISE': {
            const currentIdentity = ensureIdentityState(state);
            const newIdentityState = IdentityManager.removeDisguise(currentIdentity);

            return {
                playerIdentity: newIdentityState,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You removed your disguise.`,
                        sender: 'system',
                        timestamp: new Date()
                    }
                ]
            };
        }

        case 'LEARN_SECRET': {
            const currentIdentity = ensureIdentityState(state);
            const { secret } = action.payload;
            const newIdentityState = IdentityManager.learnSecret(currentIdentity, secret);

            return {
                playerIdentity: newIdentityState,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Secret learned: ${secret.content}`,
                        sender: 'system',
                        timestamp: new Date()
                    }
                ]
            };
        }

        default:
            return {};
    }
}
