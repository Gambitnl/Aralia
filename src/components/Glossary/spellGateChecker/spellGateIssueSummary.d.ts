/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx, components/Glossary/spellGateChecker/buildGateLabel.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { GateResult } from "./useSpellGateChecks";
export declare function buildSpecificIssueList(gate: GateResult): string[];
export declare function getPrimaryIssue(gate: GateResult): string | null;
