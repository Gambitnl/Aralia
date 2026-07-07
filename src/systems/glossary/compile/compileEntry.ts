/**
 * Build-time compiler: one glossary entry's markdown → typed GlossaryDoc.
 *
 * Runs only in the build pipeline (glossary:rebuild), never at render time.
 * Strict by design: anything it cannot map to the content model is returned
 * as a CompileError, not silently passed through.
 */

import { Lexer, type Token, type Tokens } from 'marked';
import type {
  Block,
  GlossaryDoc,
  InlineNode,
  ListItem,
  Mark,
  TermRef,
} from '../contentModel';

export interface CompileInput {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  markdown: string;
}

export interface CompileError {
  entryId: string;
  code:
    | 'unknown-block'
    | 'unknown-inline'
    | 'unresolved-term'
    | 'raw-html';
  message: string;
}

export interface ResolveContext {
  /** Resolve a term token (snake_case id or alias) to a renderable target, or null. */
  resolve(token: string): TermRef | null;
}

/**
 * Term-link shorthands are extracted BEFORE lexing and replaced with
 * private-use sentinels: a literal `|` inside `[[id|display]]` would
 * otherwise split GFM table cells, and `<g t="…">` would lex as raw HTML.
 */
interface PendingLink {
  token: string;
  display?: string;
}

const SENTINEL_OPEN = '';
const SENTINEL_CLOSE = '';
const SENTINEL_RE = /(\d+)/g;

function extractShorthands(markdown: string): {
  markdown: string;
  links: PendingLink[];
} {
  const links: PendingLink[] = [];
  const stash = (token: string, display?: string) => {
    links.push({ token: token.trim(), display: display?.trim() || undefined });
    return `${SENTINEL_OPEN}${links.length - 1}${SENTINEL_CLOSE}`;
  };
  const out = markdown
    .replace(/<g\s+t="([^"]+)"(?:\s+c="[^"]*")?>(.*?)<\/g>/g, (_, t, d) =>
      stash(t, d),
    )
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, d) => stash(t, d))
    .replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (_, t, d) => stash(t, d));
  return { markdown: out, links };
}

/** `calligrapher_s_supplies` → `Calligrapher's Supplies` (mirrors the legacy renderer). */
function titleCaseFromId(id: string): string {
  return id
    .replace(/_s_/g, "'s_")
    .replace(/_s$/g, "'s")
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/'S\b/g, "'s");
}

interface CompileState {
  input: CompileInput;
  ctx: ResolveContext;
  errors: CompileError[];
  links: PendingLink[];
}

export function compileEntry(
  input: CompileInput,
  ctx: ResolveContext,
): { doc: GlossaryDoc; errors: CompileError[] } {
  const errors: CompileError[] = [];
  const { markdown, links } = extractShorthands(input.markdown);
  const tokens = new Lexer({ gfm: true }).lex(markdown);
  const blocks = compileBlocks(tokens, { input, ctx, errors, links });

  return {
    doc: {
      id: input.id,
      title: input.title,
      category: input.category,
      excerpt: input.excerpt,
      blocks,
      schemaVersion: 1,
    },
    errors,
  };
}

function compileBlocks(tokens: Token[], state: CompileState): Block[] {
  const blocks: Block[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
        break;
      case 'heading': {
        const heading = token as Tokens.Heading;
        if (heading.depth === 1) break; // entry title is data, not content
        const level = Math.min(Math.max(heading.depth, 2), 4) as 2 | 3 | 4;
        const text = compileInline(heading.tokens ?? [], state);
        blocks.push({ kind: 'heading', level, text, anchorId: anchorIdOf(text) });
        break;
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph;
        const text = compileInline(paragraph.tokens ?? [], state);
        if (text.length > 0) blocks.push({ kind: 'paragraph', text });
        break;
      }
      case 'hr':
        blocks.push({ kind: 'divider' });
        break;
      case 'table': {
        const table = token as Tokens.Table;
        blocks.push({
          kind: 'table',
          header: table.header.map((cell) => compileInline(cell.tokens, state)),
          rows: table.rows.map((row) =>
            row.map((cell) => compileInline(cell.tokens, state)),
          ),
        });
        break;
      }
      case 'list':
        blocks.push(compileList(token as Tokens.List, state));
        break;
      case 'blockquote': {
        const quote = token as Tokens.Blockquote;
        blocks.push({
          kind: 'callout',
          variant: 'note',
          blocks: compileBlocks(quote.tokens, state),
        });
        break;
      }
      case 'html':
        state.errors.push({
          entryId: state.input.id,
          code: 'raw-html',
          message: `raw HTML block: ${String((token as Tokens.HTML).raw).slice(0, 60)}`,
        });
        break;
      default:
        state.errors.push({
          entryId: state.input.id,
          code: 'unknown-block',
          message: `unmapped block token "${token.type}"`,
        });
    }
  }
  return groupSections(blocks);
}

