import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { buildDocUsage } from '../docUsage/buildDocUsage';

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'docbuild-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'spells'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'orphans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'spells.ts'), 'const u = `docs/spells/${id}.md`;');
  fs.writeFileSync(path.join(root, 'docs', 'spells', 'fireball.md'), '# Fireball\n'.repeat(30));
  fs.writeFileSync(path.join(root, 'docs', 'orphans', 'lonely.md'), '# Lonely doc with enough words '.repeat(10));
  fs.writeFileSync(path.join(root, 'docs', 'orphans', 'dupe1.md'), 'identical body identical body identical');
  fs.writeFileSync(path.join(root, 'docs', 'orphans', 'dupe2.md'), 'identical body identical body identical');
  const atlas = path.join(root, 'atlas.json');
  fs.writeFileSync(atlas, JSON.stringify({ documents: [
    { relativePath: 'docs/spells/fireball.md', docRole: 'reference' },
  ]}));
  (buildDocUsage as any)._atlas = atlas;
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('buildDocUsage', () => {
  it('resolves consumption, duplicates, inbound, roles, candidacy', () => {
    const p = buildDocUsage(root, { atlasPath: path.join(root, 'atlas.json'), now: Date.now() });
    const byPath = Object.fromEntries(p.docs.map(d => [d.path, d]));
    expect(byPath['docs/spells/fireball.md'].consumedVia).toBe('dir');
    expect(byPath['docs/spells/fireball.md'].candidate.isCandidate).toBe(false);
    expect(byPath['docs/spells/fireball.md'].role).toBe('reference');
    expect(byPath['docs/orphans/lonely.md'].candidate.confidence).toBe('high');
    const g1 = byPath['docs/orphans/dupe1.md'].duplicateGroupId;
    expect(g1).not.toBeNull();
    expect(byPath['docs/orphans/dupe2.md'].duplicateGroupId).toBe(g1);
    expect(byPath['docs/orphans/lonely.md'].role).toBeNull();
    expect(p.diagnostics.atlasMissing).toBe(false);
  });
});
