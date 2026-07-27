/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { FidelityData, SpellGateArtifact, SpellManifestEntry, StructuredCanonicalReportFile, StructuredJsonReportFile } from "./spellGateDataTypes";
export declare function fetchSpellGateBootstrap(): Promise<{
    manifest: Record<string, SpellManifestEntry>;
    fidelity: FidelityData;
    gateArtifact: SpellGateArtifact;
    knownGaps: Set<string>;
    structuredCanonicalReport: StructuredCanonicalReportFile;
    structuredJsonReport: StructuredJsonReportFile;
}>;
