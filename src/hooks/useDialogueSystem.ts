/**
 * @file src/hooks/useDialogueSystem.ts
 * @description
 * This hook acts as the central controller for the Dialogue System.
 * It connects the Game State (Redux), the Dialogue Service (Business Logic),
 * and the AI Service (Gemini) to the UI components.
 *
 * It handles:
 * 1. Generating AI responses.
 * 2. Processing side effects of dialogue choices (XP, Reputation, Unlocks, Costs).
 * 3. Managing the dialogue session lifecycle.
 */

import { useCallback } from 'react';
import { GameState, Action } from '../types';
import { AppAction } from '../state/actionTypes';
import { ProcessTopicResult } from '../services/dialogueService';
import * as OllamaTextService from '../services/ollamaTextService';
import { NPCS } from '../data/world/npcs';
import { sanitizeAIPromptText } from '../utils/core/securityUtils';
import { topicUnlockKey } from '../systems/facts/worldFactStore';

export const useDialogueSystem = (
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>,
    /**
     * The interaction-action processor (`processAction` from useGameActions).
     * Required to make {@link inviteToParty} work end-to-end: the `talk` action
     * is routed through the action handlers (handleNpcInteraction → handleRecruitOffer),
     * NOT the Redux reducer, so a raw `dispatch` would be inert for it. When omitted
     * (e.g. in unit tests of the side-effect callbacks), `inviteToParty` falls back
     * to `dispatch` so the action is still emitted and assertable.
     */
    processAction?: (action: Action) => void
) => {

    /**
     * Generates a response from the NPC using the Gemini AI service.
     * Stores the result in the game state for history tracking.
     */
    const generateResponse = useCallback(async (prompt: string): Promise<string> => {
        const session = gameState.activeDialogueSession;
        if (!session) return "...";

        const npc = NPCS[session.npcId];
        if (!npc) return "...";

        const systemPrompt = npc.initialPersonalityPrompt ?? '';
        if (!systemPrompt) return "...";

        try {
            const result = await OllamaTextService.generateNPCResponse(
                npc.name,
                // The player's free-form dialogue line — neutralize prompt-injection
                // markers before it reaches the model.
                sanitizeAIPromptText(prompt ?? ""),
                systemPrompt
            );

            if (result.data?.text) {
                dispatch({
                    type: 'SET_LAST_NPC_INTERACTION',
                    payload: { npcId: npc.id, response: result.data.text }
                });
                return result.data.text;
            }
        } catch (error) {
            console.error("Failed to generate dialogue response:", error);
            // Fallback response handled by UI or return generic
        }
        return "...";
    }, [gameState.activeDialogueSession, gameState.devModelOverride, dispatch]);

    /**
     * Handles the side effects of a topic selection.
     * Maps the `ProcessTopicResult` from the service to Redux actions.
     */
    const handleTopicOutcome = useCallback((result: ProcessTopicResult, topicId: string) => {
        const session = gameState.activeDialogueSession;
        if (!session) return;
        const currentGameTime = Number(gameState?.gameTime ?? Date.now());

        // 0. Persist Topic Memory
        // Ensure this topic is remembered in the NPC's long-term memory
        dispatch({
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId,
                npcId: session.npcId,
                date: currentGameTime
            }
        });

        // 1. Grant Experience
        if (result.xpReward && result.xpReward > 0) {
            dispatch({ type: 'GRANT_EXPERIENCE', payload: { amount: result.xpReward } });
            dispatch({
                type: 'ADD_NOTIFICATION',
                payload: { type: 'success', message: `Gained ${result.xpReward} XP` }
            });
        }

        // 2. Modify Disposition
        if (result.dispositionChange && result.dispositionChange !== 0) {
            dispatch({
                type: 'UPDATE_NPC_DISPOSITION',
                payload: { npcId: session.npcId, amount: result.dispositionChange }
            });

            // Log dynamic feedback
            const direction = result.dispositionChange > 0 ? "approves" : "disapproves";
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: Date.now(),
                    text: `${NPCS[session.npcId]?.name || 'NPC'} ${direction} of your words.`,
                    sender: 'system',
                    timestamp: new Date(currentGameTime) as unknown as Date
                }
            });
        }

        // 3. Process Costs (Deductions)
        if (result.deductions && result.deductions.length > 0) {
            result.deductions.forEach(cost => {
                if (cost.type === 'gold') {
                    dispatch({
                        type: 'MODIFY_GOLD',
                        payload: { amount: -cost.value }
                    });
                    dispatch({
                        type: 'ADD_NOTIFICATION',
                        payload: { type: 'info', message: `Paid ${cost.value} Gold` }
                    });
                } else if (cost.type === 'item' && cost.targetId) {
                    dispatch({
                        type: 'REMOVE_ITEM',
                        payload: { itemId: cost.targetId, count: cost.value }
                    });
                     dispatch({
                        type: 'ADD_NOTIFICATION',
                        payload: { type: 'info', message: `Removed item(s)` }
                    });
                }
            });
        }

        // 4. Handle Topic Unlocks — durable cross-NPC propagation (DIAL-002/DIAL-004)
        // Every unlock becomes a world-level fact: what THIS NPC told the player
        // now durably unlocks the gated topic with EVERY NPC (dialogueService's
        // `topic_known` prerequisite reads the same store), and it survives
        // save/reload because the store serializes with GameState. Provenance
        // (who told you, via which topic) rides along for audits and future
        // region-scoped ripples.
        if (result.unlocks && result.unlocks.length > 0) {
            result.unlocks.forEach(unlockedTopicId => {
                dispatch({
                    type: 'LEARN_WORLD_FACT',
                    payload: {
                        fact: {
                            key: topicUnlockKey(unlockedTopicId),
                            sourceNpcId: session.npcId,
                            sourceTopicId: topicId,
                            learnedAt: currentGameTime,
                        },
                    },
                });
            });
        }

        // 5. Handle Lock Topic (if the NPC refuses to speak on it again)
        if (result.lockTopic) {
            // This would require a mechanism to permanently ban a topic ID for an NPC
            // Currently not supported in the simple reducer, but could be added to NPC Memory.
        }

    }, [gameState.activeDialogueSession, gameState.gameTime, dispatch]);

    /**
     * Surfaces the "Invite to party" dialogue affordance. Emits a `talk` action
     * carrying a `recruitOffer`, which the NPC-interaction handler picks up
     * (handleNpcInteraction → handleRecruitOffer): it runs the consent gate,
     * converts the NPC, and dispatches RECRUIT_COMPANION on a yes (or posts the
     * refusal reason on a no). The button is always shown in the UI — ineligible
     * NPCs are declined by the consent gate with a reason, not hidden.
     */
    const inviteToParty = useCallback((npcId: string) => {
        const action: Action = {
            type: 'talk',
            label: 'Invite to party',
            targetId: npcId,
            payload: { targetNpcId: npcId, recruitOffer: { targetNpcId: npcId } }
        };
        if (processAction) {
            processAction(action);
        } else {
            // Fallback: emit through the raw dispatch so the action is still
            // observable (used by unit tests that pass no processAction).
            dispatch(action as unknown as AppAction);
        }
    }, [processAction, dispatch]);

    return {
        generateResponse,
        handleTopicOutcome,
        inviteToParty
    };
};
