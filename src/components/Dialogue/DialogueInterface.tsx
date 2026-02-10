import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DialogueSession, ConversationTopic } from '../../types/dialogue';
import { GameState, NPC, PlayerCharacter } from '../../types';
import { getAvailableTopics, processTopicSelection, ProcessTopicResult } from '../../services/dialogueService';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { UI_ID } from '../../styles/uiIds';

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
    onGenerateResponse
}) => {
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

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
            // TODO: Use real skill system accessor
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

    return (
        <div id={UI_ID.DIALOGUE_INTERFACE} data-testid={UI_ID.DIALOGUE_INTERFACE} className="fixed inset-0 z-[var(--z-index-modal-background)] flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
            <motion.div
                ref={modalRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-4xl h-[80vh] flex flex-col bg-stone-900 border border-stone-700 shadow-2xl rounded-lg overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 bg-stone-950 border-b border-stone-800 flex justify-between items-center">
                    <h2 className="text-xl font-serif text-amber-500">{npc.name}</h2>
                    <div className="text-stone-400 text-sm">
                        Disposition: {gameState.npcMemory[npc.id]?.disposition || 0}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: NPC View / Portrait (Placeholder) */}
                    <div className="w-1/3 bg-stone-925 border-r border-stone-800 p-6 flex flex-col items-center justify-start">
                        <div className="w-32 h-32 bg-stone-800 rounded-full mb-4 border-2 border-stone-600 flex items-center justify-center overflow-hidden">
                             {/* Placeholder for NPC Avatar */}
                             <span className="text-3xl">👤</span>
                        </div>
                        <p className="text-stone-400 text-center italic text-sm">{npc.baseDescription}</p>

                        {/* Status / Mood Indicators could go here */}
                    </div>

                    {/* Right: Dialogue Flow */}
                    <div className="w-2/3 flex flex-col bg-stone-900">
                        {/* NPC Response Area */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            <div className="bg-stone-800/50 p-6 rounded-lg border border-stone-700/50">
                                <p className="text-lg text-stone-200 leading-relaxed font-serif">
                                    {isThinking ? (
                                        <span className="animate-pulse text-stone-500">Thinking...</span>
                                    ) : (
                                        currentResponse
                                    )}
                                </p>
                            </div>

                            {/* Skill Check Result Feedback */}
                            {lastTopicResult && lastTopicResult.status !== 'neutral' && (
                                <div className={`mt-4 text-sm font-bold ${lastTopicResult.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                                    [{lastTopicResult.status.toUpperCase()}]
                                    {lastTopicResult.dispositionChange ? ` Disposition ${lastTopicResult.dispositionChange > 0 ? '+' : ''}${lastTopicResult.dispositionChange}` : ''}
                                </div>
                            )}
                        </div>

                        {/* Player Choices Area */}
                        <div className="p-4 bg-stone-950 border-t border-stone-800 max-h-64 overflow-y-auto">
                            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Topics</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {availableTopics.map(topic => (
                                    <button
                                        key={topic.id}
                                        onClick={() => handleTopicSelect(topic)}
                                        disabled={isThinking}
                                        className="w-full text-left p-3 rounded bg-stone-900 border border-stone-800 hover:bg-stone-800 hover:border-amber-700/50 transition-colors group flex items-center justify-between"
                                    >
                                        <span className="text-stone-300 group-hover:text-amber-100 font-medium">
                                            {topic.label}
                                        </span>
                                        {topic.skillCheck && (
                                            <span className="text-xs px-2 py-1 rounded bg-stone-800 text-stone-500 border border-stone-700">
                                                {typeof topic.skillCheck.skill === 'string'
                                                    ? topic.skillCheck.skill
                                                    : topic.skillCheck.skill.name}{' '}
                                                (DC {topic.skillCheck.dc})
                                            </span>
                                        )}
                                    </button>
                                ))}
                                <button
                                    onClick={onClose}
                                    className="w-full text-left p-3 rounded hover:bg-red-900/20 text-stone-500 hover:text-red-400 transition-colors mt-2 border border-transparent hover:border-red-900/30"
                                >
                                    End Conversation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
