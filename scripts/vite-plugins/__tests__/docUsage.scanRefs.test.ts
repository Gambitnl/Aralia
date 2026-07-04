import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { scanReferences } from '../docUsage/scanReferences';

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'scanref-'));
  fs.mkdirSync(path.join(root, 'src', 'grill'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'spells'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'grill', 'load.ts'),
    `fetch('docs/prompts/grill.md'); const p = 'stray.md';`);
  fs.writeFileSync(path.join(root, 'src', 'spells', 'load.ts'),
    'const u = `docs/spells/reference/${spellId}.md`;');
  fs.writeFileSync(path.join(root, 'src', 'spells', 'data.json'),
    JSON.stringify({ doc: 'docs/data/manifest.md' }));
  fs.writeFileSync(path.join(root, 'vite.config.ts'), `input: 'misc/agent_docs.md'`);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('scanReferences', () => {
  it('classifies literal, templated-dir, data, and build refs', () => {
    const idx = scanReferences(root);
    expect(idx.fileRefs.has('docs/prompts/grill.md')).toBe(true);
    expect([...idx.fileRefs.get('docs/prompts/grill.md')!]).toContain('grill');
    expect(idx.dirRefs.some(d => d.prefix === 'docs/spells/reference/' && d.app === 'spells')).toBe(true);
    expect(idx.dataRefs.has('docs/data/manifest.md')).toBe(true);
    expect(idx.buildRefs.has('misc/agent_docs.md')).toBe(true);
    expect(idx.basenameRefs.has('stray.md')).toBe(true);
  });
});
