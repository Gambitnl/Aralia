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
export declare function parseJsonRobustly<T = any>(text: string): T | null;
/**
 * Extract text from a parsed response, handling various LLM output formats.
 */
export declare function extractTextField(parsed: any, fallbackSpeakerId?: string): {
    text?: string;
    speakerId?: string;
    emotion?: string;
    isConcluding?: boolean;
} | null;
