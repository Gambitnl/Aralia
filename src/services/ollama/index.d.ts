/**
 * ARCHITECTURAL CONTEXT:
 * This file serves as the 'Unified Facade' for all Ollama-based AI services.
 * It provides a stable, backward-compatible class-based API (OllamaService)
 * while internally delegating to modular functional implementations
 * (banter, conversation, reaction, etc.).
 *
 * Recent updates expose the 'Player-Directed' and 'Escalation' endpoints,
 * bridging the new character-to-player engagement logic into the
 * global service layer.
 *
 * @file src/services/ollama/index.ts
 */
export type { OllamaConfig, OllamaModel, OllamaGenerateResponse, OllamaChatResponse, OllamaError, OllamaMetadata, OllamaResult, BanterContext, ConversationParticipant, BanterParticipant, ReactionCompanion, ReactionEvent, BanterLineData, ConversationResponse, ConversationSummary, ReactionResponse, ModelParams, ResponseFormat, TaskType, TaskProfile } from '../../types/ollama';
export { DEFAULT_OLLAMA_CONFIG } from '../../types/ollama';
export { OllamaClient, getDefaultClient, resetDefaultClient } from './client';
export { resolveModelForTask, resetRouterCache } from './router';
export { DEFAULT_TASK_PROFILES, getTaskProfile } from './taskProfiles';
export { parseJsonRobustly, extractTextField } from './jsonParser';
import type { BanterDefinition } from '../../types/companions';
import type { BanterContext, BanterParticipant, BanterLineData, ConversationParticipant, ConversationResponse, ConversationSummary, ReactionCompanion, ReactionEvent, ReactionResponse, OllamaResult } from '../../types/ollama';
export { extractDiscoveredFacts } from './facts';
/**
 * Unified OllamaService class for backward compatibility.
 * All methods delegate to the modular implementations.
 */
export declare class OllamaService {
    /**
     * Checks if the Ollama service is reachable.
     */
    static isAvailable(): Promise<boolean>;
    /**
     * Finds a suitable model, preferring faster/smaller ones for banter.
     */
    static getModel(): Promise<string | null>;
    /**
     * Generates a dynamic banter definition using the local LLM.
     */
    static generateBanter(participants: BanterParticipant[], contextData: BanterContext): Promise<OllamaResult<BanterDefinition>>;
    /**
     * Generates a single banter line for turn-by-turn conversation.
     */
    static generateBanterLine(participants: BanterParticipant[], conversationHistory: {
        speakerId: string;
        speakerName: string;
        text: string;
    }[], contextData: BanterContext, turnNumber: number, onPending?: (id: string, prompt: string, model: string) => void): Promise<OllamaResult<BanterLineData>>;
    /**
     * Generates a single banter line where the NPC addresses the player directly.
     * WHAT CHANGED: Added new static method generatePlayerDirectedLine.
     * WHY IT CHANGED: Part of the 'Player-Directed Banter' expansion. This
     * allows the UI/hooks to trigger specialized prompts where NPCs
     * acknowledge the player's presence, gear, and class.
     */
    static generatePlayerDirectedLine(npc: BanterParticipant, context: BanterContext, conversationHistory: {
        speakerId: string;
        speakerName: string;
        text: string;
    }[], turnNumber: number, onPending?: (id: string, prompt: string, model: string) => void): Promise<OllamaResult<BanterLineData>>;
    /**
     * Generates an escalation/follow-up line when the player has not responded.
     * WHAT CHANGED: Added new static method generateEscalationLine.
     * WHY IT CHANGED: To support the 'Nudge/Timeout' mechanic in the banter
     * panel. If a player is idle, NPCs can now 'react to the silence'
     * based on their personality profile.
     */
    static generateEscalationLine(npc: BanterParticipant, context: BanterContext, conversationHistory: {
        speakerId: string;
        speakerName: string;
        text: string;
    }[], ignoreCount: number, onPending?: (id: string, prompt: string, model: string) => void): Promise<OllamaResult<BanterLineData>>;
    /**
     * Continues an ongoing interactive conversation.
     */
    static continueConversation(participants: ConversationParticipant[], history: {
        speakerId: string;
        text: string;
    }[], contextData: BanterContext): Promise<OllamaResult<ConversationResponse>>;
    /**
     * Summarizes a conversation into a memory.
     */
    static summarizeConversation(participants: ConversationParticipant[], history: {
        speakerId: string;
        text: string;
    }[], contextData: BanterContext): Promise<OllamaResult<ConversationSummary>>;
    /**
     * Generates a reaction to an event.
     */
    static generateReaction(companion: ReactionCompanion, event: ReactionEvent, contextData: BanterContext): Promise<OllamaResult<ReactionResponse>>;
}
