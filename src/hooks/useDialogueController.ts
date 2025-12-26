import { useCallback } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { ProcessTopicResult, DialogueSession } from '../types/dialogue';
import * as GeminiService from '../services/geminiService';
import { NPCS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook to manage Dialogue System logic and side effects.
 * Bridges the UI (DialogueInterface) with the Game State (Reducers/Service).
 */
export const useDialogueController = (
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>
) => {

    const handleGenerateResponse = useCallback(async (prompt: string): Promise<string> => {
        const npc = gameState.activeDialogueSession ? NPCS[gameState.activeDialogueSession.npcId] : null;
        if (!npc) return "...";

        const systemPrompt = npc.initialPersonalityPrompt;
        const result = await GeminiService.generateNPCResponse(systemPrompt, prompt, gameState.devModelOverride);

        if (result.data?.text) {
            dispatch({ type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: npc.id, response: result.data.text } });
            return result.data.text;
        }
        return "...";
    }, [gameState.activeDialogueSession, gameState.devModelOverride, dispatch]);

    const handleUpdateSession = useCallback((newSession: DialogueSession) => {
        dispatch({ type: 'UPDATE_DIALOGUE_SESSION', payload: { session: newSession } });
    }, [dispatch]);

    /**
     * Applies the side effects of a topic selection (XP, Disposition, Unlocks).
     */
    const handleApplyTopicResult = useCallback((result: ProcessTopicResult, npcId: string) => {
        // 1. Handle Disposition Changes
        if (result.dispositionChange) {
            dispatch({
                type: 'UPDATE_NPC_DISPOSITION',
                payload: { npcId, change: result.dispositionChange }
            });
        }

        // 2. Handle Unlocks (Topics/Knowledge)
        if (result.unlocks && result.unlocks.length > 0) {
            // We use the Discovery Log to track unlocked topics via flags.
            // This matches the logic in dialogueService.checkTopicPrerequisites ('topic_known').
            result.unlocks.forEach(topicId => {
                 dispatch({
                    type: 'ADD_DISCOVERY_ENTRY',
                    payload: {
                        id: uuidv4(),
                        type: 'dialogue_unlock', // Assuming generic type or specific one exists, strictly string in some definitions
                        title: `Topic Unlocked: ${topicId}`,
                        description: `You can now discuss this topic.`,
                        date: gameState.gameTime,
                        isRead: false,
                        flags: [{ key: 'topic_unlocked', value: topicId }]
                    }
                 });
            });
        }

        // 3. Handle XP
        if (result.xpReward) {
            dispatch({
                type: 'GRANT_EXPERIENCE',
                payload: { amount: result.xpReward }
            });
        }

    }, [dispatch, gameState.gameTime]);

    return {
        handleGenerateResponse,
        handleUpdateSession,
        handleApplyTopicResult
    };
};
