/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/conversation.ts
 * Conversation continuation and summarization functionality.
 */
import type { BanterContext, ConversationParticipant, ConversationResponse, ConversationSummary, OllamaResult } from '../../types/ollama';
import { OllamaClient } from './client';
export declare function buildContinuePrompt(participants: ConversationParticipant[], history: {
    speakerId: string;
    text: string;
}[], contextData: BanterContext, respondingCompanion: ConversationParticipant): string;
/**
 * Continues an ongoing interactive conversation.
 * Returns a single response from the speaking companion.
 */
export declare function continueConversation(participants: ConversationParticipant[], history: {
    speakerId: string;
    text: string;
}[], contextData: BanterContext, client?: OllamaClient): Promise<OllamaResult<ConversationResponse>>;
/**
 * Called AFTER a conversation ends.
 * Summarizes the entire exchange into a memory for all participants.
 */
export declare function summarizeConversation(participants: ConversationParticipant[], history: {
    speakerId: string;
    text: string;
}[], contextData: BanterContext, client?: OllamaClient): Promise<OllamaResult<ConversationSummary>>;
