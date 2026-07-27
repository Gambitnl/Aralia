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
export declare function toRepoPath(targetRoot: string, absolutePath: string): string;
export declare function normalizeRepoPath(repoPath: string): string;
export declare function titleFromSlug(slug: string): string;
