import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { loadAtlasConfig } from '../atlas/config';
import { classifyDocument } from '../atlas/classifier';
import { discoverMarkdownDocuments } from '../atlas/discovery';
import { exportAtlasState, reconcileAtlas } from '../atlas/reconcile';
import { createAtlasStore } from '../atlas/store';

/**
 * These tests protect Aralia Atlas, the local Knowledge Tree tool that maps
 * Markdown files to the in-game systems and project branches they describe.
 *
 * The tests build tiny throwaway repositories instead of touching the real
 * Aralia worktree. That proves the scanner and database behavior while keeping
 * the v1 read-only promise: Atlas may inspect a target repo, but its runtime
 * database, reports, and exports stay under the configured `.agent/atlas`
 * workspace.
 *
 * Called by: Vitest
 * Depends on: scripts/atlas modules for config loading, scanning, classification,
 * SQLite persistence, reconciliation, and export rendering
 */

const TEMP_DIRS: string[] = [];

// ============================================================================
// Temporary Repository Helpers
// ============================================================================
// This section builds small fake repo folders because Atlas works from real file
// paths, content hashes, and Markdown files. Each test gets isolated input files
// and cleanup removes them after the test finishes.
// ============================================================================

function makeTempRepo(): string {
    const repoPath = path.join(os.tmpdir(), `aralia-atlas-${randomUUID()}`);
    fs.mkdirSync(repoPath, { recursive: true });
    TEMP_DIRS.push(repoPath);
    return repoPath;
}

function makeTempRuntime(): string {
    const runtimePath = path.join(os.tmpdir(), `aralia-atlas-runtime-${randomUUID()}`);
    fs.mkdirSync(runtimePath, { recursive: true });
    TEMP_DIRS.push(runtimePath);
    return runtimePath;
}

