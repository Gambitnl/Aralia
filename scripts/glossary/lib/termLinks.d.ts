/**
 * Shared, resolve-aware term-link helpers used by both the PHB ingest
 * (scripts/ingestPhbGlossary.ts) and the legacy-markup codemod
 * (scripts/glossary/fix-legacy-entry-markup.ts).
 *
 * The glossary compiler (src/systems/glossary/compile/compileEntry.ts) treats
 * any `[[id|display]]` whose id doesn't resolve as an error. These helpers let
 * the build pipeline emit links that always resolve — repairing echo-corrupted
 * ids, rewriting underscore spell ids to their real hyphenated form, and
 * unlinking anything with no target to plain text (content preserved).
 */
export declare const normalizeToken: (t: string) => string;
/**
 * Build the set of resolvable term ids the way the runtime resolver does, but
 * from the on-disk source of truth so it works during the build (before the
 * glossary bundle exists):
 *   - every entry JSON under public/data/glossary/entries/** with a filePath
 *     contributes its id and its normalized aliases;
 *   - every spell in public/data/spells_manifest.json that has a spell JSON
 *     file contributes its (hyphenated) id and normalized aliases.
 */
export declare function buildResolvableIdSet(root: string): Set<string>;
/**
 * Repair an echo-corrupted token: `hit_points Points` -> `hit_points`,
 * `artisan_s_tools's Tools` -> `artisan_s_tools`, `saving_throw throw` ->
 * `saving_throw`. Cuts at the first space (the tail is an echoed display
 * fragment, never part of the id) and strips a trailing apostrophe echo.
 */
export declare function repairToken(token: string): string;
export interface TermLinkEmitter {
    /** True if `token` (as-is or normalized) resolves to renderable content. */
    resolves(token: string): boolean;
    /**
     * Emit `[[id|display]]` for a resolving link, or plain display text if the
     * token cannot be resolved by any repair. Never drops the display text.
     */
    emit(token: string, display: string): string;
}
export declare function makeEmitter(resolvableIds: Set<string>): TermLinkEmitter;
/**
 * Rewrite all term-link shorthand already present in a markdown string —
 * `[[id]]`, `[[id|display]]`, `{{id}}`, and `<g t="id">display</g>` — through
 * the emitter, so unresolvable/corrupted links are repaired or unlinked.
 * Idempotent.
 */
export declare function repairMarkdownLinks(md: string, emitter: TermLinkEmitter): string;
/**
 * Filter a seeAlso token array to resolvable targets, repairing echo-corrupted
 * tokens first. Unresolvable tokens are dropped (they'd render as dead links).
 */
export declare function repairSeeAlso(seeAlso: string[], emitter: TermLinkEmitter): string[];
