type IssueSeverity = 'error' | 'warning';
type IssueSource = 'template-parity' | 'structured-markdown' | 'runtime-json';
export interface TemplateField {
    label?: string;
    pattern?: string;
    path?: string;
    structuredLabel?: string | null;
    structuredPattern?: string;
    structuredLabels?: string[];
    required?: boolean;
    valueType?: string;
    acceptedValues?: string[];
    acceptedValuesFrom?: string;
    acceptedValuesBySuffix?: Record<string, string[]>;
    jsonPath?: string;
    runtimeOnly?: boolean;
    status?: string;
    acceptedValueParity?: 'exact' | 'runtime_subset_ok';
    log?: Array<{
        at: string;
        action: string;
        why: string;
    }>;
}
export interface TemplateContract {
    schemaVersion: number;
    templateKind: string;
    fields: TemplateField[];
}
export interface ValidationIssue {
    severity: IssueSeverity;
    source: IssueSource;
    code: string;
    filePath: string;
    field: string;
    message: string;
    actualValue?: string;
    expectedValue?: string;
}
export declare function validateTemplateParity(structuredTemplate: TemplateContract, jsonTemplate: TemplateContract, issues: ValidationIssue[]): void;
export {};
