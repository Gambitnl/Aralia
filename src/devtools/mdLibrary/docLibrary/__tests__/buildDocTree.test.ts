import { describe, it, expect } from 'vitest';
import { buildDocTree } from '../buildDocTree';

describe('buildDocTree', () => {
  it('nests paths into dirs+files with counts', () => {
    const root = buildDocTree(['docs/a/x.md', 'docs/a/y.md', 'docs/b.md']);
    expect(root.docCount).toBe(3);
    const docs = root.children.find(c => c.name === 'docs')!;
    expect(docs.isDir).toBe(true);
    expect(docs.docCount).toBe(3);
    const dirA = docs.children.find(c => c.name === 'a')!;
    expect(dirA.isDir).toBe(true);
    expect(dirA.docCount).toBe(2);
    expect(docs.children.map(c => c.name)).toEqual(['a', 'b.md']);
    expect(dirA.children.map(c => c.path)).toEqual(['docs/a/x.md', 'docs/a/y.md']);
  });
});
