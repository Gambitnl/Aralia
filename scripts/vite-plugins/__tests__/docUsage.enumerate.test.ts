import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { enumerateDocs } from '../docUsage/enumerateDocs';

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'docenum-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'skip.md'), '# nope');
  fs.writeFileSync(path.join(root, 'docs', 'a.md'),
    '---\nstatus: done\n---\n# A\nsee b.md instead\n- [ ] open one\n- [x] closed\n[link](./c.md)\n');
  fs.writeFileSync(path.join(root, 'docs', 'b.md'), '# B\n[[c]] and [x](d.md)\n');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('enumerateDocs', () => {
  it('skips ignored dirs and captures per-doc facts', () => {
    const facts = enumerateDocs(root);
    const byPath = Object.fromEntries(facts.map(f => [f.path, f]));
    expect(Object.keys(byPath).sort()).toEqual(['docs/a.md', 'docs/b.md']);
    const a = byPath['docs/a.md'];
    expect(a.openTaskCount).toBe(1);
    expect(a.lifecycleStatus).toBe('done');
    expect(a.supersededBy).toBe('b.md');
    expect(a.outboundLinkTargets).toContain('docs/c.md');
    expect(typeof a.contentHash).toBe('string');
    expect(a.contentHash.length).toBe(64);
    expect(byPath['docs/b.md'].outboundLinkTargets.sort()).toEqual(['docs/c.md', 'docs/d.md']);
  });
});
