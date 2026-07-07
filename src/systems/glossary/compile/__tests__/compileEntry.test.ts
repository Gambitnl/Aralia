import { describe, expect, it } from 'vitest';
import { compileEntry, type ResolveContext } from '../compileEntry';
import type {
  Block,
  InlineNode,
} from '../../contentModel';

/** Resolve context where every listed id resolves as a renderable entry. */
function ctxWith(ids: string[]): ResolveContext {
  const set = new Set(ids);
  return {
    resolve: (token) =>
      set.has(token) ? { id: token, kind: 'entry' } : null,
  };
}

const EMPTY_CTX = ctxWith([]);

function compile(markdown: string, ctx: ResolveContext = EMPTY_CTX) {
  return compileEntry(
    {
      id: 'test_entry',
      title: 'Test Entry',
      category: 'Rules Glossary',
      excerpt: 'A test entry.',
      markdown,
    },
    ctx,
  );
}

function textOf(nodes: InlineNode[]): string {
  return nodes
    .map((n) => (n.kind === 'termLink' ? n.display : n.kind === 'extLink' ? n.text : n.text))
    .join('');
}

describe('compileEntry: blocks', () => {
  it('compiles a paragraph into a paragraph block', () => {
    const { doc, errors } = compile('Just a plain sentence.');
    expect(errors).toEqual([]);
    expect(doc.blocks).toHaveLength(1);
    const block = doc.blocks[0];
    expect(block.kind).toBe('paragraph');
    if (block.kind === 'paragraph') {
      expect(textOf(block.text)).toBe('Just a plain sentence.');
    }
  });

  it('strips the leading H1 (entry title is data, not content)', () => {
    const { doc } = compile('# Test Entry\nBody text.');
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].kind).toBe('paragraph');
  });

  it('compiles H2 headings with a stable anchor id', () => {
    const { doc } = compile('## Saving Throws\nText.');
    const heading = doc.blocks[0];
    expect(heading.kind).toBe('heading');
    if (heading.kind === 'heading') {
      expect(heading.level).toBe(2);
      expect(textOf(heading.text)).toBe('Saving Throws');
      expect(heading.anchorId).toBe('saving-throws');
    }
  });

  it('compiles a thematic break into a divider block', () => {
    const { doc } = compile('Before.\n\n---\n\nAfter.');
    expect(doc.blocks.map((b: Block) => b.kind)).toEqual([
      'paragraph',
      'divider',
      'paragraph',
    ]);
  });
});

describe('compileEntry: inline marks', () => {
  it('carries bold, italic, and code marks on text nodes', () => {
    const { doc } = compile('A **bold** and *soft* and `coded` word.');
    const block = doc.blocks[0];
    expect(block.kind).toBe('paragraph');
    if (block.kind !== 'paragraph') return;
    const bold = block.text.find(
      (n) => n.kind === 'text' && n.text === 'bold',
    );
    const italic = block.text.find(
      (n) => n.kind === 'text' && n.text === 'soft',
    );
    const code = block.text.find(
      (n) => n.kind === 'text' && n.text === 'coded',
    );
    expect(bold && bold.kind === 'text' ? bold.marks : []).toContain('bold');
    expect(italic && italic.kind === 'text' ? italic.marks : []).toContain('italic');
    expect(code && code.kind === 'text' ? code.marks : []).toContain('code');
  });
});

