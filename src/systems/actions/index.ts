// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 26/08/2026, 16:49:52
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file serves as the main entry point for the shared Action System modules.
 *
 * It exports the ActionValidator (for pre-execution resource, condition, range, and target checks)
 * and the ActionOutcomeLogger (for translating action results into narrative prose and journal events).
 *
 * Called by: hooks, commands, combat systems, and UI interaction controllers.
 */

export * from './ActionValidator';
export * from './ActionOutcomeLogger';
