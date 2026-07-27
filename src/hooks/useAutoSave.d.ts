/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 01:14:26
 * Dependents: App.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { GameState } from '../types';
/**
 * Auto-saves the running game to the autosave slot (localStorage).
 *
 * Design intent:
 * - This is for "refresh safety" and crash resilience.
 * - It should not spam notifications.
 * - It should be throttled/debounced to avoid excessive localStorage writes.
 */
export declare function useAutoSave(gameState: GameState, enabledOverride?: boolean): void;
