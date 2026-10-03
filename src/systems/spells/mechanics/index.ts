// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 12/08/2026, 01:37:16
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file is the public doorway to shared spell-mechanics resolvers.
 *
 * Combat features can import saving throws, concentration, dice, scaling,
 * dispelling, and exact teleportation from one stable location. Each exported
 * implementation keeps its own rules and tests in a neighboring module.
 *
 * Called by: combat features that use the shared spell-mechanics package.
 * Depends on: the production resolver modules re-exported below.
 */

// ============================================================================
// Public Spell-Mechanics Exports
// ============================================================================
// Named exports keep callers independent from the internal module filenames.
// ============================================================================

export { SavingThrowResolver } from './SavingThrowResolver'
export { ConcentrationTracker } from './ConcentrationTracker'
export { ScalingEngine } from './ScalingEngine'
export { DiceRoller } from './DiceRoller'
export {
  resolveDispelMagic,
  type DispelMagicCleanupCounts,
  type DispelMagicResolution,
  type DispelMagicResolutionStatus,
  type ResolveDispelMagicInput,
} from './dispelMagicResolution'
export {
  resolveTeleportation,
  type ResolveTeleportationInput,
  type TeleportationResolution,
  type TeleportationResolutionReason,
  type TeleportTraversalProof,
} from './teleportationResolution'
