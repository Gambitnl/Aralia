/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/conversation.ts
 * Conversation continuation and summarization functionality.
 */

import type {
    BanterContext,
    ConversationParticipant,
    ConversationResponse,
    ConversationSummary,
    OllamaResult,
    OllamaMetadata
} from '../../types/ollama';
import { OllamaClient, getDefaultClient } from './client';
import { parseJsonRobustly } from './jsonParser';

// ============================================================================
// Conversation Prompt Builders
// ============================================================================

function buildContinuePrompt(
    participants: ConversationParticipant[],
    history: { speakerId: string; text: string }[],
    contextData: BanterContext,
    respondingCompanion: ConversationParticipant
): string {
    const historyText = history.map(m => {
        const speakerName = m.speakerId === 'player'
            ? 'Player'
            : participants.find(p => p.id === m.speakerId)?.name || m.speakerId;
        return `${speakerName}: "${m.text}"`;
    }).join('\n');

    return `[Character Data]
Name: ${respondingCompanion.name}
Personality: ${respondingCompanion.personality}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}
${historyText}

[Task]
Respond to the last message as ${respondingCompanion.name}.

[Requirements]
    - 1 - 2 sentences max.
- Stay in character.

[Output Format]
Output ONLY JSON: { "text": "your response", "emotion": "neutral" }

JSON: `;
}

function buildSummarizePrompt(
    participants: ConversationParticipant[],
    history: { speakerId: string; text: string }[],
    contextData: BanterContext
): string {
    const historyText = history.map(m => {
        const speakerName = m.speakerId === 'player'
            ? 'Player'
            : participants.find(p => p.id === m.speakerId)?.name || m.speakerId;
        return `${speakerName}: "${m.text}"`;
    }).join('\n');

    const companionNames = participants.map(p => p.name).join(' and ');

    return `You are a memory analyst for a fantasy RPG.

The following conversation just occurred between the player and their companions (${companionNames}) at ${contextData.locationName}:

${historyText}

Analyze this conversation and provide:
1. A brief memory summary (1-2 sentences) capturing the key topic or emotion
2. Relevant tags
3. How the player's behavior affected their standing with the companions

Output ONLY valid JSON:
{
  "text": "summary of the conversation",
  "tags": ["tag1", "tag2"],
  "approvalChange": 0
}

approvalChange rules:
- Range: -3 to +3 (integer only)
- +1 to +3: Player was kind, respectful, helpful, funny, or showed genuine interest
- 0: Neutral, casual conversation
- -1 to -3: Player was rude, dismissive, insulting, or disrespectful
Tags: "personal", "quest", "humor", "conflict", "location", "past", "future", "bonding", "tension"`;
}

// ============================================================================
// Conversation Functions
// ============================================================================

/**
 * Continues an ongoing interactive conversation.
 * Returns a single response from the speaking companion.
 */
export async function continueConversation(
    participants: ConversationParticipant[],
    history: { speakerId: string; text: string }[],
    contextData: BanterContext,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<ConversationResponse>> {
    const model = await client.getModel();
    if (!model) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'No Ollama model available' });
    }

    // Determine who should respond
    const lastSpeaker = history[history.length - 1]?.speakerId;
    const respondingCompanion = lastSpeaker === 'player'
        ? participants[0]
        : participants.find(p => p.id !== lastSpeaker) || participants[0];

    const prompt = buildContinuePrompt(participants, history, contextData, respondingCompanion);

    const result = await client.generate({
        model,
        prompt,
        temperature: 0.7,
        numPredict: 256
    });

    if (!result.ok) {
        return client.createNetworkError(result.error, prompt, model);
    }

    const metadata: OllamaMetadata = { prompt, response: result.data.response, model };

    const parsed = parseJsonRobustly(result.data.response);
    if (!parsed || !parsed.text) {
        return client.createParseError(
            'Failed to parse conversation continuation',
            result.data.response,
            prompt,
            model
        );
    }

    return {
        success: true,
        data: {
            speakerId: respondingCompanion.id,
            text: parsed.text,
            emotion: parsed.emotion || 'neutral'
        },
        metadata
    };
}

/**
 * Called AFTER a conversation ends.
 * Summarizes the entire exchange into a memory for all participants.
 */
export async function summarizeConversation(
    participants: ConversationParticipant[],
    history: { speakerId: string; text: string }[],
    contextData: BanterContext,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<ConversationSummary>> {
    const model = await client.getModel();
    if (!model) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'No Ollama model available' });
    }

    const prompt = buildSummarizePrompt(participants, history, contextData);

    const result = await client.generate({
        model,
        prompt,
        format: 'json',
        temperature: 0.5,
        numPredict: 256
    });

    if (!result.ok) {
        return client.createNetworkError(result.error, prompt, model);
    }

    const metadata: OllamaMetadata = { prompt, response: result.data.response, model };

    let jsonStr = result.data.response;
    if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
    }

    try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed.text) {
            return client.createParseError(
                'Summary parsing failed',
                result.data.response,
                prompt,
                model
            );
        }

        // Clamp approvalChange to valid range
        const rawApproval = typeof parsed.approvalChange === 'number' ? parsed.approvalChange : 0;
        const approvalChange = Math.max(-3, Math.min(3, Math.round(rawApproval)));

        return {
            success: true,
            data: {
                text: parsed.text,
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                approvalChange
            },
            metadata
        };
    } catch {
        return client.createParseError(
            'Summary parsing failed',
            result.data.response,
            prompt,
            model
        );
    }
}
