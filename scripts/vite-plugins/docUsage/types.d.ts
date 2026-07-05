export interface DocFacts {
    path: string;
    contentHash: string;
    wordCount: number;
    openTaskCount: number;
    supersededBy: string | null;
    outboundLinkTargets: string[];
    lifecycleStatus: string | null;
    mtimeMs: number;
}
export type RefKind = 'file' | 'dir' | 'data' | 'build';
export interface ReferenceIndex {
    fileRefs: Map<string, Set<string>>;
    basenameRefs: Map<string, Set<string>>;
    dirRefs: Array<{
        prefix: string;
        app: string;
    }>;
    dataRefs: Map<string, Set<string>>;
    buildRefs: Set<string>;
    diagnostics: {
        ambiguousRefs: string[];
        unresolvedRefs: string[];
    };
}
export interface Candidate {
    isCandidate: boolean;
    reasons: string[];
    confidence: 'authoritative' | 'high' | 'low' | 'none';
}
export interface DocUsageEntry {
    path: string;
    consumedBy: string[];
    consumedVia: RefKind | null;
    contentHash: string;
    duplicateGroupId: number | null;
    role: string | null;
    ageDays: number;
    gitAgeDays: number | null;
    wordCount: number;
    openTaskCount: number;
    inboundLinks: number;
    lifecycle: string | null;
    supersededBy: string | null;
    candidate: Candidate;
}
export interface DocUsagePayload {
    generatedAt: string;
    docs: DocUsageEntry[];
    diagnostics: {
        ambiguousRefs: string[];
        unresolvedRefs: string[];
        atlasMissing: boolean;
    };
}
