import path from 'path';

/**
 * Path helpers for Aralia Atlas.
 *
 * Atlas runs on Windows but stores document identity in slash-separated repo
 * paths. Keeping this conversion centralized prevents duplicate rows such as
 * `docs\\foo.md` and `docs/foo.md` from representing the same document.
 *
 * Called by: scanner, classifier, store, and report code
 * Depends on: Node path utilities only
 */

// ============================================================================
// Repository Path Normalization
// ============================================================================
// This section converts absolute filesystem paths into stable relative paths for
// database keys and generated Knowledge Tree exports.
// ============================================================================

export function toRepoPath(targetRoot: string, absolutePath: string): string {
    return path.relative(targetRoot, absolutePath).replaceAll(path.sep, '/');
}

export function normalizeRepoPath(repoPath: string): string {
    return repoPath.replaceAll('\\', '/').replace(/^\/+/, '');
}

export function titleFromSlug(slug: string): string {
    return slug
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
