import type { FidelityData, GateResult, SpellGateArtifactEntry, StructuredCanonicalMismatchRecord, StructuredCanonicalReportFile, StructuredJsonMismatchRecord, StructuredJsonReportFile } from "../spellGateDataTypes";
export declare function buildBucketDetailsForSpell(spellId: string, fetchedSpell: unknown, overrideRows?: StructuredCanonicalMismatchRecord[], overrideJsonRows?: StructuredJsonMismatchRecord[]): GateResult["bucketDetails"];
interface BuildGateResultParams {
    spellId: string;
    level: number;
    jsonPath: string;
    knownGaps: Set<string>;
    spellFidelity?: FidelityData["spells"][string];
    artifactEntry?: SpellGateArtifactEntry;
    fetchedSpell: unknown;
    schemaIssues?: string[];
    overrideRows?: StructuredCanonicalMismatchRecord[];
    overrideJsonRows?: StructuredJsonMismatchRecord[];
    isLegacySpell?: boolean;
}
export declare function buildGateResultForSpell({ spellId, level, jsonPath, knownGaps, spellFidelity, artifactEntry, fetchedSpell, schemaIssues, overrideRows, overrideJsonRows, isLegacySpell, }: BuildGateResultParams): GateResult;
export declare function configureStructuredReportIndexes(structuredCanonicalReport: StructuredCanonicalReportFile, structuredJsonReport: StructuredJsonReportFile): void;
export {};
