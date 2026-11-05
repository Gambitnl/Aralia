/**
 * ARCHITECTURAL CONTEXT:
 * This hook manages active, player-initiated conversations with companions.
 * Unlike the ambient 'useCompanionBanter' which is NPC-to-NPC or NPC-addressed,
 * this hook handles the interactive dialog panel where players can send
 * specific messages, @mention NPCs, and receive AI-generated responses.
 *
 * It archives exact delivered conversation lines separately from the semantic
 * memory summary, which may be absent or rejected by the provider.
 *
 * Called by: ConversationPanel.tsx
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/11/2026, 11:29:02
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 14 files
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import { getWeatherSummary } from '../types/environment';
import { AppAction } from '../state/actionTypes';
import { OllamaService, BanterContext } from '../services/ollama';
import { townChronicleForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { ConversationMessage } from '../types/conversation';
import { generateId } from '../utils/core/idGenerator';
import { getDayPartLabel, getGameDay } from '../utils/core/timeUtils';
import { buildActionMemoryDispatches } from '../systems/memory/actionMemoryMatrix';
import { OPENING_QUEST_ID, OPENING_QUEST_OBJECTIVE_ID } from '../systems/gameEntry/openingQuest';
import { buildNpcDialoguePromptContext } from '../services/dialogueService';
import { describeNpcHearsay, resolveDialogueNpc } from './useDialogueSystem';
import { npcChatAttitudeHint } from '../systems/social/npcLifeReactions';
import {
    canMergeConversationArchive,
    conversationArchiveEntry,
    findMatchingConversationArchive,
    rememberedConversationSpeech,
} from '../systems/companions/conversationTranscript';

export interface UseConversationResult {
    /** Start a new conversation with a companion */
    startConversation: (companionId: string) => void;
    /**
     * Send a player message and get AI response.
     *
     * `mechanicalNote` carries the result of a resolved skill check ("Performance
     * check: 17 … — success."). It is added as a narrator line BETWEEN the
     * player's words and the reply, so it reaches the model inside the history
     * and the NPCs answer the OUTCOME instead of only the words.
     */
    sendPlayerMessage: (text: string, mechanicalNote?: string, signal?: AbortSignal) => Promise<ConversationTurnResult>;
    /** Current local model preparation is visible to the panel and can be canceled. */
    preparationStatus: 'preparing-unsent' | 'preparing-delivered' | null;
    cancelPreparation: () => void;
    /** End the conversation and generate memory summary */
    endConversation: () => Promise<void>;
    /** Whether currently blocked from sending because it's not player turn or waiting for AI response */
    isInteractionLocked: boolean;
    /** A failed provider reply is not silence or an in-world refusal. */
    responseError: string | null;
}

/** Player delivery and NPC reply are separate outcomes: a provider failure must
 * never make recorded player words look like an unsent draft. */
