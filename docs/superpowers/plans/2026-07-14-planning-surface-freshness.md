# Planning Surface Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Planmap becomes the only hand-set status list; one idempotent program keeps the project docs and task board in line, and the roadmap reads planmap live so it cannot rot.

**Architecture:** One sync program (`tools/agora/sync-surfaces.mjs`) with 4 independent steps, run by 2 triggers (Agora daemon debounced, nightly 2am). The roadmap engine gains planmap topics as first-class nodes. A gated one-time migration folds 71 doc folders into planmap.

**Tech Stack:** Node ESM (.mjs), node:test, tsx for the roadmap engine (TypeScript), vanilla JS in `public/planmap/index.html`.

**Spec:** `docs/superpowers/specs/2026-07-14-planning-surface-freshness-design.md`

> **REVISION 2 (2026-07-14, Remy):** full absorption — the tracker is merged into planmap and `docs/projects/` is deleted per project by a subagent wave. Tasks 5 and 9 are CANCELED (no doc layer to mirror or audit). Task 4's health step reads planmap only (no docset/GAPS fields). Task 10 is REPLACED by Task 10R below. Task 12 is REPLACED by Task 12R. Task 1 additionally adds feature-level `decision` (boolean) to the schema, and does NOT add `docset`.

## Global Constraints

- NEVER `git commit` or branch — the external 2am task snapshots the tree (repo rule). Plans' usual commit steps are intentionally absent.
- Work in `master`, in place. Acquire the Agora lock before editing `public/planmap/topics.json` when other agents are live: `node tools/agora/client.mjs lock public/planmap/topics.json` (release after).
- Status vocabulary everywhere: `parked` · `specced` · `active` · `done` · `superseded`. No other words.
- The sync program must be idempotent: running twice on the same state produces byte-identical files.
- All JSON/markdown writes are atomic: write `<file>.tmp`, then `fs.renameSync`.
- If `node tools/agora/validate-planmap.mjs` exits non-zero, the sync program must refuse ALL writes.
- Never write `.agent/roadmap-local/processing_manifest.json` (roadmap-session-close regenerates it from sqlite and clobbers outside edits).
- Duplicate roadmap node ids crash the whole graph (`id-validation.ts` throws). Planmap-born ids use prefix `planmap_` + topic id, which the planmap schema guarantees unique.
- UI copy in plain English, US spelling (GOV.UK style — repo writing rule).
- Tests for `tools/agora/*` use node:test (`node --test <file>`), matching `tools/agora/server.test.mjs`.

---

### Task 1: Planmap schema + validator learn the new fields

**Files:**
- Modify: `public/planmap/topics.schema.json`
- Modify: `tools/agora/validate-planmap.mjs`
- Test: `tools/agora/validate-planmap.test.mjs` (create)

**Interfaces:**
- Produces: topics may carry `updated` (YYYY-MM-DD string), `docset` (slug string), `tier` (`"strategic"|"component"`), `status_note` (string). Features may carry `status_note`. All optional.

- [ ] **Step 1: Write the failing test**

```js
// tools/agora/validate-planmap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const validator = path.join(here, 'validate-planmap.mjs');

const baseTopic = {
  id: 'sample-topic', title: 'Sample', campaign: 'tooling', status: 'active', deps: [],
};
const wrap = (topic) => JSON.stringify({
  campaigns: { tooling: { title: 'Tooling' } }, topics: [topic],
}, null, 2);

const runOn = (json) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planmap-'));
  const file = path.join(dir, 'topics.json');
  fs.writeFileSync(file, json);
  try {
    execFileSync(process.execPath, [validator, '--file', file], { encoding: 'utf8' });
    return { code: 0 };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
};

test('accepts valid updated/docset/tier/status_note', () => {
  const r = runOn(wrap({ ...baseTopic, updated: '2026-07-14', docset: 'combat', tier: 'strategic', status_note: 'x' }));
  assert.equal(r.code, 0);
});

test('rejects bad tier and malformed updated', () => {
  assert.notEqual(runOn(wrap({ ...baseTopic, tier: 'huge' })).code, 0);
  assert.notEqual(runOn(wrap({ ...baseTopic, updated: 'yesterday' })).code, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tools/agora/validate-planmap.test.mjs`
Expected: FAIL — the validator has no `--file` flag yet and does not check the new fields.

- [ ] **Step 3: Implement**

In `tools/agora/validate-planmap.mjs`:
1. Add a `--file <path>` flag that overrides the default topics.json path (keep default behavior unchanged). Follow the flag-parsing style already in `planmap-add.mjs` (`flag('file')`).
2. Add per-topic checks (and `status_note` for features), collected into the existing `problems` array:

```js
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIERS = new Set(['strategic', 'component']);
for (const t of data.topics) {
  if (t.updated !== undefined && !DATE_RE.test(t.updated))
    problems.push(`topic "${t.id}": "updated" must be YYYY-MM-DD`);
  if (t.tier !== undefined && !TIERS.has(t.tier))
    problems.push(`topic "${t.id}": "tier" must be strategic|component`);
  if (t.docset !== undefined && !/^[a-z0-9][a-z0-9_-]*$/.test(t.docset))
    problems.push(`topic "${t.id}": "docset" must be a docs/projects slug`);
  if (t.status_note !== undefined && typeof t.status_note !== 'string')
    problems.push(`topic "${t.id}": "status_note" must be a string`);
}
```

3. In `public/planmap/topics.schema.json`, add to the topic properties object:

```json
"updated": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$", "description": "Tooling-written: date of last real change." },
"docset": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]*$", "description": "Tooling-written: docs/projects slug holding this topic's deep docs." },
"tier": { "enum": ["strategic", "component"], "description": "Tooling-written: page filter level." },
"status_note": { "type": "string", "description": "Free text nuance the 5 status words cannot hold." }
```

Add `status_note` (string) to the feature properties object too. Update the `_readme` field list in `topics.json` if present.

- [ ] **Step 4: Run tests + the real map**

Run: `node --test tools/agora/validate-planmap.test.mjs` — Expected: PASS
Run: `node tools/agora/validate-planmap.mjs` — Expected: `plan-map validation: clean` (88 topics), exit 0.

