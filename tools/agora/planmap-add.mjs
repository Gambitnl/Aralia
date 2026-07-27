#!/usr/bin/env node
/**
 * planmap-add.mjs — the actual ten-second capture for the plan-map.
 * Safely appends to public/planmap/topics.json (read → mutate → validate → write).
 *
 * New topic:
 *   node tools/agora/planmap-add.mjs --new-topic props-v2 --title "Props v2" \
 *        --campaign world [--subcampaign "Interiors & Buildings"] [--sub "..."]
 *        [--status parked] [--link docs/...] [--dep world-props[:hard|:chosen]]
 * Add feature to existing topic:
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 --feature "Combat music" \
 *        [--status parked] [--link docs/...]
 * Flip a status:
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 [--feature-match "ground picking"] --set-status active
 *
 * Test-only flags: --file <path> points at a different topics.json;
 * --no-validate skips the post-write validator child run.
 * Every mutation stamps the touched topic with updated: <today> (YYYY-MM-DD).
 *
 * Deliberately dumb: exact ids, no fuzzy matching, errors out loudly.
 * Multi-agent note: acquire the Agora file lock on public/planmap/topics.json first
 * (node tools/agora/client.mjs lock public/planmap/topics.json) when other agents are live.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { guardWriteOrDie } from './lockGuard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const args = process.argv.slice(2);
const STATUSES = ['parked', 'specced', 'active', 'done'];
const die = (msg) => { console.error(`planmap-add: ${msg}`); process.exit(1); };
const runValidation = (targetFile) => {
  try {
    const output = execFileSync(process.execPath, [path.join(here, 'validate-planmap.mjs'), '--file', targetFile], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { ok: true, output };
  } catch (err) {
    return {
      ok: false,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
};
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  // A following --flag token means the value was omitted — die loudly instead
  // of silently swallowing the next flag as the value.
  if (v === undefined || v.startsWith('--')) die(`missing value for --${name}`);
  return v;
};

// --file overrides the map location (tests point at a fixture).
const fileFlag = flag('file');
const file = fileFlag ? path.resolve(fileFlag) : path.join(repo, 'public', 'planmap', 'topics.json');
const noValidate = args.includes('--no-validate');
// Freshness stamp: every mutation marks the touched topic's last real change.
const today = new Date().toISOString().slice(0, 10);

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const working = structuredClone(data);
const byId = Object.fromEntries(working.topics.map((t) => [t.id, t]));

const newTopicId = flag('new-topic');
const topicId = flag('topic');
const feature = flag('feature');
const setStatus = flag('set-status');
const status = flag('status') ?? 'parked';
if (!STATUSES.includes(status)) die(`invalid --status "${status}"`);
if (setStatus && !STATUSES.includes(setStatus)) die(`invalid --set-status "${setStatus}"`);

if (args[args.length - 1] === '--dep') die('missing value for --dep');

if (!noValidate) {
  const baseValidation = runValidation(file);
  if (!baseValidation.ok) {
    console.error('planmap-add: pre-existing plan-map validation errors detected; refusing to write to avoid unscoped drift.');
    console.error(baseValidation.output);
    process.exit(1);
  }
}

if (newTopicId) {
  if (byId[newTopicId]) die(`topic "${newTopicId}" already exists`);
  const campaign = flag('campaign') ?? die('--campaign required for a new topic');
  if (!working.campaigns[campaign]) die(`unknown campaign "${campaign}" (known: ${Object.keys(working.campaigns).join(', ')})`);
  // A nested lane is optional, but when the campaign publishes an ordered list
  // the capture command rejects typos instead of creating a near-duplicate band.
  const subcampaign = flag('subcampaign');
  const allowedSubcampaigns = working.campaigns[campaign].subcampaigns ?? [];
  if (subcampaign && allowedSubcampaigns.length && !allowedSubcampaigns.includes(subcampaign)) {
    die(`unknown subcampaign "${subcampaign}" for "${campaign}" (known: ${allowedSubcampaigns.join(', ')})`);
  }
  const topic = {
    id: newTopicId,
    title: flag('title') ?? die('--title required'),
    ...(flag('sub') ? { sub: flag('sub') } : {}),
    campaign,
    ...(subcampaign ? { subcampaign } : {}),
    status,
    updated: today,
    deps: (args.filter((a, i) => args[i - 1] === '--dep')).map((d) => {
      if (d.startsWith('--')) die('missing value for --dep');
      const [id, kind] = d.split(':');
      if (!byId[id]) die(`--dep "${id}" does not exist`);
      return { id, kind: kind === 'chosen' ? 'chosen' : 'hard', why: 'TODO: explain this arrow (edit topics.json)' };
    }),
    ...(flag('link') ? { link: flag('link') } : {}),
  };
  working.topics.push(topic);
  console.log(`added topic "${newTopicId}" (${status})`);
} else if (topicId && feature) {
  const t = byId[topicId] ?? die(`topic "${topicId}" not found`);
  t.features = t.features ?? [];
  if (t.features.some((f) => f.title === feature)) die(`feature "${feature}" already on "${topicId}"`);
  t.features.push({ title: feature, status, ...(flag('link') ? { link: flag('link') } : {}) });
  t.updated = today;
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
  t.updated = today;
} else {
  die('usage: --new-topic <id> --title --campaign | --topic <id> --feature "title" | --topic <id> [--feature-match s] --set-status <s>');
}

// Locks are advisory — enforce them here so a chained command cannot write a
// file another agent holds (2026-07-14 incident). --force-no-lock overrides.
await guardWriteOrDie(path.relative(repo, file).replace(/\\/g, '/'), {
  toolName: 'planmap-add',
  force: args.includes('--force-no-lock'),
});

// Write into a staging file and validate before replacing the real file,
// so any validation failure leaves no caller-visible change.
const tmp = `${file}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(working, null, 2) + '\n');
if (!noValidate) {
  const mutatedValidation = runValidation(tmp);
  if (!mutatedValidation.ok) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    console.error(mutatedValidation.output);
    console.error('planmap-add: caller-scoped validation failed; refusing to write.');
    process.exit(1);
  }
  console.log(mutatedValidation.output.trim());
}
fs.renameSync(tmp, file);
