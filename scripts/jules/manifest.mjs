// scripts/jules/manifest.mjs
//
// Enumerate every spell under public/data/spells/**/*.json and emit a batched
// manifest for the Jules spell-icon pipeline.
//
// For each spell we read only { id, name, school, level } plus its json path.
// The manifest is split into batches of ~N spells (default 10). Each batch
// becomes ONE Jules session (see run-batch.mjs).
//
// Output: .agent/scratch/jules-icons/manifest.json  (gitignored; that's fine)
//
// Usage:
//   node scripts/jules/manifest.mjs                 # default batch size 10
//   node scripts/jules/manifest.mjs --batch-size 12
//   node scripts/jules/manifest.mjs --out some/other/manifest.json
//
// Zero deps: Node built-ins only. This script is READ-ONLY over the repo and
// safe to run at any time.

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SPELLS_DIR = path.join(REPO_ROOT, 'public', 'data', 'spells');
const DEFAULT_OUT = path.join(REPO_ROOT, '.agent', 'scratch', 'jules-icons', 'manifest.json');

function argFlag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const BATCH_SIZE = Math.max(1, Number(argFlag('--batch-size', 10)) || 10);
const OUT_PATH = path.resolve(REPO_ROOT, argFlag('--out', DEFAULT_OUT));

/** Recursively collect all *.json files under dir. */
async function collectJson(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectJson(full)));
    } else if (e.isFile() && e.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const files = (await collectJson(SPELLS_DIR)).sort();
  const spells = [];
  const skipped = [];

  for (const file of files) {
    let json;
    try {
      json = JSON.parse(await readFile(file, 'utf8'));
    } catch (e) {
      skipped.push({ file, reason: `parse error: ${e.message}` });
      continue;
    }
    if (!json || typeof json.id !== 'string' || typeof json.name !== 'string') {
      skipped.push({ file, reason: 'missing id or name' });
      continue;
    }
    // jsonPath is repo-relative with forward slashes so Jules (running on a
    // Linux checkout) can read it directly.
    const jsonPath = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    spells.push({
      id: json.id,
      name: json.name,
      school: json.school || '',
      level: typeof json.level === 'number' ? json.level : null,
      jsonPath,
    });
  }

  // Stable order: by id, so batch membership is deterministic across runs.
  spells.sort((a, b) => a.id.localeCompare(b.id));

  const batches = [];
  for (let i = 0; i < spells.length; i += BATCH_SIZE) {
    batches.push({
      index: batches.length,
      spells: spells.slice(i, i + BATCH_SIZE),
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    batchSize: BATCH_SIZE,
    spellCount: spells.length,
    batchCount: batches.length,
    outputRoot: 'public/assets/icons/spells',
    batches,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('jules manifest built');
  console.log(`  spells:      ${spells.length}`);
  console.log(`  batch size:  ${BATCH_SIZE}`);
  console.log(`  batches:     ${batches.length}`);
  if (skipped.length) {
    console.log(`  skipped:     ${skipped.length}`);
    for (const s of skipped.slice(0, 10)) {
      console.log(`    - ${s.file}: ${s.reason}`);
    }
  }
  console.log(`  written to:  ${path.relative(REPO_ROOT, OUT_PATH).split(path.sep).join('/')}`);
}

main().catch((e) => {
  console.error('manifest failed:', e.message);
  process.exit(1);
});
