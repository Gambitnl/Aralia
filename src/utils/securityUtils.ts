import { ENV } from '../config/env';

/**
 * Redacts sensitive data (like API keys) from strings or objects.
 * Useful for logging or error reporting.
 * @param data The data to clean.
 * @param secret The secret to redact. Defaults to ENV.API_KEY.
 */
export function redactSensitiveData(data: any, secret?: string): any {
  const keyToRedact = secret !== undefined ? secret : ENV.API_KEY;
  if (!keyToRedact) return data;

  if (typeof data === 'string') {
    return data.replaceAll(keyToRedact, '[REDACTED]');
  }

  if (typeof data === 'object' && data !== null) {
    // Handle Errors specifically to clean message and stack
    if (data instanceof Error) {
      const cleanError = new Error(data.message.replaceAll(keyToRedact, '[REDACTED]'));
      if (data.stack) {
        cleanError.stack = data.stack.replaceAll(keyToRedact, '[REDACTED]');
      }
      return cleanError;
    }

    // Recursively clean objects/arrays
    try {
        const json = JSON.stringify(data);
        const redacted = json.replaceAll(keyToRedact, '[REDACTED]');
        return JSON.parse(redacted);
    } catch {
        // If circular structure or other error, return as is (or shallow copy if needed)
        return data;
    }
  }

  return data;
}

/**
 * Basic input sanitization for AI prompts.
 * Removes common injection patterns or excessive whitespace.
 * @param input The user input string.
 */
export function sanitizeAIInput(input: string, maxLength: number = 500): string {
  if (!input) return '';
  // 1. Trim whitespace
  let clean = input.trim();
  // 2. Remove null bytes (common attack vector in some systems, less likely here but good practice)
  clean = clean.replace(/\0/g, '');
  // 3. Limit length (example: 500 chars) - prevents huge prompt costs/DoS
  //    (Adjust limit as needed for gameplay)
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean;
}

/**
 * Detects suspicious input that might be trying to jailbreak or inject commands.
 * @param input The user input string.
 * @returns True if suspicious, false otherwise.
 */
export function detectSuspiciousInput(input: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();

  // Basic heuristic for jailbreak attempts
  const suspiciousPhrases = [
    'ignore all previous instructions',
    'ignore previous instructions',
    'system override',
    'you are not a', // "You are not a DM..."
    'debug mode',
    'developer mode'
  ];

  return suspiciousPhrases.some(phrase => lower.includes(phrase));
}

/**
 * Safely parses a JSON string.
 * Wraps JSON.parse in a try-catch block to prevent crashes from malformed data.
 *
 * @param jsonString The string to parse.
 * @param fallback The value to return if parsing fails. Defaults to null.
 * @returns The parsed object or the fallback value.
 */
export function safeJSONParse<T>(jsonString: string | null | undefined, fallback: T | null = null): T | null {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}
