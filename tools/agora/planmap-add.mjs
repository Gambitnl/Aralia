#!/usr/bin/env node
/**
 * planmap-add.mjs — the actual ten-second capture for the plan-map.
 * Safely appends to public/planmap/topics.json (read → mutate → validate → write).
 *
 * New topic:
 *   node tools/agora/planmap-add.mjs --new-topic props-v2 --title "Props v2" \
 *        --campaign world [--subcampaign "Interiors & Buildings"] [--sub "..."]
 *        [--status parked] [--link docs/...] [--dep world-props[:hard|:chosen]]
 *        [--status-note "..."] [--verified YYYY-MM-DD]
 * Add feature to existing topic:
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 --feature "Combat music" \
 *        [--status parked] [--link docs/...] [--status-note "..."] [--verified YYYY-MM-DD]
 * Flip a status, or annotate without flipping:
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 [--feature-match "ground picking"] --set-status active
 *   node tools/agora/planmap-add.mjs --topic fip-slice1 [--feature-match "ground picking"] \
 *        --verified 2026-09-09 --status-note "checked against src/ on the day"
 *   (--status-note "" removes the note; --verified must be YYYY-MM-DD.)
 *
 * Test-only flags: --file <path> points at a different topics.json;
 * --no-validate skips the validator child runs.
 * Every mutation stamps the touched topic with updated: <today> (YYYY-MM-DD).
 *
 * Deliberately dumb: exact ids, no fuzzy matching, errors out loudly.
 * Multi-agent note: acquire the Agora file lock on public/planmap/topics.json first
 * (node tools/agora/client.mjs lock public/planmap/topics.json) when other agents are live.
 *
 * WF-G117 (2026-09-09) changed two things that used to make this command unusable
 * on a busy map: validation is now scoped to the topic being edited (unrelated
 * drift elsewhere prints as a warning instead of blocking every write), and the
 * file's own indentation is detected and preserved (a hardcoded 2-space write
 * turned a one-field status flip into a 7,000-line reformat diff).
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const USAGE = 'usage: --new-topic <id> --title --campaign | --topic <id> --feature "title" | '
  + '--topic <id> [--feature-match s] (--set-status <s> | --status-note "..." | --verified YYYY-MM-DD)';

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
// Caller-Scoped Validation (WF-G117)
// ============================================================================
// The map is one shared hot file: an unrelated broken topic used to block every
// other agent's one-field edit, which pushed workers onto --no-validate. The
// validator still runs over the WHOLE file; only problems that name the topic
// being edited can refuse the write. Everything else is reported as a warning
// so the drift stays visible without being this caller's problem.
// ============================================================================

// Pull the validator's flat "  - problem" list out of its combined output.
const problemLines = (output) => output
  .split(/\r?\n/)
  .filter((line) => /^\s{2}- /.test(line))
  .map((line) => line.replace(/^\s{2}- /, '').trim());

// A problem belongs to this caller when it names the touched topic id as a whole
// kebab-case token. The boundary test keeps "world-props" from matching a
// problem about "world-props-2", which is a different topic and a different
// agent's job.
const namesTopic = (problem, id) => {
  if (!id) return true; // no known target — fail closed rather than write blind
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9-])${escaped}([^a-z0-9-]|$)`).test(problem);
};

// Split one validator run into what must block this write and what is merely
// visible drift elsewhere in the map.
const scopeValidation = (result, id) => {
  if (result.ok) return { blocking: [], warnings: [] };
  const problems = problemLines(result.output);
  // A failure we cannot parse into a problem list (a FATAL unparseable map, a
  // crashed validator) is never safely someone else's — block on all of it.
  if (!problems.length) return { blocking: [result.output.trim() || 'validator failed with no parseable output'], warnings: [] };
  return {
    blocking: problems.filter((p) => namesTopic(p, id)),
    warnings: problems.filter((p) => !namesTopic(p, id)),
  };
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

const raw = fs.readFileSync(file, 'utf8');
const data = JSON.parse(raw);
// WF-G117: the map's existing indentation is the format of record. topics.json
// is written one-space; a hardcoded two-space write reformatted all 7,000 lines
// on every capture and buried the real change. Detect the first indented line's
// prefix and hand it straight back to JSON.stringify.
const indentMatch = /\n([ \t]+)"/.exec(raw);
const indent = indentMatch ? indentMatch[1] : '  ';
const trailingNewline = raw.endsWith('\n') ? '\n' : '';

const working = structuredClone(data);
const byId = Object.fromEntries(working.topics.map((t) => [t.id, t]));

const newTopicId = flag('new-topic');
const topicId = flag('topic');
const feature = flag('feature');
const setStatus = flag('set-status');
const status = flag('status') ?? 'parked';
// Annotation flags (WF-G117). Both accept the same --feature-match selector as
// --set-status, so a topic or one of its features can be annotated in place.
const statusNote = flag('status-note');
const verified = flag('verified');

// Only statuses understood by the viewer and reconciliation flow may enter the
// Plan Map through this command.
if (!STATUSES.includes(status)) die(`invalid --status "${status}"`);
if (setStatus && !STATUSES.includes(setStatus)) die(`invalid --set-status "${setStatus}"`);
// A verification date is a claim about a specific day; a free-form string here
// would silently fail the schema's date pattern downstream.
if (verified !== undefined && !DATE_RE.test(verified)) die(`--verified must be YYYY-MM-DD (got "${verified}")`);

// A dependency flag at the end has no target and would otherwise disappear
// from the collected dependency list.
if (args[args.length - 1] === '--dep') die('missing value for --dep');

// The topic this command is allowed to break. Everything the validator says
// about any other topic is a warning, not a veto.
const touchedId = newTopicId ?? topicId;

// Record which caller-scoped problems ALREADY existed, so a refusal can say
// whether this command introduced the problem or merely inherited it.
let baselineBlocking = [];
if (!noValidate) {
  baselineBlocking = scopeValidation(runValidation(file), touchedId).blocking;
}

// Apply the shared annotation flags to a topic or feature object. An empty
// --status-note deletes the note (the only way to retract one from the CLI).
const applyAnnotations = (target, label) => {
  if (statusNote !== undefined) {
    if (statusNote === '') {
      delete target.status_note;
      console.log(`${label}: status_note cleared`);
    } else {
      target.status_note = statusNote;
      console.log(`${label}: status_note set`);
    }
  }
  if (verified !== undefined) {
    target.verified = verified;
    console.log(`${label}: verified ${verified}`);
  }
};

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
  applyAnnotations(topic, `"${newTopicId}"`);
} else if (topicId && feature) {
  // Add one feature without disturbing existing feature order. Its stable
  // identity depends on that full order, including completed features.
  const t = byId[topicId] ?? die(`topic "${topicId}" not found`);
  t.features = t.features ?? [];
  if (t.features.some((f) => f.title === feature)) die(`feature "${feature}" already on "${topicId}"`);
  const added = { title: feature, status, ...(flag('link') ? { link: flag('link') } : {}) };
  t.features.push(added);
  t.updated = today;
  // Ask the reconciliation consumer for the newly appended feature's identity.
  // This preserves its 40-character base limit and collision suffix rules.
  const featureSlug = featureSlugs(t.features).at(-1);
  console.log(`added feature "${feature}" to "${topicId}" (${status})`);
  console.log(`planmap:${topicId}/${featureSlug}`);
  applyAnnotations(added, `"${topicId}" / "${feature}"`);
} else if (topicId && (setStatus || statusNote !== undefined || verified !== undefined)) {
  // Change either one matched feature or the topic itself, retaining the
  // existing case-insensitive feature lookup behavior. A status flip is
  // optional here: --status-note / --verified annotate without touching status.
  const t = byId[topicId] ?? die(`topic "${topicId}" not found`);
  const match = flag('feature-match');
  if (match) {
    const f = (t.features ?? []).find((x) => x.title.toLowerCase().includes(match.toLowerCase()));
    if (!f) die(`no feature on "${topicId}" matching "${match}"`);
    if (setStatus) {
      f.status = setStatus;
      console.log(`"${topicId}" / "${f.title}" → ${setStatus}`);
    }
    applyAnnotations(f, `"${topicId}" / "${f.title}"`);
  } else {
    if (setStatus) {
      t.status = setStatus;
      console.log(`"${topicId}" → ${setStatus}`);
    }
    applyAnnotations(t, `"${topicId}"`);
  }
  t.updated = today;
} else {
  die(USAGE);
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
// so any validation failure leaves no caller-visible change. The detected
// indent keeps the diff to the lines this command actually changed.
const tmp = `${file}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(working, null, indent) + trailingNewline);

// Remove an invalid candidate and preserve the original file when the caller's
// mutation introduces a validation failure IN THE TOPIC IT TOUCHED. Unrelated
// problems elsewhere in the map are printed and then stepped over.
if (!noValidate) {
  const mutated = runValidation(tmp);
  const scoped = scopeValidation(mutated, touchedId);
  for (const w of scoped.warnings) {
    // stdout, not stderr: on a successful run these are informational output the
    // caller is meant to read (and execFileSync drops a child's stderr on success).
    console.log(`planmap-add: warning (elsewhere in the map, not "${touchedId}"): ${w}`);
  }
  if (scoped.blocking.length) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    console.error(`plan-map validation: ${scoped.blocking.length} problem(s) naming "${touchedId}"`);
    for (const p of scoped.blocking) {
      console.error(`  - ${p}${baselineBlocking.includes(p) ? ' (pre-existing)' : ''}`);
    }
    console.error('planmap-add: caller-scoped validation failed; refusing to write.');
    process.exit(1);
  }
  if (mutated.ok) console.log(mutated.output.trim());
  else console.log(`plan-map validation: clean for "${touchedId}" (${scoped.warnings.length} unrelated problem(s) left in the map)`);
}
// PM-G2 (2026-09-13): on Windows a dev server SERVING topics.json blocks the
// rename with EPERM (see sync-surfaces.mjs atomicWrite for the measured case).
// Retry the rename briefly, then fall back to a verified in-place write.
{
  const text = fs.readFileSync(tmp, 'utf8');
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  let renamed = false;
  let lastError;
  for (let attempt = 1; attempt <= 6 && !renamed; attempt++) {
    try { fs.renameSync(tmp, file); renamed = true; }
    catch (e) { lastError = e; if (attempt < 6) sleep(150 * attempt); }
  }
  if (!renamed) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    if (lastError && (lastError.code === 'EPERM' || lastError.code === 'EBUSY')) {
      fs.writeFileSync(file, text);
      if (fs.readFileSync(file, 'utf8') !== text) {
        console.error(`planmap-add: in-place write of ${file} did not read back identical; re-run.`);
        process.exit(1);
      }
      console.error('planmap-add: note — rename was blocked (EPERM: a server is serving the file); wrote in place after verifying the content.');
    } else {
      throw lastError;
    }
  }
}
