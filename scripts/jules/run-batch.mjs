// scripts/jules/run-batch.mjs
//
// Create Jules sessions (one per batch) for the spell-icon pipeline.
//
// SAFETY: this script does NOT hit the live Jules API unless you pass --go.
//   - default (no --go): DRY RUN. Prints what it would create. No network writes.
//   - --probe:           makes ONE read-only GET /sources call and prints the
//                        matched source. Run this manually to sanity-check auth.
//   - --go:              actually POSTs sessions (consumes Jules quota).
//
// The API key is read at run time from Windows Credential Manager target
// "AgentMatrix/Jules/JULES_API_KEY" (or env JULES_API_KEY). It is NEVER printed,
// logged, or written anywhere. We only report its length and that it loaded.
//
// Jules API (v1alpha), learned from https://jules.google/docs/api/reference/ :
//   Base:   https://jules.googleapis.com/v1alpha
//   Auth:   header  x-goog-api-key: <KEY>
//   List:   GET  /sources
//           -> { sources: [ { name, id, githubRepo: { owner, repo } }, ... ] }
//   Create: POST /sessions
//           body { prompt, sourceContext: { source, githubRepoContext:
//                  { startingBranch } }, title }
//           We intentionally OMIT automationMode so Jules makes NO pull request
//           (the default). Plans auto-approve by default via the API.
//
// Usage:
//   node scripts/jules/run-batch.mjs                 # dry run, all batches
//   node scripts/jules/run-batch.mjs --batches 0,1,2 # dry run, selected batches
//   node scripts/jules/run-batch.mjs --probe         # one GET /sources, then exit
//   node scripts/jules/run-batch.mjs --batches 0 --go        # create ONE session
//   node scripts/jules/run-batch.mjs --batches 0-14 --limit 15 --go
//
// Zero deps: Node built-ins + global fetch.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWinCred } from '../../tools/groq-proxy/proxy.mjs';
import { buildPrompt } from './prompt-template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, '.agent', 'scratch', 'jules-icons', 'manifest.json');

const API_BASE = 'https://jules.googleapis.com/v1alpha';
const CRED_TARGET = process.env.JULES_CRED_TARGET || 'AgentMatrix/Jules/JULES_API_KEY';

// Repo this checkout belongs to (owner/repo). Overridable via --repo.
const DEFAULT_REPO = 'Gambitnl/Aralia';
const STARTING_BRANCH = 'master';

function argFlag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

/** Parse "0,1,2" or "0-14" or "3" into a sorted unique array of indices. */
function parseBatches(spec, count) {
  if (!spec) return Array.from({ length: count }, (_, i) => i);
  const set = new Set();
  for (const part of String(spec).split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
    } else if (/^\d+$/.test(p)) {
      set.add(Number(p));
    }
  }
  return [...set].filter((i) => i >= 0 && i < count).sort((a, b) => a - b);
}

async function loadKey() {
  let key = null;
  try {
    key = await readWinCred(CRED_TARGET);
  } catch {
    key = null;
  }
  if (!key) key = process.env.JULES_API_KEY || null;
  return key;
}

