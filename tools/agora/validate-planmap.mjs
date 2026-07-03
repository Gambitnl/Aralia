#!/usr/bin/env node
/**
 * validate-planmap.mjs — sanity-check public/planmap/topics.json.
 *
 * Hand-rolled checks (no ajv dependency, keeps the tool zero-install):
 *   - required fields + enum values (mirrors topics.schema.json)
 *   - unique topic ids; every deps[].id resolves to a real topic
 *   - every link / features[].link file exists on disk
 *   - campaign keys resolve
 * Exit 0 = clean, 1 = problems (printed as a flat list).
 *
 * Run after hand-editing, before seeding a wave: node tools/agora/validate-planmap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const file = path.join(repo, 'public', 'planmap', 'topics.json');

const STATUSES = new Set(['parked', 'specced', 'active', 'done', 'superseded']);
const KINDS = new Set(['hard', 'chosen']);
const COLORS = new Set(['purple', 'teal', 'gray', 'coral', 'pink']);
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
// Same base slug as planmap-to-wave.mjs / planmap-reconcile.mjs.
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const problems = [];
const warn = (msg) => problems.push(msg);

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`FATAL: ${file} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const topics = Array.isArray(data.topics) ? data.topics : [];
const campaigns = data.campaigns || {};
const ids = new Set();

for (const t of topics) {
  const where = `topic "${t.id ?? t.title ?? '?'}"`;
  if (!t.id) warn(`${where}: missing id`);
  else if (!ID_RE.test(t.id)) warn(`${where}: id violates pattern ^[a-z0-9][a-z0-9-]*$ (breaks planmap:<id>/<slug> refs and the viewer)`);
  else if (ids.has(t.id)) warn(`duplicate topic id "${t.id}"`);
  else ids.add(t.id);
  if (!t.title) warn(`${where}: missing title`);
  if (!t.campaign) warn(`${where}: missing campaign`);
  else if (!campaigns[t.campaign]) warn(`${where}: unknown campaign "${t.campaign}"`);
  if (!STATUSES.has(t.status)) warn(`${where}: invalid status "${t.status}"`);
  if (t.status === 'superseded' && !t.killed) warn(`${where}: superseded but no "killed" reason (the why-we-didn't is the whole point of the Graveyard)`);
  const slugSeen = new Map();
  for (const f of t.features ?? []) {
    if (!f.title) warn(`${where}: feature missing title`);
    if (!STATUSES.has(f.status)) warn(`${where} / "${f.title}": invalid status "${f.status}"`);
    if (f.status === 'superseded' && !f.killed) warn(`${where} / "${f.title}": superseded but no "killed" reason`);
    if (f.open != null && (!Number.isInteger(f.open) || f.open < 0)) warn(`${where} / "${f.title}": "open" must be an integer >= 0 (got ${JSON.stringify(f.open)})`);
    if (f.spike != null && typeof f.spike !== 'boolean') warn(`${where} / "${f.title}": "spike" must be boolean`);
    // Base-slug collisions get -2/-3 suffixes in to-wave/reconcile, but the
    // suffix depends on array order — flag them so authors rename instead.
    const s = slug(f.title);
    if (slugSeen.has(s)) warn(`${where}: feature slug collision "${s}" ("${slugSeen.get(s)}" vs "${f.title}") — rename one; order-dependent -N suffixes are fragile`);
    else slugSeen.set(s, f.title);
  }
}

// At most one focus topic (capacity-of-one shop — two stars mean neither is real).
{
  const focused = topics.filter((t) => t.focus === true).map((t) => t.id);
  if (focused.length > 1) warn(`multiple topics have focus: true (${focused.join(', ')}) — only one thing is actually being touched; pick it`);
}

// Campaign color enum (mirrors topics.schema.json + the viewer's COLORS map).
for (const [key, c] of Object.entries(campaigns)) {
  if (!c || typeof c !== 'object') { warn(`campaign "${key}": not an object`); continue; }
  if (!c.label) warn(`campaign "${key}": missing label`);
  if (!COLORS.has(c.color)) warn(`campaign "${key}": invalid color "${c.color}" (known: ${[...COLORS].join(', ')})`);
}

// Referential integrity (deps) — after ids are collected.
const topicById = Object.fromEntries(topics.filter((t) => t.id).map((t) => [t.id, t]));
for (const t of topics) {
  for (const d of t.deps ?? []) {
    const dep = typeof d === 'string' ? { id: d } : d;
    if (!ids.has(dep.id)) warn(`topic "${t.id}": dep "${dep.id}" does not exist`);
    if (dep.kind && !KINDS.has(dep.kind)) warn(`topic "${t.id}": dep "${dep.id}" invalid kind "${dep.kind}"`);
    if (typeof d === 'object' && !d.why) warn(`topic "${t.id}": dep "${dep.id}" has no "why" (every arrow should explain itself)`);
    // Edge-to-member: dep.feature narrows the arrow to one feature (by slug of its
    // title) inside the target topic, rather than the whole topic.
    if (typeof d === 'object' && d.feature != null) {
      if (typeof d.feature !== 'string') {
        warn(`topic "${t.id}": dep "${dep.id}" "feature" must be a string (got ${JSON.stringify(d.feature)})`);
      } else {
        const target = topicById[dep.id];
        const targetFeatures = target?.features ?? [];
        if (targetFeatures.length === 0) {
          warn(`topic "${t.id}": dep "${dep.id}" has "feature": "${d.feature}" but target topic "${dep.id}" has no features`);
        } else {
          const featureSlugs = targetFeatures.map((f) => slug(f.title));
          if (!featureSlugs.includes(d.feature)) {
            warn(`topic "${t.id}": dep "${dep.id}" "feature": "${d.feature}" matches no feature of "${dep.id}" — available: ${featureSlugs.join(', ')}`);
          }
        }
      }
    }
  }
}

// Dependency cycle detection (DFS, three-color). The viewer mis-columns
// silently on cycles — catch them here instead.
{
  const byId = new Map(topics.filter((t) => t.id).map((t) => [t.id, t]));
  const state = new Map(); // id → 'visiting' | 'done'
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const start = trail.indexOf(id);
      warn(`dependency cycle: ${[...trail.slice(start), id].join(' → ')}`);
      return;
    }
    state.set(id, 'visiting');
    const t = byId.get(id);
    for (const d of t?.deps ?? []) {
      const depId = typeof d === 'string' ? d : d.id;
      if (byId.has(depId)) visit(depId, [...trail, id]);
    }
    state.set(id, 'done');
  };
  for (const t of topics) if (t.id) visit(t.id, []);
}

// Link existence — repo-relative paths.
const checkLink = (owner, link) => {
  if (!link) return;
  if (!fs.existsSync(path.join(repo, link))) warn(`${owner}: broken link ${link}`);
};
for (const t of topics) {
  checkLink(`topic "${t.id}"`, t.link);
  for (const f of t.features ?? []) checkLink(`topic "${t.id}" / "${f.title}"`, f.link);
}

// Open-question drift (hard): the hand-copied "open: n" on a feature/topic mirrors
// the count of "- " bullets under the linked doc's "## Open" heading. Nothing kept
// them honest, so they rot. Parse the doc and compare. Returns the bullet count, or
// null when the doc has no Open section at all.
const countOpenBullets = (link) => {
  const abs = path.join(repo, link);
  if (!fs.existsSync(abs)) return undefined; // broken link — already reported
  let lines;
  try {
    lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  } catch { return undefined; }
  // Tolerate "## Open", "## Open questions", case-insensitive.
  const start = lines.findIndex((l) => /^##\s+open\b/i.test(l));
  if (start === -1) return null; // no Open section
  let count = 0;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break; // next heading ends the section
    if (/^\s*-\s/.test(lines[i])) count++;
  }
  return count;
};
const checkOpen = (owner, open, link) => {
  if (!link) return;
  const docCount = countOpenBullets(link);
  if (docCount === undefined) return; // broken/unreadable link
  if (docCount === null) {
    if (open != null) warn(`${owner}: "open": ${open} but the doc has no "## Open" section — ${link}`);
    return;
  }
  if (open == null) {
    if (docCount > 0) warn(`${owner}: doc has ${docCount} open-question bullet(s) but "open" is omitted (the marker is being silently dropped) — ${link}`);
    return;
  }
  if (open !== docCount) warn(`${owner}: "open": ${open} disagrees with the doc's ${docCount} "## Open" bullet(s) — ${link}`);
};
for (const t of topics) {
  checkOpen(`topic "${t.id}"`, t.open, t.link);
  for (const f of t.features ?? []) checkOpen(`topic "${t.id}" / "${f.title}"`, f.open, f.link);
}

// Spec-header drift (advisory, never fails the run): the plan-map status and the
// linked spec's hand-written "Status:" line are two editable stores of one fact.
// Dumb regex on the first 10 lines only — prose statuses are fuzzy; this catches
// the two flagrant contradictions, not shades of meaning.
const driftWarnings = [];
const checkDrift = (owner, status, link) => {
  if (!link) return;
  const abs = path.join(repo, link);
  if (!fs.existsSync(abs)) return; // broken links already reported above
  let head;
  try {
    head = fs.readFileSync(abs, 'utf8').split(/\r?\n/).slice(0, 10).join('\n');
  } catch { return; }
  const statusLine = head.split('\n').find((l) => /\*\*status[:*]|^status:/i.test(l));
  if (!statusLine) return;
  const saysNotBuilt = /not (yet )?built|not started|no slices started/i.test(statusLine);
  const saysBuilt = !saysNotBuilt && /\b(built|shipped|implemented|completed?|done|live)\b/i.test(statusLine);
  if (status === 'done' && saysNotBuilt) {
    driftWarnings.push(`${owner}: plan-map says "done" but spec header says not built — ${link}`);
  } else if (status === 'parked' && saysBuilt) {
    driftWarnings.push(`${owner}: plan-map says "parked" but spec header claims built/shipped — ${link}`);
  }
};
for (const t of topics) {
  checkDrift(`topic "${t.id}"`, t.status, t.link);
  for (const f of t.features ?? []) checkDrift(`topic "${t.id}" / "${f.title}"`, f.status, f.link);
}
if (driftWarnings.length) {
  console.warn(`spec-header drift (advisory — fix whichever side is lying):`);
  for (const w of driftWarnings) console.warn(`  ~ ${w}`);
}

// Threshold signal (advisory): a dep "why" that names a SPECIFIC feature of the
// target topic is a member-edge wearing a cluster-edge costume — the moment
// containment starts lying. Three of these = the model needs edge-to-member
// (dep.feature). Full-title substring match (>= 12 chars) to avoid noise.
const costumeWarnings = [];
for (const t of topics) {
  for (const d of t.deps ?? []) {
    if (typeof d !== 'object' || !d.why) continue;
    const target = topicById[d.id];
    for (const f of target?.features ?? []) {
      if (f.title.length >= 12 && d.why.toLowerCase().includes(f.title.toLowerCase())) {
        const fSlug = slug(f.title);
        if (d.feature === fSlug) continue; // already an explicit member-edge — no costume
        costumeWarnings.push(`"${t.id}" → "${d.id}": why names feature "${f.title}" — the edge really targets a member, not the whole topic; add "feature": "${fSlug}"`);
      }
    }
  }
}
if (costumeWarnings.length) {
  console.warn(`member-edge costume signals (advisory — at 3+, add dep.feature support):`);
  for (const w of costumeWarnings) console.warn(`  ~ ${w}`);
}

if (problems.length) {
  console.error(`plan-map validation: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`plan-map validation: clean (${topics.length} topics, ${topics.reduce((n, t) => n + (t.features?.length ?? 0), 0)} features)`);
