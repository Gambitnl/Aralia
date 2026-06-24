/**
 * Shared Aralia Atlas types.
 *
 * Aralia Atlas maps Markdown documents onto the game's Knowledge Tree. These
 * types keep the scanner, classifier, SQLite store, reports, and exports using
 * the same vocabulary so future agents do not invent parallel status names.
 *
 * Called by: every script under scripts/atlas
 * Depends on: no runtime modules; this file is the shared contract
 */

// ============================================================================
// Configuration Types
// ============================================================================
// This section describes the target repository and the Atlas-owned runtime
// folder. V1 treats the target as read-only and writes database/report/export
// files only under atlasRoot.
// ============================================================================

export interface AtlasConfig {
    repoName: string;
    targetRoot: string;
    atlasRoot: string;
    trackedDocRoots: string[];
    ignoredPathPrefixes: string[];
    planPathPatterns: RegExp[];
    now: string;
}

export interface AtlasConfigInput {
    target?: string;
    atlasRoot?: string;
    now?: string;
}

// ============================================================================
// Document And Classification Types
// ============================================================================
// This section names the facts Atlas stores for each Markdown file and the
// deterministic classification result that attaches a file to the Knowledge Tree.
// ============================================================================

export type DocRole =
    | 'architecture'
    | 'decision'
    | 'gap'
    | 'handoff'
    | 'north_star'
    | 'plan'
    | 'process'
    | 'proof'
    | 'reference'
    | 'runbook'
    | 'tracker';

export type PlanStatus =
    | 'proposed'
    | 'approved'
    | 'active'
    | 'partially_done'
    | 'done'
    | 'superseded'
    | 'blocked'
    | 'stale_review_needed';

export type ReviewedState = 'unreviewed' | 'reviewed' | 'ignored';

export interface DiscoveredDocument {
    absolutePath: string;
    relativePath: string;
    title: string;
    content: string;
    contentHash: string;
    lastChangedAt: string;
}

export interface DocumentClassification {
    primaryBranch: string;
    secondaryBranches: string[];
    docRole: DocRole;
    planStatus: PlanStatus | null;
    confidence: number;
    reason: string;
    reviewedState: ReviewedState;
}

// ============================================================================
// Stored And Exported Types
// ============================================================================
// This section describes the records that leave the live scan path and become
// durable SQLite rows or readable export JSON.
// ============================================================================

export interface StoredDocument {
    id: number;
    repoName: string;
    relativePath: string;
    absolutePath: string;
    title: string;
    docRole: DocRole;
    contentHash: string;
    firstSeenAt: string;
    lastSeenAt: string;
    lastChangedAt: string;
    araliaFacingState: 'aralia_facing' | 'local_process' | 'runtime_artifact';
}

export interface StoredPlan {
    documentId: number;
    relativePath: string;
    title: string;
    planStatus: PlanStatus;
    staleState: 'current' | 'stale_review_needed';
    supersededBy: string | null;
    completionEvidence: string | null;
    lastReviewedAt: string | null;
}

export interface ReconcileResult {
    runId: number;
    documentsSeen: number;
    attachmentsWritten: number;
    plansWritten: number;
    reportPath: string;
    knowledgeTreeExportPath: string;
    planHealthExportPath: string;
}

export interface AtlasExport {
    generatedAt: string;
    documents: StoredDocument[];
    branches: Array<{ id: number; name: string; parentId: number | null; branchType: string; source: string }>;
    attachments: Array<{ documentId: number; branchId: number; relationshipType: string; confidence: number; reason: string; reviewedState: ReviewedState }>;
    plans: StoredPlan[];
}
