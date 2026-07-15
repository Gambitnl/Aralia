#!/usr/bin/env node
// sync-surfaces.mjs — the one program that keeps every planning surface in
// line with planmap. Idempotent by contract: run it twice, get identical files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileBoardToPlanmap } from './planmap-reconcile-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayDiff = (now, d) => Math.max(0, Math.round((now - new Date(d)) / 86400000));

const atomicWrite = (file, text) => {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
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

  // Bearer token for authed daemon calls: read from the stored client identity
  // file the same way client.mjs does — { "<baseUrl>": { agentId, handle, token } }
  // keyed by base URL (AGORA_DIR overrides the default .agent/agora dir).
  const authHeaders = () => {
    try {
      const idDir = process.env.AGORA_DIR
        ? path.resolve(process.cwd(), process.env.AGORA_DIR)
        : path.join(repoRoot, '.agent', 'agora');
      const all = JSON.parse(fs.readFileSync(path.join(idDir, 'client-identity.json'), 'utf8'));
      const id = all[agoraUrl.replace(/\/+$/, '')];
      return id && id.token ? { Authorization: `Bearer ${id.token}` } : {};
    } catch {
      return {}; // no identity — the daemon answers 401 and the step reports it
    }
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
      const res = await fetch(`${agoraUrl}/admin/tidy`, { method: 'POST', headers: authHeaders() }).catch(() => null);
      if (!res || !res.ok) return { changed: false, detail: 'daemon unreachable or refused — skipped' };
      const body = await res.json();
      return { changed: body.archived > 0, detail: `${body.archived} task(s) archived` };
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
