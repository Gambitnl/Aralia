/**
 * Derive the browser's manifest and bundle from individual runtime spell JSON.
 * Reject an incomplete or ambiguous corpus before writing anything. Preserve
 * the authored payload, including fields the runtime schema does not interpret.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { SpellValidator } from '../../src/systems/spells/validation/spellValidator';
import { writeFileWithRetry } from '../writeWithRetry.mjs';

export type SpellArtifacts = { manifest: Record<string, unknown>; bundle: Record<string, unknown> };

export function deriveSpellArtifacts(root = process.cwd()): SpellArtifacts {
  const directory = path.join(root, 'public/data/spells');
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Spell sources must be regular files: ${file}`);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(file);
    }
  }
  walk(directory);
  if (!files.length) throw new Error('No spell definitions found; refusing to empty the generated artifacts.');
  const bundle: Record<string, unknown> = Object.create(null), manifest: Record<string, unknown> = Object.create(null);
  const issues: string[] = [], seen = new Set<string>();
  for (const file of files.sort()) {
    const relative = path.relative(directory, file).replace(/\\/g, '/');
    try {
      const spell = JSON.parse(fs.readFileSync(file, 'utf8'));
      const validation = SpellValidator.safeParse(spell);
      if (!validation.success) {
        throw new Error(validation.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      }
      if (seen.has(spell.id)) throw new Error(`Duplicate spell ID: ${spell.id}`);
      seen.add(spell.id);
      if (relative !== `level-${spell.level}/${spell.id}.json`) throw new Error(`Expected level-${spell.level}/${spell.id}.json, found ${relative}`);
      const entry: Record<string, unknown> = { name: spell.name };
      if (Array.isArray(spell.aliases)) entry.aliases = spell.aliases;
      Object.assign(entry, { level: spell.level, school: spell.school, path: `/data/spells/${relative}` });
      manifest[spell.id] = entry;
      bundle[spell.id] = spell;
    } catch (error) { issues.push(`${relative}: ${(error as Error).message}`); }
  }
  if (issues.length) throw new Error(`Spell source validation failed (${issues.length} files):\n${issues.join('\n')}`);
  const sorted = (record: Record<string, unknown>) => Object.fromEntries(Object.keys(record).sort().map(id => [id, record[id]]));
  return { manifest: sorted(manifest), bundle: sorted(bundle) };
}

export function artifactIsCurrent(file: string, expected: unknown): boolean {
  try { return isDeepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected); }
  catch { return false; }
}

export async function publishArtifacts(outputs: Map<string, unknown>, checkOnly = false) {
  const stale = [...outputs].filter(([file, value]) => !artifactIsCurrent(file, value));
  if (checkOnly) {
    if (stale.length) throw new Error(`Stale or missing spell artifacts:\n${stale.map(([file]) => file).join('\n')}\nRun npm run spells:generate.`);
    return;
  }
  // Derivation completes before this point. If a write fails, put already changed
  // outputs back; a malformed source can never overwrite a previously good bundle.
  const before = new Map(stale.map(([file]) => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
  const attempted: string[] = [];
  try {
    for (const [file, value] of stale) {
      attempted.push(file);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const attempts = await writeFileWithRetry(file, JSON.stringify(value, null, 2) + '\n');
      if ((attempts ?? 1) > 1) console.log(`Recovered a transient write lock on ${file} after ${attempts} attempts.`);
      console.log(`Updated ${file}`);
    }
  } catch (error) {
    for (const file of attempted.reverse()) {
      const original = before.get(file);
      if (original) await writeFileWithRetry(file, original);
      else fs.rmSync(file, { force: true });
    }
    throw error;
  }
}

export async function generateSpellArtifacts(root = process.cwd(), checkOnly = false) {
  const artifacts = deriveSpellArtifacts(root);
  const manifestFile = path.join(root, 'public/data/spells_manifest.json');
  if (fs.existsSync(manifestFile)) {
    try {
      const removed = Object.keys(JSON.parse(fs.readFileSync(manifestFile, 'utf8'))).filter(id => !(id in artifacts.manifest));
      if (removed.length) console.warn(`Spell IDs removed from the authored corpus: ${removed.join(', ')}`);
    } catch { /* A malformed generated manifest will be reported stale or regenerated below. */ }
  }
  await publishArtifacts(new Map([
    [path.join(root, 'public/data/spells_manifest.json'), artifacts.manifest],
    [path.join(root, 'public/data/spells_bundle.json'), artifacts.bundle],
  ]), checkOnly);
  console.log(`Validated ${Object.keys(artifacts.bundle).length} spell definitions; manifest and bundle are current.`);
  return artifacts;
}
