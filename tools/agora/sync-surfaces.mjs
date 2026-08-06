#!/usr/bin/env node
// sync-surfaces.mjs — the one program that keeps every planning surface in
// line with planmap. Idempotent by contract: run it twice, get identical files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileBoardToPlanmap } from './planmap-reconcile-lib.mjs';
import { coverageReport } from './coverage-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Areas a reader has already judged as needing no architecture domain doc.
 *
 * This records a decision; it does not hide anything. An ignored area is still
 * reported, marked `ignored`, so the coverage list stays a complete picture of
 * the repository rather than a curated one. */
const COVERAGE_IGNORE = ['ui', 'layout'];
const dayDiff = (now, d) => Math.max(0, Math.round((now - new Date(d)) / 86400000));

// Writes here fail transiently, in bursts of up to ~1.5 s, as EPERM on the
// rename and as libuv's UNKNOWN (-4094) on a direct open. Giving up on the first
// failure is what froze health.json for three days (2026-07-23 → 26) with every
// age on the plan-map page stale, so a transient lock must not lose the step.
//
// Measured 2026-07-28, same file, same directory, only one variable changed:
//   nobody requesting it over HTTP ....  0 failures / 250 writes
//   dev server serving it ............ 175 failures / 200 writes
// So the holder is the dev server SERVING the file, not its watcher: sibling
// files in the same watched directories never failed while merely being watched.
// Restart Manager never attributes a holder, so the handle is short-lived rather
// than parked — which is exactly what retrying is good for.
//
// The budget below rides out about 10 s. It survives one or two readers hitting
// the file back to back; against three or more it becomes a coin flip, and no
// retry budget wins against a reader that never lets go. A browser on the
// plan-map page sits well inside the survivable range.
const WRITE_ATTEMPTS = 12;
const WRITE_BACKOFF_MS = 150;
const WRITE_BACKOFF_CAP_MS = 1500;
const backoffFor = (attempt) => Math.min(WRITE_BACKOFF_CAP_MS, WRITE_BACKOFF_MS * attempt);

/**
 * Block the thread — this is a one-shot batch program, not a server. Atomics
 * rather than a spin loop: a spin burns a core competing with the very process
 * that has to finish reading the file before the write can land.
 */
