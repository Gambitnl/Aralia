// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 04:34:00
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This hook manages active, player-initiated conversations with companions.
 * Unlike the ambient 'useCompanionBanter' which is NPC-to-NPC or NPC-addressed,
 * this hook handles the interactive dialog panel where players can send 
 * specific messages, @mention NPCs, and receive AI-generated responses.
 *
 * It persists conversation history into NPC memory and triggers approval 
 * changes based on sentiment analysis of the exchange.
 *
 * Called by: ConversationPanel.tsx
 */

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useConversation.ts
 * Hook to manage interactive companion conversations.
 */
import { useCallback, useEffect, useRef } from 'react';
import { GameState } from '../types';
import { getWeatherSummary } from '../types/environment';
import { AppAction } from '../state/actionTypes';
import { OllamaService, BanterContext } from '../services/ollama';
import { townChronicleForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { ConversationMessage } from '../types/conversation';
import { generateId } from '../utils/core/idGenerator';
import { OPENING_QUEST_ID, OPENING_QUEST_OBJECTIVE_ID } from '../systems/gameEntry/openingQuest';

export interface UseConversationResult {
    /** Start a new conversation with a companion */
    startConversation: (companionId: string) => void;
    /** Send a player message and get AI response */
    sendPlayerMessage: (text: string) => Promise<void>;
    /** End the conversation and generate memory summary */
    endConversation: () => Promise<void>;
    /** Whether currently blocked from sending because it's not player turn or waiting for AI response */
    isInteractionLocked: boolean;
}

export function useConversation(
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>
): UseConversationResult {
    const gameStateRef = useRef(gameState);
    // WHAT CHANGED: Wrapped gameStateRef update in useEffect.
    // WHY IT CHANGED: Direct assignment during render is discouraged and can 
    // lead to "stale closure" bugs if callbacks triggered by async Ollama requests 
    // read the ref before it has been updated for the current render cycle. 
    // useEffect ensures the ref always points to the most recent state.
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const conversation = gameState.activeConversation;
    const isPending = conversation?.pendingResponse ?? false;
    const isPlayerTurn = conversation?.isPlayerTurn ?? false;
    const isInteractionLocked = isPending || !isPlayerTurn;

    /**
     * Build context for the AI from current game state.
     */
    const buildContext = useCallback((): BanterContext => {
        const state = gameStateRef.current;
        const locId = state.currentLocationId;
        const locName = state.dynamicLocations?.[locId]?.name || locId;
        const weather = getWeatherSummary(state.environment);
        const hour = new Date(state.gameTime).getHours();
        const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
        
        // WHAT CHANGED: Added case-insensitive quest status check.
        // WHY IT CHANGED: The quest engine recently switched from 'active' (lowercase) 
        // to 'Active' (PascalCase). This cast and dual-check maintains compatibility 
        // with legacy save files while adhering to the new schema.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeQuest = state.questLog.find(q => q.status === 'Active' || (q.status as any) === 'active');

        return {
            locationName: locName,
            weather,
            timeOfDay,
            currentTask: activeQuest?.title,
            townChronicle: townChronicleForLocation({
                // GRID-RETIRE: BA-2 — prefer the canonical cell.
                cellId: state.playerCell?.cellId ?? null,
                currentLocationId: state.currentLocationId,
                worldSeed: state.worldSeed,
                townSim: state.townSim,
                gameTime: state.gameTime,
            }),
        };
    }, []);

    /**
     * Get participant data for the OllamaService.
     */
    const getParticipantData = useCallback((companionIds: string[]) => {
        const state = gameStateRef.current;
        // Situational (non-companion) NPCs live on the active conversation, not in
        // `companions`. Resolve them here so the opening-situation stranger can be
        // voiced through the same continueConversation path.
        const npcParticipants = state.activeConversation?.npcParticipants ?? [];
        return companionIds.map(id => {
            const companion = state.companions[id];
            if (!companion) {
                const situational = npcParticipants.find(p => p.id === id);
                if (situational) {
                    return { id, name: situational.name, personality: situational.personality, race: '', class: '', sex: '', age: '', physicalDescription: '' };
                }
                return { id, name: id, personality: '', race: '', class: '', sex: '', age: '', physicalDescription: '' };
            }
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

        // AI-call logging is centralized in the Ollama client (ollamaLogSink /
        // useOllamaLogBridge); call sites no longer log individually.

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
        if (!state.activeConversation || state.activeConversation.pendingResponse || !state.activeConversation.isPlayerTurn) return;

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

        // AI-call logging is centralized in the Ollama client (ollamaLogSink /
        // useOllamaLogBridge); call sites no longer log individually.

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

        // Partition participants: companions persist into companion memory/approval;
        // situational strangers (the opening-situation NPCs, which are NOT companions)
        // persist into npcMemory — met state, a remembered fact, a disposition shift —
        // so the encounter actually leaves a mark instead of being purely cosmetic.
        const companionIds = conversation.participants.filter((id) => state.companions[id]);
        const strangerIds = conversation.participants.filter(
            (id) => !state.companions[id] && !!state.generatedNpcs?.[id],
        );

        // Mark strangers as met regardless of length — even a one-line exchange means
        // the player has now met them.
        for (const id of strangerIds) {
            dispatch({ type: 'ADD_MET_NPC', payload: { npcId: id } });
        }

        // Engaging the opening-situation strangers closes the opening quest's
        // objective — the predicament now has a beginning AND an end. The reducer
        // no-ops if the quest/objective is absent or already done, so this is safe
        // for ordinary (non-opening) companion conversations too.
        if (conversation.kind === 'situation' && strangerIds.length > 0) {
            dispatch({
                type: 'UPDATE_QUEST_OBJECTIVE',
                payload: { questId: OPENING_QUEST_ID, objectiveId: OPENING_QUEST_OBJECTIVE_ID, isCompleted: true },
            });
        }

        // Only spend a summarization model call when there's somewhere to put the
        // result (a companion or a known stranger) AND enough was said to summarize.
        const shouldSummarize =
            conversation.messages.length >= 3 && (companionIds.length > 0 || strangerIds.length > 0);

        if (shouldSummarize) {
            dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });

            const participants = getParticipantData(conversation.participants);
            const context = buildContext();
            const history = conversation.messages.map(m => ({
                speakerId: m.speakerId,
                text: m.text,
            }));

            const result = await OllamaService.summarizeConversation(participants, history, context);

            // AI-call logging is centralized in the Ollama client (ollamaLogSink /
            // useOllamaLogBridge); call sites no longer log individually.

            const summary = result.success ? result.data : null;

            if (summary) {
                // Companions: memory + approval (unchanged behavior).
                for (const companionId of companionIds) {
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

                // Strangers: record the conversation as a remembered fact and let the
                // sentiment nudge their disposition. These npcMemory writes stick
                // because PLACE_SITUATION_NPCS seeds a memory entry for each stranger.
                for (const npcId of strangerIds) {
                    dispatch({
                        type: 'ADD_NPC_KNOWN_FACT',
                        payload: {
                            npcId,
                            fact: {
                                id: generateId(),
                                text: summary.text,
                                source: 'direct',
                                isPublic: false,
                                timestamp: Date.now(),
                                strength: 4,
                                lifespan: 999,
                            },
                        },
                    });
                    if (summary.approvalChange !== 0) {
                        // Disposition runs -100..100; scale the modest sentiment up a little.
                        dispatch({
                            type: 'UPDATE_NPC_DISPOSITION',
                            payload: { npcId, amount: summary.approvalChange * 3 },
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
        isInteractionLocked,
    };
}
