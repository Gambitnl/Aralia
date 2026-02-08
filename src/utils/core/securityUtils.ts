// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 08/02/2026, 15:58:02
 * Dependents: core/index.ts, logger.ts, securityUtils.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/securityUtils.ts
 * Shared security utility functions for input sanitization and validation.
 */

import { ENV } from '../../config/env';

/**
 * Sanitizes user input intended for AI prompts to prevent injection attacks and DoS.
 *
 * @param input The raw user input string.
 * @param maxLength The maximum allowed length (default: 500).
 * @returns The sanitized, truncated string.
 */
export function sanitizeAIInput(input: string, maxLength: number = 500): string {
  if (!input) return '';

  // 1. Truncate to maximum length to prevent token exhaustion/DoS
  let sanitized = input.slice(0, maxLength);

  // 2. Remove or escape potential prompt injection delimiters
  // Users shouldn't be able to fake "System Instruction:" or "Context:" blocks
  sanitized = sanitized
    .replace(/System Instruction:/gi, '[REDACTED]')
    .replace(/User Prompt:/gi, '[REDACTED]')
    .replace(/Context:/gi, '[REDACTED]')
    .replace(/```/g, "'''"); // Break markdown code blocks

  // 3. Basic whitespace trimming
  sanitized = sanitized.trim();

  // 4. Encode HTML special characters to prevent basic XSS if reflected in UI
  // (Though this is primarily for AI prompt safety, good practice)
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return sanitized;
}

/**
 * Sanitizes user input intended for AI prompts while preserving punctuation (no HTML entity escaping).
 *
 * Use this when the string is only sent to an AI backend (and not rendered as HTML).
 */
export function sanitizeAIPromptText(input: string, maxLength: number = 500): string {
  if (!input) return '';

  // 1. Truncate to maximum length to prevent token exhaustion/DoS
  let sanitized = input.slice(0, maxLength);

  // 2. Remove or escape potential prompt injection delimiters
  sanitized = sanitized
    .replace(/System Instruction:/gi, '[REDACTED]')
    .replace(/User Prompt:/gi, '[REDACTED]')
    .replace(/Context:/gi, '[REDACTED]')
    .replace(/```/g, "'''"); // Break markdown code blocks

  // 3. Basic whitespace trimming
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validates if the input contains suspicious patterns often used in prompt injection.
 *
 * @param input The user input to check.
 * @returns True if suspicious, False if clean.
 */
export function detectSuspiciousInput(input: string): boolean {
  const lowerInput = input.toLowerCase();

  // Common injection patterns
  const suspiciousPatterns = [
    "ignore all previous instructions",
    "ignore previous instructions",
    "you are now",
    "system override",
    "debug mode",
    "reveal your prompt",
    "reveal system prompt"
  ];

  return suspiciousPatterns.some(pattern => lowerInput.includes(pattern));
}

/**
 * Recursively redacts sensitive information (like API keys) from data.
 * Safe to use on Error objects (converts them to string).
 *
 * @param data The data to scrub (string, object, Error, etc.)
 * @param secret The secret to redact. Defaults to ENV.API_KEY.
 * @returns A safe string representation or object with the secret replaced.
 */
export function redactSensitiveData(data: unknown, secret?: string): unknown {
  if (data === null || data === undefined) return data;

  const keyToRedact = secret !== undefined ? secret : ENV.API_KEY;
  if (!keyToRedact || keyToRedact.length < 5) return data; // Avoid redacting common short strings

  let stringified: string;
  try {
    if (data instanceof Error) {
      // JSON.stringify(error) returns {} usually, so we use property names
      stringified = JSON.stringify(data, Object.getOwnPropertyNames(data));
    } else if (typeof data === 'object') {
      stringified = JSON.stringify(data);
    } else {
      stringified = String(data);
    }
  } catch {
    return '[Unable to sanitize data]';
  }

  if (stringified.includes(keyToRedact)) {
    // Escape special regex characters in the key if we were using regex,
    // but split/join is safer and faster for simple string replacement.
    const redacted = stringified.split(keyToRedact).join('[REDACTED]');

    // Attempt to parse back to object if it was an object/JSON
    if (typeof data === 'object' && !(data instanceof Error)) {
      try {
        return JSON.parse(redacted);
      } catch {
        return redacted;
      }
    }
    return redacted;
  }

  return data;
}

/**
 * Safely parses a JSON string, handling errors gracefully.
 *
 * @param jsonString The string to parse.
 * @param fallback The value to return if parsing fails.
 * @returns The parsed object or the fallback value.
 */
export function safeJSONParse<T>(jsonString: string, fallback: T | null = null): T | null {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Cleans a string from an AI response by removing Markdown code blocks.
 * Often used before parsing JSON from an LLM.
 *
 * @param text The raw text from the AI.
 * @returns The cleaned text ready for parsing.
 */
export function cleanAIJSON(text: string): string {
  if (!text) return "";
  return text.replace(/```json\n|```/g, '').trim();
}

/**
 * Validates a character name to prevent abuse, UI breaking issues, and potential injection vectors.
 * Enforces length limits and an allow-list of characters.
 *
 * @param name The character name to validate.
 * @returns An object containing validity status and an optional error message.
 */
export function validateCharacterName(name: string): { valid: boolean; error?: string } {
  const trimmed = name ? name.trim() : '';

  if (trimmed.length === 0) {
    return { valid: false, error: "Name cannot be empty." };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: "Name is too long (max 50 characters)." };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: "Name is too short (min 2 characters)." };
  }

  // Allow alphanumeric (including international), spaces, apostrophes, and hyphens.
  // This prevents control characters, HTML tags (<, >), and other potential script injection vectors.
  // Using unicode property escapes to support accented characters (e.g., Björn, Zoë).
  const nameRegex = /^[\p{L}\p{N}\s'-]+$/u;

  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: "Name contains invalid characters. Use letters, numbers, spaces, hyphens, and apostrophes only." };
  }

  return { valid: true };
}
