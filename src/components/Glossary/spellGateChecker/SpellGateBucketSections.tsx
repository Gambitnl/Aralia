// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/04/2026, 01:40:47
 * Dependents: components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file SpellGateBucketSections.tsx
 * This file renders the detailed bucket-by-bucket spell review sections.
 *
 * The overview shell now lives in SpellGateChecksPanel.tsx, while this file
 * keeps the long-form forensic review blocks grouped behind one dedicated module.
 * That split makes the top-level panel easier to scan without deleting any of
 * the deeper spell-truth detail work that the reviewer still needs.
 *
 * Called by: SpellGateChecksPanel.tsx
 * Depends on: GateResult data from the spell gate hook and the spell-card JSON shape
 */

// This module was split into per-bucket-family section components under ./buckets/.
// It remains as a facade re-exporting the identical public API so importers keep working.
export { SpellGateBucketSections } from './buckets/SpellGateBucketSections';
export { default } from './buckets/SpellGateBucketSections';
