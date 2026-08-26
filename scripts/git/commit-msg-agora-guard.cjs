#!/usr/bin/env node

/*
 * commit-msg guard: defer the daily whole-tree auto-snapshot while Agora
 * agents are active in this checkout.
 *
 * Why (GG-117, 2026-08-26): the snapshot scheduler committed an agent's
 * mid-task edits (a domain-doc rewrite + a `git mv` extraction) into
 * `auto: daily snapshot 2026-08-26` while that agent held live locks. The
 * scheduler is external to this repo, so the guard lives where git itself
 * runs: as a commit-msg hook. Agents follow lock-before-edit; this makes the
 * one committer that ignored coordination follow it too.
 *
 * Behavior:
 *   - Non-snapshot commits pass untouched.
 *   - Snapshot commits are refused while any live Agora agent or active lock
 *     exists, with a clear defer message for the scheduler's log.
 *   - ARALIA_SNAPSHOT_FORCE=1 overrides (operator escape hatch).
 *   - Daemon down = advisory system offline: warn and proceed, so solo use
 *     never blocks (same philosophy as tools/agora/lockGuard.mjs).
 */

const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const msgFile = process.argv[2];
if (!msgFile) process.exit(0);

const fs = require('node:fs');
let message = '';
try {
  message = fs.readFileSync(msgFile, 'utf8');
} catch {
  process.exit(0);
}
if (!/^auto: daily snapshot/m.test(message.split('\n')[0] || '')) process.exit(0);
if (process.env.ARALIA_SNAPSHOT_FORCE === '1') {
  console.log('[agora-snapshot-guard] ARALIA_SNAPSHOT_FORCE=1 — committing despite active agents');
  process.exit(0);
}

const repoRoot = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

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

(async () => {
  const agents = await getJson('/agents');
  if (!agents.ok) {
    console.log('[agora-snapshot-guard] daemon unreachable — advisory system offline, allowing snapshot');
    process.exit(0);
  }
  const list = (agents.json && agents.json.agents) || [];
  // Any registered agent still on the roster counts as active presence; the
  // daemon reaps stale leases itself, so a live row means recent heartbeats.
  if (list.length > 0) {
    console.error(
      `[agora-snapshot-guard] DEFERRED: ${list.length} Agora agent(s) present ` +
      `(${list.map((a) => a.handle).join(', ').slice(0, 120)}). ` +
      'The daily snapshot would sweep mid-task work into an unrelated commit. ' +
      'Retry after agents retire, or set ARALIA_SNAPSHOT_FORCE=1 to override.',
    );
    process.exit(1);
  }
  const locks = await getJson('/locks');
  const lockList = (locks.ok && locks.json && locks.json.locks) || [];
  if (lockList.length > 0) {
    console.error(
      `[agora-snapshot-guard] DEFERRED: ${lockList.length} active lock(s) exist ` +
      '(orphaned locks can be cleared with `node tools/agora/client.mjs unlock --mine` by their holder). ' +
      'Set ARALIA_SNAPSHOT_FORCE=1 to override.',
    );
    process.exit(1);
  }
  console.log('[agora-snapshot-guard] no active agents or locks — allowing snapshot');
  process.exit(0);
})();
