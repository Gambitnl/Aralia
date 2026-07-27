/**
 * Cross-reference graph builder. Emitted at build time as
 * public/data/glossary_graph.json; powers bidirectional "Referenced By",
 * keeps grouping nodes unclickable, and is the query surface for the
 * future live game-state rules layer.
 */
import type { GlossaryDoc } from '../contentModel';
import { type BundleEntryLike } from './resolve';
export interface TermRefWithSource {
    id: string;
    via: 'inline' | 'seeAlso' | 'spellRule';
}
export interface GlossaryGraph {
    nodes: Record<string, {
        title: string;
        category: string;
        renderable: boolean;
        isGroupingNode: boolean;
    }>;
    outbound: Record<string, TermRefWithSource[]>;
    inbound: Record<string, TermRefWithSource[]>;
}
export interface BuildGraphInput {
    bundle: BundleEntryLike[];
    docs: GlossaryDoc[];
    /** ruleId → spellIds that reference it (from the spell enrichment data). */
    spellRuleRefs?: Record<string, string[]>;
}
export declare function buildGraph(input: BuildGraphInput): GlossaryGraph;