### Task 2: `planmap-add` stamps `updated`

**Files:**
- Modify: `tools/agora/planmap-add.mjs`
- Test: `tools/agora/planmap-add.test.mjs` (create)

**Interfaces:**
- Produces: every mutation through planmap-add sets `topic.updated = <today YYYY-MM-DD>` on the touched topic.

- [ ] **Step 1: Write the failing test**

```js
// tools/agora/planmap-add.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

test('new topic gets an updated stamp', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-'));
  const file = path.join(dir, 'topics.json');
  fs.writeFileSync(file, JSON.stringify({ campaigns: { tooling: { title: 'T' } }, topics: [] }, null, 2));
  execFileSync(process.execPath, [
    path.join(here, 'planmap-add.mjs'),
    '--file', file, '--no-validate',
    '--new-topic', 'freshness-probe', '--title', 'Probe', '--campaign', 'tooling',
  ], { encoding: 'utf8' });
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.match(data.topics[0].updated, /^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tools/agora/planmap-add.test.mjs`
Expected: FAIL — no `--file`/`--no-validate` flags, no stamp.

- [ ] **Step 3: Implement**

In `tools/agora/planmap-add.mjs`:
1. `--file <path>` overrides the topics.json path; `--no-validate` skips the post-write validator call (tests only; document both in the header comment).
2. Add near the top: `const today = new Date().toISOString().slice(0, 10);`
3. In the new-topic branch: include `updated: today` in the topic object.
4. In the add-feature and `--set-status` branches: set `topic.updated = today` on the touched topic before writing.
5. Make the final write atomic: write `${file}.tmp` then `fs.renameSync(tmp, file)`.

- [ ] **Step 4: Run tests**

Run: `node --test tools/agora/planmap-add.test.mjs` — Expected: PASS
Run: `node tools/agora/validate-planmap.mjs` — Expected: exit 0 (real map untouched).

### Task 3: Extract the board→planmap reconcile into an importable library

**Files:**
- Create: `tools/agora/planmap-reconcile-lib.mjs`
- Modify: `tools/agora/planmap-reconcile.mjs` (becomes a thin CLI over the lib)
- Test: `tools/agora/planmap-reconcile-lib.test.mjs` (create)

**Interfaces:**
- Produces: `reconcileBoardToPlanmap(data, tasks) -> { changes: string[], disconnected: {id, status}[] }` — mutates `data` in place (same rules as today: RANK upgrade only), plus `featureSlugs(features) -> string[]` re-exported.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

```js
// tools/agora/planmap-reconcile-lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBoardToPlanmap } from './planmap-reconcile-lib.mjs';

const mkData = () => ({
  topics: [{
    id: 'forests', title: 'Forests', campaign: 'world', status: 'specced',
    features: [{ title: 'Named forests', status: 'specced' }],
  }],
});

test('done task flips feature and derives topic active->done chain', () => {
  const data = mkData();
  const tasks = [{ state: 'done', refs: ['planmap:forests/named-forests'] }];
  const { changes } = reconcileBoardToPlanmap(data, tasks);
  assert.equal(data.topics[0].features[0].status, 'done');
  assert.equal(data.topics[0].status, 'done');
  assert.equal(changes.length, 2);
});

test('never downgrades; disconnected topics reported', () => {
  const data = mkData();
  data.topics[0].features[0].status = 'done';
  data.topics[0].status = 'done';
  const { changes, disconnected } = reconcileBoardToPlanmap(data, [
    { state: 'claimed', refs: ['planmap:forests/named-forests'] },
  ]);
  assert.equal(changes.length, 0);
  assert.equal(data.topics[0].status, 'done');
  assert.deepEqual(disconnected, []);
});

test('idempotent: second run yields zero changes', () => {
  const data = mkData();
  const tasks = [{ state: 'done', refs: ['planmap:forests/named-forests'] }];
  reconcileBoardToPlanmap(data, tasks);
  const second = reconcileBoardToPlanmap(data, tasks);
  assert.equal(second.changes.length, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tools/agora/planmap-reconcile-lib.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `tools/agora/planmap-reconcile-lib.mjs` by moving the pure logic out of `planmap-reconcile.mjs` lines 29–123 verbatim (slug, featureSlugs, RANK, the seen-map build, the change loop). Export:

```js
export const featureSlugs = (features) => { /* moved verbatim */ };
export function reconcileBoardToPlanmap(data, tasks) {
  // build `seen` + `topicsWithRefs` from tasks (moved verbatim)
  // apply upgrade-only changes to data.topics (moved verbatim)
  const disconnected = (data.topics ?? [])
    .filter((t) => (t.status === 'specced' || t.status === 'active') && !topicsWithRefs.has(t.id))
    .map((t) => ({ id: t.id, status: t.status }));
  return { changes, disconnected };
}
```

Rewrite `planmap-reconcile.mjs` to: fetch `/tasks`, read topics.json, call the lib, print the same output as today (including the DISCONNECTED block), write on `--apply`. Behavior and console text must not change (other docs reference it).

- [ ] **Step 4: Run tests + dry-run parity**

Run: `node --test tools/agora/planmap-reconcile-lib.test.mjs` — Expected: PASS
Run: `node tools/agora/planmap-reconcile.mjs` (daemon up) — Expected: same output style as before the refactor.

### Task 4: `sync-surfaces.mjs` core — steps, guard, health.json, run-twice golden

**Files:**
- Create: `tools/agora/sync-surfaces.mjs`
- Test: `tools/agora/sync-surfaces.test.mjs` (create)

**Interfaces:**
- Produces: `runSync({ repoRoot, agoraUrl, now, steps }) -> { ok, stepResults: [{name, ok, changed, detail}] }`; CLI `node tools/agora/sync-surfaces.mjs [--steps board,docs,tidy,health] [--dry-run]`.
- Produces: `public/planmap/health.json` shape:

```json
{
  "generatedAt": "2026-07-14T12:00:00Z",
  "lastGoodRun": "2026-07-14T12:00:00Z",
  "stepErrors": [],
  "surfaces": { "chronicleDaysSilent": 3, "atlasDaysSilent": 12 },
  "topics": {
    "<topicId>": {
      "ageDays": 4, "docsComplete": true, "openGaps": 7,
      "decisionWaiting": false, "docset": "combat"
    }
  }
}
```
- Consumes: `reconcileBoardToPlanmap` from Task 3; validator via child process.

- [ ] **Step 1: Write the failing test**

```js
// tools/agora/sync-surfaces.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSync } from './sync-surfaces.mjs';

