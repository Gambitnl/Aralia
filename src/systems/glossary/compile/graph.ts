/**
 * Cross-reference graph builder. Emitted at build time as
 * public/data/glossary_graph.json; powers bidirectional "Referenced By",
 * keeps grouping nodes unclickable, and is the query surface for the
 * future live game-state rules layer.
 */

import type { Block, GlossaryDoc, InlineNode } from '../contentModel';
import { isRenderable, type BundleEntryLike } from './resolve';

export interface TermRefWithSource {
  id: string;
  via: 'inline' | 'seeAlso' | 'spellRule';
}

export interface GlossaryGraph {
  nodes: Record<
    string,
    {
      title: string;
      category: string;
      renderable: boolean;
      isGroupingNode: boolean;
    }
  >;
  outbound: Record<string, TermRefWithSource[]>;
  inbound: Record<string, TermRefWithSource[]>;
}

export interface BuildGraphInput {
  bundle: BundleEntryLike[];
  docs: GlossaryDoc[];
  /** ruleId → spellIds that reference it (from the spell enrichment data). */
  spellRuleRefs?: Record<string, string[]>;
}

export function buildGraph(input: BuildGraphInput): GlossaryGraph {
  const graph: GlossaryGraph = { nodes: {}, outbound: {}, inbound: {} };

  const walk = (entries: BundleEntryLike[]) => {
    for (const entry of entries) {
      graph.nodes[entry.id] = {
        title: entry.title,
        category: entry.category,
        renderable: isRenderable(entry),
        isGroupingNode: !isRenderable(entry) && (entry.subEntries?.length ?? 0) > 0,
      };
      if (entry.subEntries) walk(entry.subEntries);
    }
  };
  walk(input.bundle);

  const addEdge = (from: string, to: string, via: TermRefWithSource['via']) => {
    const out = (graph.outbound[from] ??= []);
    if (!out.some((e) => e.id === to && e.via === via)) out.push({ id: to, via });
    const inn = (graph.inbound[to] ??= []);
    if (!inn.some((e) => e.id === from && e.via === via)) inn.push({ id: from, via });
  };

  for (const doc of input.docs) {
    for (const targetId of collectTermLinkIds(doc.blocks)) {
      addEdge(doc.id, targetId, 'inline');
    }
  }

  const walkSeeAlso = (entries: BundleEntryLike[]) => {
    for (const entry of entries) {
      for (const target of entry.seeAlso ?? []) {
        addEdge(entry.id, target, 'seeAlso');
      }
      if (entry.subEntries) walkSeeAlso(entry.subEntries);
    }
  };
  walkSeeAlso(input.bundle);

  for (const [ruleId, spellIds] of Object.entries(input.spellRuleRefs ?? {})) {
    for (const spellId of spellIds) {
      addEdge(spellId, ruleId, 'spellRule');
    }
  }

  return graph;
}

function collectTermLinkIds(blocks: Block[]): Set<string> {
  const ids = new Set<string>();
  const visitInline = (nodes: InlineNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'termLink') ids.add(node.ref.id);
    }
  };
  const visitBlocks = (list: Block[]) => {
    for (const block of list) {
      switch (block.kind) {
        case 'heading':
        case 'paragraph':
          visitInline(block.text);
          break;
        case 'list': {
          const visitItems = (items: typeof block.items) => {
            for (const item of items) {
              visitInline(item.text);
              if (item.children) visitItems(item.children);
            }
          };
          visitItems(block.items);
          break;
        }
        case 'table':
          block.header.forEach(visitInline);
          block.rows.forEach((row) => row.forEach(visitInline));
          break;
        case 'callout':
          visitBlocks(block.blocks);
          break;
        case 'section':
          visitInline(block.title);
          visitBlocks(block.blocks);
          break;
        default:
          break;
      }
    }
  };
  visitBlocks(blocks);
  return ids;
}
