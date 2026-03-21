/**
 * ARCHITECTURAL CONTEXT:
 * This service handles 'Banter Logic' via the local Ollama LLM. It focuses 
 * on generating character-driven dialogue that responds to the environment, 
 * recent events, and participants' specific personas.
 *
 * Recent updates introduce 'Player-Directed' and 'Escalation' modes. 
 * Instead of just NPCs talking to each other, companions can now address 
 * the player directly. The prompts have been refined to include the 
 * player's equipment and class, allowing NPCs to comment on the player's 
 * actual gear (e.g., 'Nice sword, where'd you find it?'). 
 *
 * It also includes 'Escalation' logic: if a player ignores a companion 
 * for too long, the companion's next line is shaped by their 
 * extraversion/neuroticism (e.g., pushing back vs. being resigned).
 * 
 * @file src/services/ollama/banter.ts
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
// Player-Directed Prompt Builders
// ============================================================================

function buildPlayerDirectedLinePrompt(
    npc: BanterParticipant,
    playerName: string,
    conversationHistory: { speakerId: string; speakerName: string; text: string }[],
    contextData: BanterContext,
    turnNumber: number
): { role: string; content: string }[] {
    const historyText = conversationHistory.length > 0
        ? `\nConversation so far:\n${conversationHistory.map(h => `${h.speakerName}: "${h.text}"`).join('\n')}\n`
        : '';

    let memorySection = '';
    if (npc.memories && npc.memories.length > 0) {
        memorySection = `\n[Relevant Memories]\n${npc.memories.map(m => `- ${m}`).join('\n')}\n`;
    }

    const extraversionLabel = (contextData.npcExtraversion ?? 50) >= 70
        ? 'outgoing and bold'
        : (contextData.npcExtraversion ?? 50) <= 30
            ? 'reserved and tentative'
            : 'moderately sociable';

    // Build a player equipment section so the NPC can reference real gear
    let playerGearSection = '';
    if (contextData.playerEquippedItems && contextData.playerEquippedItems.length > 0) {
        const gearList = contextData.playerEquippedItems
            .map(item => item.category ? `${item.name} (${item.slot}, ${item.category})` : `${item.name} (${item.slot})`)
            .join(', ');
        playerGearSection = `\n[Player's Equipped Gear]\n${gearList}\n`;
    } else {
        playerGearSection = `\n[Player's Equipped Gear]\nNothing notable visible.\n`;
    }

    const playerDescLine = [
        contextData.playerClass ? `${playerName} is a ${contextData.playerClass}` : null,
        contextData.playerLevel ? `level ${contextData.playerLevel}` : null,
    ].filter(Boolean).join(' ');

    // WHAT CHANGED: Added playerGearSection and extraversionLabel to the prompt.
    // WHY IT CHANGED: To make the companion feel 'present'. By injecting 
    // the player's visible gear into the prompt, the LLM can generate 
    // contextual observations that ground the banter in the current state 
    // of the game world. Extraversion ensures the 'social bold' vs 
    // 'tentative' approach matches their personality stats.

    return [
        {
            role: 'system',
            content: `You are a creative writer for a fantasy RPG.
[Character Data]
Name: ${npc.name}
ID: ${npc.id}
Role: ${npc.sex} ${npc.race} ${npc.class}
Personality: ${npc.personality} (Social style: ${extraversionLabel})${memorySection}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}
${playerDescLine ? `${playerDescLine}.\n` : ''}${playerGearSection}${historyText}

[Task]
${conversationHistory.length === 0
    ? `Address the player character ${playerName} directly. Start a conversation — ask them a question, share a personal observation, or invite them into a topic. Your social style is ${extraversionLabel}; let that shape how boldly or tentatively you approach them. You may optionally reference something from their visible gear listed above, but only if it fits naturally — do NOT force a mention of every item.`
    : `Continue the conversation with ${playerName}. Respond to what they or others just said.`
}

[CRITICAL REQUIREMENTS]
- You MUST use speakerId exactly: "${npc.id}"
- Address ${playerName} directly — by name or "you"
- Do NOT repeat or paraphrase previous lines
- Stay in character. Use your personality traits.
- 1-2 sentences max.
- Only reference gear the player is actually wearing (listed above). Never invent items they don't have.
- isConcluding: ${turnNumber >= 4 ? 'true' : 'false'}

[Output Format]
Return strict JSON only. No markdown. No intro/outro text.
{"speakerId": "${npc.id}", "text": "Your directed line here", "emotion": "neutral", "isConcluding": false}`
        }
    ];
}

function buildEscalationLinePrompt(
    npc: BanterParticipant,
    playerName: string,
    conversationHistory: { speakerId: string; speakerName: string; text: string }[],
    contextData: BanterContext,
    ignoreCount: number
): { role: string; content: string }[] {
    const extraversion = contextData.npcExtraversion ?? 50;
    const neuroticism = contextData.npcNeuroticism ?? 50;
    const historyText = conversationHistory.length > 0
        ? `\nConversation so far:\n${conversationHistory.map(h => `${h.speakerName}: "${h.text}"`).join('\n')}\n`
        : '';

    // Determine escalation tone from personality
    let escalationGuidance: string;
    // WHAT CHANGED: Added personality-driven escalation guidance.
    // WHY IT CHANGED: If a player is busy and ignores an NPC, we want the 
    // NPC's reaction to feel authentic. High-neuroticism NPCs might get 
    // annoyed/insistent, while reserved ones might just trail off. 
    // This connects 'Big Five' personality traits directly to dialogue tone.
    if (extraversion >= 70 && neuroticism >= 70) {
        escalationGuidance = `You're an outgoing and emotionally sensitive person. ${playerName} hasn't responded to you. You notice the silence and push back — with frustration, hurt, or insistence. Don't let it slide.`;
    } else if (extraversion >= 70 && neuroticism < 50) {
        escalationGuidance = `You're an outgoing but emotionally resilient person. ${playerName} hasn't responded. Try again with a light-touch follow-up — casual, not wounded, maybe a little wry.`;
    } else if (extraversion < 40) {
        escalationGuidance = `You're a reserved person. ${playerName} hasn't responded. Offer one quiet, low-stakes follow-up — then be ready to let it go. "...never mind." is a valid ending.`;
    } else {
        escalationGuidance = `${playerName} hasn't responded to you. Follow up once more with a prompt that fits your personality — whether that's persistent, curious, wry, or resigned.`;
    }

    const isConcluding = ignoreCount >= 2;

    return [
        {
            role: 'system',
            content: `You are a creative writer for a fantasy RPG.
[Character Data]
Name: ${npc.name}
ID: ${npc.id}
Role: ${npc.sex} ${npc.race} ${npc.class}
Personality: ${npc.personality}

[Context]
Location: ${contextData.locationName}
Time: ${contextData.timeOfDay}
${historyText}

[Situation]
${escalationGuidance}
${isConcluding ? `This is your final attempt. End the conversation naturally after this line.` : ''}

[CRITICAL REQUIREMENTS]
- You MUST use speakerId exactly: "${npc.id}"
- 1-2 sentences max
- Stay in character
- isConcluding: ${isConcluding ? 'true' : 'false'}

[Output Format]
Return strict JSON only. No markdown. No intro/outro text.
{"speakerId": "${npc.id}", "text": "Your follow-up line here", "emotion": "neutral", "isConcluding": ${isConcluding}}`
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

/**
 * Generates a single banter line where the NPC speaks directly to the player.
 * Used for PLAYER_DIRECTED banter mode (1 NPC or 2+ NPCs addressing the player).
 */
