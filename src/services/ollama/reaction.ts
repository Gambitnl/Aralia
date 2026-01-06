/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/reaction.ts
 * Companion reaction generation for in-game events.
 */

import type {
    BanterContext,
    ReactionCompanion,
    ReactionEvent,
    ReactionResponse,
    OllamaResult,
    OllamaMetadata
} from '../../types/ollama';
import { OllamaClient, getDefaultClient } from './client';
import { parseJsonRobustly } from './jsonParser';

// ============================================================================
// Reaction Prompt Builder
// ============================================================================

function buildReactionPrompt(
    companion: ReactionCompanion,
    event: ReactionEvent,
    contextData: BanterContext
): string {
    return `[Character Data]
Name: ${companion.name}
Role: ${companion.sex} ${companion.race} ${companion.class}
Personality: ${companion.personality}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}

[Event]
${event.description}

[Task]
React to this event in character.

[Requirements]
- VERY SHORT (1 sentence max).
- Determine approval change (-3 to +3).

[Output Format]
Output ONLY JSON: {"text": "your reaction", "approvalChange": 0}

JSON:`;
}

// ============================================================================
// Reaction Generation
// ============================================================================

/**
 * Generates a short, contextual reaction for a companion based on an event.
 * This is used for dynamic in-game reactions (e.g., looting, crimes, combat).
 */
export async function generateReaction(
    companion: ReactionCompanion,
    event: ReactionEvent,
    contextData: BanterContext,
    client: OllamaClient = getDefaultClient()
): Promise<OllamaResult<ReactionResponse>> {
    const model = await client.getModel();
    if (!model) {
        return client.createErrorResult({ type: 'NETWORK_ERROR', message: 'No Ollama model available' });
    }

    const prompt = buildReactionPrompt(companion, event, contextData);

    const result = await client.generate({
        model,
        prompt,
        temperature: 0.7,
        numPredict: 150
    });

    if (!result.ok) {
        return client.createNetworkError(result.error, prompt, model);
    }

    const metadata: OllamaMetadata = { prompt, response: result.data.response, model };

    const parsed = parseJsonRobustly(result.data.response);
    if (!parsed || !parsed.text) {
        return client.createParseError(
            'Reaction parsing failed',
            result.data.response,
            prompt,
            model
        );
    }

    return {
        success: true,
        data: {
            text: parsed.text,
            approvalChange: parsed.approvalChange || 0
        },
        metadata
    };
}
