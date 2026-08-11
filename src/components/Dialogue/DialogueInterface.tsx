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

import React, { useMemo, useState } from 'react';
import type { DialogueSession, ConversationTopic } from '../../types/dialogue';
import type { GameState, NPC, PlayerCharacter } from '../../types';
import {
    getAvailableTopics,
    processTopicSelection,
    type ProcessTopicResult,
} from '../../services/dialogueService';
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
}) => {
    // Seed the visible reply from the most recent game response. Fresh sessions
    // still receive a readable greeting before an AI reply has been generated.
    const [currentResponse, setCurrentResponse] = useState<string | null>(
        gameState.lastNpcResponse || `"${npc.name} greets you."`,
    );
    const [isThinking, setIsThinking] = useState(false);
    const [lastTopicResult, setLastTopicResult] = useState<ProcessTopicResult | null>(null);

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
        const result = processTopicSelection(topic.id, gameState, session, skillMod, npc);
        setLastTopicResult(result);

        // Mark the topic discussed immediately so repeated clicks cannot race a
        // later persistence update from the parent reducer.
        const newSession: DialogueSession = {
            ...session,
            discussedTopicIds: [...session.discussedTopicIds, topic.id],
            availableTopicIds: session.availableTopicIds,
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

    const disposition = gameState.npcMemory[npc.id]?.disposition || 0;

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
                currentResponse={currentResponse}
                isThinking={isThinking}
                topicResult={lastTopicResult}
                topics={availableTopics}
                onTopicSelect={(topic) => void handleTopicSelect(topic)}
                onInvite={onInvite ? () => onInvite(npc.id) : undefined}
                onEndConversation={onClose}
            />
        </WindowFrame>
    );
};
