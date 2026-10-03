import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveSpellArtifacts, generateSpellArtifacts, publishArtifacts } from './artifacts';

const roots: string[] = [];
const sample = JSON.parse(fs.readFileSync('public/data/spells/level-0/fire-bolt.json', 'utf8'));
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-spells-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'public/data/spells/level-0'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/data/spells/level-0/fire-bolt.json'), JSON.stringify(sample));
  return root;
}
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
describe('spell artifact safety', () => {
  it('preserves authored extension fields and derives a browser URL', () => {
    const root = fixture();
    const spell = { ...sample, futureMechanic: { enabled: true } };
    fs.writeFileSync(path.join(root, 'public/data/spells/level-0/fire-bolt.json'), JSON.stringify(spell));
    const result = deriveSpellArtifacts(root);
    expect(result.bundle['fire-bolt']).toEqual(spell);
    expect(result.manifest['fire-bolt']).toMatchObject({ path: '/data/spells/level-0/fire-bolt.json' });
  });
  it('rejects invalid sources without replacing good artifacts', async () => {
    const root = fixture();
    await generateSpellArtifacts(root);
    const file = path.join(root, 'public/data/spells_bundle.json');
    const before = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(path.join(root, 'public/data/spells/level-0/broken.json'), '{');
    await expect(generateSpellArtifacts(root)).rejects.toThrow('validation failed');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
  it('rejects ambiguous IDs and incorrect source paths', () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, 'public/data/spells/level-0/duplicate.json'), JSON.stringify(sample));
    expect(() => deriveSpellArtifacts(root)).toThrow(/Duplicate spell ID|Expected level/);
    fs.unlinkSync(path.join(root, 'public/data/spells/level-0/duplicate.json'));
    fs.renameSync(path.join(root, 'public/data/spells/level-0/fire-bolt.json'), path.join(root, 'public/data/spells/level-0/wrong.json'));
    expect(() => deriveSpellArtifacts(root)).toThrow('Expected level-0/fire-bolt.json');
  });
  it('checks content without rewriting formatting and catches stale content', async () => {
    const root = fixture();
    const file = path.join(root, 'output.json');
    fs.writeFileSync(file, '{"value":1}');
    await publishArtifacts(new Map([[file, { value: 1 }]]), true);
    expect(fs.readFileSync(file, 'utf8')).toBe('{"value":1}');
    await expect(publishArtifacts(new Map([[file, { value: 2 }]]), true)).rejects.toThrow('Stale');
    expect(fs.readFileSync(file, 'utf8')).toBe('{"value":1}');
  });
  it('refuses an empty corpus', () => {
    const root = fixture();
    fs.unlinkSync(path.join(root, 'public/data/spells/level-0/fire-bolt.json'));
    expect(() => deriveSpellArtifacts(root)).toThrow('No spell definitions');
  });
  it('rejects valid JSON that violates the runtime schema', () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, 'public/data/spells/level-0/fire-bolt.json'), JSON.stringify({ ...sample, level: 99 }));
    expect(() => deriveSpellArtifacts(root)).toThrow('validation failed');
  });
});