// Build a minimal fake repo: planmap + one project docset.
const mkRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'syncrepo-'));
  fs.mkdirSync(path.join(root, 'public', 'planmap'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'projects', 'combat'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), JSON.stringify({
    campaigns: { combat: { title: 'Combat' } },
    topics: [{
      id: 'fip', title: 'Fight in place', campaign: 'combat', status: 'active',
      updated: '2026-07-01', docset: 'combat', tier: 'strategic',
      features: [{ title: 'Camera', status: 'active' }],
    }],
  }, null, 2));
  fs.writeFileSync(path.join(root, 'docs', 'projects', 'combat', 'NORTH_STAR.md'),
    '---\nschema_version: 1\nslug: combat\nstatus: active\nlast_updated: 2026-07-01\n---\n# Combat\n');
  fs.writeFileSync(path.join(root, 'docs', 'projects', 'combat', 'GAPS.md'),
    '---\nopen_gap_count: 7\n---\n');
  return root;
};

test('health step writes health.json with ages and gap counts', async () => {
  const root = mkRepo();
  const res = await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [] });
  assert.equal(res.ok, true);
  const health = JSON.parse(fs.readFileSync(path.join(root, 'public', 'planmap', 'health.json'), 'utf8'));
  assert.equal(health.topics.fip.ageDays, 13);
  assert.equal(health.topics.fip.openGaps, 7);
});

test('run-twice golden: byte-identical outputs', async () => {
  const root = mkRepo();
  const now = new Date('2026-07-14');
  await runSync({ repoRoot: root, now, steps: ['board', 'docs', 'health'], tasksProvider: async () => [] });
  const snap = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  const first = [snap('public/planmap/topics.json'), snap('public/planmap/health.json'), snap('docs/projects/combat/NORTH_STAR.md')];
  await runSync({ repoRoot: root, now, steps: ['board', 'docs', 'health'], tasksProvider: async () => [] });
  const second = [snap('public/planmap/topics.json'), snap('public/planmap/health.json'), snap('docs/projects/combat/NORTH_STAR.md')];
  assert.deepEqual(second, first);
});