export async function generatePlayerDirectedLine(
    npc: BanterParticipant,
    context: BanterContext,
    conversationHistory: { speakerId: string; speakerName: string; text: string }[],
    turnNumber: number,
    onPending?: (id: string, prompt: string, model: string) => void,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<BanterLineData>> {
    const model = 'leeplenty/ellaria';
    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'Ollama service not available' });
    }

    const interactionId = Math.random().toString(36).substring(2, 15);
    const playerName = context.playerName || 'the player';
    const messages = buildPlayerDirectedLinePrompt(npc, playerName, conversationHistory, context, turnNumber);

    if (onPending) {
        onPending(interactionId, messages[0].content, model);
    }

    const result = await client.chat({ model, messages, format: 'json', temperature: 0.75, numPredict: 2048 });

    if (!result.ok) {
        return client.createNetworkError(result.error, messages[0].content, model, interactionId);
    }

    const responseContent = result.data.message?.content || '';
    const metadata: OllamaMetadata = { prompt: messages[0].content, response: responseContent, model, id: interactionId };

    const parsed = parseJsonRobustly(responseContent);
    if (!parsed) {
        return {
            success: false,
            error: { type: 'PARSE_ERROR', message: 'JSON parsing failed', rawResponse: responseContent },
            metadata: { ...metadata, response: `[PARSE ERROR] Raw: "${responseContent}"` }
        };
    }

    const extracted = extractTextField(parsed, npc.id);
    if (!extracted?.text) {
        return {
            success: false,
            error: { type: 'PARSE_ERROR', message: "Missing 'text' field", rawResponse: JSON.stringify(parsed) },
            metadata: { ...metadata, response: `[VALIDATION ERROR] Missing 'text': ${JSON.stringify(parsed)}` }
        };
    }

    return {
        success: true,
        data: {
            speakerId: extracted.speakerId || npc.id,
            text: extracted.text,
            emotion: extracted.emotion || 'neutral',
            isConcluding: extracted.isConcluding || turnNumber >= 5
        },
        metadata
    };
}

