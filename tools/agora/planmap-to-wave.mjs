#!/usr/bin/env node
/**
 * planmap-to-wave.mjs — turn a plan-map topic into an orchestration wave SKELETON.
 *
 *   node tools/agora/planmap-to-wave.mjs fip-slice1 [--out .agent/scratch/orchestrate/fip-slice1.json]
 *
 * Emits one packet per sub-feature (skipping status "done"), with:
 *   - "after" chaining following the features array order (list order IS the
 *     intra-node build sequence, same convention the viewer renders)
 *   - refs: ["planmap:<topicId>/<feature-slug>"] — the convention
 *     planmap-reconcile.mjs matches completed Agora tasks back against
 *   - guidance pointing at the sub-feature's spec doc
 *
 * SKELETON ONLY: fill in files/agent/guidance by hand before `orchestrate seed`.
 * (Deliberately no LLM auto-fill — that's an agent's job, not this script's.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(repo, 'public', 'planmap', 'topics.json'), 'utf8'));

const topicId = process.argv[2];
const topic = data.topics.find((t) => t.id === topicId);
if (!topic) {
  console.error(`unknown topic "${topicId}". Known: ${data.topics.map((t) => t.id).join(', ')}`);
  process.exit(1);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// SHARED SCHEME with planmap-reconcile.mjs (must stay identical or the truth-loop
// breaks): slugs are computed over the FULL features array (done included, so
// indices never shift), and duplicate base slugs get -2, -3... by occurrence order.
const featureSlugs = (feats) => {
  const counts = new Map();
  return feats.map((f) => {
    const base = slug(f.title);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};
const allFeatures = topic.features ?? [];
const allSlugs = featureSlugs(allFeatures);
const features = allFeatures
  .map((f, i) => ({ f, slug: allSlugs[i] }))
  .filter(({ f }) => f.status !== 'done');
if (!features.length) {
  console.error(`topic "${topicId}" has no non-done features to turn into packets`);
  process.exit(1);
}

let prevId = null;
const packets = features.map(({ f, slug: fslug }, i) => {
  const id = `PK-${i + 1}`;
  const p = {
    id,
    handle: fslug,
    agent: 'claude',
    scope: f.title,
    files: ['TODO: list the packet-owned files (disjoint across packets)'],
    issues: [],
    priority: i + 1,
    after: prevId ? [prevId] : [],
    refs: [`planmap:${topicId}/${fslug}`],
    guidance: (f.link ? `Spec: ${f.link}. ` : '') +
      `Sub-feature of "${topic.title}"${topic.link ? ` (parent spec: ${topic.link})` : ''}. TODO: paste the grilled scope.`,
  };
  prevId = id;
  return p;
});

const plan = {
  wave: `${topicId}-wave`,
  scope: `${topic.title} — ${topic.sub ?? ''}`.trim(),
  packets,
};

const outIdx = process.argv.indexOf('--out');
const out = outIdx >= 0
  ? path.resolve(repo, process.argv[outIdx + 1])
  : path.join(repo, '.agent', 'scratch', 'orchestrate', `${topicId}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(plan, null, 2) + '\n');
console.log(`wave skeleton (${packets.length} packets) → ${path.relative(repo, out)}`);
console.log('fill in files/guidance/agent AND REVIEW "after": the chain only mirrors');
console.log('list order, NOT real dependencies — delete "after" entries between packets');
console.log('that can run in parallel (false chains waste the whole fleet). Then: orchestrate seed <plan>');
