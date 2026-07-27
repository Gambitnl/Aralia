type TemplateSeverity = 'error' | 'warning';
interface TemplateIssue {
    severity: TemplateSeverity;
    code: string;
    spellId: string;
    spellName: string;
    source: 'structured-markdown' | 'runtime-json' | 'structured-vs-json';
    fieldPath: string;
    message: string;
    actualValue: string;
    expectedValue: string;
    filePath: string;
}
interface IssueGroup {
    code: string;
    severity: TemplateSeverity;
    source: TemplateIssue['source'];
    fieldPath: string;
    count: number;
    sampleSpellIds: string[];
    sampleMessages: string[];
}
interface TemplateAuditReport {
    generatedAt: string;
    spellCount: number;
    issueCount: number;
    errorCount: number;
    warningCount: number;
    groupedIssues: IssueGroup[];
    issues: TemplateIssue[];
}
export declare function buildReport(): TemplateAuditReport;
export {};
