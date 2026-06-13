// @dependencies-start
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
// @dependencies-end

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
import { applyDeltas } from '../delta/applyDeltas';
import type { WorldDelta } from '../delta/types';

// ============================================================================
// Delta-Replayed Ground View
// ============================================================================
// This section intentionally does not know how plot operations work. The delta
// layer owns ordering, version checks, cloning, warnings, and each operation's
// exact behavior; this bridge only supplies the TownPlan that ground mode should
// replay against.
// ============================================================================

export function localWithDeltas(
  local: LocalArtifact,
  plan: TownPlan,
  deltas: WorldDelta[],
): LocalArtifact {
  // When there are no deltas, still return a fresh LocalArtifact wrapper so the
  // caller receives the requested townPlan without paying for a full terrain and
  // feature clone. The returned object shares the terrain/features/bounds and
  // supplied plan by design; this function does not mutate any of them.
  if (deltas.length === 0) {
    return {
      ...local,
      townPlan: plan,
    };
  }

  // For edited towns, hand a LocalArtifact-with-plan to the existing replay
  // engine. applyDeltas clones the local artifact and town plan before replay,
  // so plot edits and building markers cannot leak back into the inputs.
  return applyDeltas(
    {
      ...local,
      townPlan: plan,
    },
    deltas,
  ).artifact;
}
