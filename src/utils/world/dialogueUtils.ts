/**
 * @file src/utils/world/dialogueUtils.ts
 * Utilities for parsing and cleaning dialogue text.
 */

/**
 * Safely removes system-specific dialogue formatting (like ': "...") 
 * without destroying internal quotes or content.
 */
export function stripSystemFormatting(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // 1. Remove optional System Prefix ': "'
    if (cleaned.startsWith(': "')) {
        cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith(':"')) {
        cleaned = cleaned.substring(2);
    }

    // 2. Remove trailing quote if it exists
    if (cleaned.endsWith('"')) {
        cleaned = cleaned.substring(0, cleaned.length - 1);
    }

    return cleaned.trim();
}
