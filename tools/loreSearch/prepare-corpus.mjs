#!/usr/bin/env node
/**
 * Stages the ask-Aralia corpus for the Vertex AI Search data store.
 *
 * Sources:
 *  - docs/**\/*.md                        -> corpus/docs/<relpath>
 *  - <memoryDir>/*.md                     -> corpus/memory/<name>
 *  - AGENTS.md, progress.md, README.md    -> corpus/root/<name>
 *  - public/data/spells/**\/*.json        -> corpus/spells/<level>/<id>.md (rendered)
 *  - public/data/glossary/entries/**\/*.json -> corpus/glossary/<relpath>.md (rendered)
 *
 * Output: .agent/scratch/lore-corpus/  (gitignored staging; rsynced to GCS)
 * Vertex unstructured stores index MD/TXT/HTML/PDF only, so JSON is rendered
 * to markdown here. Files over 1 MB are skipped and listed (retrieval noise).
 *
 * Refresh the live index in one command:
 *   node tools/loreSearch/prepare-corpus.mjs --upload
 * (stages, rsyncs to gs://aralia-lore-corpus-503109/corpus, then triggers a
 * FULL re-import of the aralia-lore data store so removed docs drop out.
 * Needs Remy's gcloud login; queries bill to the GenAI App Builder credit.)
 */
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.join(import.meta.dirname, '..', '..'));
const OUT = path.join(ROOT, '.agent', 'scratch', 'lore-corpus');
const MEMORY_DIR = 'C:/Users/Gambit/.claude/projects/F--Repos-Aralia/memory';
const MAX_BYTES = 1024 * 1024;

const counts = { docs: 0, memory: 0, root: 0, spells: 0, glossary: 0 };
const skippedLarge = [];
const failures = [];

