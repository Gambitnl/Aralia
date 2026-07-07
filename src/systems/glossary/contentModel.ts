/**
 * Typed content model for glossary entries.
 *
 * Produced once at build time by the glossary compiler
 * (src/systems/glossary/compile/) and consumed by the block renderer.
 * No raw markdown or HTML strings exist in this model — if content needs a
 * new visual, it gets a new block kind, never an escape hatch.
 *
 * Spec: docs/superpowers/specs/2026-07-06-glossary-structured-content-design.md
 */

export interface GlossaryDoc {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  blocks: Block[];
  schemaVersion: 1;
}

export type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: InlineNode[]; anchorId: string }
  | { kind: 'paragraph'; text: InlineNode[] }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | {
      kind: 'table';
      caption?: string;
      header: InlineNode[][];
      rows: InlineNode[][][];
    }
  | { kind: 'callout'; variant: CalloutVariant; blocks: Block[] }
  | {
      kind: 'section';
      title: InlineNode[];
      defaultOpen: boolean;
      blocks: Block[];
    }
  | { kind: 'divider' }
  | { kind: 'referencedBy'; source: 'spells' | 'entries'; refs: TermRef[] };

export type CalloutVariant = 'note' | 'rule' | 'warning';

export interface ListItem {
  text: InlineNode[];
  children?: ListItem[];
}

export type InlineNode =
  | { kind: 'text'; text: string; marks?: Mark[] }
  | { kind: 'termLink'; ref: TermRef; display: string; marks?: Mark[] }
  | { kind: 'extLink'; href: string; text: string };

export type Mark = 'bold' | 'italic' | 'code';

/** A resolved cross-reference. The compiler guarantees the id exists and is renderable. */
export interface TermRef {
  id: string;
  kind: 'entry' | 'spell';
}
