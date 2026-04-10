type MismatchKind = 'value-mismatch' | 'missing-structured-field' | 'missing-canonical-field';
interface ComparisonMismatch {
    id: string;
    groupKey: string;
    mismatchKind: MismatchKind;
    spellId: string;
    spellName: string;
    markdownPath: string;
    field: string;
    structuredValue: string;
    canonicalValue: string;
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
interface StructuredVsCanonicalReport {
    generatedAt: string;
    scannedMarkdownFiles: number;
    comparedSpellFiles: number;
    mismatchCount: number;
    mismatches: ComparisonMismatch[];
    groupedMismatches: GroupedMismatch[];
}
interface AuditOptions {
    spellId?: string;
}
export declare function buildReport(options?: AuditOptions): StructuredVsCanonicalReport;
export {};
