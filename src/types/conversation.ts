/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/conversation.ts
 * Types for the interactive companion conversation system.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 12:51:04
 * Dependents: hooks/actions/handleNpcInteraction.ts, hooks/useConversation.ts, hooks/useOpeningSituation.ts, state/reducers/conversationReducer.ts, types/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * A single message in an ongoing conversation.
 */
export interface ConversationMessage {
    id: string;
    speakerId: string; // 'player' or companion ID
    text: string;
    emotion?: string;
    timestamp: number;
    /** Fixed story choices already recorded their outcome in companion memory.
     * Exclude them from model summarization and a second approval award. */
    memoryHandled?: boolean;
}

/**
 * A non-companion participant in a conversation (e.g. a situational stranger NPC
 * generated for the opening situation). Carries just enough to address it and
 * voice it through the Ollama conversation path, since it is not in
 * `gameState.companions`.
 */
export interface ConversationNpcParticipant {
    id: string;
    name: string;
    /** Personality / disposition + goal string passed to the model. */
    personality: string;
}

/**
 * State for an active, ongoing conversation with companions.
 */
export interface ActiveConversation {
    id: string;
    /** Participant IDs (does not include 'player'). Usually companion IDs, but may
     * include situational NPC IDs resolved via {@link npcParticipants}. */
    participants: string[];
    /** Full message history */
    messages: ConversationMessage[];
    /** When the conversation started */
    startedAt: number;
    /** True if waiting for player input, false if waiting for AI */
    isPlayerTurn: boolean;
    /** True while waiting for Ollama response */
    pendingResponse: boolean;
    /**
     * What kind of conversation this is. Defaults to companion when omitted so
     * existing companion conversations are unchanged. 'situation' marks the
     * opening-situation drop-in.
     */
    kind?: 'companion' | 'situation';
    /**
     * Non-companion participants (situational NPCs). Resolved by the UI and the
     * conversation hook when a participant id is not found in `companions`.
     * Additive — absent for ordinary companion conversations.
     */
    npcParticipants?: ConversationNpcParticipant[];
}
