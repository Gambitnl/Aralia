type MismatchKind = 'value-mismatch' | 'missing-structured-field' | 'missing-json-field' | 'json-parse-failed';
export interface StructuredJsonMismatch {
    id: string;
    groupKey: string;
    mismatchKind: MismatchKind;
    spellId: string;
    spellName: string;
    markdownPath: string;
    jsonPath: string;
    field: string;
    structuredValue: string;
    jsonValue: string;
    summary: string;
}
interface GroupedMismatch {
    groupKey: string;
    field: string;
    mismatchKind: MismatchKind;
    count: number;
    spellIds: string[];
    sampleSpellIds: string[];
    sampleSummaries: string[];
}
export interface StructuredVsJsonReport {
    generatedAt: string;
    scannedMarkdownFiles: number;
    comparedSpellFiles: number;
    mismatchCount: number;
    mismatches: StructuredJsonMismatch[];
    groupedMismatches: GroupedMismatch[];
}
interface AuditOptions {
    spellId?: string;
}
export declare function buildReport(options?: AuditOptions): StructuredVsJsonReport;
export {};
