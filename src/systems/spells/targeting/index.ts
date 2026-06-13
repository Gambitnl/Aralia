// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 12/06/2026, 22:06:57
 * Dependents: None (Orphan)
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export { AoECalculator } from './AoECalculator'
/**
 * This barrel exposes spell-targeting helpers to the rest of the combat system.
 *
 * TargetResolver validates creatures, objects, and points against spell rules.
 * ObjectTargetRegistry supplies the explicit positioned object candidates that
 * object-aware UI and combat flows can pass into that resolver.
 */

export { TargetResolver } from './TargetResolver'
export { collectObjectTargetCandidates, withObjectTargetCandidates } from './ObjectTargetRegistry'
export type { ObjectTargetRegistryInput, ObjectTargetRegistryMapSource } from './ObjectTargetRegistry'
export { buildSelectedSpellTargetsForPosition } from './selectedSpellTargets'
export type { SelectedSpellTargetBuildInput } from './selectedSpellTargets'

// For testing/advanced use
export { getCone } from './gridAlgorithms/cone'
export { getCube } from './gridAlgorithms/cube'
export { getSphere } from './gridAlgorithms/sphere'
export { getLine } from './gridAlgorithms/line'
export { getCylinder } from './gridAlgorithms/cylinder'
