import fs from 'fs';
import path from 'path';

import { classifyDocument } from './classifier';
import { discoverMarkdownDocuments } from './discovery';
import { createAtlasStore } from './store';
import type { AtlasConfig, AtlasExport, ReconcileResult, StoredPlan } from './types';

/**
 * Aralia Atlas reconciliation pipeline.
 *
 * A reconciliation pass scans Markdown, classifies each document, stores the
 * Knowledge Tree in SQLite, and emits readable reports/exports. It deliberately
 * writes only under atlasRoot so the target repo's source docs stay read-only.
 *
 * Called by: CLI commands, Codex automation, and tests
 * Depends on: discovery, deterministic classifier, and SQLite store modules
 */

// ============================================================================
// Export Writers
// ============================================================================
// This section turns the SQLite source of truth into JSON files that humans,
// dashboards, and future agents can inspect without running SQL.
// ============================================================================

function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function exportPaths(config: AtlasConfig): { knowledgeTree: string; planHealth: string } {
    return {
        knowledgeTree: path.join(config.atlasRoot, 'exports', 'knowledge-tree.json'),
        planHealth: path.join(config.atlasRoot, 'exports', 'plan-health.json'),
    };
}

export function exportAtlasState(config: AtlasConfig): AtlasExport {
    const store = createAtlasStore(config);
    try {
        const exported = store.exportState();
        const paths = exportPaths(config);
        writeJson(paths.knowledgeTree, exported);
        writeJson(paths.planHealth, {
            generatedAt: exported.generatedAt,
            plans: exported.plans,
        });
        return exported;
    } finally {
        store.close();
    }
}

// ============================================================================
// Report Rendering
// ============================================================================
// This section writes the nightly human report. It keeps the report short enough
// for an agent wrap-up while still surfacing stale and active plan files.
// ============================================================================

function planLine(plan: StoredPlan): string {
    return `- ${plan.planStatus}: ${plan.relativePath}`;
}

function writeReport(config: AtlasConfig, exported: AtlasExport, runId: number): string {
    const day = config.now.slice(0, 10);
    const reportPath = path.join(config.atlasRoot, 'reports', `${day}-reconciliation.md`);
    const activePlans = exported.plans.filter((plan) => plan.planStatus !== 'done' && plan.planStatus !== 'superseded');
    const stalePlans = exported.plans.filter((plan) => plan.staleState === 'stale_review_needed');

    const lines = [
        `# Aralia Atlas Reconciliation - ${day}`,
        '',
        `Run: ${runId}`,
        `Generated: ${exported.generatedAt}`,
        `Documents indexed: ${exported.documents.length}`,
        `Knowledge branches: ${exported.branches.length}`,
        `Attachments: ${exported.attachments.length}`,
        `Plans tracked: ${exported.plans.length}`,
        '',
        '## Active Plan Health',
        '',
        ...(activePlans.length ? activePlans.map(planLine) : ['- No active plan files found.']),
        '',
        '## Stale Review Needed',
        '',
        ...(stalePlans.length ? stalePlans.map(planLine) : ['- No stale plan files flagged in this pass.']),
        '',
        '## Read-Only Boundary',
        '',
        `Atlas wrote runtime state under ${config.atlasRoot}. It did not edit target Markdown files.`,
        '',
    ];

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    return reportPath;
}

// ============================================================================
// Reconciliation Entry Point
// ============================================================================
// This section coordinates one scan/store/export/report pass and returns the
// key paths that the CLI and automation can summarize.
// ============================================================================

export function reconcileAtlas(config: AtlasConfig, options: { trigger: string }): ReconcileResult {
    const store = createAtlasStore(config);
    store.beginBulkWrite();
    const runId = store.startRun(options.trigger);
    let attachmentsWritten = 0;
    let plansWritten = 0;
    let committed = false;

    try {
        const documents = discoverMarkdownDocuments(config);

        for (const document of documents) {
            const classification = classifyDocument(document);
            const documentId = store.upsertDocument(document, classification);

            const primaryBranchId = store.upsertBranch(classification.primaryBranch);
            store.upsertAttachment(documentId, primaryBranchId, 'primary', classification);
            attachmentsWritten += 1;

            for (const branch of classification.secondaryBranches) {
                const branchId = store.upsertBranch(branch);
                store.upsertAttachment(documentId, branchId, 'secondary', classification);
                attachmentsWritten += 1;
            }

            if (classification.planStatus) {
                store.upsertPlan(documentId, classification.planStatus);
                plansWritten += 1;
            }
        }

        store.finishRun(runId, `Indexed ${documents.length} Markdown documents.`);
        store.commitBulkWrite();
        committed = true;
    } catch (error) {
        if (!committed) {
            store.rollbackBulkWrite();
        }
        throw error;
    } finally {
        store.close();
    }

    const exported = exportAtlasState(config);
    const paths = exportPaths(config);
    const reportPath = writeReport(config, exported, runId);

    return {
        runId,
        documentsSeen: exported.documents.length,
        attachmentsWritten,
        plansWritten,
        reportPath,
        knowledgeTreeExportPath: paths.knowledgeTree,
        planHealthExportPath: paths.planHealth,
    };
}
