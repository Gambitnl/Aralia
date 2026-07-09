// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 05/04/2026, 00:55:31
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/types/ritual.ts
 * DEPRECATED / COMPATIBILITY SHIM.
 *
 * The canonical home for ritual types is now `src/types/rituals.ts`.
 * This file previously carried a divergent copy of RitualState / RitualConfig /
 * InterruptResult (rituals RG-6, RG-10). To keep exactly one ritual type source,
 * it is now a thin re-export from the canonical file. Any lingering importer of
 * `./ritual` transparently receives the canonical (superset) shapes.
 *
 * Do NOT add new type definitions here — edit `src/types/rituals.ts` instead.
 * "Time is part of the magic."
 */
export type {
  RitualState,
  RitualConfig,
  InterruptCondition,
  InterruptResult,
} from './rituals.js';