/**
 * Generates an escalation/follow-up line from an NPC when the player hasn't responded.
 * Tone is driven by the NPC's extraversion and neuroticism personality values.
 */
export async function generateEscalationLine(
    npc: BanterParticipant,
    context: BanterContext,
    conversationHistory: { speakerId: string; speakerName: string; text: string }[],
    ignoreCount: number,
    onPending?: (id: string, prompt: string, model: string) => void,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<BanterLineData>> {
    const model = 'leeplenty/ellaria';
    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'Ollama service not available' });
    }

    const interactionId = Math.random().toString(36).substring(2, 15);
    const playerName = context.playerName || 'the player';
    const messages = buildEscalationLinePrompt(npc, playerName, conversationHistory, context, ignoreCount);

    if (onPending) {
        onPending(interactionId, messages[0].content, model);
    }

    const result = await client.chat({ model, messages, format: 'json', temperature: 0.8, numPredict: 2048 });

    if (!result.ok) {
        return client.createNetworkError(result.error, messages[0].content, model, interactionId);
    }

    const responseContent = result.data.message?.content || '';
    const metadata: OllamaMetadata = { prompt: messages[0].content, response: responseContent, model, id: interactionId };

    const parsed = parseJsonRobustly(responseContent);
    if (!parsed) {
        return {
            success: false,
            error: { type: 'PARSE_ERROR', message: 'JSON parsing failed', rawResponse: responseContent },
            metadata: { ...metadata, response: `[PARSE ERROR] Raw: "${responseContent}"` }
        };
    }

    const extracted = extractTextField(parsed, npc.id);
    if (!extracted?.text) {
        return {
            success: false,
            error: { type: 'PARSE_ERROR', message: "Missing 'text' field", rawResponse: JSON.stringify(parsed) },
            metadata: { ...metadata, response: `[VALIDATION ERROR] Missing 'text': ${JSON.stringify(parsed)}` }
        };
    }

    return {
        success: true,
        data: {
            speakerId: extracted.speakerId || npc.id,
            text: extracted.text,
            emotion: extracted.emotion || 'neutral',
            isConcluding: extracted.isConcluding || ignoreCount >= 2
        },
        metadata
    };
}