function writeFile(repoPath: string, relativePath: string, content: string): string {
    const absolutePath = path.join(repoPath, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf-8');
    return absolutePath;
}

afterEach(() => {
    for (const dirPath of TEMP_DIRS.splice(0)) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
});

// ============================================================================
// Markdown Discovery
// ============================================================================
// This section proves that Atlas finds durable Markdown docs, skips local/runtime
// folders, normalizes paths, and computes stable hashes for change detection.
// ============================================================================

describe('Aralia Atlas markdown discovery', () => {
    it('finds markdown files under tracked roots while ignoring runtime folders', () => {
        const repoPath = makeTempRepo();
        writeFile(repoPath, 'docs/projects/worldforge/NORTH_STAR.md', '# Worldforge\n\nOwns the living world.');
        writeFile(repoPath, 'docs/projects/worldforge/notes.txt', 'not markdown');
        writeFile(repoPath, '.agent/scratch/proof.md', '# Scratch proof');
        writeFile(repoPath, '.agent_tools/AGENT_README.md', '# Local tool instructions');
        writeFile(repoPath, '.cursor/commands/todo-finder.md', '# Cursor command');
        writeFile(repoPath, '.gemini/extensions/conductor/README.md', '# Gemini extension');
        writeFile(repoPath, '.worktrees/matrix-copy/docs/projects/worldforge/NORTH_STAR.md', '# Duplicate worktree proof');
        writeFile(repoPath, '.tmp/generated/docs/plans/temp-plan.md', '# Temporary generated plan');

        const config = loadAtlasConfig({ target: repoPath });
        const documents = discoverMarkdownDocuments(config);

        expect(documents).toHaveLength(1);
        expect(documents[0]).toMatchObject({
            relativePath: 'docs/projects/worldforge/NORTH_STAR.md',
            title: 'Worldforge',
        });
        expect(documents[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    });
});

// ============================================================================
// Document Classification
// ============================================================================
// This section proves the deterministic v1 classifier attaches docs to Aralia
// branches without requiring a local model. Ollama/Gemma can be added later as a
// proposal source, but Codex-owned deterministic rules must still produce a safe
// baseline result.
// ============================================================================

describe('Aralia Atlas document classification', () => {
    it('classifies project North Star documents by their project branch', () => {
        const classification = classifyDocument({
            relativePath: 'docs/projects/worldforge/NORTH_STAR.md',
            title: 'Worldforge',
            content: '# Worldforge\n\n## Current Mission\nBuild cartography.',
            contentHash: 'hash',
            absolutePath: 'unused',
            lastChangedAt: '2026-06-23T00:00:00.000Z',
        });

        expect(classification.primaryBranch).toBe('Worldforge');
        expect(classification.docRole).toBe('north_star');
        expect(classification.planStatus).toBeNull();
        expect(classification.reviewedState).toBe('unreviewed');
    });

    it('keeps active plan files open unless explicit completion evidence exists', () => {
        const classification = classifyDocument({
            relativePath: 'docs/superpowers/plans/2026-06-23-worldforge-plan.md',
            title: 'Worldforge plan',
            content: '# Plan\n\n- [x] Create fixture\n- [ ] Verify in app\n',
            contentHash: 'hash',
            absolutePath: 'unused',
            lastChangedAt: '2026-06-23T00:00:00.000Z',
        });

        expect(classification.docRole).toBe('plan');
        expect(classification.planStatus).toBe('partially_done');
        expect(classification.reason).toContain('checked and unchecked');
    });
});

// ============================================================================
// Reconciliation, Persistence, And Read-Only Safety
// ============================================================================
// This section proves a full Atlas pass writes only Atlas-owned files, records the
// Knowledge Tree in SQLite, and generates human-readable report/export artifacts.
// ============================================================================

describe('Aralia Atlas reconciliation', () => {
    it('records documents, attachments, plan health, exports, and reports without writing into the target repo', () => {
        const repoPath = makeTempRepo();
        writeFile(repoPath, 'docs/projects/worldforge/NORTH_STAR.md', '# Worldforge\n');
        writeFile(repoPath, 'docs/superpowers/plans/2026-06-23-worldforge-plan.md', '# Plan\n\n- [ ] Verify branch links\n');

        const targetBefore = new Set(
            fs.readdirSync(repoPath, { recursive: true }).map((entry) => String(entry).replaceAll('\\', '/')),
        );
        const config = loadAtlasConfig({
            target: repoPath,
            atlasRoot: makeTempRuntime(),
            now: '2026-06-23T01:00:00.000Z',
        });

        const result = reconcileAtlas(config, { trigger: 'test' });
        const exported = exportAtlasState(config);
        const targetAfter = new Set(
            fs.readdirSync(repoPath, { recursive: true }).map((entry) => String(entry).replaceAll('\\', '/')),
        );

        expect(result.documentsSeen).toBe(2);
        expect(result.attachmentsWritten).toBeGreaterThanOrEqual(2);
        expect(result.reportPath).toMatch(/2026-06-23-reconciliation\.md$/);
        expect(fs.existsSync(path.join(config.atlasRoot, 'atlas.sqlite'))).toBe(true);
        expect(fs.existsSync(path.join(config.atlasRoot, 'exports', 'knowledge-tree.json'))).toBe(true);
        expect(fs.existsSync(path.join(config.atlasRoot, 'exports', 'plan-health.json'))).toBe(true);
        expect(exported.documents.map((doc) => doc.relativePath)).toContain('docs/projects/worldforge/NORTH_STAR.md');
        expect(exported.plans).toContainEqual(expect.objectContaining({ planStatus: 'active' }));
        expect(targetAfter).toEqual(targetBefore);
    });

    it('updates a changed document hash on the next reconciliation run', () => {
        const repoPath = makeTempRepo();
        const docPath = writeFile(repoPath, 'docs/projects/town/NORTH_STAR.md', '# Town\n\nFirst text.');
        const config = loadAtlasConfig({
            target: repoPath,
            atlasRoot: makeTempRuntime(),
            now: '2026-06-23T01:00:00.000Z',
        });

        reconcileAtlas(config, { trigger: 'test' });
        const store = createAtlasStore(config);
        const first = store.getDocumentByRelativePath('docs/projects/town/NORTH_STAR.md');

        fs.writeFileSync(docPath, '# Town\n\nChanged text.', 'utf-8');
        reconcileAtlas({ ...config, now: '2026-06-23T01:05:00.000Z' }, { trigger: 'test' });
        const second = store.getDocumentByRelativePath('docs/projects/town/NORTH_STAR.md');
        store.close();

        expect(first?.contentHash).toBeTruthy();
        expect(second?.contentHash).toBeTruthy();
        expect(second?.contentHash).not.toBe(first?.contentHash);
    });
});
