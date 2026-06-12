// @dependencies-start
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
// @dependencies-end

/**
 * @file serialize.ts - JSON save-file helpers for Worldforge deltas.
 *
 * Delta records need to survive save/load boundaries without executable state.
 * This module wraps the delta list in a versioned JSON envelope so future save
 * migrations can reject unknown shapes cleanly instead of replaying them as if
 * they were current.
 */
import {
  WORLD_DELTA_SCHEMA_VERSION,
  type WorldDelta,
} from './types';

// ---------------------------------------------------------------------------
// Serialized envelope
// ---------------------------------------------------------------------------
// The file schema version belongs to the JSON package, not to any one delta.
// Individual deltas still carry their own schema/op versions for replay-time
// tolerance in applyDeltas.ts.
// ---------------------------------------------------------------------------

export interface SerializedWorldDeltas {
  schemaVersion: number;
  deltas: WorldDelta[];
}

export interface DeserializeDeltasResult {
  deltas: WorldDelta[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// JSON conversion
// ---------------------------------------------------------------------------
// Serialization intentionally keeps the envelope small. The deltas themselves
// are already JSON-safe by type, so JSON.stringify is enough for the current
// persistence layer.
// ---------------------------------------------------------------------------

export function serializeDeltas(deltas: WorldDelta[]): string {
  return JSON.stringify({
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    deltas,
  } satisfies SerializedWorldDeltas);
}

export function deserializeDeltas(json: string): DeserializeDeltasResult {
  const parsed = JSON.parse(json) as SerializedWorldDeltas;

  if (parsed.schemaVersion !== WORLD_DELTA_SCHEMA_VERSION) {
    return {
      deltas: [],
      warnings: [
        `Unsupported WorldDelta save schema version ${parsed.schemaVersion}.`,
      ],
    };
  }

  return {
    deltas: parsed.deltas,
    warnings: [],
  };
}
