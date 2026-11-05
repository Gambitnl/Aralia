// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 01:18:45
 * Dependents: components/layout/GameModals.tsx
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DialogueSession, ConversationTopic } from '../../types/dialogue';
import type { GameState, NPC, PlayerCharacter, RichNPC } from '../../types';
import {
    getAvailableTopics,
    processTopicSelection,
    type ProcessTopicResult,
} from '../../services/dialogueService';
import { loadDialogueGraph } from '../../systems/dialogue/dialogueGraphLoader';
import {
    advanceLinear,
    getAvailableChoices,
    getNode,
} from '../../systems/dialogue/dialogueGraphRuntime';
import type {
    DialogueGraph,
    DialogueGraphContext,
    DialogueEffectOutcome,
} from '../../systems/dialogue/dialogueGraphTypes';
import { WindowFrame } from '../ui/WindowFrame';
import { DialogueConversationView } from './DialogueConversationView';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { getCharacterSkillModifier } from '../../utils/character/skillModifierUtils';
import { canOfferPartyInvitation } from '../../systems/party/recruitConsent';
import { householdNpcDescription } from '../../systems/worldforge/townsim/householdNpc';
import { getGameDay } from '../../utils/core';

/**
 * This file controls the conversation window players use when talking to an NPC.
 *
 * GameModals opens it after a dialogue session starts. This controller resolves
 * available topics, skill checks, session updates, outcomes, and generated NPC
 * replies, then passes the visible state into DialogueConversationView. Sharing
 * that view with Design Preview keeps preview and production presentation equal.
 *
 * Called by: components/layout/GameModals.tsx
 * Depends on: dialogueService, WindowFrame, and DialogueConversationView
 */

// ============================================================================
// Component Contract
// ============================================================================
// The parent owns reducer state and lifecycle callbacks. This component owns
// temporary response, pending, and result state for the open dialogue window.
// ============================================================================
interface DialogueInterfaceProps {
    isOpen: boolean;
    session: DialogueSession | null;
    gameState: GameState;
    npc: NPC;
    playerCharacter: PlayerCharacter;
    onClose: () => void;
    onUpdateSession: (newSession: DialogueSession) => void;
    onTopicOutcome?: (result: ProcessTopicResult, topicId: string) => void;
    onGenerateResponse: (prompt: string, signal?: AbortSignal, options?: { kind: 'topic' | 'speech'; onPreparationChange: (preparing: boolean) => void }) => Promise<string>;
    /**
     * Invokes the "Invite to party" flow for this NPC. The downstream consent
     * gate still resolves trust and consent. Ordinary household residents need an
     * established companion opportunity before an invitation is offered.
     */
    onInvite?: (npcId: string) => void;
    /**
     * Scripted-conversation mode (DIAL-001). Supply either an already-loaded
     * `dialogueGraph` or a `dialogueGraphId` to fetch through the loader. When
     * one is present this window plays the authored graph instead of the
     * free-form topic pool; when neither is, nothing about the existing topic
     * behavior changes.
     */
    dialogueGraph?: DialogueGraph;
    dialogueGraphId?: string;
    /**
     * Initial gating context for graph conditions (quest statuses, inventory,
     * time of day, flags). Disposition defaults to this NPC's stored value.
     * Kept separate from `gameState` so a preview can drive a graph without a
     * save, and so the graph system never binds to the game state shape.
     */
    graphContext?: DialogueGraphContext;
    /**
     * Receives the effects a graph node fired, resolved but NOT applied. The
     * parent's reducer stays the only writer of items, quests, disposition,
     * topic unlocks, and flags.
     */
    onGraphEffects?: (outcomes: DialogueEffectOutcome[]) => void;
}

// ============================================================================
// Dialogue Controller
// ============================================================================
// Game decisions remain here rather than in the shared view. That separation
// lets the Design Preview use identical presentation without mutating a save.
// ============================================================================
// Normal direct Talk snapshots familiarity before writing the meeting fact.
// Its opening is a brief narration, never an invented model response. Callers
// with an authored/generated opening retain their existing same-speaker line.
const getOpeningResponse = (gameState: GameState, npc: NPC, session: DialogueSession | null): string => {
    if (session?.contactStatus === 'returning') return `${npc.name} recognizes you from your earlier conversation.`;
    if (session?.contactStatus === 'first-meeting') return `${npc.name} turns to speak with you.`;
    return (gameState.lastInteractedNpcId === npc.id && gameState.lastNpcResponse) || `"${npc.name} greets you."`;
};

