/**
 * Public combat contracts grouped by owner. Keep this barrel explicit about
 * type-only edges so the biome list remains the sole runtime export.
 * Existing callers continue to use ../combat.ts without changing their paths.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 24/10/2026, 21:16:06
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type * from './actors.js';
export type * from './effects.js';
export type * from './primitives.js';
export type * from './actions.js';
export type * from './turn.js';
export type * from './map.js';
export type * from './state.js';
export type * from './visuals.js';
export type * from './log.js';
export { BATTLE_MAP_BIOMES } from './map.js';
