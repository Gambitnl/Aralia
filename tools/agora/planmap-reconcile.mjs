#!/usr/bin/env node
/**
 * planmap-reconcile.mjs — close the status-rot loop: reflect DONE Agora tasks
 * back onto plan-map statuses. (The old feature-tree roadmap died of manual,
 * never-updated statuses; this is the antidote.)
 *
 *   node tools/agora/planmap-reconcile.mjs           # dry run — prints the diff
 *   node tools/agora/planmap-reconcile.mjs --apply   # write the flips
 *
 * Matching convention: an Agora task counts toward a plan-map feature when its
 * refs contain "planmap:<topicId>/<feature-slug>" (planmap-to-wave.mjs emits
 * these automatically). Rules:
 *   - task done  → feature status "done"
 *   - any task claimed/in-flight on a feature → feature at least "active"
 *   - all features of a topic done → topic "done" (else if any active → "active")
 * Standalone by design: does NOT edit orchestrate.mjs (that file is hot,
 * shared with other agents).
 *
 * Pure reconcile logic lives in planmap-reconcile-lib.mjs (importable by
 * sync-surfaces.mjs); this file is just the fetch/read/print/write shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileBoardToPlanmap } from './planmap-reconcile-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const file = path.join(repo, 'public', 'planmap', 'topics.json');
const BASE = process.env.AGORA_URL || 'http://localhost:4319';
const apply = process.argv.includes('--apply');

const res = await fetch(`${BASE}/tasks`).catch((e) => {
  console.error(`Agora daemon unreachable at ${BASE}: ${e.message}`);
  process.exit(1);
});
const body = await res.json();
const tasks = body.tasks ?? body ?? [];
if (!Array.isArray(tasks)) {
  console.error('unexpected /tasks response shape');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const { changes, disconnected, evidence } = reconcileBoardToPlanmap(data, tasks);

// The highest-value signal this tool emits: topics the plan-map claims are in
// motion (specced/active) but which NO board task references. Reconcile is a
// board→plan-map one-way sync — for these topics there is nothing to sync FROM,
// so their status can only rot (the feature-tree's death). Surface them loudly.
function reportDisconnected() {
  if (!disconnected.length) return;
  console.log('\nDISCONNECTED (reconcile can never fix these):');
  for (const t of disconnected) {
    console.log(`  ${t.id} [${t.status}] — no board task carries a planmap:${t.id}/ ref; seed a wave (planmap-to-wave.mjs ${t.id}) or park it`);
  }
}

if (!evidence) {
  console.log('no Agora tasks carry planmap:<topic>/<feature> refs — nothing to reconcile');
  reportDisconnected();
  process.exit(0);
}

if (!changes.length) {
  console.log('plan-map already agrees with the board — no changes');
  reportDisconnected();
  process.exit(0);
}
console.log(`${apply ? 'applying' : 'DRY RUN —'} ${changes.length} change(s):`);
for (const c of changes) console.log(`  ${c}`);
if (apply) {
  // Locks are advisory — enforce them before the write (2026-07-14 incident).
  const { guardWriteOrDie } = await import('./lockGuard.mjs');
  await guardWriteOrDie(path.relative(repo, file).replace(/\\/g, '/'), {
    toolName: 'planmap-reconcile',
    force: process.argv.includes('--force-no-lock'),
  });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('written. Re-run validate-planmap.mjs if you also hand-edited.');
} else {
  console.log('re-run with --apply to write');
}
reportDisconnected();
