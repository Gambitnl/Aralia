/**
 * Doc-level validators for the glossary build gate.
 *
 * These run on the compiled content model (never on HTML) and port the
 * artifact detectors from the old scratch render audit
 * (.agent/scratch/glossary-render-audit.mjs). Every issue is a hard build
 * error — no grandfathered baseline (Remy, 2026-07-06).
 */

import type { Block, GlossaryDoc, InlineNode, ListItem } from '../contentModel';

export interface ValidationIssue {
  entryId: string;
  code: 'empty-doc' | 'leftover-markdown' | 'malformed-table' | 'dirty-token';
  message: string;
}

/** Markdown syntax that should never survive compilation into plain text. */
const LEFTOVER_PATTERNS: Array<[string, RegExp]> = [
  ['heading marker', /(?:^|\n)\s*#{1,6}\s+\S/],
  ['bold marker', /\*\*[^*\n]{1,80}\*\*/],
  ['link shorthand', /\[\[|\]\]|\{\{|\}\}|<g\s+t=/],
  ['markdown link', /\[[^\]\n]{1,60}\]\([^)\n]{1,120}\)/],
  ['table row', /(?:^|\n)\s*\|[^\n]*\|/],
  ['blockquote marker', /(?:^|\n)\s*>\s+\S/],
];

const DIRTY_TOKEN_PATTERNS: Array<[string, RegExp]> = [
  ['doubled colons', /:{2,}/],
];

/**
 * Data-first entries (races, magic items, lore) render from structured
 * fields, not markdown — zero compiled blocks is legitimate content there.
 */
export function hasStructuredContent(raw: Record<string, unknown>): boolean {
  const nonEmptyArray = (v: unknown) => Array.isArray(v) && v.length > 0;
  return (
    nonEmptyArray(raw.traits) ||
    nonEmptyArray(raw.characteristics) ||
    nonEmptyArray(raw.spellsOfTheMark) ||
    (typeof raw.entryLore === 'string' && raw.entryLore.trim().length > 0) ||
    (typeof raw.itemMetadata === 'object' && raw.itemMetadata !== null)
  );
}

export function validateDoc(doc: GlossaryDoc): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (countMeaningfulBlocks(doc.blocks) === 0) {
    issues.push({
      entryId: doc.id,
      code: 'empty-doc',
      message: 'entry compiles to zero meaningful blocks',
    });
  }

  for (const text of collectPlainText(doc.blocks)) {
    for (const [label, pattern] of LEFTOVER_PATTERNS) {
      if (pattern.test(text)) {
        issues.push({
          entryId: doc.id,
          code: 'leftover-markdown',
          message: `${label} in compiled text: "${text.slice(0, 60)}"`,
        });
      }
    }
    for (const [label, pattern] of DIRTY_TOKEN_PATTERNS) {
      if (pattern.test(text)) {
        issues.push({
          entryId: doc.id,
          code: 'dirty-token',
          message: `${label} in compiled text: "${text.slice(0, 60)}"`,
        });
      }
    }
  }

  visitTables(doc.blocks, (table) => {
    const width = table.header.length;
    if (width === 0 || table.header.every((cell) => cell.length === 0)) {
      issues.push({
        entryId: doc.id,
        code: 'malformed-table',
        message: 'table has an empty header',
      });
    }
    for (const row of table.rows) {
      if (row.length !== width) {
        issues.push({
          entryId: doc.id,
          code: 'malformed-table',
          message: `ragged table row: ${row.length} cells vs ${width} header cells`,
        });
        break;
      }
    }
  });

  return issues;
}

function countMeaningfulBlocks(blocks: Block[]): number {
  return blocks.filter((b) => b.kind !== 'divider').length;
}

function* collectPlainText(blocks: Block[]): Generator<string> {
  function* fromInline(nodes: InlineNode[]): Generator<string> {
    for (const node of nodes) {
      if (node.kind === 'text' && !node.marks?.includes('code')) yield node.text;
    }
  }
  function* fromItems(items: ListItem[]): Generator<string> {
    for (const item of items) {
      yield* fromInline(item.text);
      if (item.children) yield* fromItems(item.children);
    }
  }
  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
      case 'paragraph':
        yield* fromInline(block.text);
        break;
      case 'list':
        yield* fromItems(block.items);
        break;
      case 'table':
        for (const cell of block.header) yield* fromInline(cell);
        for (const row of block.rows) for (const cell of row) yield* fromInline(cell);
        break;
      case 'callout':
        yield* collectPlainText(block.blocks);
        break;
      case 'section':
        yield* fromInline(block.title);
        yield* collectPlainText(block.blocks);
        break;
      default:
        break;
    }
  }
}

function visitTables(
  blocks: Block[],
  visit: (table: Extract<Block, { kind: 'table' }>) => void,
): void {
  for (const block of blocks) {
    if (block.kind === 'table') visit(block);
    else if (block.kind === 'callout' || block.kind === 'section') {
      visitTables(block.blocks, visit);
    }
  }
}