export const DialogueInterface: React.FC<DialogueInterfaceProps> = ({
    isOpen,
    session,
    gameState,
    npc,
    playerCharacter,
    onClose,
    onUpdateSession,
    onTopicOutcome,
    onGenerateResponse,
    onInvite,
    dialogueGraph,
    dialogueGraphId,
    graphContext,
    onGraphEffects,
}) => {
    // Start direct Talk with its own greeting; old answers remain in history.
    // Authored/generated openings retain the existing same-speaker response.
    const [currentResponse, setCurrentResponse] = useState<string | null>(
        getOpeningResponse(gameState, npc, session),
    );
    const [isThinking, setIsThinking] = useState(false);
    const [isPreparingLocalDialogue, setIsPreparingLocalDialogue] = useState(false);
    const [lastTopicResult, setLastTopicResult] = useState<ProcessTopicResult | null>(null);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [speechDraft, setSpeechDraft] = useState('');
    // Retry remembers only the requested speech. Free speech never replays a
    // paid/rolled topic and cannot award the effects of an authored choice.
    const [lastReplyRequest, setLastReplyRequest] = useState<{prompt:string; kind:'topic'|'speech'} | null>(null);
    const replySerial = useRef(0);
    const replyRequest = useRef<{ id: number; controller: AbortController } | null>(null);
    const invalidateReply = useCallback(() => {
        replyRequest.current?.controller.abort();
        replyRequest.current = null;
        replySerial.current++;
    }, []);

    useEffect(() => {
        invalidateReply();
        setIsThinking(false);
        setIsPreparingLocalDialogue(false);
        setReplyError(null);
        setLastTopicResult(null);
        setSpeechDraft('');
        setLastReplyRequest(null);
        setCurrentResponse(getOpeningResponse(gameState, npc, session));
        return invalidateReply;
        // Topic/clock updates keep the current reply. A new speaker or reopened
        // window starts a fresh lifetime and cannot inherit another NPC's line.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, session?.npcId, invalidateReply]);

    const endConversation = () => {
        invalidateReply();
        setIsThinking(false);
        setIsPreparingLocalDialogue(false);
        onClose();
    };

    const requestReply = async (prompt: string, kind:'topic'|'speech' = 'topic'): Promise<boolean> => {
        if (replyRequest.current) return false;
        const controller = new AbortController(), id = ++replySerial.current;
        replyRequest.current = { id, controller };
        setReplyError(null);
        setIsThinking(true);
        setIsPreparingLocalDialogue(false);
        setLastReplyRequest({prompt,kind});
        try {
            const response = await onGenerateResponse(prompt, controller.signal, {
                kind,
                onPreparationChange: preparing => {
                    if (replyRequest.current?.id === id && !controller.signal.aborted) {
                        setIsPreparingLocalDialogue(preparing);
                    }
                },
            });
            if (replyRequest.current?.id !== id || controller.signal.aborted) return false;
            if (!response.trim()) throw new Error('Empty reply');
            setCurrentResponse(response);
            if (kind==='speech') setSpeechDraft(current => current.trim()===prompt ? '' : current);
            return true;
        } catch {
            if (replyRequest.current?.id !== id || controller.signal.aborted) return false;
            setReplyError(kind==='speech' ? 'The reply failed. Your words are kept; you can retry or ask something else.' : 'The reply failed. Your choice and its effects are kept.');
            return false;
        } finally {
            if (replyRequest.current?.id === id) {
                replyRequest.current = null;
                setIsThinking(false);
                setIsPreparingLocalDialogue(false);
            }
        }
    };

    const cancelPendingReply = () => {
        if (!replyRequest.current) return;
        replyRequest.current.controller.abort();
        replyRequest.current = null;
        replySerial.current++;
        setIsThinking(false);
        setIsPreparingLocalDialogue(false);
        setReplyError(null);
    };

    // ------------------------------------------------------------------
    // Scripted graph mode (DIAL-001)
    // ------------------------------------------------------------------
    // Graph playback lives beside the topic flow rather than replacing it.
    // The two answer different needs: authored graphs give exact wording and
    // deterministic branching, the topic pool gives open-ended, LLM-voiced
    // conversation. A caller picks per conversation.
    const [loadedGraph, setLoadedGraph] = useState<DialogueGraph | null>(null);
    const [graphError, setGraphError] = useState<string | null>(null);
    const activeGraph = dialogueGraph ?? loadedGraph;

    // Fetch by id only when no graph object was handed in. Cancellation via the
    // `cancelled` guard keeps a slow fetch from resolving into a closed window.
    useEffect(() => {
        if (dialogueGraph || !dialogueGraphId) return undefined;
        let cancelled = false;
        setGraphError(null);
        loadDialogueGraph(dialogueGraphId)
            .then((graph) => {
                if (!cancelled) setLoadedGraph(graph);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setLoadedGraph(null);
                    setGraphError(error instanceof Error ? error.message : String(error));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [dialogueGraph, dialogueGraphId]);

    // Disposition seeds the graph context so a `disposition` condition works
    // against the same number the header shows, without the graph system having
    // to know what `npcMemory` is.
    const storedDisposition = gameState.npcMemory?.[npc.id]?.disposition ?? 0;
    const [graphState, setGraphState] = useState<{
        nodeId: string | null;
        context: DialogueGraphContext;
    }>({ nodeId: null, context: {} });

    // Entering a graph (or switching to a different one) replays its opening
    // linear run so the player sees the full authored lead-in at once.
    useEffect(() => {
        if (!activeGraph) {
            setGraphState({ nodeId: null, context: {} });
            return;
        }
        const startContext: DialogueGraphContext = {
            disposition: storedDisposition,
            ...graphContext,
        };
        const run = advanceLinear(activeGraph, activeGraph.startNodeId, startContext);
        setGraphState({ nodeId: run.nodeId, context: run.context });
        if (run.outcomes.length > 0) onGraphEffects?.(run.outcomes);
        // `graphContext`/`onGraphEffects` are intentionally excluded: a parent
        // re-creating either object each render must not restart the
        // conversation from its first line.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeGraph, storedDisposition]);

    const graphNode = useMemo(
        () => (activeGraph && graphState.nodeId ? getNode(activeGraph, graphState.nodeId) : undefined),
        [activeGraph, graphState.nodeId],
    );

    const graphChoices = useMemo(
        () => getAvailableChoices(graphNode, graphState.context),
        [graphNode, graphState.context],
    );

    // Graph choices are presented through the SAME view as topics so scripted
    // and free-form conversation look identical to the player. Reusing
    // `ConversationTopic` here avoids a second button component and a second
    // visual standard; only the fields the view reads are populated.
    const graphChoiceTopics = useMemo<ConversationTopic[]>(
        () =>
            graphChoices.map((choice, index) => ({
                id: `graph-choice-${index}`,
                label: choice.text,
                category: 'personal',
                playerPrompt: choice.text,
            })),
        [graphChoices],
    );

    const handleGraphChoice = useCallback(
        (topic: ConversationTopic) => {
            if (!activeGraph) return;
            const index = Number(topic.id.replace('graph-choice-', ''));
            const choice = graphChoices[index];
            if (!choice) return;

            const run = advanceLinear(activeGraph, choice.nextNodeId, graphState.context);
            setGraphState({ nodeId: run.nodeId, context: run.context });
            if (run.outcomes.length > 0) onGraphEffects?.(run.outcomes);
        },
        [activeGraph, graphChoices, graphState.context, onGraphEffects],
    );

    // Topic availability depends on current game state, NPC knowledge, and what
    // this session already discussed. Recalculate only when those inputs change.
    const availableTopics = useMemo(() => {
        if (!session) return [];
        return getAvailableTopics(gameState, npc.id, session, npc);
    }, [gameState, npc, session]);

    // Selecting a topic resolves its mechanics first, updates durable session
    // state and outcomes, then asks the AI for the NPC's visible response.
    const handleTopicSelect = async (topic: ConversationTopic) => {
        if (!session || replyRequest.current) return;

        setReplyError(null);
        setIsThinking(true);
        setLastReplyRequest(null);

        // Skill topics use the player's full skill check modifier (including proficiency,
        // expertise, and Jack of All Trades).
        let skillMod = 0;
        if (topic.skillCheck) {
            const checkSkill = topic.skillCheck.skill;
            skillMod = getCharacterSkillModifier(playerCharacter, checkSkill.id || checkSkill.name, checkSkill.ability);
        }

        // Dialogue service owns costs, checks, unlocks, and the prompt used for
        // the NPC reply. The UI surfaces the result but does not duplicate rules.
        //
        // processTopicSelection throws on an id it cannot resolve. Unhandled,
        // that throw escapes this async handler to the ErrorBoundary wrapping
        // the mount in GameModals and tears the conversation down mid-sentence
        // (agora-f821.27). A stale session or a graph-choice id reaching this
        // handler is a lookup miss, not a reason to end the conversation, so it
        // is reported inside the window and the session is left untouched: no
        // discussedTopicIds append, no outcome, no AI call.
        let result: ProcessTopicResult;
        try {
            // The service may mark its input discussed. Give it a copy so the
            // controller records one choice without mutating React state twice.
            result = processTopicSelection(topic.id, gameState, {
                ...session, discussedTopicIds: [...session.discussedTopicIds],
            }, skillMod, npc);
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            setLastTopicResult(null);
            setCurrentResponse(`(That subject leads nowhere: ${reason})`);
            setIsThinking(false);
            return;
        }
        // Mark the topic discussed immediately so repeated clicks cannot race a
        // later persistence update from the parent reducer.
        const newSession: DialogueSession = {
            ...session,
            discussedTopicIds: [...session.discussedTopicIds, topic.id],
        };
        if (result.openMerchant) {
            setLastTopicResult(null);
            try {
                if (!onTopicOutcome) throw new Error('Trading is unavailable in this view.');
                onTopicOutcome(result, topic.id);
                onUpdateSession(newSession);
                endConversation();
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                setReplyError(`The shop could not be opened. ${reason}`);
                setIsThinking(false);
            }
            return; // Real stock is opened by the action, never an AI reply.
        }
        if (result.directReply) {
            try {
                if (!onTopicOutcome) throw new Error('Personal answers are unavailable in this view.');
                onTopicOutcome(result, topic.id);
                onUpdateSession(newSession);
                setCurrentResponse(result.directReply.text);
                setLastTopicResult(null);
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                setReplyError(reason);
            }
            setIsThinking(false);
            return; // This selected factual answer never needs a model or a retry.
        }
        setLastTopicResult(result);
        onUpdateSession(newSession);

        // The parent persists disposition, unlocks, costs, and other outcomes.
        // Keeping this optional preserves dialogue-only consumers and tests.
        if (onTopicOutcome) {
            onTopicOutcome(result, topic.id);
        }

        // Replace the pending state with the generated reply after every prior
        // mechanical side effect has been recorded.
        await requestReply(result.responsePrompt);
    };

    // A closed or incomplete session should not mount a modal shell or reserve
    // focus above the game world.
    if (!isOpen || !session) return null;

    const disposition = graphState.context.disposition ?? storedDisposition;

    // In graph mode the visible line is the authored node text (or the loader's
    // error, which is surfaced rather than swallowed so a broken content file
    // is obvious in play instead of showing an empty window).
    const isGraphMode = Boolean(activeGraph) || Boolean(dialogueGraphId);
    const graphResponse = graphError
        ? `(Dialogue unavailable: ${graphError})`
        : graphNode?.text ?? (activeGraph ? null : 'Loading...');

    return (
        <WindowFrame
            title={npc.name}
            onClose={endConversation}
            storageKey={WINDOW_KEYS.DIALOGUE}
            initialMaximized={false}
            headerActions={
                <span className="self-center whitespace-nowrap text-sm text-gray-400">
                    Disposition: {disposition}
                </span>
            }
        >
            {/* Production and Design Preview now share this complete visible
                body. Only this controller can execute game and AI effects. */}
            <DialogueConversationView
                npcDescription={!isGraphMode && gameState.gameTime instanceof Date && Number.isFinite(gameState.gameTime.getTime())
                    ? householdNpcDescription(npc as RichNPC,gameState.townSim,getGameDay(gameState.gameTime)) ?? npc.baseDescription
                    : npc.baseDescription}
                currentResponse={isGraphMode ? graphResponse : currentResponse}
                isThinking={isGraphMode ? false : isThinking}
                isPreparingLocalDialogue={!isGraphMode && isPreparingLocalDialogue}
                onCancelReply={!isGraphMode && isThinking && lastReplyRequest?.kind === 'speech' ? cancelPendingReply : undefined}
                topicResult={isGraphMode ? null : lastTopicResult}
                topics={isGraphMode ? graphChoiceTopics : availableTopics}
                onTopicSelect={
                    isGraphMode
                        ? handleGraphChoice
                        : (topic) => void handleTopicSelect(topic)
                }
                onInvite={onInvite && canOfferPartyInvitation(npc, gameState) ? () => onInvite(npc.id) : undefined}
                replyError={isGraphMode ? null : replyError}
                speechDraft={speechDraft}
                onSpeechDraftChange={setSpeechDraft}
                onSpeak={!isGraphMode ? () => {
                    const words=speechDraft.trim();
                    if (!words || words.length>1200 || replyRequest.current || !session) return;
                    setLastTopicResult(null);
                    // Same generation callback publishes the actual heard words
                    // with the sanitized player question into existing memory.
                    void requestReply(words,'speech');
                } : undefined}
                onRetryResponse={!isGraphMode && lastReplyRequest ? () => void requestReply(lastReplyRequest.prompt,lastReplyRequest.kind) : undefined}
                onEndConversation={endConversation}
            />
        </WindowFrame>
    );
};