test('invalid topics.json refuses all writes', async () => {
  const root = mkRepo();
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), '{ not json');
  const res = await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [] });
  assert.equal(res.ok, false);
  assert.equal(fs.existsSync(path.join(root, 'public', 'planmap', 'health.json')), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tools/agora/sync-surfaces.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the core**

`tools/agora/sync-surfaces.mjs` skeleton (health + board steps now; docs step lands in Task 5; tidy in Task 6):

```js
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
    tidy: async () => ({ changed: false, detail: 'not implemented yet (Task 6)' }),
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
```

Note for the health test: `ageDays` for `updated: 2026-07-01` at now `2026-07-14` is 13.

- [ ] **Step 4: Run tests**

Run: `node --test tools/agora/sync-surfaces.test.mjs` — Expected: PASS (the run-twice golden passes because board/docs steps are no-ops or upgrade-only and health output depends only on inputs + `now`).
Run: `node tools/agora/sync-surfaces.mjs --steps health` on the real repo — Expected: `ok health: 88 topics`, `public/planmap/health.json` appears, validator still clean.

### Task 5: Doc mirror step — 3 machine lines + roll-up rule

**Files:**
- Modify: `tools/agora/sync-surfaces.mjs` (replace the `docs` stub)
- Test: extend `tools/agora/sync-surfaces.test.mjs`

**Interfaces:**
- Produces: `rollUpStatus(statuses: string[]) -> 'active'|'specced'|'done'|'parked'` (exported for tests); NORTH_STAR.md frontmatter gains/updates exactly `status`, `planmap_topic`, `last_synced`.
- Consumes: topics with `docset` from the map.

- [ ] **Step 1: Write the failing tests**

```js
import { rollUpStatus } from './sync-surfaces.mjs';

test('roll-up: active beats specced beats all-done beats parked', () => {
  assert.equal(rollUpStatus(['done', 'active', 'parked']), 'active');
  assert.equal(rollUpStatus(['done', 'specced']), 'specced');
  assert.equal(rollUpStatus(['done', 'done']), 'done');
  assert.equal(rollUpStatus(['parked', 'superseded']), 'parked');
});

test('docs step writes the 3 machine lines and nothing else changes', async () => {
  const root = mkRepo(); // from Task 4; NORTH_STAR has status: active, last_updated: 2026-07-01
  await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['docs'], tasksProvider: async () => [] });
  const doc = fs.readFileSync(path.join(root, 'docs', 'projects', 'combat', 'NORTH_STAR.md'), 'utf8');
  assert.match(doc, /^status: active$/m);
  assert.match(doc, /^planmap_topic: fip$/m);
  assert.match(doc, /^last_synced: 2026-07-14$/m);
  assert.match(doc, /^last_updated: 2026-07-01$/m); // hand-owned line untouched
  assert.match(doc, /^# Combat$/m);                  // body untouched
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tools/agora/sync-surfaces.test.mjs`
Expected: FAIL — `rollUpStatus` not exported; docs step is a stub.

- [ ] **Step 3: Implement**

Add to `sync-surfaces.mjs`:

```js
export const rollUpStatus = (statuses) => {
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('specced')) return 'specced';
  if (statuses.length && statuses.every((s) => s === 'done')) return 'done';
  return 'parked';
};
```

Replace the `docs` step:

```js
docs: async () => {
  // Group topics by docset — several topics may share one doc folder.
  const bySlug = new Map();
  for (const t of map.topics) {
    if (!t.docset) continue;
    if (!bySlug.has(t.docset)) bySlug.set(t.docset, []);
    bySlug.get(t.docset).push(t);
  }
  let written = 0;
  for (const [slugName, topics] of bySlug) {
    const nsPath = path.join(repoRoot, 'docs', 'projects', slugName, 'NORTH_STAR.md');
    if (!fs.existsSync(nsPath)) continue;
    const status = rollUpStatus(topics.map((t) => t.status));
    // Owner topic named in the doc: the first strategic topic, else the first.
    const owner = topics.find((t) => t.tier !== 'component') ?? topics[0];
    const raw = fs.readFileSync(nsPath, 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m) continue; // no frontmatter — the audit (Task 6 of projects:audit) reports it; never invent one
    let fm = m[1];
    const setLine = (key, value) => {
      const line = `${key}: ${value}`;
      fm = new RegExp(`^${key}:.*$`, 'm').test(fm)
        ? fm.replace(new RegExp(`^${key}:.*$`, 'm'), line)
        : `${fm}\n${line}`;
    };
    setLine('status', status);
    setLine('planmap_topic', owner.id);
    // Idempotency: only bump last_synced when the mirrored values actually change.
    const next = raw.replace(m[1], fm);
    const changedBeforeStamp = next !== raw;
    if (changedBeforeStamp) setLine('last_synced', today);
    const finalText = raw.replace(m[1], fm);
    if (finalText !== raw && !dryRun) { atomicWrite(nsPath, finalText); written += 1; }
  }
  return { changed: written > 0, detail: `${written} doc(s) updated` };
},
```

- [ ] **Step 4: Run tests, including the golden**

Run: `node --test tools/agora/sync-surfaces.test.mjs` — Expected: PASS including the run-twice golden (second run rewrites nothing, so `last_synced` does not churn).

### Task 6: Board tidying — archive, handoff liveness, dead-owner flags

**Files:**
- Modify: `tools/agora/store.mjs`
- Modify: `tools/agora/server.mjs` (handoff endpoint + sweep call)
- Modify: `tools/agora/sync-surfaces.mjs` (`tidy` step calls the daemon admin endpoint)
- Test: extend `tools/agora/server.test.mjs`

**Interfaces:**
- Produces (store): `store.archiveDoneTasks({ olderThanDays = 14, now }) -> { archived: number }` — moves qualifying done tasks to `.agent/agora/archive/tasks-YYYY-MM.jsonl` (append, one JSON line each) and deletes them from live state via a journaled `task_archived` event so replay stays consistent.
- Produces (server): `POST /tasks/:id/handoff` returns 422 when the target agent id is not in the live roster; `GET /campaigns` rows gain `ownerAlive: boolean`.
- Produces (server): `POST /admin/tidy` (authed) runs `archiveDoneTasks` and returns its result — the sync program's `tidy` step calls this instead of touching store files directly.

- [ ] **Step 1: Write the failing tests** (same harness style as existing `server.test.mjs`, lines 70–239: boot `createAgoraServer` on a temp dir, register, use fetch)

```js
test('handoff to unknown agent -> 422; task stays with holder', async () => {
  // create + claim a task as agent A, then POST handoff with toAgentId: 'ghost-9999'
  // assert res.status === 422 and GET /tasks shows the task still claimed by A
});

test('archiveDoneTasks files old done tasks and survives replay', async () => {
  // create a task, walk it to done, backdate its updatedAt in the store (test seam:
  // store.__setTaskUpdatedAt(id, isoDate) — add this tiny test-only export),
  // call POST /admin/tidy, assert { archived: 1 }, GET /tasks no longer lists it,
  // the archive JSONL file contains it, and rebooting the server (createAgoraServer
  // again on the same dir) still does not list it.
});

test('campaigns expose ownerAlive=false when the lead is gone', async () => {
  // create a campaign row owned by an agent, drop the agent (or fabricate an owner
  // id that never registered), GET /campaigns, assert ownerAlive === false.
});
```

Write these as real fetch-based tests following the file's existing helpers (`register`, `authed`, base URL from the boot block).

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tools/agora/server.test.mjs`
Expected: the 3 new tests FAIL (404 on /admin/tidy, handoff accepts ghost, no ownerAlive field).

- [ ] **Step 3: Implement**

In `store.mjs` (inside `createStore`, near `sweepExpired`):

```js
const archiveDir = path.join(dir, 'archive');
function archiveDoneTasks({ olderThanDays = 14, now = Date.now() } = {}) {
  const cutoff = now - olderThanDays * 86400000;
  let archived = 0;
  for (const [id, task] of [...state.tasks]) {
    if (task.state !== 'done') continue;
    const stamp = Date.parse(task.updatedAt ?? task.createdAt ?? 0);
    if (!(stamp < cutoff)) continue;
    fs.mkdirSync(archiveDir, { recursive: true });
    const month = new Date(stamp).toISOString().slice(0, 7);
    fs.appendFileSync(path.join(archiveDir, `tasks-${month}.jsonl`), JSON.stringify(task) + '\n');
    appendJournal({ type: 'task_archived', taskId: id, at: new Date(now).toISOString() });
    state.tasks.delete(id);
    archived += 1;
  }
  return { archived };
}
```

Wire `task_archived` into the journal replay switch (delete the task id) and expose `archiveDoneTasks` on the returned store object. Match the file's existing journal helper names exactly (read the neighboring `sweepExpired` for the local idioms — event append helper, `state.tasks` shape).

In `server.mjs`:
- handoff route: before reassigning, `if (!store.getAgent(body.toAgentId)) return json(res, 422, { error: 'unknown or dead target agent' });` (use the store's existing roster lookup; check the actual helper name near the reap logic).
- campaigns GET: add `ownerAlive: Boolean(store.getAgent(row.ownerId))` per row.
- add `POST /admin/tidy` (authed like other mutations): `json(res, 200, store.archiveDoneTasks())`.

In `sync-surfaces.mjs`, replace the `tidy` stub:

```js
tidy: async () => {
  if (dryRun) return { changed: false, detail: 'dry run' };
  const res = await fetch(`${agoraUrl}/admin/tidy`, { method: 'POST', headers: authHeaders() }).catch(() => null);
  if (!res || !res.ok) return { changed: false, detail: 'daemon unreachable or refused — skipped' };
  const body = await res.json();
  return { changed: body.archived > 0, detail: `${body.archived} task(s) archived` };
},
```

(`authHeaders()`: read the token from `.agent/agora/client-identity.json` the same way `client.mjs` does; copy that small block.)

- [ ] **Step 4: Run the whole agora suite**

Run: `node --test tools/agora/server.test.mjs tools/agora/sync-surfaces.test.mjs` — Expected: ALL PASS, including every pre-existing test (the reaper and replay behavior must not regress).

### Task 7: Daemon debounce trigger + nightly wiring

**Files:**
- Modify: `tools/agora/server.mjs`
- Modify: `package.json` (scripts)
- Human step: one line in `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1` (outside the repo — Remy edits or explicitly authorizes the edit)

**Interfaces:**
- Produces: after any task-mutating route succeeds, the daemon schedules ONE `sync-surfaces` child run 60s later (new events inside the window coalesce). Exported for tests: `scheduleSyncSoon()` on the server object with `syncDelayMs` option.
- Produces: `npm run sync` → `node tools/agora/sync-surfaces.mjs`; `npm run sync:dry` → `... --dry-run`.

- [ ] **Step 1: Write the failing test**

```js
test('task mutations coalesce into one scheduled sync', async () => {
  // boot server with { syncDelayMs: 30, syncRunner: () => calls++ } (test seams),
  // create 3 tasks quickly, wait 120ms, assert calls === 1.
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tools/agora/server.test.mjs`

- [ ] **Step 3: Implement**

In `server.mjs` (near the sweep interval at line ~840):

```js
let syncTimer = null;
const runSyncChild = options.syncRunner ?? (() => {
  const { spawn } = require('node:child_process');
  const child = spawn(process.execPath, [path.join(here, 'sync-surfaces.mjs')], { stdio: 'ignore', detached: true });
  child.unref();
});
const scheduleSyncSoon = () => {
  if (syncTimer) return;
  syncTimer = setTimeout(() => { syncTimer = null; runSyncChild(); }, options.syncDelayMs ?? 60000);
  if (syncTimer.unref) syncTimer.unref();
};
```

Call `scheduleSyncSoon()` at the end of every successful task-mutating handler (create/claim/state-change/handoff/done). Match the file's existing `options`/ESM import style (use `import { spawn }` at top, not require, if the file is pure ESM — it is).

In `package.json` scripts:

```json
"sync": "node tools/agora/sync-surfaces.mjs",
"sync:dry": "node tools/agora/sync-surfaces.mjs --dry-run"
```

Nightly (human step for Remy — the ps1 lives outside the repo): add before the commit step of `aralia-daily-commit.ps1`:

```powershell
& node F:\Repos\Aralia\tools\agora\sync-surfaces.mjs *> F:\Repos\Aralia\.agent\scratch\sync-nightly.txt
```

- [ ] **Step 4: Run tests + live smoke**

Run: `node --test tools/agora/server.test.mjs` — Expected: PASS.
Smoke: with the daemon running, `node tools/agora/client.mjs` task create/done, wait ~70s, confirm `health.json` `generatedAt` moved.

### Task 8: Roadmap revival — planmap topics as first-class nodes

**Files:**
- Create: `.agent/roadmap-local/campaign-homes.json` (data)
- Create: `.agent/roadmap-local/planmap-bindings.json` (data)
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`
- Test: `devtools/roadmap/scripts/roadmap-engine/planmap-nodes.test.ts` (create; run with `npx tsx --test`)

**Interfaces:**
- Consumes: `public/planmap/topics.json` (all fields), `MAIN_PILLARS` ids from `pillars.ts`.
- Produces: nodes `planmap_<topicId>` (type 'milestone', category 'feature', `planmapTopic` set) under `pillar_<slug(home)>`, and `planmap_<topicId>__<featureSlug>` children (same featureSlugs scheme as `planmap-reconcile-lib.mjs` — copy the function into the engine file with a comment naming the source of truth). Exported: `buildPlanmapNodes(topicsDoc, homes, pillarNodeIds) -> { nodes, edges }`.
- `campaign-homes.json` shape: `{ "world": "world-exploration", "combat": "combat-systems", "tooling": "dev-tools", ... }` — one entry per planmap campaign, value is a `MainPillarId`. Unmapped campaigns fall back to `"technical-foundation-tooling"` and are listed in the node description so the gap is visible.
- `planmap-bindings.json` shape: `{ "sub_pillar_x_label": "topic-id", ... }` — replaces the in-code `PLANMAP_TOPIC_BY_NODE_ID`; loaded at generate time; missing file = empty map.

- [ ] **Step 1: Write the failing test**

```ts
// devtools/roadmap/scripts/roadmap-engine/planmap-nodes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanmapNodes } from './generate';

const topicsDoc = {
  topics: [
    { id: 'forests', title: 'Forests', campaign: 'world', status: 'active',
      features: [{ title: 'Named forests', status: 'done' }] },
    { id: 'mystery', title: 'Mystery', campaign: 'unmapped-campaign', status: 'specced' },
  ],
};
const homes = { world: 'world-exploration' };
const pillarIds = new Map([
  ['world-exploration', 'pillar_world_exploration'],
  ['technical-foundation-tooling', 'pillar_technical_foundation_tooling'],
]);

test('topics become bound nodes under their campaign home', () => {
  const { nodes, edges } = buildPlanmapNodes(topicsDoc as never, homes, pillarIds);
  const topicNode = nodes.find((n) => n.id === 'planmap_forests');
  assert.ok(topicNode);
  assert.equal(topicNode!.planmapTopic, 'forests');
  assert.equal(topicNode!.status, 'active'); // active -> active
  assert.ok(edges.some((e) => e.from === 'pillar_world_exploration' && e.to === 'planmap_forests'));
  const child = nodes.find((n) => n.id === 'planmap_forests__named-forests');
  assert.equal(child!.status, 'done');
});

test('unmapped campaign falls back to tooling pillar; specced reads planned', () => {
  const { nodes, edges } = buildPlanmapNodes(topicsDoc as never, homes, pillarIds);
  const n = nodes.find((x) => x.id === 'planmap_mystery')!;
  assert.equal(n.status, 'planned');
  assert.ok(edges.some((e) => e.from === 'pillar_technical_foundation_tooling' && e.to === 'planmap_mystery'));
});

test('no duplicate ids across topics and features', () => {
  const { nodes } = buildPlanmapNodes(topicsDoc as never, homes, pillarIds);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test devtools/roadmap/scripts/roadmap-engine/planmap-nodes.test.ts`
Expected: FAIL — `buildPlanmapNodes` not exported.

- [ ] **Step 3: Implement in `generate.ts`**

1. Replace the constant map usage: load bindings from `.agent/roadmap-local/planmap-bindings.json` at the top of `generateRoadmapData()` (`fs.existsSync ? JSON.parse : {}`) and pass it to every existing `attachPlanmapTopic(node, bindings)` call. Keep the exported `PLANMAP_TOPIC_BY_NODE_ID` as `{}` for compatibility, with a comment pointing at the data file.
2. Add and export:

```ts
const PLANMAP_STATUS_TO_BASE: Record<string, RoadmapNode['status']> = {
  done: 'done', active: 'active', specced: 'planned', parked: 'planned', superseded: 'planned',
};

export function buildPlanmapNodes(
  topicsDoc: { topics: Array<Record<string, unknown>> },
  homes: Record<string, string>,
  pillarNodeIds: Map<string, string>,
): { nodes: RoadmapNode[]; edges: RoadmapEdge[] } {
  const nodes: RoadmapNode[] = [];
  const edges: RoadmapEdge[] = [];
  const FALLBACK = 'technical-foundation-tooling';
  for (const t of topicsDoc.topics ?? []) {
    const topic = t as { id: string; title: string; campaign?: string; status: string; sub?: string; link?: string; features?: Array<{ title: string; status: string }> };
    const home = homes[topic.campaign ?? ''] ?? FALLBACK;
    const pillarNodeId = pillarNodeIds.get(home) ?? pillarNodeIds.get(FALLBACK);
    if (!pillarNodeId) continue;
    const id = `planmap_${topic.id}`;
    nodes.push({
      id, label: topic.title, type: 'milestone', category: NODE_CATEGORIES.feature,
      sourceKind: 'planmap', feature: topic.title, featureCategory: 'Planmap',
      status: PLANMAP_STATUS_TO_BASE[topic.status] ?? 'planned',
      planmapTopic: topic.id,
      initialX: 0, initialY: 0, color: DOMAIN_COLORS.default,
      description: topic.sub ?? '', link: topic.link,
    } as RoadmapNode);
    edges.push({ from: pillarNodeId, to: id, type: 'containment' });
    const slugs = planmapFeatureSlugs(topic.features ?? []); // copied scheme, see below
    (topic.features ?? []).forEach((f, i) => {
      const childId = `planmap_${topic.id}__${slugs[i]}`;
      nodes.push({
        id: childId, label: f.title, type: 'milestone', category: NODE_CATEGORIES.feature,
        sourceKind: 'planmap', feature: topic.title, featureCategory: 'Planmap',
        status: PLANMAP_STATUS_TO_BASE[f.status] ?? 'planned', planmapTopic: topic.id,
        initialX: 0, initialY: 0, color: DOMAIN_COLORS.default, description: '',
      } as RoadmapNode);
      edges.push({ from: id, to: childId, type: 'containment' });
    });
  }
  return { nodes, edges };
}
```

`planmapFeatureSlugs`: copy the counted-duplicate scheme from `tools/agora/planmap-reconcile-lib.mjs` verbatim, with the comment `// SHARED SCHEME with tools/agora/planmap-reconcile-lib.mjs — must stay identical`.
3. In `generateRoadmapData()`, after the pillar loop and before `relaxNodeCollisions(nodes)`:

```ts
const topicsPath = path.resolve(process.cwd(), 'public', 'planmap', 'topics.json');
const homesPath = path.resolve(process.cwd(), '.agent', 'roadmap-local', 'campaign-homes.json');
if (fs.existsSync(topicsPath)) {
  const topicsDoc = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
  const homes = fs.existsSync(homesPath) ? JSON.parse(fs.readFileSync(homesPath, 'utf8')) : {};
  const pillarNodeIds = new Map(MAIN_PILLARS.map((p) => [p.id, `pillar_${slug(p.id)}`]));
  const pm = buildPlanmapNodes(topicsDoc, homes, pillarNodeIds);
  for (const n of pm.nodes) { nodeIds.register(n.id, `planmap: ${n.label}`); nodes.push(n); }
  edges.push(...pm.edges);
}
```

Position note: leave `initialX/initialY` 0 and let `relaxNodeCollisions` spread them; saved `layout.json` positions override client-side anyway.
4. Seed `.agent/roadmap-local/campaign-homes.json` with the 10 real campaigns (from `topics.json` `campaigns` keys) mapped to pillar ids — propose: world→world-exploration, combat→combat-systems, travel→world-exploration, character→character-systems, spells→combat-systems, sim→world-exploration, rendering→technical-foundation-tooling, ui→ui-player-surfaces, agents→dev-tools, tooling→dev-tools. This seeding is REVIEWED at the Task 10 gate before it is treated as final.
5. Seed `.agent/roadmap-local/planmap-bindings.json` as `{}`.

- [ ] **Step 4: Run tests + live graph smoke**

Run: `npx tsx --test devtools/roadmap/scripts/roadmap-engine/planmap-nodes.test.ts` — Expected: PASS.
Smoke: start the roadmap server (preview config `dev:roadmap`, port 3010), fetch `/Aralia/api/roadmap/data`, assert HTTP 200 (no id-collision 500) and that `nodes` contains `planmap_forests`. Then load the page and screenshot it (visual rule).

### Task 9: `projects:audit` checks the machine lines

**Files:**
- Modify: `scripts/audit-living-project-docs.cjs`
- Test: run against a fixture folder

- [ ] **Step 1: Add the check.** In the per-project audit section (where frontmatter fields are validated), load `public/planmap/topics.json` once; for each project slug, find topics with `docset === slug`; when at least one exists, compute the roll-up (same rule as Task 5 — inline the 8-line function with a comment naming `sync-surfaces.mjs` as the source of truth) and report a finding when `status` in NORTH_STAR frontmatter differs, when `planmap_topic` names a topic that does not exist, or when `last_synced` is malformed. Follow the script's existing findings format (it emits JSON).

- [ ] **Step 2: Verify both directions.** Run `npm run projects:audit` — expected: combat (and any docset-linked project) passes once Task 5's sync has run; hand-edit a `status:` line to a wrong word, re-run, expected: the new finding appears; revert the hand edit.

### Task 10R: The absorption wave (replaces Task 10)

**Files:**
- Create: `tools/agora/seed-absorption-wave.mjs` (one board task per docs/projects folder, refs `planmap:planning-surface-freshness/absorption-wave`)
- Create: `docs/superpowers/plans/absorption-playbook.md` (the subagent brief below, verbatim)

**Per-project subagent brief (the playbook):**

```
You are migrating one project tracker card into the Aralia planmap, then deleting its folder.
Project folder: docs/projects/<SLUG>/. Acquire the Agora lock on public/planmap/topics.json first
(node tools/agora/client.mjs lock public/planmap/topics.json); release when done.

1. DEDUPE. Search public/planmap/topics.json for a topic already covering this project
   (id == slug, then title-word overlap). If found: enrich that topic (steps 3-5 apply to it);
   do not create a duplicate.
2. TILE. Else create a topic via node tools/agora/planmap-add.mjs: id = slug, title from
   NORTH_STAR "project:" field, campaign from the lane map in the wave seeder output,
   tier "component" (use "strategic" only if the folder clearly describes a flagship campaign),
   status via the conversion table in the spec (docs/superpowers/specs/2026-07-14-planning-surface-freshness-design.md),
   status_note for any nuance the 5 words cannot hold.
3. GAPS -> STEPS. Each OPEN gap row in GAPS.md becomes a feature: title "<GapID> <issue summary>",
   status active (or parked if the gap is explicitly deferred), decision: true when the row
   requires a human decision.
4. DONE WORK -> HISTORY. Each completed/verified piece of work evidenced in TRACKER.md or GAPS.md
   becomes a done feature with history.built backdated to the evidence date (YYYY-MM-DD from the row).
5. DISTILL. If the folder holds still-valuable prose (runbook steps, live design decisions,
   cold-start context that agents still need), write ONE spec doc
   docs/superpowers/specs/2026-07-14-absorbed-<SLUG>.md holding it, and set the topic link to it.
   Skip when nothing is worth keeping.
6. DELETE. Remove the whole docs/projects/<SLUG>/ folder (git history is the archive).
7. VALIDATE. node tools/agora/validate-planmap.mjs must exit 0. If it fails, fix your edits;
   never leave the map invalid. Release the lock. Report: topic id, features added, doc distilled
   (path or "none"), folder deleted (yes), validator clean (yes).
```

- [ ] **Step 1: Write the seeder.** `seed-absorption-wave.mjs`: list `docs/projects/*/` folders (skip non-folders and `PROJECT_TRACKER.md`), skip slugs already migrated (no folder = done), and POST one Agora task each (title `absorb docs/projects/<slug>`, refs as above, description = playbook path + slug + campaign-lane suggestion from the main_category map in the old Task 10). `--dry-run` prints the task list.
- [ ] **Step 2: Dry-run and gate.** Run `node tools/agora/seed-absorption-wave.mjs --dry-run`; show Remy the list (count, lanes). On his approval, seed for real.
- [ ] **Step 3: Dispatch.** Subagents claim tasks off the board (fleet rules: Haiku for simple cards, Fable 5 where judgment on content is needed). Verify each result: validator clean, folder gone, tile present.

### Task 12R: Tracker retirement (replaces Task 12; runs only when the wave is complete)

- [ ] Confirm `docs/projects/` holds no project folders. Then delete `misc/project_tracker.html`, `misc/project_tracker.js`, `misc/project_detail*.js`, `misc/project_ui*.js`, `misc/project_filter_ui*.js`, `docs/projects/PROJECT_TRACKER.md`, `scripts/audit-living-project-docs.cjs`; remove the `projects:audit` npm script; remove the `/api/projects/*` handlers in `scripts/vite-plugins/devhub/projectRoutes.ts` (leave the file exporting a no-op if other routes import it). Grep for `project_tracker` and `projects/dashboard` to catch stragglers; fix references.
- [ ] Verify: main dev server boots clean; planmap page loads; `npm run typecheck` if routes were TypeScript.

### Task 10 (SUPERSEDED by Task 10R — kept for reference): The gated one-time migration

**Files:**
- Create: `tools/agora/planmap-migrate.mjs`
- Test: `tools/agora/planmap-migrate.test.mjs` (create)

**Interfaces:**
- Consumes: `docs/projects/*/NORTH_STAR.md` + `GAPS.md` frontmatter; `public/planmap/topics.json`; git history of topics.json (`git log --format=%as -- public/planmap/topics.json` style backfill); `.agent/roadmap-local/campaign-homes.json`.
- Produces: `--dry-run` (default) prints 3 tables to stdout and writes `.agent/scratch/planmap-migration-plan.json`; `--apply` executes exactly that plan file (refuses if it is missing or stale by content hash).

**Behavior (all from the spec):**
1. Fold table: every docs/projects folder with no matching topic (by `docset` link or id match) becomes `{ id: <slug>, title: <from NORTH_STAR project field>, campaign: <mapped from main_category via a small in-file table>, tier: 'component', docset: <slug>, status: <converted> }`. Status conversion table (verbatim from spec): active→active; complete/complete_for_current_gap_set/"complete for World-owned scope"→done (+status_note); idle→parked; partial→active; review-required→active; merged-reference/reference-only/linked-support→superseded (+status_note original label); missing→listed as NEEDS-HUMAN in the table.
2. Link table: the 32 matched topics get `docset` set (match by exact id=slug first, then the fuzzy title match; print match basis).
3. Stamp pass: every existing topic without `updated` gets it backfilled from the last git commit date that changed its entry (fallback: file's last commit date); every topic without `tier` gets `strategic`.
4. Close `planmap-roadmap-sync`: `status: 'superseded'`, `killed: 'superseded by planning-surface-freshness (2026-07-14 design)'`.
5. After `--apply`: run the validator; non-zero exit = restore the pre-apply backup it wrote to `.agent/scratch/topics.pre-migration.json` and report.

- [ ] **Step 1: Write failing tests** — fixture repo (reuse the Task 4 `mkRepo` pattern, plus 2 extra project folders: one with `status: idle` and no topic, one whose slug matches an existing topic id). Assert: dry-run writes the plan JSON with a fold row (`idle→parked`), a link row, and stamps; apply produces a validator-clean topics.json with the new component topic; apply twice = second apply reports "nothing to do".

- [ ] **Step 2: Run to verify they fail.** `node --test tools/agora/planmap-migrate.test.mjs`

- [ ] **Step 3: Implement** exactly the behaviors above. Table printing: plain aligned columns (`slug | new topic id | seeded status | note`). Campaign mapping from `main_category` (in-file map: "Game & Simulation"→world, "Combat & Encounters"→combat, UI categories→ui, tooling/docs categories→tooling; anything unmapped→tooling with a NEEDS-HUMAN note in the table).

- [ ] **Step 4: Run tests.** Expected: PASS.

- [ ] **Step 5: THE GATE (human).** Run `node tools/agora/planmap-migrate.mjs` on the real repo (lock topics.json first). Present the 3 printed tables to Remy via AskUserQuestion. Only on explicit approval run `--apply`, re-run the validator, run `npm run sync` once, then release the lock. If Remy edits mappings, regenerate the dry-run and re-present.

### Task 11: Planmap page — age, health, tier filter, last-run banner

**Files:**
- Modify: `public/planmap/index.html`
- Verify: screenshots (visual rule) — no unit tests for this task

**Interfaces:**
- Consumes: `public/planmap/health.json` (Task 4 shape) fetched alongside topics.json.

- [ ] **Step 1: Load health.json.** At line ~639, change `fetch('./topics.json').then(...)` to:

```js
Promise.all([
  fetch('./topics.json').then((r) => r.json()),
  fetch('./health.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
]).then(([data, health]) => {
```

Keep the existing error banner path working (health may be null — every use below must tolerate that).

- [ ] **Step 2: Badges.** Add a helper near `renderTopicDetail` (line ~1397):

```js
const healthBadges = (t) => {
  const h = health && health.topics && health.topics[t.id];
  if (!h) return '';
  const bits = [];
  if (h.ageDays != null) bits.push(`<span class="hbadge ${h.ageDays > 30 ? 'stale' : ''}" title="days since last change">${h.ageDays}d</span>`);
  if (h.openGaps != null) bits.push(`<span class="hbadge" title="open gaps">${h.openGaps} gaps</span>`);
  if (h.docsComplete === false) bits.push(`<span class="hbadge warn" title="doc set incomplete">docs</span>`);
  if (h.decisionWaiting) bits.push(`<span class="hbadge decide" title="a decision is waiting on you">decide</span>`);
  return bits.join('');
};
```

Insert `${healthBadges(t)}` into the topic tile template (find the tile HTML construction; it is the map over `data.topics` that builds the board) and into `renderTopicDetail`. Add CSS classes `.hbadge` (small pill, muted), `.hbadge.stale` (amber), `.hbadge.warn` (amber), `.hbadge.decide` (red) beside the page's existing badge styles.

- [ ] **Step 3: Tier filter + banner.** Add a checkbox control next to the existing hint bar: `show detail topics` (default OFF hides `tier === 'component'` topics from the board; detail pane unaffected). Add a top-right banner div: `synced <n>h ago` from `health.generatedAt`, red text `sync has not run for <n> days` when older than 48 hours, and `health.json missing — run npm run sync` when health is null.

- [ ] **Step 4: Eyeball with screenshots.** Serve via the `planmap` launch config (port 5183), screenshot: (a) board with badges, (b) detail pane, (c) tier filter off/on, (d) the banner with a hand-aged health.json. Fix what looks wrong before calling it done. Present the screenshots to Remy.

### Task 12: Tracker page forwards to planmap

**Files:**
- Modify: `misc/project_tracker.html`

**Precondition:** Task 11 approved by Remy (health parity confirmed on the planmap page).

- [ ] **Step 1: Replace content with the redirect-stub pattern.** Copy the structure of `misc/agent_matrix.html` (the existing "moved" stub): a short page saying "The project tracker moved into the plan map" with a link + `location.replace` to `/Aralia/planmap/index.html` after 2 seconds. Keep `misc/project_tracker.js` and API routes untouched (other pages import pieces; removal is a later cleanup, not this plan).

- [ ] **Step 2: Verify.** Open `misc/project_tracker.html` via the dev server; confirm the forward lands on the planmap page.

---

## Self-Review (done at write time)

- Spec coverage: schema fields (T1), stamps (T2), board→planmap (T3/T4), health (T4), doc mirrors + roll-up (T5), audit check (T9), board tidying WF-G15/G17 (T6), triggers live+nightly (T7), roadmap revival + bindings + campaign homes (T8), migration + gates (T10), UI + stale visibility (T11), tracker forward (T12). Chronicle/atlas visibility = `surfaces` block in health.json (T4). Spec's "refuse on invalid map" = T4 guard.
- No placeholders: every code step carries real code or an exact verbatim-move instruction with line ranges.
- Type consistency: `runSync`/`rollUpStatus`/`reconcileBoardToPlanmap`/`buildPlanmapNodes` signatures match across tasks; `planmap_<topicId>__<featureSlug>` used consistently; health.json shape identical in T4 and T11.
- Repo rules honored: no commit steps anywhere; Agora lock called out where topics.json is written (T10 gate); external ps1 edit marked as a human step (T7).
