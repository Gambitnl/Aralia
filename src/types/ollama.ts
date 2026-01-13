/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/ollama.ts
 * Types and interfaces for the Ollama AI service integration.
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for Ollama service.
 * Can be customized per-user or for game balancing.
 */
export interface OllamaConfig {
    /** Base URL for the Ollama API proxy */
    apiBase: string;
    /** Default timeout for requests in milliseconds */
    timeoutMs: number;
    /** Number of retry attempts for failed requests */
    retryAttempts: number;
    /** Preferred model names in order of priority */
    preferredModels: string[];
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
    apiBase: '/api/ollama',
    timeoutMs: 90000,
    retryAttempts: 0,
    preferredModels: ['mistral:instruct', 'leeplenty/ellaria', 'phi4-mini:3.8b', 'llama3.1:instruct', 'llama3:instruct', 'gemma3:1b', 'gemma:2b', 'phi']
};

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Model information from Ollama tags endpoint.
 */
export interface OllamaModel {
    name: string;
}

/**
 * Response from Ollama generate endpoint.
 */
export interface OllamaGenerateResponse {
    response: string;
}

/**
 * Response from Ollama chat endpoint.
 */
export interface OllamaChatResponse {
    message?: {
        role: string;
        content: string;
    };
    done: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Typed error variants for Ollama operations.
 */
export type OllamaError =
    | { type: 'NETWORK_ERROR'; message: string }
    | { type: 'TIMEOUT'; message: string }
    | { type: 'PARSE_ERROR'; message: string; rawResponse: string }
    | { type: 'UNKNOWN'; message: string };

// ============================================================================
// Result Types
// ============================================================================

/**
 * Metadata about an Ollama request/response cycle.
 */
export interface OllamaMetadata {
    prompt: string;
    response?: string;
    model: string;
    id?: string;
}

/**
 * Result wrapper for Ollama operations with success/failure discrimination.
 */
export type OllamaResult<T> =
    | { success: true; data: T; metadata: OllamaMetadata }
    | { success: false; error: OllamaError; metadata?: OllamaMetadata };

// ============================================================================
// Context Types
// ============================================================================

/**
 * Contextual information for AI-generated content.
 */
export interface BanterContext {
    locationName: string;
    weather?: string;
    timeOfDay?: string;
    recentEvents?: string[];
    currentTask?: string;
    conversationHistory?: string[];
}

// ============================================================================
// Participant Types
// ============================================================================

/**
 * Basic participant info for conversations.
 */
export interface ConversationParticipant {
    id: string;
    name: string;
    personality: string;
}

/**
 * Full participant info for banter generation.
 */
export interface BanterParticipant {
    id: string;
    name: string;
    race: string;
    class: string;
    sex: string;
    age: number | string;
    physicalDescription: string;
    personality: string;
    memories?: string[];
}

/**
 * Companion info for reaction generation.
 */
export interface ReactionCompanion {
    id: string;
    name: string;
    race: string;
    class: string;
    sex: string;
    personality: string;
}

/**
 * Event that triggers a companion reaction.
 */
export interface ReactionEvent {
    type: string;
    description: string;
    tags: string[];
}

// ============================================================================
// Response Data Types
// ============================================================================

/**
 * A single line of banter dialogue.
 */
export interface BanterLineData {
    speakerId: string;
    text: string;
    emotion: string;
    isConcluding: boolean;
}

/**
 * Conversation continuation response.
 */
export interface ConversationResponse {
    speakerId: string;
    text: string;
    emotion?: string;
}

/**
 * Conversation summary for memory creation.
 */
export interface ConversationSummary {
    text: string;
    tags: string[];
    approvalChange: number;
}

/**
 * Companion reaction to an event.
 */
export interface ReactionResponse {
    text: string;
    approvalChange: number;
}