async function walk(dir, ext) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, ext)));
    else if (e.name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

// The Vertex importer maps MIME type from the file EXTENSION (GCS metadata is
// ignored): .md becomes text/markdown, which it rejects. Every staged file
// gets a .txt suffix (foo.md -> foo.md.txt) so it imports as text/plain; the
// devhub route strips the suffix again for readable citations.
async function stage(srcPath, destRel) {
  const stat = await fs.stat(srcPath);
  if (stat.size > MAX_BYTES) {
    skippedLarge.push(`${destRel} (${(stat.size / 1024).toFixed(0)} KB)`);
    return false;
  }
  const dest = path.join(OUT, `${destRel}.txt`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(srcPath, dest);
  return true;
}

async function writeDoc(destRel, text) {
  const dest = path.join(OUT, `${destRel}.txt`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, text, 'utf8');
}

const UNIT_WORDS = { bonus_action: 'bonus action', action: 'action', reaction: 'reaction', minute: 'minute', hour: 'hour', round: 'round' };
const unitWord = (u, v) => {
  const w = UNIT_WORDS[u] ?? String(u ?? '').replace(/_/g, ' ');
  return v === 1 ? w : `${w}s`;
};

function spellMarkdown(spell) {
  const lines = [`# ${spell.name}`, ''];
  const classes = (spell.classes ?? []).join(', ');
  lines.push(`Level ${spell.level} ${spell.school}${classes ? ` (${classes})` : ''}${spell.ritual ? ' — ritual' : ''}.`);

  const ct = spell.castingTime;
  if (ct) lines.push(`Casting time: ${ct.value} ${unitWord(ct.unit, ct.value)}.`);

  const r = spell.range;
  if (r) {
    if (r.type === 'self') lines.push('Range: self.');
    else if (r.type === 'touch') lines.push('Range: touch.');
    else if (r.distance) lines.push(`Range: ${r.distance} ${r.distanceUnit ?? 'feet'}.`);
  }

  const c = spell.components;
  if (c) {
    const parts = [c.verbal && 'V', c.somatic && 'S', c.material && 'M'].filter(Boolean).join(', ');
    const mat = c.material && c.materialDescription ? ` (${c.materialDescription})` : '';
    lines.push(`Components: ${parts || 'none'}${mat}.`);
  }

  const d = spell.duration;
  if (d) {
    if (d.type === 'instantaneous') lines.push('Duration: instantaneous.');
    else if (d.value) {
      const span = `${d.value} ${unitWord(d.unit, d.value)}`;
      lines.push(d.concentration ? `Duration: concentration, up to ${span}.` : `Duration: ${span}.`);
    }
  }

  if (spell.tags?.length) lines.push(`Tags: ${spell.tags.join(', ')}.`);
  lines.push('', spell.description ?? '');
  if (spell.higherLevels) lines.push('', `**At higher levels:** ${spell.higherLevels}`);

  const effectDescs = (spell.effects ?? []).map((e) => e.description).filter(Boolean);
  if (effectDescs.length) {
    lines.push('', '## Mechanical effects', '');
    for (const desc of effectDescs) lines.push(`- ${desc}`);
  }
  return lines.join('\n') + '\n';
}

function glossaryMarkdown(entry) {
  const lines = [];
  const meta = [`Category: ${entry.category ?? 'unknown'}`];
  if (entry.tags?.length) meta.push(`Tags: ${entry.tags.join(', ')}`);
  if (entry.aliases?.length) meta.push(`Also known as: ${entry.aliases.join(', ')}`);
  const body = entry.markdown ?? `# ${entry.title}\n\n${entry.excerpt ?? ''}`;
  lines.push(body.trimEnd(), '', meta.join('. ') + '.');

  const im = entry.itemMetadata;
  if (im) {
    const bits = [];
    if (im.type) bits.push(`Type: ${im.type}`);
    if (im.rarity && im.rarity !== 'None') bits.push(`Rarity: ${im.rarity}`);
    if (im.cost != null) bits.push(`Cost: ${im.cost} gp`);
    if (im.weight != null) bits.push(`Weight: ${im.weight} lb`);
    if (im.damage) bits.push(`Damage: ${im.damage}`);
    if (im.properties?.length) bits.push(`Properties: ${im.properties.join('; ')}`);
    if (bits.length) lines.push('', bits.join('. ') + '.');
  }
  if (entry.seeAlso?.length) lines.push('', `See also: ${entry.seeAlso.join(', ')}.`);
  return lines.join('\n') + '\n';
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  for (const p of await walk(path.join(ROOT, 'docs'), '.md')) {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (await stage(p, rel)) counts.docs++;
  }

  for (const p of await walk(MEMORY_DIR, '.md')) {
    if (await stage(p, `memory/${path.basename(p)}`)) counts.memory++;
  }

  for (const name of ['AGENTS.md', 'progress.md', 'README.md']) {
    try {
      if (await stage(path.join(ROOT, name), `root/${name}`)) counts.root++;
    } catch {
      /* file absent is fine */
    }
  }

  for (const p of await walk(path.join(ROOT, 'public', 'data', 'spells'), '.json')) {
    const rel = path.relative(path.join(ROOT, 'public', 'data', 'spells'), p).replace(/\\/g, '/');
    try {
      const spell = JSON.parse(await fs.readFile(p, 'utf8'));
      await writeDoc(`spells/${rel.replace(/\.json$/, '.md')}`, spellMarkdown(spell));
      counts.spells++;
    } catch (err) {
      failures.push(`${rel}: ${err.message}`);
    }
  }

  const glossaryRoot = path.join(ROOT, 'public', 'data', 'glossary', 'entries');
  for (const p of await walk(glossaryRoot, '.json')) {
    const rel = path.relative(glossaryRoot, p).replace(/\\/g, '/');
    if (rel.startsWith('dev/')) continue; // test fixtures, not content
    try {
      const entry = JSON.parse(await fs.readFile(p, 'utf8'));
      await writeDoc(`glossary/${rel.replace(/\.json$/, '.md')}`, glossaryMarkdown(entry));
      counts.glossary++;
    } catch (err) {
      failures.push(`${rel}: ${err.message}`);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`staged ${total} files -> ${OUT}`);
  console.log(JSON.stringify(counts));
  if (skippedLarge.length) console.log(`skipped ${skippedLarge.length} over 1 MB:\n  ${skippedLarge.join('\n  ')}`);
  if (failures.length) {
    console.error(`FAILED to render ${failures.length}:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }

  if (process.argv.includes('--upload')) await uploadAndReindex();
}

const PROJECT = 'crimson-ledger-503109';
const BUCKET = 'gs://aralia-lore-corpus-503109';
const IMPORT_URL =
  `https://eu-discoveryengine.googleapis.com/v1/projects/${PROJECT}` +
  `/locations/eu/collections/default_collection/dataStores/aralia-lore` +
  `/branches/default_branch/documents:import`;

async function uploadAndReindex() {
  console.log('rsyncing corpus to GCS…');
  execSync(`gcloud storage rsync -r --delete-unmatched-destination-objects "${OUT}" ${BUCKET}/corpus`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // The importer rejects text/markdown (rsync's auto-detected type for .md);
  // it accepts text/plain, so stamp every object after each sync.
  console.log('stamping text/plain content type…');
  execSync(`gcloud storage objects update "${BUCKET}/corpus/**" --content-type=text/plain`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  const res = await fetch(IMPORT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': PROJECT,
    },
    body: JSON.stringify({
      gcsSource: { inputUris: [`${BUCKET}/corpus/**`], dataSchema: 'content' },
      reconciliationMode: 'FULL',
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`re-import failed: ${JSON.stringify(payload)}`);
  console.log(`re-import started: ${payload.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
