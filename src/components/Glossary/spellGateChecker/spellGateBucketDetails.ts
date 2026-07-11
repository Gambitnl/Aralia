// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/04/2026, 00:24:19
 * Dependents: components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns spell audit mismatches into the detailed buckets shown in the glossary gate checker.
 *
 * The gate checker compares three layers at once: the canonical spell snapshot, the structured markdown,
 * and the runtime JSON that the glossary actually renders. This module owns the field-by-field review
 * logic so the React hook can stay focused on loading data and updating glossary state.
 *
 * Called by: useSpellGateChecks.ts
 * Depends on: SpellValidator and shared spell gate data types
 */

// This module was split into per-bucket-family modules under ./buckets/.
// It remains as a facade re-exporting the identical public API so importers keep working.
export { buildBucketDetailsForSpell, buildGateResultForSpell, configureStructuredReportIndexes } from "./buckets/gateResultBuilder";
