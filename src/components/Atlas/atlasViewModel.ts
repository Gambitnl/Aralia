import type {
  AtlasBranchCard,
  AtlasBranchDetail,
  AtlasDocumentRow,
  AtlasRawExport,
  AtlasRawPlan,
  AtlasViewModel,
} from './atlasTypes';

/**
 * Builds the browser-ready Knowledge Tree view model.
 *
 * Atlas exports raw documents, branches, attachments, and plans as separate
 * tables because that mirrors the SQLite database. The explorer needs a more
 * human shape: each branch should show counts, plan health, unreviewed links,
 * and the document rows attached to it.
 *
 * Called by: AtlasExplorer.tsx and atlasViewModel tests
 * Depends on: atlasTypes.ts for the raw and visual data contracts
 */

// ============================================================================
// Plan And Count Helpers
// ============================================================================
// This section keeps plan-health math consistent across summary cards and branch
// cards. A plan is considered active unless Atlas has closed or superseded it.
// ============================================================================

const CLOSED_PLAN_STATUSES = new Set(['done', 'superseded']);

function isActivePlan(plan: AtlasRawPlan | undefined): boolean {
  return !!plan && !CLOSED_PLAN_STATUSES.has(plan.planStatus);
}

function sortBranches(left: AtlasBranchCard, right: AtlasBranchCard): number {
  return right.documentCount - left.documentCount || left.name.localeCompare(right.name);
}

// ============================================================================
// Public View-Model Builder
// ============================================================================
// This section joins attachments to documents and plans so the visual explorer
// can render one selected branch without repeating lookup logic in React.
// ============================================================================

export function buildAtlasViewModel(raw: AtlasRawExport, selectedBranchId?: number): AtlasViewModel {
  const documentsById = new Map(raw.documents.map((document) => [document.id, document]));
  const plansByDocumentId = new Map(raw.plans.map((plan) => [plan.documentId, plan]));

  const branchDetails: AtlasBranchDetail[] = raw.branches.map((branch) => {
    const attachedRows: AtlasDocumentRow[] = raw.attachments
      .filter((attachment) => attachment.branchId === branch.id)
      .map((attachment) => {
        const document = documentsById.get(attachment.documentId);
        if (!document) return null;

        const plan = plansByDocumentId.get(document.id);
        return {
          ...document,
          relationshipType: attachment.relationshipType,
          confidence: attachment.confidence,
          reason: attachment.reason,
          reviewedState: attachment.reviewedState,
          planStatus: plan?.planStatus ?? null,
          staleState: plan?.staleState ?? null,
        };
      })
      .filter((row): row is AtlasDocumentRow => !!row)
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    const planRows = attachedRows.filter((row) => row.planStatus);
    const activePlanRows = attachedRows.filter((row) => isActivePlan(plansByDocumentId.get(row.id)));

    return {
      id: branch.id,
      name: branch.name,
      documents: attachedRows,
      documentCount: attachedRows.length,
      planCount: planRows.length,
      activePlanCount: activePlanRows.length,
      stalePlanCount: attachedRows.filter((row) => row.staleState === 'stale_review_needed').length,
      unreviewedCount: attachedRows.filter((row) => row.reviewedState === 'unreviewed').length,
      primaryCount: attachedRows.filter((row) => row.relationshipType === 'primary').length,
      secondaryCount: attachedRows.filter((row) => row.relationshipType === 'secondary').length,
    };
  });

  const branches = branchDetails.map(({ documents: _documents, ...branch }) => branch).sort(sortBranches);
  const selectedId = selectedBranchId ?? branches[0]?.id;
  const selectedBranch = branchDetails.find((branch) => branch.id === selectedId) ?? branchDetails[0] ?? null;

  return {
    generatedAt: raw.generatedAt,
    summary: {
      branchCount: raw.branches.length,
      documentCount: raw.documents.length,
      attachmentCount: raw.attachments.length,
      planCount: raw.plans.length,
      activePlanCount: raw.plans.filter(isActivePlan).length,
      stalePlanCount: raw.plans.filter((plan) => plan.staleState === 'stale_review_needed').length,
      unreviewedCount: raw.attachments.filter((attachment) => attachment.reviewedState === 'unreviewed').length,
    },
    branches,
    selectedBranch,
  };
}
