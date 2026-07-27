/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 03:51:17
 * Dependents: systems/worldforge/world/worldStore.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file applyDeltas.ts - replay Worldforge save deltas over generated artifacts.
 *
 * This is the pure merge point for decision #14. Generators rebuild the base
 * artifact from its seed path; then this module applies saved mutations without
 * changing the original input artifact. Today the landed mutation target is
 * LocalArtifact.features, and the envelope is designed so later layers can add
 * their own stable entity keys without changing the ordering contract.
 */
import type { AnyWorldforgeArtifact } from '../artifacts';
import { type DeltaWarning, type WorldDelta } from './types';
export interface ApplyDeltasResult<TArtifact extends AnyWorldforgeArtifact> {
    artifact: TArtifact;
    warnings: DeltaWarning[];
}
export declare function applyDeltas<TArtifact extends AnyWorldforgeArtifact>(artifact: TArtifact, deltas: WorldDelta[]): ApplyDeltasResult<TArtifact>;
