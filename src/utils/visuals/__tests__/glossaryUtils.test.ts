import { describe, it, expect } from 'vitest';
import { findGlossaryEntryAndPath } from '../glossaryUtils';
import { GlossaryEntry } from '../../types';

describe('findGlossaryEntryAndPath', () => {
  const tree: GlossaryEntry[] = [
    { id: 'root', title: 'Root', category: 'Top', filePath: '/root.md' },
    {
      id: 'parent',
      title: 'Parent',
      category: 'Top',
      filePath: '/parent.md',
      subEntries: [
        {
          id: 'child',
          title: 'Child',
          category: 'Top',
          filePath: '/parent/child.md',
          subEntries: [{ id: 'grandchild', title: 'Grandchild', category: 'Top', filePath: '/parent/child/grandchild.md' }],
        },
      ],
    },
  ];

  it('returns the entry and path for a nested child', () => {
    const result = findGlossaryEntryAndPath('grandchild', tree);
    expect(result.entry?.id).toBe('grandchild');
    expect(result.path).toEqual(['parent', 'child', 'grandchild']);
  });

  it('returns an empty result when not found', () => {
    const result = findGlossaryEntryAndPath('missing', tree);
    expect(result.entry).toBeNull();
    expect(result.path).toEqual([]);
  });
});
