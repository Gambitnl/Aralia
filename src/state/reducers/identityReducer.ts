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
import { LeverageSystem } from '../../systems/intrigue/LeverageSystem';
import { PlayerIdentityState } from '../../types/identity';
import type { Secret } from '../../types/identity';

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

        case 'APPLY_LEVERAGE': {
            const currentIdentity = ensureIdentityState(state);
            const { secretId, targetId, goal } = action.payload as import('../payloads/identityPayloads').ApplyLeveragePayload;

            const secret = currentIdentity.knownSecrets.find(s => s.id === secretId);
            if (!secret) {
                return {
                    messages: [
                        ...state.messages,
                        {
                            id: Date.now(),
                            text: `You do not know that secret.`,
                            sender: 'system',
                            timestamp: new Date()
                        }
                    ]
                };
            }

            let target = { id: targetId, name: targetId, power: 50, reputation: 0 };
            const faction = state.factions?.[targetId];
            if (faction) {
                const standing = state.playerFactionStandings?.[faction.id];
                target = {
                    id: faction.id,
                    name: faction.name,
                    power: faction.power ?? 50,
                    reputation: standing?.publicStanding ?? 0
                };
            } else {
                const npc = state.dynamicNPCs?.[targetId] ?? state.generatedNpcs?.[targetId];
                if (npc) {
                    target = {
                        id: npc.id,
                        name: npc.name,
                        power: 30,
                        reputation: 0
                    };
                }
            }

            const leverageSystem = new LeverageSystem(state.worldSeed + Date.now());
            const result = leverageSystem.applyLeverage({ secretId, targetId, goal }, secret, target);

            const newIdentityState = { ...currentIdentity };
            if (result.consequences?.secretBurned) {
                newIdentityState.knownSecrets = newIdentityState.knownSecrets.filter(s => s.id !== secretId);
            }

            const updates: Partial<GameState> = {
                playerIdentity: newIdentityState,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: result.message,
                        sender: 'system',
                        timestamp: new Date()
                    }
                ]
            };

            if (result.rewards?.gold && result.rewards.gold > 0) {
                updates.party = state.party.map(p => ({
                    ...p,
                    gold: (p.gold ?? 0) + result.rewards!.gold!
                }));
            }

            const existingStanding = state.playerFactionStandings?.[target.id];
            const currentPublic = existingStanding?.publicStanding ?? 0;
            if (result.rewards?.favor && target.id in (state.factions ?? {})) {
                updates.playerFactionStandings = {
                    ...state.playerFactionStandings,
                    [target.id]: {
                        factionId: target.id,
                        publicStanding: currentPublic + result.rewards.favor,
                        secretStanding: existingStanding?.secretStanding ?? 0,
                        rankId: existingStanding?.rankId ?? 'outsider',
                        favorsOwed: (existingStanding?.favorsOwed ?? 0) + result.rewards.favor,
                        renown: (existingStanding?.renown ?? 0) + Math.floor(result.rewards.favor / 2),
                        history: existingStanding?.history ?? []
                    }
                };
            }

            if (result.consequences?.reputationLoss && target.id in (state.factions ?? {})) {
                updates.playerFactionStandings = {
                    ...state.playerFactionStandings,
                    [target.id]: {
                        factionId: target.id,
                        publicStanding: currentPublic - result.consequences.reputationLoss,
                        secretStanding: existingStanding?.secretStanding ?? 0,
                        rankId: existingStanding?.rankId ?? 'outsider',
                        favorsOwed: existingStanding?.favorsOwed ?? 0,
                        renown: (existingStanding?.renown ?? 0) - Math.floor(result.consequences.reputationLoss / 2),
                        history: existingStanding?.history ?? []
                    }
                };
            }

            return updates;
        }

        default:
            return {};
    }
}
