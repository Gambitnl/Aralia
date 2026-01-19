/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/banter.ts
 * Banter generation functionality for companion dialogue.
 */

import type { BanterDefinition } from '../../types/companions';
import type {
    BanterContext,
    BanterParticipant,
    BanterLineData,
    OllamaResult,
    OllamaMetadata
} from '../../types/ollama';
import { OllamaClient, getDefaultClient } from './client';
import { parseJsonRobustly, extractTextField } from './jsonParser';

// ============================================================================
// Banter Prompt Builders
// ============================================================================

function buildBanterPrompt(
    participants: BanterParticipant[],
    contextData: BanterContext
): string {
    let contextDescription = `Walking through ${contextData.locationName}.`;
    if (contextData.weather) contextDescription += ` weather: ${contextData.weather}.`;
    if (contextData.timeOfDay) contextDescription += ` Time: ${contextData.timeOfDay}.`;
    if (contextData.currentTask) contextDescription += ` Current Goal: ${contextData.currentTask}.`;
    if (contextData.recentEvents && contextData.recentEvents.length > 0) {
        contextDescription += `\nRecent Events:\n- ${contextData.recentEvents.join('\n- ')}`;
    }

    let historySection = "";
    if (contextData.conversationHistory && contextData.conversationHistory.length > 0) {
        historySection = `\nPrevious Conversation (continue the topic/vibe, but don't just repeat):\n${contextData.conversationHistory.join('\n')}\n`;
    }

    return `You are a creative writer for a fantasy RPG.
Generate a short, witty banter dialogue between the following companions in the player's party:
${participants.map(p => `- ${p.name} (${p.sex} ${p.race} ${p.class}, Age: ${p.age}): ${p.physicalDescription}.\n  Personality: ${p.personality}`).join('\n')}

Context: ${contextDescription}
${historySection}

Requirements:
1. Output MUST be valid JSON only.
2. Structure: { 
    "lines": [{ "speakerId": "id", "text": "dialogue", "delay": 3000, "emotion": "neutral" }],
    "memory": { "text": "Short summary of this interaction", "tags": ["topic1", "topic2"] } 
   }
3. Length: 2-5 lines.
4. If there are 3+ participants, try to involve at least 3 of them if it makes sense, or focus on a subset. Use the exact Speaker IDs provided.
5. Make it sound natural and character-appropriate. Lean heavily into their specific races, ages, and backgrounds.
6. Allowed emotions: "happy", "sad", "angry", "surprised", "neutral"
7. The 'memory' field is optional but desirable for significant interactions.`;
}

const TOPIC_STARTERS = [
    'a recent fight or danger',
    'their personal history or backstory',
    'teasing another party member',
    'complaining about something',
    'a funny observation',
    'a past heist or adventure',
    'food or drink preferences',
    'questioning the party\'s current plan',
    'their views on magic or religion',
    'a rumor they heard in a tavern',
    'their opinion on a party member\'s habits',
    'something shiny they want to steal',
];

function buildBanterLinePrompt(
    participants: BanterParticipant[],
    conversationHistory: { speakerId: string; speakerName: string; text: string }[],
    contextData: BanterContext,
    turnNumber: number,
    nextSpeaker: BanterParticipant
): { role: string; content: string }[] {
    const lastLine = conversationHistory[conversationHistory.length - 1];
    const historyText = conversationHistory.length > 0
        ? `\nConversation so far:\n${conversationHistory.map(h => `${h.speakerName}: "${h.text}"`).join('\n')}\n`
        : '';

    let memorySection = '';
    if (nextSpeaker.memories && nextSpeaker.memories.length > 0) {
        memorySection = `\n[Relevant Memories]\n${nextSpeaker.memories.map(m => `- ${m}`).join('\n')}\n`;
    }

    const suggestedTopic = TOPIC_STARTERS[Math.floor(Math.random() * TOPIC_STARTERS.length)];

    const otherMembers = participants.filter(p => p.id !== nextSpeaker.id)
        .map(p => `${p.name} (${p.race} ${p.class})`).join(', ');

    // Build context about who just spoke
    const respondingTo = lastLine
        ? `\n[Responding To]\n${lastLine.speakerName} just said: "${lastLine.text}"\nYou must respond to this - do NOT repeat it.`
        : '';

    return [
        {
            role: 'system',
            content: `You are a creative writer for a fantasy RPG.
[Character Data]
Name: ${nextSpeaker.name}
ID: ${nextSpeaker.id}
Role: ${nextSpeaker.sex} ${nextSpeaker.race} ${nextSpeaker.class}
Personality: ${nextSpeaker.personality}
Travelers: ${otherMembers}${memorySection}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}
${historyText}${respondingTo}

[Task]
${conversationHistory.length === 0 ? `Start a new conversation about ${suggestedTopic}.` : `Continue the conversation. Respond to ${lastLine?.speakerName || 'the last speaker'}.`}

[CRITICAL REQUIREMENTS]
- You MUST use speakerId exactly: "${nextSpeaker.id}"
- Do NOT change or abbreviate the speakerId
- Do NOT repeat or paraphrase what the previous speaker said
- Stay in character. Use your traits and quirks.
- 1-2 sentences max.
- Be specific (places, people, items).
- NEVER mention weather or light.
- isConcluding: ${turnNumber >= 4 ? 'true' : 'false'}

[Output Format]
Return strict JSON only. No markdown code blocks. No intro/outro text.
{"speakerId": "${nextSpeaker.id}", "text": "Your unique response here", "emotion": "neutral", "isConcluding": false}`
        }
    ];
}

