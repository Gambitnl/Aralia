import path from 'path';

import type { AtlasConfig, AtlasConfigInput } from './types';

/**
 * Loads the Aralia Atlas runtime configuration.
 *
 * Atlas is intentionally local-first: it indexes Markdown inside a target repo
 * but writes its own database, reports, and exports under `.agent/atlas`. Keeping
 * that boundary in one config object protects the v1 read-only promise.
 *
 * Called by: CLI, tests, and reconciliation scripts
 * Depends on: Node path utilities only
 */

// ============================================================================
// Default Repository Rules
// ============================================================================
// This section defines which Markdown surfaces are meaningful for v1 and which
// local/runtime folders are skipped so generated state does not classify itself.
// ============================================================================

const DEFAULT_TRACKED_DOC_ROOTS = ['docs', 'scripts', '.'];

const DEFAULT_IGNORED_PREFIXES = [
    '.agent/',
    '.agent_tools/',
    '.claude/',
    '.codex/',
    '.cursor/',
    '.gemini/',
    '.git/',
    '.jules/',
    '.symphony/',
    '.superpowers/',
    '.local/',
    '.tmp/',
    '.worktrees/',
    'node_modules/',
    'dist/',
    'docs-site-dist/',
    'output/',
    'public/agent-docs/',
    'verification/',
    'test-results/',
];

const DEFAULT_PLAN_PATTERNS = [
    /(^|\/)plans\//i,
    /(^|\/)superpowers\/plans\//i,
    /(^|\/)PLAN[^/]*\.md$/i,
    /(^|\/).*plan.*\.md$/i,
];

// ============================================================================
// Public Config Loader
// ============================================================================
// This section resolves native Windows paths into absolute paths while leaving
// Atlas's internal document paths normalized separately in the scanner.
// ============================================================================

export function loadAtlasConfig(input: AtlasConfigInput = {}): AtlasConfig {
    const targetRoot = path.resolve(input.target ?? process.cwd());
    const atlasRoot = path.resolve(input.atlasRoot ?? path.join(targetRoot, '.agent', 'atlas'));

    return {
        repoName: path.basename(targetRoot) || 'Aralia',
        targetRoot,
        atlasRoot,
        trackedDocRoots: DEFAULT_TRACKED_DOC_ROOTS,
        ignoredPathPrefixes: DEFAULT_IGNORED_PREFIXES,
        planPathPatterns: DEFAULT_PLAN_PATTERNS,
        now: input.now ?? new Date().toISOString(),
    };
}
