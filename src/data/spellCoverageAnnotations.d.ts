export interface CoverageAnnotation {
    bucket: string;
    byDesign?: {
        canonicalAudit?: boolean;
        structuredJsonAudit?: boolean;
        parityScript?: boolean;
    };
    note?: string;
}
export declare const COVERAGE_ANNOTATIONS: Record<string, CoverageAnnotation>;
export declare function bucketForField(field: string): string;