// ============================================================================
// Banter Generation Functions
// ============================================================================

/**
 * Generates a dynamic banter definition using the local LLM.
 */
export async function generateBanter(
    participants: BanterParticipant[],
    contextData: BanterContext,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<BanterDefinition>> {
    // Use leeplenty/ellaria specifically for banter (better at creative dialogue)
    const model = 'leeplenty/ellaria';
    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'Ollama service not available' });
    }

    const prompt = buildBanterPrompt(participants, contextData);

    const result = await client.generate({
        model,
        prompt,
        format: 'json',
        temperature: 0.8,
        numPredict: 512
    });

    if (!result.ok) {
        // Check if it's a timeout error (fetchWithTimeout includes elapsed time in the message).
        if (result.error.toLowerCase().includes('timed out')) {
            return client.createErrorResult(
                { type: 'TIMEOUT', message: result.error },
                { prompt, response: `[TIMEOUT ERROR] ${result.error}`, model }
            );
        }
        return client.createNetworkError(result.error, prompt, model);
    }

    const metadata: OllamaMetadata = { prompt, response: result.data.response, model };

    const parsed = parseJsonRobustly(result.data.response);
    if (!parsed || !parsed.lines || !Array.isArray(parsed.lines)) {
        return client.createParseError(
            'Failed to parse valid banter JSON',
            result.data.response,
            prompt,
            model
        );
    }

    return {
        success: true,
        data: {
            id: `ai_generated_${Date.now()}`,
            participants: participants.map(p => p.id),
            lines: parsed.lines,
            generatedMemory: parsed.memory
        },
        metadata
    };
}

/**
 * Generates a single banter line for turn-by-turn conversation.
 */
export async function generateBanterLine(
    participants: BanterParticipant[],
    conversationHistory: { speakerId: string; speakerName: string; text: string }[],
    contextData: BanterContext,
    turnNumber: number,
    onPending?: (id: string, prompt: string, model: string) => void,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<BanterLineData>> {
    // Use leeplenty/ellaria specifically for banter (better at creative dialogue)
    const model = 'leeplenty/ellaria';
    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'Ollama service not available' });
    }

    const interactionId = Math.random().toString(36).substring(2, 15);

    // Determine who should speak next
    const lastSpeaker = conversationHistory[conversationHistory.length - 1]?.speakerId;
    const availableSpeakers = participants.filter(p => p.id !== lastSpeaker);
    const nextSpeaker = availableSpeakers.length > 0
        ? availableSpeakers[Math.floor(Math.random() * availableSpeakers.length)]
        : participants[0];

    const messages = buildBanterLinePrompt(participants, conversationHistory, contextData, turnNumber, nextSpeaker);

    if (onPending) {
        onPending(interactionId, messages[0].content, model);
    }

    const result = await client.chat({
        model,
        messages,
        format: 'json',
        temperature: 0.7,
        numPredict: 2048
    });

    if (!result.ok) {
        return client.createNetworkError(result.error, messages[0].content, model, interactionId);
    }

    const responseContent = result.data.message?.content || '';
    const metadata: OllamaMetadata = { prompt: messages[0].content, response: responseContent, model, id: interactionId };

    const parsed = parseJsonRobustly(responseContent);
    if (!parsed) {
        console.warn('Ollama response parsing failed. Full data:', result.data);
        return {
            success: false,
            error: {
                type: 'PARSE_ERROR',
                message: 'JSON parsing failed',
                rawResponse: responseContent
            },
            metadata: {
                ...metadata,
                response: `[PARSE ERROR] Raw content: "${responseContent}"\n\nFull API Output: \n${JSON.stringify(result.data, null, 2)}`
            }
        };
    }

    const extracted = extractTextField(parsed, nextSpeaker.id);
    if (!extracted?.text) {
        return {
            success: false,
            error: { type: 'PARSE_ERROR', message: "Missing 'text' field", rawResponse: JSON.stringify(parsed) },
            metadata: {
                ...metadata,
                response: `[VALIDATION ERROR] Missing 'text' field in parsed JSON: \n${JSON.stringify(parsed, null, 2)} `
            }
        };
    }

    // Validate that the returned speakerId is a known participant
    const validParticipantIds = participants.map(p => p.id);
    const returnedSpeakerId = extracted.speakerId || nextSpeaker.id;
    const validatedSpeakerId = validParticipantIds.includes(returnedSpeakerId)
        ? returnedSpeakerId
        : nextSpeaker.id;

    return {
        success: true,
        data: {
            speakerId: validatedSpeakerId,
            text: extracted.text,
            emotion: extracted.emotion || 'neutral',
            isConcluding: extracted.isConcluding || turnNumber >= 5
        },
        metadata
    };
}
