/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/jsonParser.ts
 * Robust JSON parsing utilities for handling LLM output.
 */

/**
 * Attempts to extract and parse JSON from a potentially messy string.
 * Handles common LLM quirks like markdown fencing, extra text, and control characters.
 */
export function parseJsonRobustly<T = any>(text: string): T | null {
    if (!text) return null;

    // 1. Try direct parse
    try {
        return JSON.parse(text.trim()) as T;
    } catch {
        // Continue to fallback
    }

    // 2. Try to find JSON block in markdown
    const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch?.[1]) {
        try {
            return JSON.parse(mdMatch[1].trim()) as T;
        } catch {
            // Continue
        }
    }

    // 3. Try to find anything between { and }
    const braceMatch = text.match(/(\{[\s\S]*\})/);
    // TODO: Add a final fallback strategy that locates the first '{' and last '}' in the entire string to extract the JSON object, handling cases where the model wraps the JSON in conversational text without markdown blocks.
    if (braceMatch?.[1]) {
        try {
            return JSON.parse(braceMatch[1].trim()) as T;
        } catch {
            // Try more aggressive cleanup: find first { and last }
            const lastIndex = text.lastIndexOf('}');
            const firstIndex = text.indexOf('{');
            if (firstIndex !== -1 && lastIndex > firstIndex) {
                try {
                    return JSON.parse(text.substring(firstIndex, lastIndex + 1)) as T;
                } catch {
                    // Fail
                }
            }
        }
    }

    // 4. Try stripping invalid control characters which can break JSON.parse
    try {
        // eslint-disable-next-line no-control-regex
        const cleaned = text.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        return JSON.parse(cleaned) as T;
    } catch {
        // Continue
    }

    return null;
}

/**
 * Extract text from a parsed response, handling various LLM output formats.
 */
export function extractTextField(parsed: any, fallbackSpeakerId?: string): {
    text?: string;
    speakerId?: string;
    emotion?: string;
    isConcluding?: boolean;
} | null {
    if (!parsed) return null;

    // Support both single-line and legacy multi-line JSON formats
    const text = parsed.text
        || parsed.line
        || (Array.isArray(parsed.lines) ? parsed.lines[0]?.text : undefined);

    const speakerId = parsed.speakerId
        || parsed.speaker
        || (Array.isArray(parsed.lines) ? parsed.lines[0]?.speakerId : undefined)
        || fallbackSpeakerId;

    const emotion = parsed.emotion
        || (Array.isArray(parsed.lines) ? parsed.lines[0]?.emotion : undefined)
        || 'neutral';

    const isConcluding = parsed.isConcluding === true
        || (Array.isArray(parsed.lines) ? parsed.lines[0]?.isConcluding === true : false);

    return { text, speakerId, emotion, isConcluding };
}