export type ConversationTurnResult =
    | { delivery: 'not-delivered'; reason: 'cancelled' | 'preparation-error' }
    | { delivery: 'delivered'; reply: 'received' | 'failed' | 'cancelled' };

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
    const [responseError, setResponseError] = useState<string | null>(null);
    const [preparationStatus, setPreparationStatus] = useState<UseConversationResult['preparationStatus']>(null);
    const preparationController = useRef<AbortController | null>(null);
    const preparationConversationId = useRef<string | null>(null);
    const preparationTurn = useRef(0);
    const endingConversationIds = useRef(new Set<string>());
    const cancelPreparation = useCallback(() => {
        const activeController = preparationController.current;
        activeController?.abort();
        preparationController.current = null;
        preparationTurn.current += 1;
        setPreparationStatus(null);
        const active = gameStateRef.current.activeConversation;
        if (activeController && active?.id === preparationConversationId.current) {
            dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
        }
        preparationConversationId.current = null;
    }, [dispatch]);
    useEffect(() => {
        setPreparationStatus(null);
        return () => {
            if (preparationConversationId.current === conversation?.id) {
                preparationController.current?.abort();
                preparationController.current = null;
                preparationConversationId.current = null;
                preparationTurn.current += 1;
            }
        };
    }, [conversation?.id]);
    useEffect(() => { setResponseError(null); }, [conversation?.id]);
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
        // G5: day-part word from the character's local in-world clock (the HUD
        // clock, UTC-rendered) — never host-machine getHours().
        const timeOfDay = getDayPartLabel(new Date(state.gameTime));
        
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
        // Memory-derived knowledge (agora-f821.12, deepdive F8/F9). The chat lane's
        // prompt builder (`buildContinuePrompt`) interpolates exactly two things it
        // does not own: the shared `BanterContext` and each speaker's `personality`
        // string. Knowledge is per-speaker — two people in the same room have not
        // heard the same things — so it rides on `personality`, not on the context.
        // Same three builders the topic lane uses, through the same two seams, so a
        // witnessed act or a propagated fact reads identically in both lanes.
        const knowledgeFor = (id: string): string => [
            buildNpcDialoguePromptContext(state, id, resolveDialogueNpc(state, id)),
            describeNpcHearsay(state, id),
            // NPC lives (2026-11-04, GG-596 follow-up 2): a non-companion speaker
            // talks with the same attitude as its greeting. Companions keep
            // their own approval systems, so they get no stance line.
            state.companions[id] ? '' : npcChatAttitudeHint(state, id),
            rememberedConversationSpeech(
                state.archivedBanters,
                state.worldSeed,
                state.activeConversation?.participants ?? companionIds,
            ),
        ].filter(Boolean).join(' ');
        const withKnowledge = (personality: string, id: string): string => {
            const knowledge = knowledgeFor(id);
            return knowledge ? `${personality} ${knowledge}`.trim() : personality;
        };
        return companionIds.map(id => {
            const companion = state.companions[id];
            if (!companion) {
                const situational = npcParticipants.find(p => p.id === id);
                if (situational) {
                    return { id, name: situational.name, personality: withKnowledge(situational.personality, id), race: '', class: '', sex: '', age: '', physicalDescription: '' };
                }
                return { id, name: id, personality: withKnowledge('', id), race: '', class: '', sex: '', age: '', physicalDescription: '' };
            }
            return {
                id,
                name: companion.identity.name,
                race: companion.identity.race,
                class: companion.identity.class,
                sex: companion.identity.sex,
                age: companion.identity.age,
                physicalDescription: companion.identity.physicalDescription,
                personality: withKnowledge(
                    `Values: ${companion.personality.values.join(', ')}. Quirks: ${companion.personality.quirks.join(', ')}.`,
                    id
                )
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
     * @param mechanicalNote - Optional resolved-check line, narrated after the
     *   player's words so the NPCs react to the result of what was attempted.
     */
    const sendPlayerMessage = useCallback(async (text: string, mechanicalNote?: string, signal?: AbortSignal): Promise<ConversationTurnResult> => {
        const state = gameStateRef.current;
        if (preparationController.current || !state.activeConversation || state.activeConversation.pendingResponse || !state.activeConversation.isPlayerTurn) {
            return { delivery: 'not-delivered', reason: 'cancelled' };
        }
        setResponseError(null);
        const note = mechanicalNote?.trim();
        const conversationId = state.activeConversation.id;
        const ownsConversation = () => gameStateRef.current.activeConversation?.id === conversationId;

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

        const controller = new AbortController();
        preparationController.current = controller;
        preparationConversationId.current = conversationId;
        const turn = ++preparationTurn.current;
        const abortFromCaller = () => controller.abort();
        signal?.addEventListener('abort', abortFromCaller, { once: true });
        const unlinkCaller = () => signal?.removeEventListener('abort', abortFromCaller);
        const ownsTurn = () => preparationController.current === controller
            && preparationTurn.current === turn
            && ownsConversation();
        const playerMessage: ConversationMessage = {
            id: generateId(), speakerId: 'player', text, timestamp: Date.now(),
        };
        const noteMessage: ConversationMessage | null = note
            ? { id: generateId(), speakerId: 'narrator', text: note, timestamp: Date.now() }
            : null;
        let playerLineDelivered = !!note;
        // Resolved mechanics already changed the world; preserve their attributed
        // line even if preparation is canceled before the NPC can answer.
        if (note) {
            dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: playerMessage });
            if (noteMessage) dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: noteMessage });
        }
        dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });
        setPreparationStatus(note ? 'preparing-delivered' : 'preparing-unsent');
        let preparation: Awaited<ReturnType<typeof OllamaService.prepareForTask>>;
        try {
            preparation = await OllamaService.prepareForTask('conversation_continuation', { signal: controller.signal });
        } catch (error) {
            unlinkCaller();
            if (!ownsTurn()) return playerLineDelivered
                ? { delivery: 'delivered', reply: 'cancelled' }
                : { delivery: 'not-delivered', reason: 'cancelled' };
            setPreparationStatus(null);
            if (ownsConversation()) dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
            preparationController.current = null;
            preparationConversationId.current = null;
            setResponseError(error instanceof Error ? error.message : 'Local dialogue could not be prepared.');
            return playerLineDelivered
                ? { delivery: 'delivered', reply: 'failed' }
                : { delivery: 'not-delivered', reason: 'preparation-error' };
        }
        if (!ownsTurn()) {
            unlinkCaller();
            return playerLineDelivered
                ? { delivery: 'delivered', reply: 'cancelled' }
                : { delivery: 'not-delivered', reason: 'cancelled' };
        }
        if (preparation.status === 'cancelled' || controller.signal.aborted) {
            unlinkCaller();
            setPreparationStatus(null);
            dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
            preparationController.current = null;
            preparationConversationId.current = null;
            return playerLineDelivered
                ? { delivery: 'delivered', reply: 'cancelled' }
                : { delivery: 'not-delivered', reason: 'cancelled' };
        }
        if (preparation.status === 'error') {
            unlinkCaller();
            setPreparationStatus(null);
            setResponseError(note
                ? 'Local dialogue could not be prepared. Your resolved attempt remains recorded; you can continue or end the conversation.'
                : 'Local dialogue could not be prepared. Your line is still available to retry or continue.');
            if (ownsConversation()) dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
            preparationController.current = null;
            preparationConversationId.current = null;
            return playerLineDelivered
                ? { delivery: 'delivered', reply: 'failed' }
                : { delivery: 'not-delivered', reason: 'preparation-error' };
        }

        // Add player message only once the continuation model is ready. A canceled
        // ordinary line stays in the input; resolved check notes are preserved below.
        if (!note) {
            dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: playerMessage });
            playerLineDelivered = true;
        }
        setPreparationStatus(null);

        // The check result is a real message in the transcript, not a UI badge:
        // the player reads it, and the prose model reads it too because the
        // history below is built from these same messages.
        // Get AI response - prioritize the addressed companion
        const participantIds = addressedCompanionId
            ? [addressedCompanionId, ...state.activeConversation.participants.filter(id => id !== addressedCompanionId)]
            : state.activeConversation.participants;

        const participants = getParticipantData(participantIds);
        const context = buildContext();

        // Build history from conversation
        const history = [
            ...state.activeConversation.messages,
            playerMessage,
            ...(noteMessage ? [noteMessage] : []),
        ].map(m => ({
            speakerId: m.speakerId,
            text: m.text,
        }));

        try {
            const result = await OllamaService.continueConversation(participants, history, context, { signal: controller.signal });
            if (!ownsTurn() || controller.signal.aborted) {
                return playerLineDelivered
                    ? { delivery: 'delivered', reply: 'cancelled' }
                    : { delivery: 'not-delivered', reason: 'cancelled' };
            }

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
                return { delivery: 'delivered', reply: 'received' };
            } else {
                // Keep the player's delivered words, but never present a transport
                // failure as the companion's decision to ignore or agree with them.
                setResponseError('No reply was received. Your words remain in the conversation. You can continue or end the conversation.');
                return { delivery: 'delivered', reply: 'failed' };
            }
        } catch {
            if (!ownsTurn() || controller.signal.aborted) {
                return playerLineDelivered
                    ? { delivery: 'delivered', reply: 'cancelled' }
                    : { delivery: 'not-delivered', reason: 'cancelled' };
            }
            setResponseError('No reply was received. Your words remain in the conversation. You can continue or end the conversation.');
            return { delivery: 'delivered', reply: 'failed' };
        } finally {
            unlinkCaller();
            if (ownsTurn()) {
                setPreparationStatus(null);
                dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
                preparationController.current = null;
                preparationConversationId.current = null;
            }
        }
    }, [dispatch, buildContext, getParticipantData]);

    /**
     * End the conversation and generate memory summary.
     * Also updates companion approval based on AI-analyzed player sentiment.
     */
    const endConversation = useCallback(async () => {
        const state = gameStateRef.current;
        if (!state.activeConversation) return;

        const conversation = state.activeConversation;
        // This guard covers overlapping clicks only. Persisted archive identity
        // below handles a remount/reload; a permanent hook-local set would
        // incorrectly block an older save loaded with the same active ID.
        if (endingConversationIds.current.has(conversation.id)) return;
        endingConversationIds.current.add(conversation.id);
        try {
        const archiveEntry = conversationArchiveEntry(state, 'ended', 'attempted');
        const existingArchive = archiveEntry
            ? findMatchingConversationArchive(state.archivedBanters, archiveEntry)
            : undefined;
        const semanticAlreadyAttempted = existingArchive?.source?.semanticStatus === 'attempted';

        if (archiveEntry && !canMergeConversationArchive(state.archivedBanters, archiveEntry)) {
            // A same-source ID with different delivered words is a divergent
            // snapshot. Keep the active transcript available instead of silently
            // replacing either version or applying social effects twice.
            setResponseError('This conversation conflicts with an archived transcript and remains open.');
            return;
        }

        // The reducer merges only a verified exact-prefix continuation. Its
        // persisted status distinguishes load capture from completed End work.
        if (archiveEntry) dispatch({ type: 'ARCHIVE_BANTER', payload: archiveEntry });

        if (semanticAlreadyAttempted) {
            if (gameStateRef.current.activeConversation?.id === conversation.id) {
                dispatch({ type: 'END_CONVERSATION' });
            }
            return;
        }

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
        // Authored promises and handovers already persist their own exact events.
        // Summarizing them again could duplicate trust or replace facts with guesses.
        const summaryMessages = conversation.messages.filter(message => !message.memoryHandled);
        const shouldSummarize =
            summaryMessages.length >= 3 && (companionIds.length > 0 || strangerIds.length > 0);

        if (shouldSummarize) {
            dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });

            const participants = getParticipantData(conversation.participants);
            const context = buildContext();
            const history = summaryMessages.map(m => ({
                speakerId: m.speakerId,
                text: m.text,
            }));

            try {
            const result = await OllamaService.summarizeConversation(participants, history, context);

            // AI-call logging is centralized in the Ollama client (ollamaLogSink /
            // useOllamaLogBridge); call sites no longer log individually.

            // A close requested for an old conversation may finish after a new
            // one starts. Keep its transcript archive, but never publish its
            // semantic summary or approval into the replacement conversation.
            const summary = gameStateRef.current.activeConversation?.id === conversation.id && result.success ? result.data : null;

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
                    // A finished conversation is a remembered act like any other, so it
                    // goes through the action-memory matrix: the table owns the strength,
                    // the lifespan, the provenance and the fact id; the summarizer owns
                    // only the wording. The conversation id is passed as `targetId` so two
                    // talks with the same NPC on one day stay two distinct facts.
                    buildActionMemoryDispatches({
                        actionType: 'converse',
                        observerNpcId: npcId,
                        targetId: conversation.id,
                        gameDay: getGameDay(new Date(state.gameTime)),
                        timestamp: Date.now(),
                        detail: summary.text,
                    }).forEach(memoryAction => dispatch(memoryAction));
                    if (summary.approvalChange !== 0) {
                        // Disposition runs -100..100; scale the modest sentiment up a little.
                        dispatch({
                            type: 'UPDATE_NPC_DISPOSITION',
                            payload: { npcId, amount: summary.approvalChange * 3 },
                        });
                    }
                }
            }

            } catch {
                // The exact transcript is already archived. Summary failure is
                // not a reason to strand the conversation or lose its words.
            } finally {
                if (gameStateRef.current.activeConversation?.id === conversation.id) {
                    dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
                }
            }
        }

        if (gameStateRef.current.activeConversation?.id === conversation.id) {
            dispatch({ type: 'END_CONVERSATION' });
        }
        } finally {
            endingConversationIds.current.delete(conversation.id);
        }
    }, [dispatch, buildContext, getParticipantData]);

    return {
        startConversation,
        sendPlayerMessage,
        endConversation,
        isInteractionLocked,
        responseError,
        preparationStatus,
        cancelPreparation,
    };
}
