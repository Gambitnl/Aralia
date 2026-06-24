import { describe, expect, it } from 'vitest';

import { buildAtlasViewModel } from '../atlasViewModel';

/**
 * These tests protect the browser-facing Atlas view model.
 *
 * The Atlas database and exports are machine-oriented. The visual explorer needs
 * branch cards, document rows, plan counts, and selected-branch details that a
 * person can scan without reading raw JSON. These tests use tiny fixture exports
 * so the UI can stay deterministic even when the real nightly export changes.
 *
 * Called by: Vitest
 * Depends on: atlasViewModel.ts for transforming Atlas export JSON into UI state
 */

// ============================================================================
// Knowledge Tree Fixtures
// ============================================================================
// This section keeps the test export small while still covering primary links,
// secondary links, and plan health attached to the same branch.
// ============================================================================

const FIXTURE_EXPORT = {
    generatedAt: '2026-06-23T01:00:00.000Z',
    branches: [
        { id: 1, name: 'Worldforge', parentId: null, branchType: 'knowledge_branch', source: 'test' },
        { id: 2, name: 'Town', parentId: null, branchType: 'knowledge_branch', source: 'test' },
    ],
    documents: [
        {
            id: 10,
            repoName: 'Aralia',
            relativePath: 'docs/projects/worldforge/NORTH_STAR.md',
            absolutePath: 'F:/Repos/Aralia/docs/projects/worldforge/NORTH_STAR.md',
            title: 'Worldforge',
            docRole: 'north_star',
            contentHash: 'a',
            firstSeenAt: '2026-06-23T00:00:00.000Z',
            lastSeenAt: '2026-06-23T01:00:00.000Z',
            lastChangedAt: '2026-06-23T00:00:00.000Z',
            araliaFacingState: 'aralia_facing',
        },
        {
            id: 11,
            repoName: 'Aralia',
            relativePath: 'docs/superpowers/plans/2026-06-23-worldforge-plan.md',
            absolutePath: 'F:/Repos/Aralia/docs/superpowers/plans/2026-06-23-worldforge-plan.md',
            title: 'Worldforge plan',
            docRole: 'plan',
            contentHash: 'b',
            firstSeenAt: '2026-06-23T00:00:00.000Z',
            lastSeenAt: '2026-06-23T01:00:00.000Z',
            lastChangedAt: '2026-06-23T00:00:00.000Z',
            araliaFacingState: 'aralia_facing',
        },
    ],
    attachments: [
        { documentId: 10, branchId: 1, relationshipType: 'primary', confidence: 0.9, reason: 'North Star path.', reviewedState: 'unreviewed' },
        { documentId: 11, branchId: 1, relationshipType: 'primary', confidence: 0.8, reason: 'Plan path.', reviewedState: 'unreviewed' },
        { documentId: 11, branchId: 2, relationshipType: 'secondary', confidence: 0.8, reason: 'Mentions town.', reviewedState: 'unreviewed' },
    ],
    plans: [
        {
            documentId: 11,
            relativePath: 'docs/superpowers/plans/2026-06-23-worldforge-plan.md',
            title: 'Worldforge plan',
            planStatus: 'active',
            staleState: 'current',
            supersededBy: null,
            completionEvidence: null,
            lastReviewedAt: null,
        },
    ],
};

// ============================================================================
// View Model Behavior
// ============================================================================
// This section proves the visual explorer can show branch-level health and the
// selected branch's attached documents without re-querying the raw export.
// ============================================================================

describe('buildAtlasViewModel', () => {
    it('groups attached documents and plan health by Knowledge Tree branch', () => {
        const model = buildAtlasViewModel(FIXTURE_EXPORT);

        expect(model.summary).toMatchObject({
            branchCount: 2,
            documentCount: 2,
            attachmentCount: 3,
            planCount: 1,
            activePlanCount: 1,
        });
        expect(model.branches[0]).toMatchObject({
            name: 'Worldforge',
            documentCount: 2,
            planCount: 1,
            activePlanCount: 1,
            unreviewedCount: 2,
        });
        expect(model.selectedBranch?.documents.map((doc) => doc.relativePath)).toEqual([
            'docs/projects/worldforge/NORTH_STAR.md',
            'docs/superpowers/plans/2026-06-23-worldforge-plan.md',
        ]);
        expect(model.branches.find((branch) => branch.name === 'Town')).toMatchObject({
            documentCount: 1,
            secondaryCount: 1,
        });
    });
});
