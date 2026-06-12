// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/06/2026, 03:10:02
 * Dependents: systems/worldforge/delta/applyDeltas.ts, systems/worldforge/delta/serialize.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file types.ts - Worldforge delta-layer persistence contracts.
 *
 * The generated artifact is the deterministic base; this file describes the
 * small saved records that replay player/world mutations on top of that base.
 * Each delta targets one seed-addressed artifact and one stable entity inside
 * it, so future generators can rebuild the same base and then apply only the
 * recorded changes.
 */
import type { LocalFeature } from '../artifacts';
import type { SeedPath } from '../seedPath';

// ---------------------------------------------------------------------------
// Version constants
// ---------------------------------------------------------------------------
// The save envelope and the operation union are versioned separately. A future
// save-file packaging change can bump the schema version, while a new mutation
// shape can bump the operation version without changing the outer file shape.
// ---------------------------------------------------------------------------

export const WORLD_DELTA_SCHEMA_VERSION = 1;
export const WORLD_DELTA_OPERATION_VERSION = 1;

// ---------------------------------------------------------------------------
// JSON-safe values
// ---------------------------------------------------------------------------
// Feature state is persisted as JSON so it can move through save files,
// workers, and future remote sync without losing meaning.
// ---------------------------------------------------------------------------

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Operation union
// ---------------------------------------------------------------------------
// Extension rule: add a new operation kind instead of changing the meaning of
// an existing one. If an existing operation needs incompatible behavior, bump
// WORLD_DELTA_OPERATION_VERSION so older readers skip it with a warning.
// ---------------------------------------------------------------------------

export type WorldDeltaOperation =
  | {
      kind: 'remove-feature';
      featureId: number;
    }
  | {
      kind: 'set-feature-state';
      featureId: number;
      key: string;
      value: JsonValue;
    }
  | {
      kind: 'add-feature';
      feature: LocalFeature;
    };

// ---------------------------------------------------------------------------
// Delta envelope
// ---------------------------------------------------------------------------
// `artifactSeedPath` names the regenerated base artifact. `entityKey` names a
// stable entity within that artifact, such as `feature:17`. `sequence` is the
// writer's causal order for one entity, and `id` breaks ties deterministically.
// ---------------------------------------------------------------------------

export interface WorldDelta {
  id: string;
  schemaVersion: number;
  opVersion: number;
  artifactSeedPath: SeedPath;
  entityKey: string;
  sequence: number;
  operation: WorldDeltaOperation;
}

export interface DeltaWarning {
  deltaId: string;
  message: string;
}
