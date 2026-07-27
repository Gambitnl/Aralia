/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:09
 * Dependents: components/Glossary/spellGateChecker/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { GateResult } from './useSpellGateChecks';
/**
 * This helper turns rich spell gate issues into the short sidebar tooltip text.
 *
 * It exists because the sidebar only has room for a quick "what is wrong?"
 * answer, while the full spell gate panel renders the longer diagnostic prose.
 * GlossarySidebar.tsx calls this helper so the wording stays aligned with the
 * same issue summaries the detailed spell gate panel uses.
 *
 * Called by: GlossarySidebar.tsx
 * Depends on: the GateResult shape produced by useSpellGateChecks
 */
export declare function buildGateLabel(gate: GateResult | undefined, isDevModeEnabled: boolean): string | undefined;
