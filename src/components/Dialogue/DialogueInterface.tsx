import React, { useMemo, useState } from 'react';
import { DialogueSession, ConversationTopic } from '../../types/dialogue';
import { GameState, NPC, PlayerCharacter } from '../../types';
import { getAvailableTopics, processTopicSelection, ProcessTopicResult } from '../../services/dialogueService';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

/**
 * This file renders the conversation window players use when talking to an NPC.
 *
 * The game opens it from GameModals after START_DIALOGUE_SESSION creates an
 * active dialogue session. It reads available topics from dialogueService,
 * sends selected topics back through reducer callbacks, and uses WindowFrame
 * for the draggable/resizable outer window.
 */

// ============================================================================
// Component Contract
// ============================================================================
// The parent owns the active session and reducer callbacks. This component owns
// the immediate conversation layout, pending-response state, and topic buttons
// that the player sees inside the shared WindowFrame shell.
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
     * Invokes the "Invite to party" flow for this NPC. Always rendered as a
     * button when provided; the consent gate (downstream) declines ineligible
     * NPCs with a reason rather than the button being hidden.
     */
    onInvite?: (npcId: string) => void;
}

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
    onInvite
}) => {
    const [currentResponse, setCurrentResponse] = useState<string | null>(gameState.lastNpcResponse || `"${npc.name} greets you."`);
    const [isThinking, setIsThinking] = useState(false);
    const [lastTopicResult, setLastTopicResult] = useState<ProcessTopicResult | null>(null);

    // Calculate available topics dynamically
    const availableTopics = useMemo(() => {
        if (!session) return [];
        return getAvailableTopics(gameState, npc.id, session, npc);
    }, [gameState, npc, session]);

    const handleTopicSelect = async (topic: ConversationTopic) => {
        if (!session) return;

        setIsThinking(true);

        // 1. Process Logic (Skill checks, unlocks)
        // Helper to find skill modifier
        let skillMod = 0;
        if (topic.skillCheck) {
            // Simplified: Use raw ability score or proficiency logic if available
            // For now, assuming raw score modifier: (Score - 10) / 2
            // TODO #79: Use real skill system accessor
            const charismaScore =
                playerCharacter.abilityScores?.Charisma ??
                playerCharacter.finalAbilityScores?.Charisma ??
                10;
            skillMod = Math.floor((charismaScore - 10) / 2);
        }

        const result = processTopicSelection(topic.id, gameState, session, skillMod, npc);
        setLastTopicResult(result);

        // 2. Update Session (add to discussed)
        const newSession = {
            ...session,
            discussedTopicIds: [...session.discussedTopicIds, topic.id],
            availableTopicIds: session.availableTopicIds // This usually comes from re-running getAvailableTopics
        };
        // We defer session update slightly because onTopicOutcome might dispatch the persistence action which updates both.
        // However, standard flow suggests UI updates optimistically or waits.
        // For now, we call onUpdateSession to keep local state in sync if the parent relies on it immediately.
        onUpdateSession(newSession);

        // 3. Update Global State (Disposition, Unlocks) via callback
        if (onTopicOutcome) {
            onTopicOutcome(result, topic.id);
        }

        // 4. Generate AI Response
        const response = await onGenerateResponse(result.responsePrompt);
        setCurrentResponse(response);
        setIsThinking(false);
    };

    if (!isOpen || !session) return null;

    const disposition = gameState.npcMemory[npc.id]?.disposition || 0;

    return (
        <WindowFrame
            title={npc.name}
            onClose={onClose}
            storageKey={WINDOW_KEYS.DIALOGUE}
            initialMaximized={false}
            headerActions={
                <span className="self-center text-gray-400 text-sm whitespace-nowrap">Disposition: {disposition}</span>
            }
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                {/* NPC identity: on wide windows this sits beside the dialogue.
                    On cramped windows it becomes a compact top band so the
                    response and choices keep enough horizontal room to read. */}
                <div className="flex max-h-[24%] shrink-0 flex-row items-center gap-3 overflow-y-auto border-b border-gray-700 bg-gray-900/40 p-3 md:max-h-none md:w-1/3 md:flex-col md:gap-0 md:border-b-0 md:border-r md:p-6">
                    <div className="mb-0 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gray-600 bg-gray-800 md:mb-4 md:h-32 md:w-32">
                        <span className="text-3xl">👤</span>
                    </div>
                    <p className="min-w-0 text-left text-xs italic text-gray-400 md:text-center md:text-sm">{npc.baseDescription}</p>
                </div>

                {/* Conversation body: the response, topics, and footer each get
                    their own space so long text and long topic lists scroll
                    without hiding the conversation exit. */}
                <div className="flex min-h-0 flex-1 flex-col md:w-2/3">
                    {/* NPC response — capped so a one-line greeting never dwarfs the choices. */}
                    <div className="max-h-[30%] shrink-0 overflow-y-auto p-3 md:max-h-[40%] md:p-6">
                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 md:p-6">
                            <p className="text-base leading-relaxed text-gray-200 md:text-lg">
                                {isThinking ? (
                                    <span className="animate-pulse text-gray-500">Thinking...</span>
                                ) : (
                                    currentResponse
                                )}
                            </p>
                        </div>

                        {/* Skill Check Result Feedback */}
                        {lastTopicResult && lastTopicResult.status !== 'neutral' && (
                            <div className={`mt-4 text-sm font-bold ${lastTopicResult.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                [{lastTopicResult.status.toUpperCase()}]
                                {lastTopicResult.dispositionChange ? ` Disposition ${lastTopicResult.dispositionChange > 0 ? '+' : ''}${lastTopicResult.dispositionChange}` : ''}
                            </div>
                        )}
                    </div>

                    {/* Topics — fill the remaining height, scroll only when truly long. */}
                    <div className="flex-1 min-h-0 overflow-y-auto border-t border-gray-700 bg-gray-900/50 p-3 md:p-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Topics</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {availableTopics.map(topic => (
                                <button
                                    key={topic.id}
                                    onClick={() => handleTopicSelect(topic)}
                                    disabled={isThinking}
                                    className="w-full rounded border border-gray-700 bg-gray-800 p-2.5 text-left transition-colors hover:border-amber-700/50 hover:bg-gray-700 disabled:opacity-50 group flex items-center justify-between md:p-3"
                                >
                                    <span className="text-gray-300 group-hover:text-amber-100 font-medium">
                                        {topic.label}
                                    </span>
                                    {topic.skillCheck && (
                                        <span className="text-xs px-2 py-1 rounded bg-gray-900 text-gray-500 border border-gray-700">
                                            {typeof topic.skillCheck.skill === 'string'
                                                ? topic.skillCheck.skill
                                                : topic.skillCheck.skill.name}{' '}
                                            (DC {topic.skillCheck.dc})
                                        </span>
                                    )}
                                </button>
                            ))}
                            {onInvite && (
                                <button
                                    type="button"
                                    data-testid="dialogue-invite-to-party"
                                    onClick={() => onInvite(npc.id)}
                                    disabled={isThinking}
                                    className="w-full rounded border border-amber-800/40 bg-gray-800 p-2.5 text-left transition-colors hover:border-amber-600/60 hover:bg-amber-900/20 disabled:opacity-50 group flex items-center justify-between md:p-3"
                                >
                                    <span className="text-amber-200 group-hover:text-amber-100 font-medium">
                                        Invite to party
                                    </span>
                                    <span className="text-lg" aria-hidden="true">🤝</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* This footer stays outside the scrolling topic list so
                        the player always has a visible way to leave dialogue,
                        even when the topic list is long or the window is
                        resized very small. */}
                    <div className="shrink-0 border-t border-gray-700 bg-gray-950/70 p-3">
                        <button
                            type="button"
                            data-testid="dialogue-end-conversation"
                            onClick={onClose}
                            className="w-full rounded border border-transparent p-3 text-left text-gray-400 transition-colors hover:border-red-900/30 hover:bg-red-900/20 hover:text-red-400"
                        >
                            End Conversation
                        </button>
                    </div>
                </div>
            </div>
        </WindowFrame>
    );
};
