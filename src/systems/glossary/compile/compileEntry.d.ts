/**
 * Build-time compiler: one glossary entry's markdown → typed GlossaryDoc.
 *
 * Runs only in the build pipeline (glossary:rebuild), never at render time.
 * Strict by design: anything it cannot map to the content model is returned
 * as a CompileError, not silently passed through.
 */
import type { GlossaryDoc, TermRef } from '../contentModel';
export interface CompileInput {
    id: string;
    title: string;
    category: string;
    excerpt: string;
    markdown: string;
}
export interface CompileError {
    entryId: string;
    code: 'unknown-block' | 'unknown-inline' | 'unresolved-term' | 'raw-html';
    message: string;
}
export interface ResolveContext {
    /** Resolve a term token (snake_case id or alias) to a renderable target, or null. */
    resolve(token: string): TermRef | null;
}
export declare function compileEntry(input: CompileInput, ctx: ResolveContext): {
    doc: GlossaryDoc;
    errors: CompileError[];
};
