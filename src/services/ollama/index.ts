/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/index.ts
 * Unified facade for the Ollama service, providing backward-compatible API.
 */

// Re-export all types
export type {
    OllamaConfig,
    OllamaModel,
    OllamaGenerateResponse,
    OllamaChatResponse,
    OllamaError,
    OllamaMetadata,
    OllamaResult,
    BanterContext,
    ConversationParticipant,
    BanterParticipant,
    ReactionCompanion,
    ReactionEvent,
    BanterLineData,
    ConversationResponse,
    ConversationSummary,
    ReactionResponse
} from '../../types/ollama';

export { DEFAULT_OLLAMA_CONFIG } from '../../types/ollama';

// Re-export client
export { OllamaClient, getDefaultClient, resetDefaultClient } from './client';

// Re-export utilities
export { parseJsonRobustly, extractTextField } from './jsonParser';

// Import for facade
import type { BanterDefinition } from '../../types/companions';
import type {
    BanterContext,
    BanterParticipant,
    BanterLineData,
    ConversationParticipant,
    ConversationResponse,
    ConversationSummary,
    ReactionCompanion,
    ReactionEvent,
    ReactionResponse,
    OllamaResult
} from '../../types/ollama';
import { getDefaultClient } from './client';
import { generateBanter, generateBanterLine } from './banter';
import { continueConversation, summarizeConversation } from './conversation';
import { generateReaction } from './reaction';
import { extractDiscoveredFacts } from './facts';

// Re-export feature functions for direct use
export { extractDiscoveredFacts } from './facts';

/**
 * Unified OllamaService class for backward compatibility.
 * All methods delegate to the modular implementations.
 */
export class OllamaService {
    /**
     * Checks if the Ollama service is reachable.
     */
    static async isAvailable(): Promise<boolean> {
        return getDefaultClient().isAvailable();
    }

    /**
     * Finds a suitable model, preferring faster/smaller ones for banter.
     */
    static async getModel(): Promise<string | null> {
        return getDefaultClient().getModel();
    }

    /**
     * Generates a dynamic banter definition using the local LLM.
     */
    static async generateBanter(
        participants: BanterParticipant[],
        contextData: BanterContext
    ): Promise<OllamaResult<BanterDefinition>> {
        return generateBanter(participants, contextData);
    }

    /**
     * Generates a single banter line for turn-by-turn conversation.
     */
    static async generateBanterLine(
        participants: BanterParticipant[],
        conversationHistory: { speakerId: string; speakerName: string; text: string }[],
        contextData: BanterContext,
        turnNumber: number,
        onPending?: (id: string, prompt: string, model: string) => void
    ): Promise<OllamaResult<BanterLineData>> {
        return generateBanterLine(participants, conversationHistory, contextData, turnNumber, onPending);
    }

    /**
     * Continues an ongoing interactive conversation.
     */
    static async continueConversation(
        participants: ConversationParticipant[],
        history: { speakerId: string; text: string }[],
        contextData: BanterContext
    ): Promise<OllamaResult<ConversationResponse>> {
        return continueConversation(participants, history, contextData);
    }

    /**
     * Summarizes a conversation into a memory.
     */
    static async summarizeConversation(
        participants: ConversationParticipant[],
        history: { speakerId: string; text: string }[],
        contextData: BanterContext
    ): Promise<OllamaResult<ConversationSummary>> {
        return summarizeConversation(participants, history, contextData);
    }

    /**
     * Generates a reaction to an event.
     */
    static async generateReaction(
        companion: ReactionCompanion,
        event: ReactionEvent,
        contextData: BanterContext
    ): Promise<OllamaResult<ReactionResponse>> {
        return generateReaction(companion, event, contextData);
    }
}
