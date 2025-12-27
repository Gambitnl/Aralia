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
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { ProcessTopicResult } from '../services/dialogueService';
import * as GeminiService from '../services/geminiService';
import { NPCS } from '../constants';

export const useDialogueSystem = (
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>
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

        const systemPrompt = npc.initialPersonalityPrompt;

        try {
            const result = await GeminiService.generateNPCResponse(
                systemPrompt,
                prompt,
                gameState.devModelOverride
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
    const handleTopicOutcome = useCallback((result: ProcessTopicResult) => {
        const session = gameState.activeDialogueSession;
        if (!session) return;

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
                    id: crypto.randomUUID(),
                    text: `${NPCS[session.npcId]?.name || 'NPC'} ${direction} of your words.`,
                    type: 'SYSTEM',
                    timestamp: Date.now()
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

        // 4. Handle Topic Unlocks (Global Discovery)
        if (result.unlocks && result.unlocks.length > 0) {
            result.unlocks.forEach(topicId => {
                // We use the Discovery Log to track "Unlocked Topics" globally if they are significant
                // For now, we assume simple topic chaining is handled by the Session state (discussedTopicIds),
                // but if a topic unlocks a GLOBAL fact or quest, we should log it.

                // Example: If a topic unlocks a 'secret', we might want to log it.
                // Current implementation mostly relies on the session state update in the reducer,
                // but if we need persistent cross-NPC unlocks, we'd add a KnownFact here.

                // TODO(Dialogist): Implement cross-NPC topic propagation via ADD_NPC_KNOWN_FACT or Discovery Log.
            });
        }

        // 5. Handle Lock Topic (if the NPC refuses to speak on it again)
        if (result.lockTopic) {
            // This would require a mechanism to permanently ban a topic ID for an NPC
            // Currently not supported in the simple reducer, but could be added to NPC Memory.
        }

    }, [gameState.activeDialogueSession, dispatch]);

    return {
        generateResponse,
        handleTopicOutcome
    };
};
