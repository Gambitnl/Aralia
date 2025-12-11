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
