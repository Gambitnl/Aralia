#!/usr/bin/env node
/**
 * planmap-add.mjs — the actual ten-second capture for the plan-map.
 * Safely appends to public/planmap/topics.json (read → mutate → validate → write).
 *
 * New topic:
 *   node tools/agora/planmap-add.mjs --new-topic props-v2 --title "Props v2" \
 *        --campaign world [--sub "..."] [--status parked] [--link docs/...] [--dep world-props[:hard|:chosen]]
 * Add feature to existing topic:
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 --feature "Combat music" \
 *        [--status parked] [--link docs/...]
 * Flip a status:
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 [--feature-match "ground picking"] --set-status active
 *
 * Deliberately dumb: exact ids, no fuzzy matching, errors out loudly.
 * Multi-agent note: acquire the Agora file lock on public/planmap/topics.json first
 * (node tools/agora/client.mjs lock public/planmap/topics.json) when other agents are live.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const file = path.join(repo, 'public', 'planmap', 'topics.json');

const args = process.argv.slice(2);
const STATUSES = ['parked', 'specced', 'active', 'done'];
const die = (msg) => { console.error(`planmap-add: ${msg}`); process.exit(1); };
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  // A following --flag token means the value was omitted — die loudly instead
  // of silently swallowing the next flag as the value.
  if (v === undefined || v.startsWith('--')) die(`missing value for --${name}`);
  return v;
};

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = Object.fromEntries(data.topics.map((t) => [t.id, t]));

const newTopicId = flag('new-topic');
const topicId = flag('topic');
const feature = flag('feature');
const setStatus = flag('set-status');
const status = flag('status') ?? 'parked';
if (!STATUSES.includes(status)) die(`invalid --status "${status}"`);
if (setStatus && !STATUSES.includes(setStatus)) die(`invalid --set-status "${setStatus}"`);

if (args[args.length - 1] === '--dep') die('missing value for --dep');

if (newTopicId) {
  if (byId[newTopicId]) die(`topic "${newTopicId}" already exists`);
  const campaign = flag('campaign') ?? die('--campaign required for a new topic');
  if (!data.campaigns[campaign]) die(`unknown campaign "${campaign}" (known: ${Object.keys(data.campaigns).join(', ')})`);
  const topic = {
    id: newTopicId,
    title: flag('title') ?? die('--title required'),
    ...(flag('sub') ? { sub: flag('sub') } : {}),
    campaign,
    status,
    deps: (args.filter((a, i) => args[i - 1] === '--dep')).map((d) => {
      if (d.startsWith('--')) die('missing value for --dep');
      const [id, kind] = d.split(':');
      if (!byId[id]) die(`--dep "${id}" does not exist`);
      return { id, kind: kind === 'chosen' ? 'chosen' : 'hard', why: 'TODO: explain this arrow (edit topics.json)' };
    }),
    ...(flag('link') ? { link: flag('link') } : {}),
  };
  data.topics.push(topic);
  console.log(`added topic "${newTopicId}" (${status})`);
} else if (topicId && feature) {
  const t = byId[topicId] ?? die(`topic "${topicId}" not found`);
  t.features = t.features ?? [];
  if (t.features.some((f) => f.title === feature)) die(`feature "${feature}" already on "${topicId}"`);
  t.features.push({ title: feature, status, ...(flag('link') ? { link: flag('link') } : {}) });
  console.log(`added feature "${feature}" to "${topicId}" (${status})`);
} else if (topicId && setStatus) {
  const t = byId[topicId] ?? die(`topic "${topicId}" not found`);
  const match = flag('feature-match');
  if (match) {
    const f = (t.features ?? []).find((x) => x.title.toLowerCase().includes(match.toLowerCase()));
    if (!f) die(`no feature on "${topicId}" matching "${match}"`);
    f.status = setStatus;
    console.log(`"${topicId}" / "${f.title}" → ${setStatus}`);
  } else {
    t.status = setStatus;
    console.log(`"${topicId}" → ${setStatus}`);
  }
} else {
  die('usage: --new-topic <id> --title --campaign | --topic <id> --feature "title" | --topic <id> [--feature-match s] --set-status <s>');
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
// Validate what we just wrote — a bad write should scream immediately.
execFileSync(process.execPath, [path.join(here, 'validate-planmap.mjs')], { stdio: 'inherit' });
