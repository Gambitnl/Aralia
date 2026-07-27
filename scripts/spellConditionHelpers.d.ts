/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: manual addition; the dependency sync tool skips scripts.
 * Dependents: scripts/auditSpellStructuredAgainstJson.ts, scripts/generateSpellGateReport.ts, src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, src/components/Glossary/spellGateChecker/spellGateDataTypes.ts, src/components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export interface RuntimeConditionSummary {
    value: string;
    conditions: string[];
    standardConditions: string[];
    customConditions: string[];
}
export declare function normalizeConditionText(value: string): string;
export declare function normalizeConditionComparisonValue(value: string): string;
export declare function readStructuredConditionsApplied(markdown: string): string;
export declare function formatRuntimeConditionsApplied(spell: unknown): RuntimeConditionSummary;
