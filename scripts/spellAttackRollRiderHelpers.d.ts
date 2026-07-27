/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: manual addition; the dependency sync tool skips scripts.
 * Dependents: scripts/generateSpellGateReport.ts, src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, src/components/Glossary/spellGateChecker/spellGateDataTypes.ts, src/components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Shared helpers for comparing spell attack-roll rider rows against runtime
 * spell JSON.
 *
 * Why this exists:
 * the gate checker needs one consistent way to read the structured rider lines
 * in the markdown block and one consistent way to read the live runtime rider
 * effects. Keeping that logic here avoids making the audit script, the gate
 * report generator, and the glossary panel each invent their own slightly
 * different rider parsing rules.
 */
export declare function normalizeAttackRollText(value: string): string;
export declare function normalizeAttackRollComparisonValue(value: string): string;
export interface RuntimeAttackRollRiderSummary {
    value: string;
    riders: string[];
}
export declare function readStructuredAttackRollRiders(markdown: string): RuntimeAttackRollRiderSummary;
export declare function formatRuntimeAttackRollRiders(spell: unknown): RuntimeAttackRollRiderSummary;
