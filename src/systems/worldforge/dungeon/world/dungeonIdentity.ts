// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:42:53
 * Dependents: systems/worldforge/dungeon/world/deriveIdentity.ts, systems/worldforge/dungeon/world/dungeonLifecycle.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the small canonical identity receipt shared by dungeon systems.
 *
 * A frozen Worldforge seed path is the authoritative address of a dungeon. The stable dungeon id
 * is derived from that path, so world entrances, save records, reducers, and generators cannot
 * choose independent keys. Keeping this contract free of atlas generation lets core save/state
 * code validate receipts without loading the full dungeon generator.
 *
 * Called by: deriveIdentity.ts and dungeonLifecycle.ts; re-exported by deriveIdentity.ts for
 * existing callers.
 * Depends on: Worldforge's frozen SeedPath type only.
 */

// ============================================================================
// Identity Dependency
// ============================================================================
// Only the opaque frozen-path type is needed; no atlas or generator code crosses this boundary.
// ============================================================================

import type { SeedPath } from '../../seedPath';

// ============================================================================
// Canonical Dungeon Receipt
// ============================================================================

/** The persistence-safe identity shared by a world entrance and dungeon runtime. */
export interface DungeonIdentity {
  /** Stable save/runtime key for this dungeon, independent of the current window. */
  dungeonId: string;
  /** Frozen worldforge path that selects the dungeon's deterministic content. */
  seedPath: SeedPath;
}

/** Derive the one canonical dungeon id from its frozen Worldforge seed path. */
export function canonicalDungeonId(seedPath: SeedPath): string {
  return `wf-dungeon-${seedPath}`;
}