function compileList(list: Tokens.List, state: CompileState): Block {
  const items = list.items.map((item) => compileListItem(item, state));
  return { kind: 'list', ordered: !!list.ordered, items };
}

function compileListItem(
  item: Tokens.ListItem,
  state: CompileState,
): ListItem {
  const text: InlineNode[] = [];
  let children: ListItem[] | undefined;
  for (const token of item.tokens) {
    if (token.type === 'list') {
      const nested = compileList(token as Tokens.List, state);
      if (nested.kind === 'list') {
        children = [...(children ?? []), ...nested.items];
      }
    } else if (token.type === 'text' || token.type === 'paragraph') {
      const t = token as Tokens.Text | Tokens.Paragraph;
      text.push(...compileInline(t.tokens ?? [], state));
    } else if (token.type !== 'space') {
      state.errors.push({
        entryId: state.input.id,
        code: 'unknown-block',
        message: `unmapped list-item token "${token.type}"`,
      });
    }
  }
  return children ? { text, children } : { text };
}

/**
 * H3 headings become collapsible section blocks (the legacy renderer's
 * <details> feature cards, decided structurally instead of by DOM surgery).
 * A section swallows everything until the next H2/H3 heading.
 */
function groupSections(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let current: { kind: 'section' } & Extract<Block, { kind: 'section' }> | null =
    null;
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 3) {
      current = {
        kind: 'section',
        title: block.text,
        defaultOpen: false,
        blocks: [],
      };
      out.push(current);
    } else if (block.kind === 'heading' && block.level === 2) {
      current = null;
      out.push(block);
    } else if (current) {
      current.blocks.push(block);
    } else {
      out.push(block);
    }
  }
  return out;
}

function compileInline(
  tokens: Token[],
  state: CompileState,
  activeMarks: Mark[] = [],
): InlineNode[] {
  const nodes: InlineNode[] = [];
  const withMarks = (node: InlineNode): InlineNode =>
    activeMarks.length > 0 && (node.kind === 'text' || node.kind === 'termLink')
      ? { ...node, marks: [...activeMarks, ...(node.marks ?? [])] }
      : node;

  /** Split raw text on link sentinels and emit text/termLink nodes. */
  const pushTextWithLinks = (raw: string) => {
    let last = 0;
    SENTINEL_RE.lastIndex = 0;
    for (const m of raw.matchAll(SENTINEL_RE)) {
      const before = raw.slice(last, m.index);
      if (before) nodes.push(withMarks({ kind: 'text', text: before }));
      nodes.push(withMarks(resolvePendingLink(Number(m[1]), state)));
      last = (m.index ?? 0) + m[0].length;
    }
    const rest = raw.slice(last);
    if (rest) nodes.push(withMarks({ kind: 'text', text: rest }));
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const t = token as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          nodes.push(...compileInline(t.tokens, state, activeMarks));
        } else {
          pushTextWithLinks(t.text);
        }
        break;
      }
      case 'escape':
        pushTextWithLinks((token as Tokens.Escape).text);
        break;
      case 'strong':
        nodes.push(
          ...compileInline((token as Tokens.Strong).tokens, state, [
            ...activeMarks,
            'bold',
          ]),
        );
        break;
      case 'em':
        nodes.push(
          ...compileInline((token as Tokens.Em).tokens, state, [
            ...activeMarks,
            'italic',
          ]),
        );
        break;
      case 'codespan': {
        const text = (token as Tokens.Codespan).text;
        nodes.push({ kind: 'text', text, marks: [...activeMarks, 'code'] });
        break;
      }
      case 'br':
        pushTextWithLinks('\n');
        break;
      case 'link': {
        const link = token as Tokens.Link;
        nodes.push({ kind: 'extLink', href: link.href, text: link.text });
        break;
      }
      default:
        state.errors.push({
          entryId: state.input.id,
          code: 'unknown-inline',
          message: `unmapped inline token "${token.type}"`,
        });
    }
  }
  return nodes;
}

/** Turn a stashed shorthand back into a termLink, or plain text + error if unresolvable. */
function resolvePendingLink(index: number, state: CompileState): InlineNode {
  const pending = state.links[index];
  const ref = state.ctx.resolve(pending.token);
  const display = pending.display ?? titleCaseFromId(pending.token);
  if (!ref) {
    state.errors.push({
      entryId: state.input.id,
      code: 'unresolved-term',
      message: `term "${pending.token}" does not resolve to renderable content`,
    });
    return { kind: 'text', text: display };
  }
  return { kind: 'termLink', ref, display };
}

function anchorIdOf(text: InlineNode[]): string {
  return text
    .map((n) => (n.kind === 'extLink' ? n.text : n.kind === 'termLink' ? n.display : n.text))
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
