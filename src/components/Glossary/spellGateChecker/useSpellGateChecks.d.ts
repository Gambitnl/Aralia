/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/04/2026, 00:27:00
 * Dependents: components/Glossary/Glossary.tsx, components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx, components/Glossary/spellGateChecker/buildGateLabel.ts, components/Glossary/spellGateChecker/index.ts, components/Glossary/spellGateChecker/spellGateIssueSummary.ts, hooks/useSpellGateChecks.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { GateResult } from "./spellGateDataTypes";
export type { GateChecklist, GateResult, GateStatus, SpellGateArtifactEntry } from "./spellGateDataTypes";
/**
 * This hook powers the developer-only spell gate checker inside the glossary.
 *
 * It exists so a spell can be reviewed in one place against three layers at once:
 * the live runtime JSON, the generated spell-truth reports, and the accepted
 * residue buckets from the structured-vs-canonical audit. Glossary.tsx now
 * reaches this hook through the dedicated spellGateChecker folder and
 * GlossaryEntryPanel.tsx renders the results.
 *
 * Called by: Glossary.tsx
 * Depends on: spell JSON files, generated audit artifacts, SpellValidator, and the bucket-detail builder
 */
export declare const useSpellGateChecks: (selectedSpellId?: string | null, enableSelectedSpellLiveRefresh?: boolean, enabled?: boolean) => {
    results: Record<string, GateResult>;
    recheck: () => void;
    isLoading: boolean;
};
