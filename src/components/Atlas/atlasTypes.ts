/**
 * Browser-side data contracts for the Aralia Atlas explorer.
 *
 * The nightly Atlas job writes a machine-readable Knowledge Tree export. These
 * types mirror only the fields the browser needs so the visual explorer can show
 * branches, attached documents, and plan health without depending on SQLite.
 *
 * Called by: AtlasExplorer.tsx and atlasViewModel.ts
 * Depends on: generated `.agent/atlas/exports/knowledge-tree.json` shape
 */

// ============================================================================
// Raw Export Types
// ============================================================================
// This section names the JSON fields produced by the Atlas reconciliation
// command. The UI treats this export as read-only evidence from the last run.
// ============================================================================

export interface AtlasRawDocument {
  id: number;
  repoName: string;
  relativePath: string;
  absolutePath: string;
  title: string;
  docRole: string;
  contentHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt: string;
  araliaFacingState: string;
}

export interface AtlasRawBranch {
  id: number;
  name: string;
  parentId: number | null;
  branchType: string;
  source: string;
}

export interface AtlasRawAttachment {
  documentId: number;
  branchId: number;
  relationshipType: string;
  confidence: number;
  reason: string;
  reviewedState: string;
}

export interface AtlasRawPlan {
  documentId: number;
  relativePath: string;
  title: string;
  planStatus: string;
  staleState: string;
  supersededBy: string | null;
  completionEvidence: string | null;
  lastReviewedAt: string | null;
}

export interface AtlasRawExport {
  generatedAt: string;
  documents: AtlasRawDocument[];
  branches: AtlasRawBranch[];
  attachments: AtlasRawAttachment[];
  plans: AtlasRawPlan[];
}

export interface AtlasBacklogCandidate {
  path: string;
  score: number;
  reasons: string[];
}

export interface AtlasBacklogRecentActivity {
  path: string;
  walkState: string;
  exists: boolean;
  kind: string;
  modifiedUtc: string | null;
  sha256: string | null;
}

export interface AtlasBacklogRetirementExport {
  available: boolean;
  generatedAt?: string;
  message?: string;
  snapshot?: {
    generatedAtUtc: string;
    ledgerPath: string;
    summary: {
      total: number;
      file?: number;
      missing?: number;
      glob?: number;
      not_file?: number;
    };
  };
  markerSummary?: {
    totalMarkdown: number;
    markedMarkdown: number;
    missingMarkdown: number;
  };
  recentActivity?: AtlasBacklogRecentActivity[];
  candidates?: {
    candidateCount: number;
    files: AtlasBacklogCandidate[];
  };
}

// ============================================================================
// View Model Types
// ============================================================================
// This section describes the browser-ready shape after raw Atlas records are
// grouped by Knowledge Tree branch.
// ============================================================================

export interface AtlasDocumentRow extends AtlasRawDocument {
  relationshipType: string;
  confidence: number;
  reason: string;
  reviewedState: string;
  planStatus: string | null;
  staleState: string | null;
}

export interface AtlasBranchCard {
  id: number;
  name: string;
  documentCount: number;
  planCount: number;
  activePlanCount: number;
  stalePlanCount: number;
  unreviewedCount: number;
  primaryCount: number;
  secondaryCount: number;
}

export interface AtlasBranchDetail extends AtlasBranchCard {
  documents: AtlasDocumentRow[];
}

export interface AtlasViewModel {
  generatedAt: string;
  summary: {
    branchCount: number;
    documentCount: number;
    attachmentCount: number;
    planCount: number;
    activePlanCount: number;
    stalePlanCount: number;
    unreviewedCount: number;
  };
  branches: AtlasBranchCard[];
  selectedBranch: AtlasBranchDetail | null;
}
