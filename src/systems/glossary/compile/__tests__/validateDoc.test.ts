import { describe, expect, it } from 'vitest';
import { validateDoc } from '../validate';
import type { GlossaryDoc, Block } from '../../contentModel';

function docWith(blocks: Block[]): GlossaryDoc {
  return {
    id: 'test_entry',
    title: 'Test Entry',
    category: 'Rules Glossary',
    excerpt: '',
    schemaVersion: 1,
    blocks,
  };
}

describe('validateDoc', () => {
  it('passes a healthy doc', () => {
    const issues = validateDoc(
      docWith([
        { kind: 'paragraph', text: [{ kind: 'text', text: 'All good here.' }] },
      ]),
    );
    expect(issues).toEqual([]);
  });

  it('flags a content-less doc', () => {
    expect(validateDoc(docWith([]))).toContainEqual(
      expect.objectContaining({ code: 'empty-doc', entryId: 'test_entry' }),
    );
  });

  it('flags leftover markdown artifacts in text nodes', () => {
    const issues = validateDoc(
      docWith([
        {
          kind: 'paragraph',
          text: [{ kind: 'text', text: 'Broken **bold and [[leftover_token]] here.' }],
        },
      ]),
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('leftover-markdown');
  });

  it('flags a table with a ragged row', () => {
    const issues = validateDoc(
      docWith([
        {
          kind: 'table',
          header: [[{ kind: 'text', text: 'A' }], [{ kind: 'text', text: 'B' }]],
          rows: [[[{ kind: 'text', text: 'only one cell' }]]],
        },
      ]),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'malformed-table' }),
    );
  });

  it('flags a table with an entirely empty header', () => {
    const issues = validateDoc(
      docWith([
        {
          kind: 'table',
          header: [[], []],
          rows: [[[{ kind: 'text', text: 'x' }], [{ kind: 'text', text: 'y' }]]],
        },
      ]),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'malformed-table' }),
    );
  });

  it('flags doubled colons as dirty tokens', () => {
    const issues = validateDoc(
      docWith([
        { kind: 'paragraph', text: [{ kind: 'text', text: 'Feat:: something' }] },
      ]),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'dirty-token' }),
    );
  });
});

describe('hasStructuredContent', () => {
  it('treats entries with data-first fields as content even with no markdown', async () => {
    const { hasStructuredContent } = await import('../validate');
    expect(hasStructuredContent({ traits: [{ name: 'Darkvision' }] })).toBe(true);
    expect(hasStructuredContent({ characteristics: [{ k: 'v' }] })).toBe(true);
    expect(hasStructuredContent({ entryLore: 'Some lore.' })).toBe(true);
    expect(hasStructuredContent({ itemMetadata: { type: 'Ring' } })).toBe(true);
    expect(hasStructuredContent({ spellsOfTheMark: [{ id: 'x' }] })).toBe(true);
  });

  it('returns false for entries with none of the structured fields', async () => {
    const { hasStructuredContent } = await import('../validate');
    expect(hasStructuredContent({ markdown: '# Title only' })).toBe(false);
    expect(hasStructuredContent({})).toBe(false);
    expect(hasStructuredContent({ traits: [] })).toBe(false);
  });
});
