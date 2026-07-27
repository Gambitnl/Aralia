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
/**
 * @file src/utils/world/dialogueUtils.ts
 * Utilities for parsing and cleaning dialogue text.
 */
/**
 * Safely removes system-specific dialogue formatting (like ': "...")
 * without destroying internal quotes or content.
 */
export declare function stripSystemFormatting(text: string): string;
