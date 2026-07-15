// scripts/jules/fetch-icons.mjs
//
// Apply the SVGs a Jules session produced, WITHOUT switching branches.
//
// HOW JULES ACTUALLY DELIVERS (confirmed live 2026-07-14, session 3434532823404847684):
// Because run-batch.mjs omits automationMode, Jules opens NO pull request AND pushes
// NO branch. Instead the finished session carries the whole change inline:
//
//   session.outputs[0].changeSet.gitPatch = {
//     unidiffPatch:          "<full git diff text>",
//     baseCommitId:          "<40-char sha the patch applies to>",
//     suggestedCommitMessage:"<message>",
//   }
//
// So there is nothing to fetch from git at all. We pull the patch from the API and
// `git apply` it onto the working tree. We stay on master and never check out,
// reset, or delete anything.
//
// SAFETY: before applying, every file in the patch must be an .svg under
// public/assets/icons/spells/. If the patch touches ANYTHING else, we refuse and
// print the offenders. (Jules is told to write SVGs only; this enforces it.)
//
// The API key is read at run time (Credential Manager target
// "AgentMatrix/Jules/JULES_API_KEY" or env JULES_API_KEY) and NEVER printed.
//
// Usage:
//   node scripts/jules/fetch-icons.mjs --session sessions/3434532823404847684
//   node scripts/jules/fetch-icons.mjs --session sessions/123 --dry-run   # check only
//   node scripts/jules/fetch-icons.mjs --session sessions/123 --save-patch out.patch
//
// Zero deps: Node built-ins + global fetch + git CLI.

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWinCred } from '../../tools/groq-proxy/proxy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const API_BASE = 'https://jules.googleapis.com/v1alpha';
const CRED_TARGET = process.env.JULES_CRED_TARGET || 'AgentMatrix/Jules/JULES_API_KEY';
const ICON_PREFIX = 'public/assets/icons/spells/';

function argFlag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

function git(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: REPO_ROOT, maxBuffer: 1 << 28 }, (err, stdout, stderr) => {
      if (err) {
        err.message = `git ${args.join(' ')}\n${stderr || err.message}`;
        reject(err);
      } else resolve(stdout);
    });
  });
}

async function loadKey() {
  let key = null;
  try { key = await readWinCred(CRED_TARGET); } catch { key = null; }
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
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

/** Every destination path the patch writes to. */
function filesInPatch(patch) {
  return [...patch.matchAll(/^diff --git a\/(.+?) b\/(.+?)$/gm)].map((m) => m[2]);
}

async function main() {
  const sessionArg = argFlag('--session', '');
  const dryRun = hasFlag('--dry-run');
  const savePatch = argFlag('--save-patch', '');

  if (!sessionArg) {
    console.error('ERROR: pass --session sessions/<id>  (run-batch.mjs printed it)');
    process.exit(1);
  }
  const sessionPath = sessionArg.startsWith('sessions/') ? sessionArg : `sessions/${sessionArg}`;

  const key = await loadKey();
  if (!key) {
    console.error(`ERROR: no Jules API key (Credential Manager "${CRED_TARGET}" or env JULES_API_KEY).`);
    process.exit(1);
  }

  const session = await apiGet('/' + sessionPath, key);
  console.log(`session: ${sessionPath}`);
  console.log(`  state: ${session.state}`);

  if (session.state !== 'COMPLETED') {
    console.error(`\nSession is not COMPLETED yet (state: ${session.state}). Wait, then re-run.`);
    process.exit(1);
  }

  const gitPatch = session.outputs?.[0]?.changeSet?.gitPatch;
  const patch = gitPatch?.unidiffPatch;
  if (!patch) {
    console.error('\nERROR: session has no changeSet.gitPatch.unidiffPatch.');
    console.error('Output shape was:', JSON.stringify(session.outputs || null).slice(0, 600));
    process.exit(1);
  }

  const files = filesInPatch(patch);
  const offenders = files.filter((f) => !(f.startsWith(ICON_PREFIX) && f.endsWith('.svg')));
  const spells = [...new Set(files.map((f) => f.split('/')[4]).filter(Boolean))];

  console.log(`  patch: ${patch.length} chars, ${files.length} file(s)`);
  console.log(`  base:  ${gitPatch.baseCommitId}`);
  console.log(`  spells: ${spells.length} (${spells.join(', ')})`);

  // SAFETY GATE: refuse anything that is not an SVG in a spell icon folder.
  if (offenders.length) {
    console.error(`\nREFUSING TO APPLY: patch touches ${offenders.length} file(s) outside ${ICON_PREFIX}:`);
    offenders.slice(0, 20).forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log(`  safety: OK — all ${files.length} files are .svg under ${ICON_PREFIX}`);

  const patchFile = path.join(REPO_ROOT, '.agent', 'scratch', `jules-${sessionPath.replace(/\W/g, '_')}.patch`);
  await writeFile(patchFile, patch, 'utf8');
  if (savePatch) {
    await writeFile(path.resolve(REPO_ROOT, savePatch), patch, 'utf8');
    console.log(`  saved patch -> ${savePatch}`);
  }

  try {
    // --check verifies it applies cleanly without touching the tree.
    await git(['apply', '--check', '--whitespace=nowarn', patchFile]);
    console.log('  apply --check: clean');

    if (dryRun) {
      console.log('\nDRY RUN: patch applies cleanly. Re-run without --dry-run to write the files.');
      return;
    }

    await git(['apply', '--whitespace=nowarn', patchFile]);
    console.log(`\nAPPLIED: ${files.length} SVG(s) written into ${ICON_PREFIX}`);
    console.log('Working copy stayed on master; no branch was checked out.');
    console.log('Open the design preview (Spell Icons) to review and pick.');
  } finally {
    await unlink(patchFile).catch(() => {});
  }
}

main().catch((e) => {
  console.error('fetch-icons failed:', e.message);
  process.exit(1);
});