async function apiGet(pathname, key) {
  const res = await fetch(API_BASE + pathname, {
    method: 'GET',
    headers: { 'x-goog-api-key': key, accept: 'application/json' },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

async function apiPost(pathname, key, payload) {
  const res = await fetch(API_BASE + pathname, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`POST ${pathname} -> ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

/** Find the source whose githubRepo matches owner/repo. */
function matchSource(sources, ownerRepo) {
  const [owner, repo] = ownerRepo.split('/');
  const want = (owner || '').toLowerCase() + '/' + (repo || '').toLowerCase();
  for (const s of sources || []) {
    const gr = s.githubRepo || {};
    // Two possible shapes seen in the alpha docs: { owner, repo } or an id like
    // "github/{owner}/{repo}". Match either.
    const grOwnerRepo = gr.owner && gr.repo ? `${gr.owner}/${gr.repo}`.toLowerCase() : '';
    const idOwnerRepo = typeof s.id === 'string' ? s.id.replace(/^github\//i, '').toLowerCase() : '';
    if (grOwnerRepo === want || idOwnerRepo === want) return s;
  }
  return null;
}

async function main() {
  const go = hasFlag('--go');
  const probe = hasFlag('--probe');
  const ownerRepo = argFlag('--repo', DEFAULT_REPO);
  const limit = Number(argFlag('--limit', 15)) || 15;

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const selected = parseBatches(argFlag('--batches', ''), manifest.batches.length);

  console.log(`jules run-batch`);
  console.log(`  mode:        ${go ? 'GO (live, consumes quota)' : probe ? 'PROBE (one read-only GET /sources)' : 'DRY RUN (no network writes)'}`);
  console.log(`  repo:        ${ownerRepo}`);
  console.log(`  branch:      ${STARTING_BRANCH}`);
  console.log(`  batches:     ${manifest.batchCount} total, ${selected.length} selected [${selected.join(',')}]`);
  console.log(`  concurrency: cap ${limit}`);

  // Key is only needed for --probe or --go.
  let key = null;
  if (go || probe) {
    key = await loadKey();
    if (!key) {
      console.error(`\nERROR: no Jules API key found.`);
      console.error(`  Looked in Windows Credential Manager target "${CRED_TARGET}" and env JULES_API_KEY.`);
      console.error(`  Create the key in Jules Settings and store it via the PAT vault`);
      console.error(`  (http://127.0.0.1:3040/pat_vault.html -> "Jules API key" card).`);
      process.exit(1);
    }
    console.log(`  api key:     loaded (${key.length} chars), not printed`);
  }

  if (probe) {
    const { sources = [] } = await apiGet('/sources', key);
    console.log(`\nPROBE: /sources returned ${sources.length} source(s).`);
    const match = matchSource(sources, ownerRepo);
    if (match) {
      console.log(`  matched source for ${ownerRepo}:`);
      console.log(`    name: ${match.name || '(none)'}`);
      console.log(`    id:   ${match.id || '(none)'}`);
    } else {
      console.log(`  NO source matched ${ownerRepo}. Available:`);
      for (const s of sources) console.log(`    - ${s.name || s.id || JSON.stringify(s)}`);
      console.log(`  Connect the repo to Jules, or pass --repo owner/repo.`);
    }
    return;
  }

  // Resolve the source (needed for the real POST body). In dry run without a key
  // we can't call /sources, so we show a placeholder and the payload shape.
  let source = null;
  if (go) {
    const { sources = [] } = await apiGet('/sources', key);
    const match = matchSource(sources, ownerRepo);
    if (!match) {
      console.error(`\nERROR: no Jules source matched ${ownerRepo}. Run --probe to list sources.`);
      process.exit(1);
    }
    source = match.name || match.id;
    console.log(`  source:      ${source}`);
  }

  const toCreate = selected.slice(0, limit);
  if (toCreate.length < selected.length) {
    console.log(`  NOTE: capping to first ${limit} of ${selected.length} selected batches (--limit).`);
  }

  console.log('');
  const created = [];
  for (const idx of toCreate) {
    const batch = manifest.batches[idx];
    const title = `Spell icons batch ${idx} (${batch.spells.length} spells: ${batch.spells.map((s) => s.id).slice(0, 3).join(', ')}${batch.spells.length > 3 ? ', …' : ''})`;
    const prompt = buildPrompt(batch);
    const payload = {
      prompt,
      title,
      sourceContext: {
        source: source || `sources/github/${ownerRepo}`,
        githubRepoContext: { startingBranch: STARTING_BRANCH },
      },
      // automationMode intentionally omitted -> Jules creates NO pull request.
    };

    if (!go) {
      console.log(`[dry-run] batch ${idx}: would POST /sessions`);
      console.log(`          title:  ${title}`);
      console.log(`          spells: ${batch.spells.map((s) => s.id).join(', ')}`);
      console.log(`          prompt: ${prompt.length} chars`);
      continue;
    }

    try {
      const session = await apiPost('/sessions', key, payload);
      const name = session.name || session.id || '(unknown)';
      created.push({ batch: idx, name });
      console.log(`[created] batch ${idx}: session ${name}`);
    } catch (e) {
      console.error(`[FAILED]  batch ${idx}: ${e.message}`);
    }
  }

  if (go) {
    console.log(`\ncreated ${created.length}/${toCreate.length} session(s).`);
    if (created.length) {
      console.log(`Record these session names for fetch-icons.mjs:`);
      for (const c of created) console.log(`  batch ${c.batch}: ${c.name}`);
    }
  } else {
    console.log(`\nDRY RUN complete. Re-run with --go to actually create sessions.`);
  }
}

main().catch((e) => {
  console.error('run-batch failed:', e.message);
  process.exit(1);
});
