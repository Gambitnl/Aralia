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
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const file = path.join(repo, 'public', 'planmap', 'topics.json');
const BASE = process.env.AGORA_URL || 'http://localhost:4319';
const apply = process.argv.includes('--apply');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// SHARED SCHEME with planmap-to-wave.mjs (must stay identical or the truth-loop
// breaks): slugs are computed over the FULL features array (done included, so
// indices never shift), and duplicate base slugs get -2, -3... by occurrence order.
const featureSlugs = (features) => {
  const counts = new Map();
  return features.map((f) => {
    const base = slug(f.title);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};
const RANK = { parked: 0, specced: 1, active: 2, done: 3 };

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

// planmap:<topic>/<featureSlug> → strongest state seen across tasks
const seen = new Map();
// Topic ids that have ANY board task referencing them (any state, feature-level
// or not) — used for the disconnected-topic warning below. A topic absent from
// this set has zero board presence, so reconcile can NEVER update it.
const topicsWithRefs = new Set();
for (const t of tasks) {
  for (const ref of t.refs ?? []) {
    const anyTopic = /^planmap:([a-z0-9-]+)(?:\/|$)/.exec(ref);
    if (anyTopic) topicsWithRefs.add(anyTopic[1]);
    const m = /^planmap:([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(ref);
    if (!m) continue;
    const key = `${m[1]}/${m[2]}`;
    // Daemon states (store.mjs TASK_STATES): open | claimed | in_progress | blocked | done.
    // Only done and genuinely in-flight states are evidence — open AND blocked are not
    // (a blocked task is stalled, not being worked on).
    const state = t.state === 'done' ? 'done'
      : (t.state === 'claimed' || t.state === 'in_progress') ? 'active'
      : null;
    if (!state) continue;
    const cur = seen.get(key);
    if (!cur || RANK[state] > RANK[cur]) seen.set(key, state);
  }
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// The highest-value signal this tool emits: topics the plan-map claims are in
// motion (specced/active) but which NO board task references. Reconcile is a
// board→plan-map one-way sync — for these topics there is nothing to sync FROM,
// so their status can only rot (the feature-tree's death). Surface them loudly.
function reportDisconnected() {
  const orphans = (data.topics ?? []).filter(
    (t) => (t.status === 'specced' || t.status === 'active') && !topicsWithRefs.has(t.id),
  );
  if (!orphans.length) return;
  console.log('\nDISCONNECTED (reconcile can never fix these):');
  for (const t of orphans) {
    console.log(`  ${t.id} [${t.status}] — no board task carries a planmap:${t.id}/ ref; seed a wave (planmap-to-wave.mjs ${t.id}) or park it`);
  }
}

if (!seen.size) {
  console.log('no Agora tasks carry planmap:<topic>/<feature> refs — nothing to reconcile');
  reportDisconnected();
  process.exit(0);
}

const changes = [];
for (const topic of data.topics) {
  const slugs = featureSlugs(topic.features ?? []);
  (topic.features ?? []).forEach((f, i) => {
    const evidence = seen.get(`${topic.id}/${slugs[i]}`);
    if (evidence && RANK[evidence] > RANK[f.status]) {
      changes.push(`"${topic.id}" / "${f.title}": ${f.status} → ${evidence}`);
      f.status = evidence;
    }
  });
  const feats = topic.features ?? [];
  if (feats.length) {
    const target = feats.every((f) => f.status === 'done') ? 'done'
      : feats.some((f) => f.status === 'active' || f.status === 'done') ? 'active'
      : null;
    if (target && RANK[target] > RANK[topic.status]) {
      changes.push(`"${topic.id}": ${topic.status} → ${target} (derived from features)`);
      topic.status = target;
    }
  }
}

if (!changes.length) {
  console.log('plan-map already agrees with the board — no changes');
  reportDisconnected();
  process.exit(0);
}
console.log(`${apply ? 'applying' : 'DRY RUN —'} ${changes.length} change(s):`);
for (const c of changes) console.log(`  ${c}`);
if (apply) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('written. Re-run validate-planmap.mjs if you also hand-edited.');
} else {
  console.log('re-run with --apply to write');
}
reportDisconnected();
