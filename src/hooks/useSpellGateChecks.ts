// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 05/04/2026, 13:54:02
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
 * This file is now a compatibility wrapper for the dedicated spell gate module.
 *
 * The spell gate checker outgrew the generic hooks folder because it owns its
 * own reports, types, helper wording, and glossary-specific review flow. The
 * real implementation now lives under the glossary spellGateChecker folder, but
 * this wrapper preserves the old import path while the rest of the repo catches up.
 *
 * Called by: older imports and tests that still reference src/hooks/useSpellGateChecks
 * Depends on: src/components/Glossary/spellGateChecker/useSpellGateChecks.ts
 */

// ============================================================================
// Compatibility re-exports
// ============================================================================
// Keep the old hook path alive so this refactor does not silently break every
// older import at once. New glossary work should import from the dedicated
// spellGateChecker folder instead of adding more dependencies to this shim.
// ============================================================================

export {
  useSpellGateChecks,
  type GateChecklist,
  type GateResult,
  type GateStatus,
  type SpellGateArtifactEntry,
} from "../components/Glossary/spellGateChecker/useSpellGateChecks";
