/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/conversation.ts
 * Types for the interactive companion conversation system.
 */
/**
 * A single message in an ongoing conversation.
 */
export interface ConversationMessage {
    id: string;
    speakerId: string;
    text: string;
    emotion?: string;
    timestamp: number;
}
/**
 * State for an active, ongoing conversation with companions.
 */
export interface ActiveConversation {
    id: string;
    /** Companion IDs participating (does not include 'player') */
    participants: string[];
    /** Full message history */
    messages: ConversationMessage[];
    /** When the conversation started */
    startedAt: number;
    /** True if waiting for player input, false if waiting for AI */
    isPlayerTurn: boolean;
    /** True while waiting for Ollama response */
    pendingResponse: boolean;
}
