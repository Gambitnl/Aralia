/**
 * Doc-level validators for the glossary build gate.
 *
 * These run on the compiled content model (never on HTML) and port the
 * artifact detectors from the old scratch render audit
 * (.agent/scratch/glossary-render-audit.mjs). Every issue is a hard build
 * error — no grandfathered baseline (Remy, 2026-07-06).
 */
import type { GlossaryDoc } from '../contentModel';
export interface ValidationIssue {
    entryId: string;
    code: 'empty-doc' | 'leftover-markdown' | 'malformed-table' | 'dirty-token';
    message: string;
}
/**
 * Data-first entries (races, magic items, lore) render from structured
 * fields, not markdown — zero compiled blocks is legitimate content there.
 */
export declare function hasStructuredContent(raw: Record<string, unknown>): boolean;
export declare function validateDoc(doc: GlossaryDoc): ValidationIssue[];
