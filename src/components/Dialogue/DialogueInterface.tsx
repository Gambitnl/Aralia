// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/08/2026, 13:30:38
 * Dependents: components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DialogueSession, ConversationTopic } from '../../types/dialogue';
import type { GameState, NPC, PlayerCharacter } from '../../types';
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
    onGenerateResponse: (prompt: string) => Promise<string>;
    /**
     * Invokes the "Invite to party" flow for this NPC. The downstream consent
     * gate explains ineligible cases instead of hiding the action in advance.
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
    // Seed the visible reply from the most recent game response. Fresh sessions
    // still receive a readable greeting before an AI reply has been generated.
    const [currentResponse, setCurrentResponse] = useState<string | null>(
        gameState.lastNpcResponse || `"${npc.name} greets you."`,
    );
    const [isThinking, setIsThinking] = useState(false);
    const [lastTopicResult, setLastTopicResult] = useState<ProcessTopicResult | null>(null);

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
        if (!session) return;

        setIsThinking(true);

        // Skill topics use the player's final ability score and add proficiency
        // only when the character is trained in the governing skill.
        let skillMod = 0;
        if (topic.skillCheck) {
            const checkSkill = topic.skillCheck.skill;
            const abilityScore =
                playerCharacter.finalAbilityScores?.[checkSkill.ability]
                ?? playerCharacter.abilityScores?.[checkSkill.ability]
                ?? 10;
            const isProficient = playerCharacter.skills?.some(
                (skill) => skill.id === checkSkill.id || skill.name === checkSkill.name,
            ) ?? false;

            skillMod = Math.floor((abilityScore - 10) / 2)
                + (isProficient ? (playerCharacter.proficiencyBonus || 2) : 0);
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
            result = processTopicSelection(topic.id, gameState, session, skillMod, npc);
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            setLastTopicResult(null);
            setCurrentResponse(`(That subject leads nowhere: ${reason})`);
            setIsThinking(false);
            return;
        }
        setLastTopicResult(result);

        // Mark the topic discussed immediately so repeated clicks cannot race a
        // later persistence update from the parent reducer.
        const newSession: DialogueSession = {
            ...session,
            discussedTopicIds: [...session.discussedTopicIds, topic.id],
        };
        onUpdateSession(newSession);

        // The parent persists disposition, unlocks, costs, and other outcomes.
        // Keeping this optional preserves dialogue-only consumers and tests.
        if (onTopicOutcome) {
            onTopicOutcome(result, topic.id);
        }

        // Replace the pending state with the generated reply after every prior
        // mechanical side effect has been recorded.
        const response = await onGenerateResponse(result.responsePrompt);
        setCurrentResponse(response);
        setIsThinking(false);
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
            onClose={onClose}
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
                npcDescription={npc.baseDescription}
                currentResponse={isGraphMode ? graphResponse : currentResponse}
                isThinking={isGraphMode ? false : isThinking}
                topicResult={isGraphMode ? null : lastTopicResult}
                topics={isGraphMode ? graphChoiceTopics : availableTopics}
                onTopicSelect={
                    isGraphMode
                        ? handleGraphChoice
                        : (topic) => void handleTopicSelect(topic)
                }
                onInvite={onInvite ? () => onInvite(npc.id) : undefined}
                onEndConversation={onClose}
            />
        </WindowFrame>
    );
};
