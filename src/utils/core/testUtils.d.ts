/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:11:49
 * Dependents: components/SaveLoad/SaveSlotSelector.tsx, utils/testUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file runs development-only accessibility checks for mounted UI panels.
 * Components load it dynamically so the large axe library stays out of the
 * production bundle, while developers still receive actionable diagnostics.
 */
export declare const runAxe: (node: HTMLElement) => void;
