// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:29:01
 * Dependents: ollama/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/facts.ts
 * Extracts discovered character facts from banter conversations.
 */

import type { DiscoveredFact } from '../../types/companions';
import type { OllamaResult, OllamaMetadata } from '../../types/ollama';
import { OllamaClient, getDefaultClient } from './client';
import { parseJsonRobustly } from './jsonParser';
import { generateId } from '../../utils/core/idGenerator';

interface ParticipantData {
    id: string;
    name: string;
    knownFacts: string[]; // Facts already known about this character
}

interface ExtractedFactRaw {
    companionId: string;
    category: string;
    fact: string;
}

/**
 * Builds a prompt to extract new character facts from a conversation.
 */
function buildFactExtractionPrompt(
    conversation: { speakerId: string; speakerName: string; text: string }[],
    participants: ParticipantData[]
): string {
    const conversationText = conversation
        .map(line => `${line.speakerName}: "${line.text}"`)
        .join('\n');

    const participantInfo = participants
        .map(p => {
            const factsSection = p.knownFacts.length > 0
                ? `Already known: ${p.knownFacts.join(', ')}`
                : 'No facts known yet';
            return `- ${p.name} (ID: ${p.id}): ${factsSection}`;
        })
        .join('\n');

    return `You are analyzing a conversation between companions in a fantasy RPG.
Your task is to extract any NEW personal facts that characters revealed about themselves.

[Participants]
${participantInfo}

[Conversation]
${conversationText}

[Task]
Identify any NEW facts the characters revealed about themselves that are NOT already in their "Already known" list.
Only include facts that are:
- Specific and concrete (not vague opinions)
- About the speaker themselves (not about others)
- New information (not repetitions of known facts)

[Categories]
- backstory: Past events, history, origin
- family: Relatives, spouse, children
- occupation: Jobs, skills, training
- belief: Religion, philosophy, values
- relationship: Connections to other characters
- preference: Likes, dislikes, habits
- other: Anything else notable

[Output Format]
Return strict JSON only. No markdown code blocks.
{
  "facts": [
    { "companionId": "character_id", "category": "backstory", "fact": "Used to work as a blacksmith" }
  ]
}

If no new facts were revealed, return: { "facts": [] }`;
}

/**
 * Extracts new personal facts about companions from a banter conversation.
 * Compares against known facts to only return genuinely new information.
 */
export async function extractDiscoveredFacts(
    conversation: { speakerId: string; speakerName: string; text: string }[],
    participants: ParticipantData[],
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<DiscoveredFact[]>> {
    const model = await client.getModel();
    if (!model) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'No Ollama model available' });
    }

    const prompt = buildFactExtractionPrompt(conversation, participants);

    const result = await client.generate({
        model,
        prompt,
        format: 'json',
        temperature: 0.3, // Lower temp for more factual extraction
        numPredict: 512
    });

    if (!result.ok) {
        if (result.error === 'Request timed out') {
            return client.createErrorResult(
                { type: 'TIMEOUT', message: result.error },
                { prompt, response: `[TIMEOUT ERROR] ${result.error}`, model }
            );
        }
        return client.createNetworkError(result.error, prompt, model);
    }

    const metadata: OllamaMetadata = { prompt, response: result.data.response, model };

    const parsed = parseJsonRobustly(result.data.response);
    if (!parsed || !Array.isArray(parsed.facts)) {
        return client.createParseError(
            'Failed to parse facts JSON',
            result.data.response,
            prompt,
            model
        );
    }

    // Convert raw facts to DiscoveredFact objects
    const now = Date.now();
    const validCategories = ['backstory', 'family', 'occupation', 'belief', 'relationship', 'preference', 'other'];

    const discoveredFacts: (DiscoveredFact & { companionId: string })[] = parsed.facts
        .filter((f: ExtractedFactRaw) =>
            f.companionId &&
            f.fact &&
            participants.some(p => p.id === f.companionId)
        )
        .map((f: ExtractedFactRaw) => ({
            id: generateId(),
            companionId: f.companionId, // Include for dispatch
            category: validCategories.includes(f.category) ? f.category : 'other',
            fact: f.fact,
            discoveredAt: now,
            source: 'banter' as const
        })) as (DiscoveredFact & { companionId: string })[];

    return {
        success: true,
        data: discoveredFacts,
        metadata
    };
}
