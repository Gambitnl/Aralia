#!/usr/bin/env node
// Applies the wave-bulk-3 prepared absorption payload to public/planmap/topics.json.
// PRECONDITION: caller holds the Agora lock on public/planmap/topics.json.
// AFTER: run `node tools/agora/validate-planmap.mjs` (must exit 0) before deleting folders.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const mapFile = path.join(repo, 'public', 'planmap', 'topics.json');
const payload = JSON.parse(fs.readFileSync(path.join(here, 'absorption-prep-wave-bulk-3.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const data = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const byId = Object.fromEntries(data.topics.map((t) => [t.id, t]));

// 1. Link repairs inside topics.json (tiered-autosave GAPS links on whole-game-systems-audit).
for (const repair of payload.linkRepairsInsideTopicsJson) {
  const t = byId[repair.topic];
  if (!t) throw new Error(`repair target topic missing: ${repair.topic}`);
  let n = 0;
  for (const f of t.features ?? []) {
    if (f.link === repair.from) { f.link = repair.to; n++; }
  }
  if (t.link === repair.from) { t.link = repair.to; n++; }
  if (n !== repair.occurrences) throw new Error(`expected ${repair.occurrences} link repairs on ${repair.topic}, made ${n}`);
  t.updated = today;
  console.log(`repaired ${n} links on ${repair.topic}`);
}

// 2. Merges: add features + status_note to existing topics.
for (const m of payload.merges) {
  const t = byId[m.targetTopic];
  if (!t) throw new Error(`merge target missing: ${m.targetTopic}`);
  t.features = t.features ?? [];
  for (const f of m.addFeatures) {
    if (t.features.some((x) => x.title === f.title)) { console.log(`skip dup feature on ${m.targetTopic}: ${f.title}`); continue; }
    t.features.push(f);
  }
  t.status_note = t.status_note ? `${t.status_note}; ${m.statusNoteAppend}` : m.statusNoteAppend;
  t.updated = today;
  console.log(`merged ${m.slug} into ${m.targetTopic} (+${m.addFeatures.length} features)`);
}

// 3. New topics.
for (const nt of payload.newTopics) {
  if (byId[nt.id]) { console.log(`topic ${nt.id} already exists — skipping create`); continue; }
  const topic = { ...nt, updated: today };
  data.topics.push(topic);
  byId[nt.id] = topic;
  console.log(`created topic ${nt.id} (${nt.status}, ${nt.features.length} features)`);
}

fs.writeFileSync(mapFile, JSON.stringify(data, null, 2) + '\n');
console.log('topics.json written. NOW RUN: node tools/agora/validate-planmap.mjs');
