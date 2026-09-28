export interface DocUsage {
    path: string;
    consumedBy: string[];
    consumedVia: 'file' | 'dir' | 'data' | 'build' | null;
    duplicateGroupId: number | null;
    role: string | null;
    ageDays: number;
    gitAgeDays: number | null;
    wordCount: number;
    openTaskCount: number;
    inboundLinks: number;
    lifecycle: string | null;
    supersededBy: string | null;
    candidate: {
        isCandidate: boolean;
        reasons: string[];
        confidence: 'authoritative' | 'high' | 'low' | 'none';
    };
}
export interface DocUsageResponse {
    generatedAt: string;
    docs: DocUsage[];
    diagnostics: {
        ambiguousRefs: string[];
        unresolvedRefs: string[];
        atlasMissing: boolean;
    };
}
export declare function indexByPath(docs: DocUsage[]): Record<string, DocUsage>;
export declare function fetchDocUsage(refresh?: boolean): Promise<DocUsageResponse>;
