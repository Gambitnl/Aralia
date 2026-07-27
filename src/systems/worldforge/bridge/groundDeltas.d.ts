/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 12/06/2026, 05:31:10
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file groundDeltas.ts - prepares a LocalArtifact view whose town plan includes
 * saved player/world edits.
 *
 * Ground mode ultimately consumes LocalArtifact data, while the delta layer is
 * the durable record of plot edits such as changed roles, removed plots, and
 * newly added buildings. This file is the small bridge between those systems:
 * callers provide the generated LocalArtifact, the generated TownPlan they want
 * ground mode to see, and the saved deltas; the result is a LocalArtifact with a
 * replayed townPlan ready for later makeGroundWorld integration.
 *
 * Called by: future ground-mode loading code before makeGroundWorld.
 * Depends on: applyDeltas for all mutation semantics and validation.
 */
import type { LocalArtifact, TownPlan } from '../artifacts';
import type { WorldDelta } from '../delta/types';
export declare function localWithDeltas(local: LocalArtifact, plan: TownPlan, deltas: WorldDelta[]): LocalArtifact;
