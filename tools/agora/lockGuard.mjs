#!/usr/bin/env node
// lockGuard.mjs — advisory-lock self-check for file-writing planmap tools.
// Born from the 2026-07-14 incident: a failed `client.mjs lock` did not stop a
// chained write, so a tool edited a file another agent had locked. Locks are
// advisory by design; this makes the WRITING TOOLS enforce them client-side.
// Tools call guardWriteOrDie() before writing a shared file and refuse loudly
// when another live agent holds it. Daemon down = advisory system offline:
// warn-free proceed, so solo use never blocks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const globToRe = (g) => new RegExp('^' + norm(g).split('*').map(escapeRe).join('[^]*') + '$');

// Same file-naming scheme as client.mjs identityPath(): AGORA_DIR override,
// AGORA_AGENT_ID scopes the file per concurrent agent. Must stay in step.
function identityAgentId(env = process.env) {
  const dir = env.AGORA_DIR || path.join(repo, '.agent', 'agora');
  const key = typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim()
    ? env.AGORA_AGENT_ID.trim().replace(/[^A-Za-z0-9._-]/g, '_')
    : '';
  const file = path.join(dir, key ? `client-identity.${key}.json` : 'client-identity.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).agentId ?? null;
  } catch {
    return null;
  }
}

/**
 * checkAgoraLock(file) -> { ok: true, reason } when writing is safe:
 * no live lock covers the file, the caller's stored identity holds the lock,
 * or the daemon is unreachable. -> { ok: false, holderAgentId, lockReason,
 * lockId } when another agent holds it.
 */
export async function checkAgoraLock(file, {
  baseUrl = process.env.AGORA_URL || 'http://localhost:4319',
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const target = norm(file);
  let body;
  try {
    const res = await fetchImpl(`${baseUrl}/locks`);
    body = await res.json();
  } catch {
    return { ok: true, reason: 'daemon-unreachable' };
  }
  const locks = body.locks ?? [];
  const covering = locks.find((l) =>
    (l.paths ?? []).some((p) => norm(p) === target) ||
    (l.globs ?? []).some((g) => globToRe(g).test(target)));
  if (!covering) return { ok: true, reason: 'unlocked' };
  const mine = identityAgentId(env);
  if (mine && covering.agentId === mine) return { ok: true, reason: 'held-by-me' };
  // WF fix (task abbdc943): a missed AGORA_AGENT_ID prefix makes the identity
  // read miss, and the guard then refuses the caller's OWN lock. Possession of
  // the covering lock's id is acquirer-only knowledge (the daemon returns it
  // only from a successful lock call), so an explicit AGORA_HELD_LOCK id that
  // MATCHES the covering lock is proof enough — verified, unlike --force-no-lock.
  const heldId = typeof env.AGORA_HELD_LOCK === 'string' ? env.AGORA_HELD_LOCK.trim() : '';
  if (heldId && covering.id === heldId) return { ok: true, reason: 'held-lock-id' };
  return {
    ok: false,
    holderAgentId: covering.agentId,
    lockReason: covering.reason ?? '',
    lockId: covering.id,
    identityRead: mine,
  };
}

/** CLI wrapper: exits 2 with a loud CONFLICT message unless forced. */
export async function guardWriteOrDie(file, { toolName = 'planmap tool', force = false, ...opts } = {}) {
  if (force) return;
  const r = await checkAgoraLock(file, opts);
  if (r.ok) return;
  console.error(
    `${toolName}: REFUSING to write ${file} — Agora lock held by agent ${r.holderAgentId}` +
    (r.lockReason ? ` (reason: ${r.lockReason})` : '') +
    `\n  If this is YOUR lock: your AGORA_AGENT_ID prefix probably went missing (guard read identity: ${r.identityRead ?? 'none'}).` +
    `\n  Safe self-service: export AGORA_HELD_LOCK=<your lockId> (printed by the lock call) and re-run.` +
    `\n  Otherwise coordinate via \`node tools/agora/client.mjs say\`, wait for the release, or pass --force-no-lock if you are CERTAIN.`,
  );
  process.exit(2);
}
