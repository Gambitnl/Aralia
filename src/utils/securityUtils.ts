/**
 * @file src/utils/securityUtils.ts
 * Shared security utility functions for input sanitization and validation.
 */

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
 * Recursively redacts sensitive keys from an object or array.
 * Commonly used for logging to prevent secrets from being exposed.
 *
 * @param data The data to redact.
 * @returns A deep copy of the data with sensitive keys replaced by '[REDACTED]'.
 */
export function redactSensitiveData(data: unknown, seen = new WeakSet()): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // Handle circular references first to prevent infinite recursion
  if (seen.has(data as object)) {
    return '[CIRCULAR]';
  }
  seen.add(data as object);

  // Return specific types as-is to preserve functionality
  if (data instanceof Date || data instanceof RegExp) {
    return data;
  }

  // Handle Errors specifically to preserve message and stack
  if (data instanceof Error) {
    const errorObj: Record<string, any> = {
      name: data.name,
      message: data.message,
      stack: data.stack,
      // Include any other enumerable properties
      ...data
    };
    // Recursively redact properties of the error object (e.g. if it has a 'context' property)
    return redactSensitiveData(errorObj, seen);
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, seen));
  }

  if (data instanceof Map) {
    // We convert Map to object for logging purposes, or just return as is?
    // Usually loggers serialize Maps. Let's return as is but warn, or just skip redaction for now
    // Simplest approach: treat as non-redactable or convert entries if needed.
    // For safety, let's just return it. Map keys are rarely strings like "password".
    return data;
  }

  if (data instanceof Set) {
    return data;
  }

  const SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'authorization',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'credit_card',
    'cc_number',
    'ssn'
  ];

  const redactedObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    // Use strict equality check or check for specific substrings that definitely indicate secrets
    // Avoid broad "includes" for short words like "key" or "auth" to prevent false positives (e.g., "keyboard", "author")
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sensitive => lowerKey === sensitive) ||
                        lowerKey.includes('password') ||
                        lowerKey.includes('token') ||
                        lowerKey.includes('secret') ||
                        lowerKey.endsWith('key') && (lowerKey.includes('api') || lowerKey.includes('auth') || lowerKey.includes('private'));

    if (isSensitive) {
      redactedObj[key] = '[REDACTED]';
    } else {
      redactedObj[key] = redactSensitiveData(value, seen);
    }
  }

  return redactedObj;
}
