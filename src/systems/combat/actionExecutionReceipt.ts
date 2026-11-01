/**
 * @file actionExecutionReceipt.ts
 * Deterministic combat decisions extracted from useActionExecutor.
 * Receives explicit state and receipt sources; does not prompt, publish React
 * state, claim actions or emit events. The hook keeps those timing boundaries.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:36:36
 * Dependents: systems/combat/actionMovementPlanning.ts, systems/combat/actionTurnResolution.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Sources are invoked only when the preserved rule branch actually emits a receipt. */
export interface ActionExecutionReceiptSources {
  generateId: () => string;
  now: () => number;
}