describe('compileEntry: term links', () => {
  it('compiles [[term_id]] into a resolved termLink with title-cased display', () => {
    const { doc, errors } = compile('Gain the [[rage]] feature.', ctxWith(['rage']));
    expect(errors).toEqual([]);
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    const link = block.text.find((n) => n.kind === 'termLink');
    expect(link).toMatchObject({
      kind: 'termLink',
      ref: { id: 'rage', kind: 'entry' },
      display: 'Rage',
    });
    expect(textOf(block.text)).toBe('Gain the Rage feature.');
  });

  it('honors explicit display text in [[term_id|Display]] and {{term_id|Display}}', () => {
    const { doc } = compile(
      'See [[unarmed_strike|unarmed strikes]] and {{grappled_condition|Grappled}}.',
      ctxWith(['unarmed_strike', 'grappled_condition']),
    );
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    const links = block.text.filter((n) => n.kind === 'termLink');
    expect(links.map((l) => (l.kind === 'termLink' ? l.display : ''))).toEqual([
      'unarmed strikes',
      'Grappled',
    ]);
  });

  it('compiles <g t="term_id">Display</g> into a termLink', () => {
    const { doc, errors } = compile(
      'You are <g t="prone_condition">Prone</g> now.',
      ctxWith(['prone_condition']),
    );
    expect(errors).toEqual([]);
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    const link = block.text.find((n) => n.kind === 'termLink');
    expect(link).toMatchObject({
      kind: 'termLink',
      ref: { id: 'prone_condition', kind: 'entry' },
      display: 'Prone',
    });
  });

  it("title-cases possessive ids: [[calligrapher_s_supplies]] → Calligrapher's Supplies", () => {
    const { doc } = compile('[[calligrapher_s_supplies]]', ctxWith(['calligrapher_s_supplies']));
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    expect(textOf(block.text)).toBe("Calligrapher's Supplies");
  });

  it('reports an unresolved-term error and keeps plain text when the target does not resolve', () => {
    const { doc, errors } = compile('Use [[nonexistent_thing]] here.', EMPTY_CTX);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'unresolved-term', entryId: 'test_entry' });
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    expect(block.text.every((n) => n.kind !== 'termLink')).toBe(true);
    expect(textOf(block.text)).toBe('Use Nonexistent Thing here.');
  });

  it('reports corrupted tokens like [[magic_initiate Initiate]] as unresolved (source must be fixed)', () => {
    const { errors } = compile('Take [[magic_initiate Initiate]].', ctxWith(['magic_initiate']));
    expect(errors.some((e) => e.code === 'unresolved-term')).toBe(true);
  });

  it('term links inside bold keep the bold mark', () => {
    const { doc } = compile('**See [[rage]] now.**', ctxWith(['rage']));
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    const link = block.text.find((n) => n.kind === 'termLink');
    expect(link && link.kind === 'termLink' ? link.marks : []).toContain('bold');
  });
});

describe('compileEntry: tables, lists, sections', () => {
  it('compiles a GFM table with term links inside cells', () => {
    const md = [
      '| Level | Benefit |',
      '| --- | --- |',
      '| 1 | Gain [[rage]] |',
      '| 2 | Nothing |',
    ].join('\n');
    const { doc, errors } = compile(md, ctxWith(['rage']));
    expect(errors).toEqual([]);
    const table = doc.blocks[0];
    expect(table.kind).toBe('table');
    if (table.kind !== 'table') return;
    expect(table.header.map(textOf)).toEqual(['Level', 'Benefit']);
    expect(table.rows).toHaveLength(2);
    expect(textOf(table.rows[0][1])).toBe('Gain Rage');
    const cellLink = table.rows[0][1].find((n) => n.kind === 'termLink');
    expect(cellLink).toMatchObject({ ref: { id: 'rage' } });
  });

  it('compiles nested lists', () => {
    const md = ['- top one', '  - child one', '  - child two', '- top two'].join('\n');
    const { doc, errors } = compile(md);
    expect(errors).toEqual([]);
    const list = doc.blocks[0];
    expect(list.kind).toBe('list');
    if (list.kind !== 'list') return;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(textOf(list.items[0].text)).toBe('top one');
    expect(list.items[0].children?.map((c) => textOf(c.text))).toEqual([
      'child one',
      'child two',
    ]);
  });

  it('compiles an ordered list', () => {
    const { doc } = compile('1. first\n2. second');
    const list = doc.blocks[0];
    if (list.kind !== 'list') throw new Error('expected list');
    expect(list.ordered).toBe(true);
  });

  it('groups content under an H3 into a collapsible section block', () => {
    const md = ['## Overview', 'Intro text.', '### Rage', 'Rage body.', '### Reckless Attack', 'Body two.'].join('\n\n');
    const { doc, errors } = compile(md);
    expect(errors).toEqual([]);
    expect(doc.blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'section', 'section']);
    const section = doc.blocks[2];
    if (section.kind !== 'section') throw new Error('expected section');
    expect(textOf(section.title)).toBe('Rage');
    expect(section.blocks).toHaveLength(1);
    expect(section.blocks[0].kind).toBe('paragraph');
  });

  it('compiles a blockquote into a note callout', () => {
    const { doc } = compile('> A quoted aside.');
    const callout = doc.blocks[0];
    expect(callout.kind).toBe('callout');
    if (callout.kind !== 'callout') return;
    expect(callout.variant).toBe('note');
    expect(callout.blocks[0].kind).toBe('paragraph');
  });

  it('compiles markdown links into extLink nodes', () => {
    const { doc, errors } = compile('See [the SRD](https://example.com/srd).');
    expect(errors).toEqual([]);
    const block = doc.blocks[0];
    if (block.kind !== 'paragraph') throw new Error('expected paragraph');
    const link = block.text.find((n) => n.kind === 'extLink');
    expect(link).toMatchObject({ kind: 'extLink', href: 'https://example.com/srd', text: 'the SRD' });
  });

  it('reports raw HTML blocks as errors instead of passing them through', () => {
    const { errors } = compile('<div class="weird">markup</div>');
    expect(errors.some((e) => e.code === 'raw-html')).toBe(true);
  });
});
