import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import type { AtlasConfig, DiscoveredDocument } from './types';
import { normalizeRepoPath, toRepoPath } from './pathUtils';

/**
 * Markdown discovery for Aralia Atlas.
 *
 * This scanner walks the target repository, finds durable `.md` files, extracts
 * a human title, and computes a content hash for change tracking. It skips
 * runtime folders so Atlas does not accidentally ingest its own reports or
 * throwaway agent artifacts.
 *
 * Called by: reconcileAtlas and CLI scan/reconcile commands
 * Depends on: AtlasConfig for target roots and ignored path rules
 */

// ============================================================================
// Ignore And Title Helpers
// ============================================================================
// This section keeps the crawler conservative. It excludes local/runtime folders
// early and uses the first Markdown heading as the human-facing document title.
// ============================================================================

function isIgnored(config: AtlasConfig, repoPath: string): boolean {
    const normalized = normalizeRepoPath(repoPath);
    return config.ignoredPathPrefixes.some((prefix) => normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix));
}

function extractTitle(content: string, filePath: string): string {
    const heading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line));
    if (heading) return heading.replace(/^#\s+/, '').trim();
    return path.basename(filePath, '.md').replace(/[-_]+/g, ' ');
}

function hashContent(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

// ============================================================================
// Recursive Markdown Walk
// ============================================================================
// This section performs a deterministic recursive walk so repeated scans emit
// documents in the same order, which keeps reports and tests easy to compare.
// ============================================================================

function walkMarkdown(config: AtlasConfig, currentDir: string, documents: DiscoveredDocument[]): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = toRepoPath(config.targetRoot, absolutePath);

        if (isIgnored(config, relativePath)) continue;

        if (entry.isDirectory()) {
            walkMarkdown(config, absolutePath, documents);
            continue;
        }

        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const stats = fs.statSync(absolutePath);
        documents.push({
            absolutePath,
            relativePath: normalizeRepoPath(relativePath),
            title: extractTitle(content, absolutePath),
            content,
            contentHash: hashContent(content),
            lastChangedAt: stats.mtime.toISOString(),
        });
    }
}

export function discoverMarkdownDocuments(config: AtlasConfig): DiscoveredDocument[] {
    if (!fs.existsSync(config.targetRoot)) {
        throw new Error(`Atlas target does not exist: ${config.targetRoot}`);
    }

    const documents: DiscoveredDocument[] = [];
    walkMarkdown(config, config.targetRoot, documents);
    return documents;
}
