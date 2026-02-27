// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:14
 * Dependents: world/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