const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const atomicWrite = (file, text, { attempts = WRITE_ATTEMPTS, sleep = sleepSync } = {}) => {
  // A pid-scoped tmp name means two concurrent writers cannot fight over one
  // scratch path while they retry.
  const tmp = `${file}.${process.pid}.tmp`;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, file);
      return { attempts: attempt };
    } catch (e) {
      lastError = e;
      // Never leave scratch files behind for the next run to trip over.
      try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
      if (attempt < attempts) sleep(backoffFor(attempt));
    }
  }
  throw new Error(
    `could not write ${path.basename(file)} after ${attempts} attempts — ` +
    `something is holding it open (${lastError?.code ?? lastError?.message})`,
  );
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// Each step: { name, run(ctx) -> { changed, detail } }. Steps never throw out;
// failures are caught per step so one failure never blocks the rest.
export async function runSync({
  repoRoot = path.resolve(here, '..', '..'),
  agoraUrl = process.env.AGORA_URL || 'http://localhost:4319',
  now = new Date(),
  steps = ['board', 'docs', 'tidy', 'health'],
  dryRun = false,
  tasksProvider, // test seam; defaults to fetching the daemon
} = {}) {
  const topicsPath = path.join(repoRoot, 'public', 'planmap', 'topics.json');
  const healthPath = path.join(repoRoot, 'public', 'planmap', 'health.json');

  // Guard: refuse everything if the map is unreadable/invalid.
  let map;
  try {
    map = readJson(topicsPath);
    if (!Array.isArray(map.topics)) throw new Error('topics.json has no topics[]');
  } catch (e) {
    return { ok: false, stepResults: [{ name: 'guard', ok: false, changed: false, detail: String(e.message) }] };
  }

  // --- daemon identity for authed calls -------------------------------------
  // A stored client identity cannot work here. The daemon resolves bearer tokens
  // through its live agent registry, and its sweep reaps any agent that stops
  // checking in — deleting the record, so the token stops working. sync is a
  // detached one-shot that never heartbeats, so a token saved by one run is dead
  // by the next. Claiming a fresh identity per run is the only durable way in.
  //
  // The identity is retired as soon as tidy is done. An abandoned one would sit
  // in Presence until the drop horizon and then be reaped WITH a crash dossier,
  // so every nightly sync would look like a crashed agent.
  const SYNC_HANDLE = 'sync-surfaces';

  const daemonPost = (route, { token, body } = {}) => fetch(`${agoraUrl}${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  // Claim a short-lived service identity. Resolves to a bearer token, or throws.
  // Errors the DAEMON caused are tagged `answered` so the caller can tell "the
  // daemon declined" from "nothing is listening" — a thrown fetch is the latter.
  const declined = (message) => Object.assign(new Error(message), { answered: true });

  const claimSyncIdentity = async () => {
    // Registration requires a pet slug from the daemon's own catalog, and that
    // catalog changes — ask rather than hardcode a slug that may be retired.
    const petsRes = await fetch(`${agoraUrl}/pets`);
    if (!petsRes.ok) throw declined(`HTTP ${petsRes.status} from /pets`);
    const petSlug = ((await petsRes.json()).pets ?? [])[0]?.slug;
    if (!petSlug) throw declined('daemon offers no pet identities');

    // unique:false is the documented opt-out for a flow that deliberately
    // re-registers under the same name. sync is a singleton batch program
    // reclaiming its own handle, which is exactly that case; each registration
    // still mints its own agent record and its own token.
    const res = await daemonPost('/agents/register', {
      body: { handle: SYNC_HANDLE, petSlug, unique: false, type: 'service', note: 'planning-surface sync (board tidy)' },
    });
    if (!res.ok) throw declined(`HTTP ${res.status} from /agents/register`);
    const body = await res.json();
    if (!body.token) throw declined('register returned no token');
    return body.token;
  };

  const getTasks = tasksProvider ?? (async () => {
    const res = await fetch(`${agoraUrl}/tasks`);
    const body = await res.json();
    return body.tasks ?? body ?? [];
  });

  const today = now.toISOString().slice(0, 10);
  const stepResults = [];
  const stepErrors = [];
  const impl = {
    board: async () => {
      const tasks = await getTasks();
      const before = JSON.stringify(map);
      const { changes, disconnected } = reconcileBoardToPlanmap(map, tasks);
      for (const line of changes) {
        const id = /^"([a-z0-9-]+)"/.exec(line)?.[1];
        const topic = map.topics.find((t) => t.id === id);
        if (topic) topic.updated = today;
      }
      if (!dryRun && JSON.stringify(map) !== before) {
        atomicWrite(topicsPath, JSON.stringify(map, null, 2) + '\n');
      }
      return { changed: changes.length > 0, detail: `${changes.length} change(s); ${disconnected.length} disconnected` };
    },
    docs: async () => ({ changed: false, detail: 'not implemented yet (Task 5)' }),
    tidy: async () => {
      if (dryRun) return { changed: false, detail: 'dry run' };
      // The daemon owns its store files; tidying goes through its authed admin
      // endpoint, never by touching .agent/agora on disk from here.
      let token;
      try {
        token = await claimSyncIdentity();
      } catch (e) {
        if (!e.answered) return { changed: false, detail: `daemon unreachable at ${agoraUrl} — skipped` };
        return { changed: false, detail: `could not claim a sync identity: ${e.message} — skipped` };
      }

      try {
        // Say which of the two it was. "unreachable or refused" reads as a dead
        // daemon and sends the reader looking for the wrong problem — a live
        // daemon answering 401 needs a different fix than one not listening.
        const res = await daemonPost('/admin/tidy', { token }).catch(() => null);
        if (!res) return { changed: false, detail: `daemon unreachable at ${agoraUrl} — skipped` };
        if (!res.ok) return { changed: false, detail: `daemon refused: HTTP ${res.status} — skipped` };
        const body = await res.json();
        return { changed: body.archived > 0, detail: `${body.archived} task(s) archived` };
      } finally {
        // Retire even when tidy failed — see the note on claimSyncIdentity.
        await daemonPost('/agents/retire', { token, body: { note: 'sync-surfaces tidy complete' } }).catch(() => {});
      }
    },
    health: async () => {
      const topics = {};
      for (const t of map.topics) {
        const entry = { ageDays: t.updated && DATE_RE.test(t.updated) ? dayDiff(now, t.updated) : null };
        if (t.docset) {
          const projDir = path.join(repoRoot, 'docs', 'projects', t.docset);
          entry.docset = t.docset;
          const required = ['NORTH_STAR.md', 'TRACKER.md', 'GAPS.md', 'COLD_START_AGENT_PROMPT.md', 'DECISIONS.md', 'AUDIT_OR_PROOF.md', 'RUNBOOK.md'];
          entry.docsComplete = required.every((f) => fs.existsSync(path.join(projDir, f)));
          const gapsFile = path.join(projDir, 'GAPS.md');
          entry.openGaps = null;
          entry.decisionWaiting = false;
          if (fs.existsSync(gapsFile)) {
            const gaps = fs.readFileSync(gapsFile, 'utf8');
            entry.openGaps = Number(/^open_gap_count:\s*(\d+)/m.exec(gaps)?.[1] ?? NaN) || 0;
            entry.decisionWaiting = Number(/^decision_required_count:\s*(\d+)/m.exec(gaps)?.[1] ?? 0) > 0;
          }
        }
        topics[t.id] = entry;
      }
      const mtimeDays = (p) => (fs.existsSync(p) ? dayDiff(now, fs.statSync(p).mtime) : null);
      const health = {
        generatedAt: now.toISOString(),
        lastGoodRun: now.toISOString(),
        stepErrors,
        surfaces: {
          chronicleDaysSilent: mtimeDays(path.join(repoRoot, 'misc', 'chronicle', 'chronicle.db')),
          atlasDaysSilent: mtimeDays(path.join(repoRoot, '.agent', 'atlas', 'atlas.sqlite')),
        },
        /* What SHOULD be on a planning surface and is not.
         *
         * The block above measures staleness — has a surface gone quiet. This
         * one measures coverage — was it ever there. They are different faults
         * and only the first was ever checked, which is how the streamed 3D
         * world reached 154 files with no architecture doc and nothing said so.
         *
         * Never filtered. See PLANNING-STACK.md section 6 for why a threshold
         * here would be the tool making a judgment it cannot make. */
        coverage: coverageReport(repoRoot, { ignore: COVERAGE_IGNORE }),
        topics,
      };
      if (!dryRun) atomicWrite(healthPath, JSON.stringify(health, null, 2) + '\n');
      return { changed: true, detail: `${Object.keys(topics).length} topics` };
    },
  };

  for (const name of steps) {
    try {
      const r = await impl[name]();
      stepResults.push({ name, ok: true, ...r });
    } catch (e) {
      stepErrors.push({ step: name, error: String(e.message) });
      stepResults.push({ name, ok: false, changed: false, detail: String(e.message) });
    }
  }
  return { ok: stepResults.every((r) => r.ok), stepResults };
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const steps = arg('steps')?.split(',') ?? undefined;
  runSync({ steps, dryRun: process.argv.includes('--dry-run') }).then((res) => {
    for (const r of res.stepResults) console.log(`${r.ok ? 'ok ' : 'ERR'} ${r.name}: ${r.detail}`);
    process.exit(res.ok ? 0 : 1);
  });
}
