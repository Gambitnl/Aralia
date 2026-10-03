#!/usr/bin/env node

/*
 * commit-msg guard: keep the daily whole-tree auto-snapshot away from the
 * files that Agora agents hold locked in this checkout.
 *
 * Why (GG-117, 2026-08-26): the snapshot scheduler committed an agent's
 * mid-task edits (a domain-doc rewrite + a `git mv` extraction) into
 * `auto: daily snapshot 2026-08-26` while that agent held live locks. The
 * scheduler is external to this repo, so the guard lives where git itself
 * runs: as a commit-msg hook. Agents follow lock-before-edit; this makes the
 * one committer that ignored coordination follow it too.
 *
 * What changed (GG-310, 2026-09-28): the first version refused the WHOLE
 * snapshot while any agent was present or any lock existed. Agents work every
 * night, so no snapshot landed after 2026-08-26. The guard now holds back only
 * the locked paths and lets the rest through. Presence alone no longer blocks,
 * because an agent locks a file before it edits it.
 *
 * Modes:
 *   node commit-msg-agora-guard.cjs <msg-file>
 *     The commit-msg hook. Non-snapshot commits pass untouched. A snapshot
 *     commit is refused only when a STAGED path is under a live lock. That
 *     happens when a lock is taken after the scheduler's hold-back step; the
 *     scheduler then puts its pre-run index back.
 *   node commit-msg-agora-guard.cjs --hold-back-locked <list-file>
 *     Scheduler step, after `git add -A`. Resets each staged path under a live
 *     lock back to HEAD in the index. The file on disk does not change. Writes
 *     the held paths, NUL-separated, to <list-file>.
 *   node commit-msg-agora-guard.cjs --restore-held <index-backup> <list-file>
 *     Scheduler step, after the commit. Puts each held path's index entry back
 *     the way the pre-run index had it, so staging that a person or an agent
 *     did on a locked file (a `git mv`, a `git rm --cached`) survives the night.
 *
 * Preserved from the first version:
 *   - ARALIA_SNAPSHOT_FORCE=1 overrides (operator escape hatch): the hook
 *     allows, and the hold-back step holds nothing back.
 *   - Ordinary owner commits keep the advisory daemon-down policy. The nightly
 *     runner sets ARALIA_SNAPSHOT_REQUIRE_AGORA=1 and refuses to run without it.
 *
 * What a lock covers: the daemon's own lockOverlap() from tools/agora/store.mjs,
 * so the snapshot and the daemon agree. One addition, in the safe direction: a
 * plain path token also covers every path under it, in case it names a folder.
 * The daemon compares a plain token exactly. Holding back too much costs one
 * night; committing a mid-edit file is the GG-117 incident.
 *
 * Uncertain: an agent that edits WITHOUT a lock is not protected. Nothing in
 * this guard can see that edit; the lock-before-edit rule is the only defense.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const TAG = '[agora-snapshot-guard]';
const force = process.env.ARALIA_SNAPSHOT_FORCE === '1';

const repoRoot = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
}

function agoraUrl() {
  return process.env.AGORA_URL || 'http://localhost:4319';
}

function getJson(urlPath) {
  return new Promise((resolve) => {
    const base = new URL(agoraUrl());
    const req = http.request(
      { hostname: base.hostname, port: base.port, path: urlPath, method: 'GET', timeout: 2000 },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try { resolve({ ok: true, json: JSON.parse(body) }); } catch { resolve({ ok: false }); }
        });
      },
    );
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.end();
  });
}

/** Live locks for THIS checkout, or null when the daemon is unreachable. */
async function liveLocks() {
  const res = await getJson('/locks');
  if (!res.ok) return null;
  const here = path.basename(repoRoot).toLowerCase();
  // A lock that names a sibling repo (Entity-Generator, the operator dashboard)
  // cannot cover a path in this tree.
  return ((res.json && res.json.locks) || [])
    .filter((l) => !l.repo || String(l.repo).toLowerCase() === here);
}

/** Staged paths. --no-renames lists both sides of a move, so a lock on either side holds it. */
function stagedPaths() {
  // Reviewed publication checks outgoing commits against the fetched remote,
  // since an index equal to HEAD has no ordinary staged changes to inspect.
  const base = process.env.ARALIA_SNAPSHOT_COMPARE_BASE;
  return git(['diff', '--cached', '--name-only', '--no-renames', '-z', ...(base ? [base] : [])]).split('\0').filter(Boolean);
}

/** The subset of `paths` that a live lock covers. */
async function lockedAmong(paths, locks) {
  if (!paths.length || !locks.length) return [];
  const { lockOverlap } = await import(pathToFileURL(path.join(repoRoot, 'tools', 'agora', 'store.mjs')).href);
  const folders = (p) => {
    const seg = p.split('/');
    const out = [];
    for (let i = 1; i < seg.length; i++) out.push(seg.slice(0, i).join('/'));
    return out;
  };
  return paths.filter((p) => locks.some((lock) =>
    lockOverlap([p], lock, repoRoot) ||
    lockOverlap(folders(p), { paths: lock.paths || [], globs: [] }, repoRoot)));
}

