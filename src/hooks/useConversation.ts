// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:27
 * Dependents: ConversationPanel.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useConversation.ts
 * Hook to manage interactive companion conversations.
 */
import { useCallback, useRef } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { OllamaService, BanterContext } from '../services/ollama';
import { ConversationMessage } from '../types/conversation';
import { generateId } from '../utils/core/idGenerator';

export interface UseConversationResult {
    /** Start a new conversation with a companion */
    startConversation: (companionId: string) => void;
    /** Send a player message and get AI response */
    sendPlayerMessage: (text: string) => Promise<void>;
    /** End the conversation and generate memory summary */
    endConversation: () => Promise<void>;
    /** Whether currently waiting for AI response */
    isPending: boolean;
}

export function useConversation(
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>
): UseConversationResult {
    const gameStateRef = useRef(gameState);
    gameStateRef.current = gameState;

    const isPending = gameState.activeConversation?.pendingResponse ?? false;

    /**
     * Build context for the AI from current game state.
     */
    const buildContext = useCallback((): BanterContext => {
        const state = gameStateRef.current;
        const locId = state.currentLocationId;
        const locName = state.dynamicLocations?.[locId]?.name || locId;
        const weather = state.environment?.currentWeather || 'Clear';
        const hour = new Date(state.gameTime).getHours();
        const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
        const activeQuest = state.questLog.find(q => q.status === 'Active' || (q.status as any) === 'active');

        return {
            locationName: locName,
            weather,
            timeOfDay,
            currentTask: activeQuest?.title,
        };
    }, []);

    /**
     * Get participant data for the OllamaService.
     */
    const getParticipantData = useCallback((companionIds: string[]) => {
        const state = gameStateRef.current;
        return companionIds.map(id => {
            const companion = state.companions[id];
            if (!companion) return { id, name: id, personality: '', race: '', class: '', sex: '', age: '', physicalDescription: '' };
            return {
                id,
                name: companion.identity.name,
                race: companion.identity.race,
                class: companion.identity.class,
                sex: companion.identity.sex,
                age: companion.identity.age,
                physicalDescription: companion.identity.physicalDescription,
                personality: `Values: ${companion.personality.values.join(', ')}. Quirks: ${companion.personality.quirks.join(', ')}.`
            };
        });
    }, []);

    /**
     * Start a new conversation with a companion.
     */
    const startConversation = useCallback(async (companionId: string) => {
        const state = gameStateRef.current;
        if (state.activeConversation) return; // Already in conversation

        const companion = state.companions[companionId];
        if (!companion) return;

        dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });

        // Generate opening line from companion
        const participants = getParticipantData([companionId]);
        const context = buildContext();

        const result = await OllamaService.continueConversation(
            participants,
            [], // Empty history - companion starts
            context
        );

        if (result.metadata) {
            dispatch({
                type: 'ADD_OLLAMA_LOG_ENTRY',
                payload: {
                    id: result.metadata.id || generateId(),
                    timestamp: new Date(),
                    model: result.metadata.model,
                    prompt: result.metadata.prompt,
                    response: result.metadata.response || '',
                    context
                }
            });
        }

        const response = result.success ? result.data : null;

        if (response) {
            const initialMessage: ConversationMessage = {
                id: generateId(),
                speakerId: response.speakerId,
                text: response.text,
                emotion: response.emotion,
                timestamp: Date.now(),
            };

            dispatch({
                type: 'START_CONVERSATION',
                payload: {
                    companionIds: [companionId],
                    initialMessage,
                },
            });
        } else {
            // Fallback if Ollama unavailable
            const initialMessage: ConversationMessage = {
                id: generateId(),
                speakerId: companionId,
                text: `*${companion.identity.name} looks at you expectantly.*`,
                timestamp: Date.now(),
            };

            dispatch({
                type: 'START_CONVERSATION',
                payload: {
                    companionIds: [companionId],
                    initialMessage,
                },
            });
        }

        dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
    }, [dispatch, buildContext, getParticipantData]);

    /**
     * Send a player message and get AI response.
     * @param text - The player's message (may contain @mention to address specific companion)
     */
    const sendPlayerMessage = useCallback(async (text: string) => {
        const state = gameStateRef.current;
        if (!state.activeConversation || state.activeConversation.pendingResponse) return;

        // Extract @mention to determine who is being addressed
        const mentionMatch = text.match(/@(\w+)/i);
        let addressedCompanionId: string | null = null;

        if (mentionMatch) {
            const mentionName = mentionMatch[1].toLowerCase();
            for (const id of state.activeConversation.participants) {
                const companion = state.companions[id];
                if (companion && companion.identity.name.toLowerCase().includes(mentionName)) {
                    addressedCompanionId = id;
                    break;
                }
            }
        }

        // Add player message
        const playerMessage: ConversationMessage = {
            id: generateId(),
            speakerId: 'player',
            text,
            timestamp: Date.now(),
        };

        dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: playerMessage });
        dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });

        // Get AI response - prioritize the addressed companion
        const participantIds = addressedCompanionId
            ? [addressedCompanionId, ...state.activeConversation.participants.filter(id => id !== addressedCompanionId)]
            : state.activeConversation.participants;

        const participants = getParticipantData(participantIds);
        const context = buildContext();

        // Build history from conversation
        const history = [...state.activeConversation.messages, playerMessage].map(m => ({
            speakerId: m.speakerId,
            text: m.text,
        }));

        const result = await OllamaService.continueConversation(participants, history, context);

        if (result.metadata) {
            dispatch({
                type: 'ADD_OLLAMA_LOG_ENTRY',
                payload: {
                    id: result.metadata.id || generateId(),
                    timestamp: new Date(),
                    model: result.metadata.model,
                    prompt: result.metadata.prompt,
                    response: result.metadata.response || '',
                    context
                }
            });
        }

        const response = result.success ? result.data : null;

        if (response) {
            const aiMessage: ConversationMessage = {
                id: generateId(),
                speakerId: response.speakerId,
                text: response.text,
                emotion: response.emotion,
                timestamp: Date.now(),
            };

            dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: aiMessage });
        }

        dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
    }, [dispatch, buildContext, getParticipantData]);

    /**
     * End the conversation and generate memory summary.
     * Also updates companion approval based on AI-analyzed player sentiment.
     */
    const endConversation = useCallback(async () => {
        const state = gameStateRef.current;
        if (!state.activeConversation) return;

        const conversation = state.activeConversation;

        // Only summarize if there were multiple exchanges
        if (conversation.messages.length >= 3) {
            dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });

            const participants = getParticipantData(conversation.participants);
            const context = buildContext();
            const history = conversation.messages.map(m => ({
                speakerId: m.speakerId,
                text: m.text,
            }));

            const result = await OllamaService.summarizeConversation(participants, history, context);

            if (result.metadata) {
                dispatch({
                    type: 'ADD_OLLAMA_LOG_ENTRY',
                    payload: {
                        id: result.metadata.id || generateId(),
                        timestamp: new Date(),
                        model: result.metadata.model,
                        prompt: result.metadata.prompt,
                        response: result.metadata.response || '',
                        context
                    }
                });
            }

            const summary = result.success ? result.data : null;

            if (summary) {
                // Add memory to all participants
                for (const companionId of conversation.participants) {
                    dispatch({
                        type: 'ADD_COMPANION_MEMORY',
                        payload: {
                            companionId,
                            memory: {
                                id: generateId(),
                                type: 'banter',
                                text: summary.text,
                                tags: summary.tags,
                                timestamp: Date.now(),
                                importance: 5,
                            },
                        },
                    });

                    // Update companion approval based on AI sentiment analysis
                    // Banter adjustments are modest (multiplier of 2) compared to major story events
                    if (summary.approvalChange !== 0) {
                        const companion = state.companions[companionId];
                        const companionName = companion?.identity.name || companionId;
                        const banterMultiplier = 2; // Modest: -6 to +6 per conversation
                        const adjustedChange = summary.approvalChange * banterMultiplier;

                        dispatch({
                            type: 'UPDATE_COMPANION_APPROVAL',
                            payload: {
                                companionId,
                                change: adjustedChange,
                                reason: summary.approvalChange > 0
                                    ? `${companionName} appreciated the conversation`
                                    : `${companionName} was put off by the conversation`,
                                source: 'conversation',
                            },
                        });
                    }
                }
            }

            dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
        }

        dispatch({ type: 'END_CONVERSATION' });
    }, [dispatch, buildContext, getParticipantData]);

    return {
        startConversation,
        sendPlayerMessage,
        endConversation,
        isPending,
    };
}
