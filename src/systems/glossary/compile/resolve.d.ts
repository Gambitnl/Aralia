/**
 * Term resolution for the glossary compiler: id/alias → renderable target.
 * Mirrors the loadability rule the legacy renderer used (spells need
 * hasSpellJson, everything else needs a filePath); grouping/container
 * nodes never resolve.
 */
import type { ResolveContext } from './compileEntry';
export interface BundleEntryLike {
    id: string;
    title: string;
    category: string;
    aliases?: string[];
    seeAlso?: string[];
    filePath?: string;
    hasSpellJson?: boolean;
    subEntries?: BundleEntryLike[];
}
export declare function isRenderable(entry: BundleEntryLike): boolean;
export declare function buildResolveContext(bundle: BundleEntryLike[]): ResolveContext;
