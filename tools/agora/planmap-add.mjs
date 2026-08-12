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

// ============================================================================
// Runtime Dependencies
// ============================================================================
// Built-in modules handle files, paths, and validator execution. Agora helpers
// enforce ownership and provide the stable reference identity used downstream.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { guardWriteOrDie } from './lockGuard.mjs';
import { featureSlugs } from './planmap-reconcile-lib.mjs';

/**
 * This file captures one Plan Map change from the command line without making
 * callers edit the shared JSON by hand. It validates the current map, applies
 * one narrowly selected change, and only then replaces the real file. Agora
 * operators call it before creating linked tasks, so feature additions also
 * print the exact reference understood by the reconciliation flow.
 *
 * Called by: agents and operators adding or updating Plan Map work
 * Depends on: lockGuard.mjs, validate-planmap.mjs, and the reconciliation
 * consumer that owns stable Plan Map feature references
 */

// ============================================================================
// Repository Locations and Command Input
// ============================================================================
// These paths connect the command to the canonical Plan Map while preserving
// the existing fixture override used by focused tests.
// ============================================================================

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const args = process.argv.slice(2);
const STATUSES = ['parked', 'specced', 'active', 'done'];

// ============================================================================
// Command Helpers
// ============================================================================
// These helpers keep failures loud and retain validation output for a useful
// operator error instead of leaving a partially written Plan Map.
// ============================================================================

// Stop immediately with the command name so shell users can identify which
// capture step rejected their input.
const die = (msg) => { console.error(`planmap-add: ${msg}`); process.exit(1); };

// Run the repository validator against either the real map or its staged
// replacement, returning its output instead of letting the child error escape.
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

// Read a named flag and reject a missing value before a following flag can be
// mistaken for user content.
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  // A following --flag token means the value was omitted — die loudly instead
  // of silently swallowing the next flag as the value.
  if (v === undefined || v.startsWith('--')) die(`missing value for --${name}`);
  return v;
};

// ============================================================================
// Target Map and Freshness Stamp
// ============================================================================
// Tests can point at a disposable fixture. Normal runs use the public Plan Map,
// and every successful mutation records the current calendar date.
// ============================================================================

// --file overrides the map location (tests point at a fixture).
const fileFlag = flag('file');
const file = fileFlag ? path.resolve(fileFlag) : path.join(repo, 'public', 'planmap', 'topics.json');
const noValidate = args.includes('--no-validate');
// Freshness stamp: every mutation marks the touched topic's last real change.
const today = new Date().toISOString().slice(0, 10);

// ============================================================================
// Parsed Plan Map and Requested Mutation
// ============================================================================
// Work happens on a clone so validation can fail without changing the visible
// file or creating a duplicate feature on retry.
// ============================================================================

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const working = structuredClone(data);
const byId = Object.fromEntries(working.topics.map((t) => [t.id, t]));

const newTopicId = flag('new-topic');
const topicId = flag('topic');
const feature = flag('feature');
const setStatus = flag('set-status');
const status = flag('status') ?? 'parked';

// Only statuses understood by the viewer and reconciliation flow may enter the
// Plan Map through this command.
if (!STATUSES.includes(status)) die(`invalid --status "${status}"`);
if (setStatus && !STATUSES.includes(setStatus)) die(`invalid --set-status "${setStatus}"`);

// A dependency flag at the end has no target and would otherwise disappear
// from the collected dependency list.
if (args[args.length - 1] === '--dep') die('missing value for --dep');

// Reject existing Plan Map drift before applying this caller's change. This
// keeps an unrelated validation problem from being blamed on the new item.
if (!noValidate) {
  const baseValidation = runValidation(file);
  if (!baseValidation.ok) {
    console.error('planmap-add: pre-existing plan-map validation errors detected; refusing to write to avoid unscoped drift.');
    console.error(baseValidation.output);
    process.exit(1);
  }
}

// ============================================================================
// Narrow Mutation Modes
// ============================================================================
// Exactly one branch creates a topic, adds a feature, or changes a status. The
// feature branch prints the stable reference needed by a follow-up Agora task.
// ============================================================================

// Create a new topic only when its campaign, optional lane, and dependencies
// already exist in the current Plan Map vocabulary.
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
  // Add one feature without disturbing existing feature order. Its stable
  // identity depends on that full order, including completed features.
  const t = byId[topicId] ?? die(`topic "${topicId}" not found`);
  t.features = t.features ?? [];
  if (t.features.some((f) => f.title === feature)) die(`feature "${feature}" already on "${topicId}"`);
  t.features.push({ title: feature, status, ...(flag('link') ? { link: flag('link') } : {}) });
  t.updated = today;
  // Ask the reconciliation consumer for the newly appended feature's identity.
  // This preserves its 40-character base limit and collision suffix rules.
  const featureSlug = featureSlugs(t.features).at(-1);
  console.log(`added feature "${feature}" to "${topicId}" (${status})`);
  console.log(`planmap:${topicId}/${featureSlug}`);
} else if (topicId && setStatus) {
  // Change either one matched feature or the topic itself, retaining the
  // existing case-insensitive feature lookup behavior.
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

// ============================================================================
// Ownership Guard and Atomic Write
// ============================================================================
// The command checks shared-checkout ownership immediately before disk I/O,
// then validates a temporary candidate before replacing the requested map.
// ============================================================================

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

// Remove an invalid candidate and preserve the original file when the caller's
// mutation introduces a validation failure.
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
