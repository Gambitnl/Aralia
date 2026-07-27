import type { AtlasConfig, AtlasExport, DocumentClassification, DiscoveredDocument, PlanStatus, StoredDocument } from './types';
export declare class AtlasStore {
    private readonly config;
    private readonly db;
    constructor(config: AtlasConfig);
    private initialize;
    beginBulkWrite(): void;
    commitBulkWrite(): void;
    rollbackBulkWrite(): void;
    startRun(trigger: string): number;
    finishRun(runId: number, summary: string): void;
    upsertBranch(name: string, branchType?: string, source?: string): number;
    upsertDocument(document: DiscoveredDocument, classification: DocumentClassification): number;
    upsertAttachment(documentId: number, branchId: number, relationshipType: 'primary' | 'secondary', classification: DocumentClassification): void;
    upsertPlan(documentId: number, planStatus: PlanStatus): void;
    getDocumentByRelativePath(relativePath: string): StoredDocument | null;
    exportState(): AtlasExport;
    close(): void;
}
export declare function createAtlasStore(config: AtlasConfig): AtlasStore;
