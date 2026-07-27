/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:32:01
 * Dependents: core/index.ts, logger.ts, securityUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Sanitizes user input intended for AI prompts to prevent injection attacks and DoS.
 *
 * @param input The raw user input string.
 * @param maxLength The maximum allowed length (default: 500).
 * @returns The sanitized, truncated string.
 */
export declare function sanitizeAIInput(input: string, maxLength?: number): string;
/**
 * Sanitizes user input intended for AI prompts while preserving punctuation (no HTML entity escaping).
 *
 * Use this when the string is only sent to an AI backend (and not rendered as HTML).
 */
export declare function sanitizeAIPromptText(input: string, maxLength?: number): string;
/**
 * Validates if the input contains suspicious patterns often used in prompt injection.
 *
 * @param input The user input to check.
 * @returns True if suspicious, False if clean.
 */
export declare function detectSuspiciousInput(input: string): boolean;
/**
 * Recursively redacts sensitive information (like API keys) from data.
 * Safe to use on Error objects (converts them to string).
 *
 * @param data The data to scrub (string, object, Error, etc.)
 * @param secret The secret to redact. Defaults to ENV.API_KEY.
 * @returns A safe string representation or object with the secret replaced.
 */
export declare function redactSensitiveData(data: unknown, secret?: string): unknown;
/**
 * Safely parses a JSON string, handling errors gracefully.
 *
 * @param jsonString The string to parse.
 * @param fallback The value to return if parsing fails.
 * @returns The parsed object or the fallback value.
 */
export declare function safeJSONParse<T>(jsonString: string, fallback?: T | null): T | null;
/**
 * Cleans a string from an AI response by removing Markdown code blocks.
 * Often used before parsing JSON from an LLM.
 *
 * @param text The raw text from the AI.
 * @returns The cleaned text ready for parsing.
 */
export declare function cleanAIJSON(text: string): string;
/**
 * Validates a character name to prevent abuse, UI breaking issues, and potential injection vectors.
 * Enforces length limits and an allow-list of characters.
 *
 * @param name The character name to validate.
 * @returns An object containing validity status and an optional error message.
 */
export declare function validateCharacterName(name: string): {
    valid: boolean;
    error?: string;
};