function readList(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

async function holdBackLocked(listFile) {
  fs.writeFileSync(listFile, '');
  if (force) {
    console.log(`${TAG} ARALIA_SNAPSHOT_FORCE=1 - holding nothing back`);
    return 0;
  }
  const locks = await liveLocks();
  if (locks === null) {
    if (process.env.ARALIA_SNAPSHOT_REQUIRE_AGORA === '1') throw new Error('Agora is unavailable; refusing an unattended snapshot.');
    console.log(`${TAG} daemon unreachable - advisory system offline, holding nothing back`);
    return 0;
  }
  const held = await lockedAmong(stagedPaths(), locks);
  if (!held.length) {
    console.log(`${TAG} ${locks.length} live lock(s); no staged path is locked - the snapshot keeps every change`);
    return 0;
  }
  fs.writeFileSync(listFile, held.join('\0') + '\0');
  // Literal pathspecs: a file name that holds `*` or `?` must not widen the reset.
  git(['reset', '-q', `--pathspec-from-file=${listFile}`, '--pathspec-file-nul'], {
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  console.log(`${TAG} held back ${held.length} locked path(s) for a later night; the files on disk did not change:`);
  for (const p of held.slice(0, 40)) console.log(`${TAG}   ${p}`);
  if (held.length > 40) console.log(`${TAG}   ... and ${held.length - 40} more`);
  return 0;
}

function restoreHeld(backupIndex, listFile) {
  const held = new Set(readList(listFile));
  if (!held.size) return 0;
  // Read the pre-run entries from the backup copy of the index.
  const before = git(['ls-files', '-s', '-z'], { env: { ...process.env, GIT_INDEX_FILE: backupIndex } })
    .split('\0').filter(Boolean);
  const entries = new Map();
  for (const line of before) {
    const tab = line.indexOf('\t');
    const file = line.slice(tab + 1);
    if (!held.has(file)) continue;
    if (!entries.has(file)) entries.set(file, []);
    entries.get(file).push(line);
  }
  // Mode 0 drops the path's current entry first; the pre-run entries (if any)
  // then go back in. A path that the pre-run index did not hold stays out.
  const zero = '0'.repeat(git(['rev-parse', 'HEAD']).trim().length);
  const input = [...held].flatMap((file) => [`0 ${zero}\t${file}`, ...(entries.get(file) || [])]);
  git(['update-index', '-z', '--index-info'], { input: input.join('\0') + '\0' });
  console.log(`${TAG} restored the pre-run index entries of ${held.size} held path(s)`);
  return 0;
}

async function hook(msgFile) {
  let message = '';
  try {
    message = fs.readFileSync(msgFile, 'utf8');
  } catch {
    return 0;
  }
  if (!/^auto: daily snapshot/m.test(message.split('\n')[0] || '')) return 0;
  if (force) {
    console.log(`${TAG} ARALIA_SNAPSHOT_FORCE=1 - committing despite live locks`);
    return 0;
  }
  const locks = await liveLocks();
  if (locks === null) {
    if (process.env.ARALIA_SNAPSHOT_REQUIRE_AGORA === '1') throw new Error('Agora is unavailable; refusing an unattended snapshot.');
    console.log(`${TAG} daemon unreachable - advisory system offline, allowing snapshot`);
    return 0;
  }
  const locked = await lockedAmong(stagedPaths(), locks);
  if (locked.length) {
    console.error(
      `${TAG} DEFERRED: ${locked.length} staged path(s) are under a live Agora lock ` +
      `(${locked.join(', ').slice(0, 160)}). ` +
      'A lock was probably taken after the hold-back step ran. ' +
      'Retry, or set ARALIA_SNAPSHOT_FORCE=1 to override.',
    );
    return 1;
  }
  console.log(`${TAG} no staged path is locked (${locks.length} live lock(s)) - allowing snapshot`);
  return 0;
}

(async () => {
  const [mode, a, b] = process.argv.slice(2);
  if (!mode) process.exit(0);
  if (mode === '--hold-back-locked') {
    if (!a) { console.error(`${TAG} --hold-back-locked needs <list-file>`); process.exit(2); }
    process.exit(await holdBackLocked(a));
  }
  if (mode === '--restore-held') {
    if (!a || !b) { console.error(`${TAG} --restore-held needs <index-backup> <list-file>`); process.exit(2); }
    process.exit(restoreHeld(a, b));
  }
  process.exit(await hook(mode));
})().catch((err) => {
  // No silent pass: an error here must stop the snapshot, never wave it through.
  console.error(`${TAG} FAILED: ${err && err.stack ? err.stack : err}`);
  process.exit(3);
});
