/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/06/2026, 03:10:02
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file serialize.ts - JSON save-file helpers for Worldforge deltas.
 *
 * Delta records need to survive save/load boundaries without executable state.
 * This module wraps the delta list in a versioned JSON envelope so future save
 * migrations can reject unknown shapes cleanly instead of replaying them as if
 * they were current.
 */
import { type WorldDelta } from './types';
export interface SerializedWorldDeltas {
    schemaVersion: number;
    deltas: WorldDelta[];
}
export interface DeserializeDeltasResult {
    deltas: WorldDelta[];
    warnings: string[];
}
export declare function serializeDeltas(deltas: WorldDelta[]): string;
export declare function deserializeDeltas(json: string): DeserializeDeltasResult;
