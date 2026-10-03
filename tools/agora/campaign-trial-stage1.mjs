#!/usr/bin/env node
/**
 * campaign-trial-stage1.mjs — Trial by fire, Stage 1 (design §22, revised in §72).
 *
 *   node tools/agora/campaign-trial-stage1.mjs [--keep] [--json <file>]
 *
 * A synthetic abandoned campaign on a DISPOSABLE daemon, on a private port, in a
 * temporary directory. It proves, over real HTTP routes and a real store:
 *
 *   1. an abandoned campaign reads adoptable, with its owner gone;
 *   2. the triage report changes NO byte of the record, and the read-only
 *      surface serves the same report and names how far behind its snapshot is;
 *   3. the four low-risk dispositions apply, one task at a time;
 *   4. close-obsolete is refused without a human, and without the human's words;
 *   5. triage cannot finish until every task has exactly one disposition;
 *   6. after a restart, replay reproduces the charter, the dispositions, the
 *      triage history, and every task history exactly;
 *   7. the shared daemon on 4319 is never contacted.
 *
 * What it does NOT touch, and why that is structural rather than promised:
 *   - no child `server.mjs` is spawned. The daemon binary mirrors activity into
 *     .agent/orchestration, spawns sync-surfaces (which writes the tracked Plan
 *     Map from the SHARED daemon), and writes the tracked seat roster. The
 *     disposable daemon is built with createAgoraServer and all three switched off;
 *   - every outbound connection to port 4319 is refused inside this process and
 *     counted, and the count must be zero.
 *
 * Owner loss is simulated with an injected clock. The clock is set between the
 * drop horizon (the owner reads gone) and twice the horizon (the reaper frees a
 * gone agent's claimed work only after 2x), so the claimed tasks are still held
 * when triage looks at them. That is the case triage exists for.
 *
 * Exit 0 when every check passes. Exit 1 on the first failed check, naming the
 * section-22 stop condition it trips. Nothing here is a fallback: a check that
 * cannot run is a failed check.
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';
import { createReadOnlyServer } from './readonly-server.mjs';

const SHARED_PORT = 4319;
const DROP_MS = 5000;

// ---- guard: the shared daemon must never be contacted ----------------------
const sharedContacts = [];
function refuseShared(port, where) {
  if (Number(port) === SHARED_PORT) {
    sharedContacts.push({ where, at: new Date().toISOString() });
    throw new Error(`Stage 1 refused a connection to the shared daemon on ${SHARED_PORT} (${where})`);
  }
}
const realRequest = http.request;
http.request = function guardedRequest(opts, ...rest) {
  const port = typeof opts === 'string' ? new URL(opts).port : (opts.port || (opts.host || '').split(':')[1]);
  refuseShared(port, 'http.request');
  return realRequest.call(this, opts, ...rest);
};
const realConnect = net.connect;
net.connect = net.createConnection = function guardedConnect(...args) {
  const first = args[0];
  refuseShared(typeof first === 'object' ? first.port : first, 'net.connect');
  return realConnect.apply(this, args);
};
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  refuseShared(new URL(typeof input === 'string' ? input : input.url).port, 'fetch');
  return realFetch(input, init);
};

// ---- output ------------------------------------------------------------------
const argv = process.argv.slice(2);
const keep = argv.includes('--keep');
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : '';
const checks = [];
function check(name, pass, evidence, stop) {
  checks.push({ name, pass: Boolean(pass), evidence, stop: pass ? null : stop });
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      ${evidence}\n`);
  if (!pass) throw Object.assign(new Error(`stop: ${stop}`), { stage1Stop: stop });
}

// ---- the fixture -------------------------------------------------------------
const TOPICS = {
  topics: [{ id: 'stage1-fixture-topic', status: 'active', features: [{ title: 'Fixture feature', status: 'active' }] }],
};
const CHARTER = {
  mission: 'A synthetic campaign that exists to be abandoned and triaged.',
  outcome: 'Every task receives one disposition, and the record replays exactly.',
  currentState: 'Five tasks, two claimed by an owner that is gone.',
  planMapPrimary: 'planmap:stage1-fixture-topic/fixture-feature',
  scope: ['five fixture tasks'],
  nonScope: ['anything outside the temporary directory'],
  tier: 'standard',
  effort: { taskCount: 6, fileCount: 1 },
  risk: 'low',
  riskReason: 'a disposable record in a temporary directory',
  affectedDomains: ['fixture only'],
  milestones: [{ id: 'M1', title: 'Triage' }],
  acceptance: [{ text: 'every task has one disposition', evidence: 'this transcript' }],
  verification: 'this script',
  adoptionPolicy: 'escalate',
  owner: 'fixture owner',
  author: 'campaign-trial-stage1.mjs',
};

let clock = Date.UTC(2026, 8, 13, 12, 0, 0);
let dir;
let app;
let ro;
let port;
let roPort;

function makeDaemon() {
  return createAgoraServer({
    dir,
    storeFactory: ({ dir: d }) => createStore({
      dir: d,
      now: () => clock,
      presenceTtlMs: 1000,
      presenceDropMs: DROP_MS,
      seatRosterPath: null, // never the tracked roster
      readPlanmap: () => TOPICS, // never the tracked Plan Map
    }),
    activityFile: undefined, // no mirror into .agent/orchestration
    syncRunner: () => {}, // never sync-surfaces, which reads the SHARED daemon
  });
}

function request(targetPort, method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port: targetPort, method, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
const api = (method, pathname, opts) => request(port, method, pathname, opts);

let petCursor = -1;
async function register(handle, role = 'worker') {
  const pets = (await api('GET', '/pets')).json.pets;
  const r = await api('POST', '/agents/register', {
    body: { handle, petSlug: pets[++petCursor].slug, sessionId: `stage1-${handle}`, role, note: 'Stage 1 fixture' },
  });
  if (r.status !== 201) throw new Error(`register ${handle}: ${r.status} ${r.raw}`);
  return { id: r.json.agentId, token: r.json.token, handle };
}

function recordBytes() {
  const read = (name) => {
    const p = path.join(dir, name);
    return fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
  };
  return { snapshot: read('snapshot.json'), journal: read('journal.jsonl') };
}

/** The first path at which two plain values differ, or null when they match. */
function firstDifference(a, b, at = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDifference(a[k], b[k], at + '.' + k);
      if (d) return d;
    }
  }
  return `${at || '(root)'}: daemon ${JSON.stringify(b)} vs surface ${JSON.stringify(a)}`;
}

function raw(campaign, tasks) {
  const pick = (t) => ({
    id: t.id, state: t.state, claimedBy: t.claimedBy, closedReason: t.closedReason || null,
    supersededBy: t.supersededBy || null, escalated: t.escalated || false, history: t.history,
  });
  return JSON.stringify({
    charter: campaign.charter,
    triage: campaign.triage,
    history: campaign.history,
    agentId: campaign.agentId,
    tasks: tasks.map(pick).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

async function run() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-stage1-'));
  app = makeDaemon();
  await new Promise((r) => app.listen(0, r));
  port = app.server.address().port;
  check('the disposable daemon runs on a private port, in a temporary directory', port !== SHARED_PORT && dir.startsWith(os.tmpdir()),
    `port ${port}, dir ${dir}`, 'An edit lands on a working-tree file outside the campaign scope');

  // 1. Seed: one campaign, a charter, five tasks, two claimed by the owner.
  const owner = await register('stage1-owner');
  const claimed = await api('POST', '/campaigns', { token: owner.token, body: { id: 'stage1-fixture', scope: 'fixture', paths: ['tmp/stage1-fixture'] } });
  if (claimed.status !== 201) throw new Error(claimed.raw);
  const code = claimed.json.campaign.id;
  const charter = await api('POST', `/campaigns/${code}/charter`, { token: owner.token, body: { charter: CHARTER, summary: 'fixture charter' } });
  check('the fixture charter passes the daemon\'s own validation', charter.status === 200,
    `POST /campaigns/${code}/charter -> ${charter.status}${charter.json && charter.json.errors ? ' ' + charter.json.errors.join('; ') : ''}`,
    'A required charter field for the tier is absent');
  const titles = ['A continue: open work the successor keeps', 'B reopen: claimed by the gone owner', 'C reassign: claimed by the gone owner', 'D block: waits on a decision', 'E close-obsolete: no longer applies'];
  const tasks = {};
  for (const title of titles) {
    const r = await api('POST', '/tasks', { token: owner.token, body: { title, campaignId: code } });
    tasks[title[0]] = r.json.task.id;
  }
  for (const k of ['B', 'C']) {
    const r = await api('POST', `/tasks/${tasks[k]}/claim`, { token: owner.token });
    if (r.status !== 200) throw new Error(`claim ${k}: ${r.status} ${r.raw}`);
  }

  // 2. Owner loss: past the drop horizon, short of the reap horizon.
  clock += DROP_MS + 2000;
  const successor = await register('stage1-successor', 'orchestrator');
  const human = await register('stage1-operator', 'human');
  const helper = await register('stage1-helper');

  const listed = (await api('GET', '/campaigns')).json.campaigns.find((c) => c.id === code);
  check('the abandoned campaign reads adoptable, with its owner gone and nobody attending',
    listed.adoptable === true && listed.attended === false && listed.ownerStatus === 'gone',
    `adoptable ${listed.adoptable}, attended ${listed.attended}, ownerStatus ${listed.ownerStatus}`,
    'An adoption or closure path turns out to be reachable without authorization');

  // 3. The byte-identical report, from the daemon and from the read-only surface.
  // The surface is told this daemon's drop horizon, so both judge liveness alike.
  // ...and the same Plan Map, written into the temporary directory, never the tracked one.
  const ws = path.join(dir, 'workspace');
  fs.mkdirSync(path.join(ws, 'public', 'planmap'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'public', 'planmap', 'topics.json'), JSON.stringify(TOPICS));
  ro = createReadOnlyServer({ dir, now: () => clock, presenceDropMs: DROP_MS, workspaceRoot: ws });
  await new Promise((r) => ro.listen(0, r));
  roPort = ro.address().port;
  const snapBefore = recordBytes();
  const daemonReport = await api('GET', `/campaigns/${code}/triage`);
  const roReport = await request(roPort, 'GET', `/campaigns/${code}/triage`);
  const snapAfter = recordBytes();
  check('generating the triage report changes no byte of the record',
    daemonReport.status === 200 && snapBefore.snapshot.equals(snapAfter.snapshot) && snapBefore.journal.equals(snapAfter.journal),
    `daemon ${daemonReport.status}; snapshot ${snapBefore.snapshot.length} bytes and journal ${snapBefore.journal.length} bytes, identical before and after`,
    'Any record changes during a dry run');
  // The read-only surface reads the SNAPSHOT; events newer than it are named in
  // its source block. Force nothing: if it is behind, say so and compare only
  // what both can see.
  const behind = roReport.json && roReport.json.source ? roReport.json.source.behindByEvents : null;
  check('the read-only surface serves the report and says how far behind the snapshot it is',
    roReport.status === 200 && roReport.json.readOnly === true && Number.isFinite(behind),
    `GET :${roPort}/campaigns/${code}/triage -> ${roReport.status}; behind by ${behind} event(s)`,
    'The triage report cannot be produced read-only');
  const { source: _src, ...served } = roReport.json;
  check('the read-only surface gives the same report as the daemon, including changes newer than its snapshot',
    JSON.stringify(served) === JSON.stringify(daemonReport.json),
    `first difference: ${firstDifference(served, daemonReport.json) || 'none'}; snapshot seq ${roReport.json.source.snapshotSeq}, record seq ${roReport.json.source.recordSeq}, tail events applied ${roReport.json.source.journalTailEvents}`,
    'The triage report cannot be produced read-only');
  const advice = Object.fromEntries(daemonReport.json.tasks.map((t) => [t.title[0], t.recommendation.disposition]));
  check('the report advises reopen for the tasks the gone owner still holds', advice.B === 'reopen' && advice.C === 'reopen',
    `advice ${JSON.stringify(advice)}`, 'A task lacks the history needed to reconstruct its audit trail');
  check('every task history in the report is complete enough to audit', daemonReport.json.totals.incompleteHistory.length === 0,
    `incomplete: ${JSON.stringify(daemonReport.json.totals.incompleteHistory)}`, 'A task lacks the history needed to reconstruct its audit trail');


  // 4. Start triage, then one disposition per task.
  const started = await api('POST', `/campaigns/${code}/triage/start`, { token: successor.token, body: { reason: 'Stage 1: the owner is gone and two tasks are held' } });
  check('triage starts explicitly, by the command channel, with a reason', started.status === 200,
    `POST triage/start -> ${started.status}`, 'An adoption or closure path turns out to be reachable without authorization');
  const worker = await api('POST', `/campaigns/${code}/triage/start`, { token: helper.token, body: { reason: 'a worker tries' } });
  check('a worker cannot start triage', worker.status === 403, `worker -> ${worker.status}`,
    'An adoption or closure path turns out to be reachable without authorization');

  const apply = (k, token, body) => api('POST', `/campaigns/${code}/triage/${tasks[k]}`, { token, body });
  const rA = await apply('A', successor.token, { disposition: 'continue', reason: 'open work; the successor keeps it' });
  const rB = await apply('B', successor.token, { disposition: 'reopen', reason: 'the claimant is gone' });
  const rC = await apply('C', successor.token, { disposition: 'reassign', reason: 'hand to a live worker', toAgentId: helper.id });
  const rD = await apply('D', successor.token, { disposition: 'block', reason: 'waits on a decision', blocker: 'the operator rules on D1' });
  check('the four low-risk dispositions apply, each recording its prior and new state',
    [rA, rB, rC, rD].every((r) => r.status === 200)
      && rB.json.record.from === 'claimed' && rB.json.record.to === 'open'
      && rC.json.task.claimedBy === helper.id && rD.json.task.state === 'blocked',
    `continue ${rA.status}; reopen ${rB.status} (${rB.json.record.from} -> ${rB.json.record.to}); reassign ${rC.status} (to ${rC.json.task.claimedBy === helper.id ? 'helper' : '?'}); block ${rD.status} (${rD.json.task.state})`,
    'A destructive action occurs without recorded human approval');
  const again = await apply('A', successor.token, { disposition: 'escalate', reason: 'a second opinion' });
  check('a task cannot take a second disposition', again.status === 409, `second disposition -> ${again.status}: ${again.json.error}`,
    'A destructive action occurs without recorded human approval');

  const early = await api('POST', `/campaigns/${code}/triage/finish`, { token: successor.token, body: { reason: 'too soon' } });
  check('triage cannot finish while a task has no disposition', early.status === 400 && early.json.missing.length === 1,
    `finish -> ${early.status}, missing ${JSON.stringify(early.json.missing)}`, 'A destructive action occurs without recorded human approval');

  const noHuman = await apply('E', successor.token, { disposition: 'close-obsolete', reason: 'no longer applies' });
  const noQuote = await apply('E', human.token, { disposition: 'close-obsolete', reason: 'no longer applies' });
  check('close-obsolete is refused without a human, and refused without the human\'s words',
    noHuman.status === 403 && noQuote.status === 403,
    `successor -> ${noHuman.status}; human with no quote -> ${noQuote.status}`, 'A destructive action occurs without recorded human approval');
  const closed = await apply('E', human.token, { disposition: 'close-obsolete', reason: 'no longer applies', approvalQuote: 'Stage 1 fixture approval' });
  check('close-obsolete applies with a human caller and the approval quote, and keeps both on the record',
    closed.status === 200 && closed.json.record.approval.quote === 'Stage 1 fixture approval' && closed.json.task.closedReason === 'obsolete: no longer applies',
    `-> ${closed.status}; approval ${JSON.stringify(closed.json.record.approval)}`, 'A destructive action occurs without recorded human approval');

  const finished = await api('POST', `/campaigns/${code}/triage/finish`, { token: successor.token, body: { reason: 'five tasks, five dispositions' } });
  const dispositions = finished.json && finished.json.campaign ? Object.keys(finished.json.campaign.triage.dispositions).length : 0;
  check('triage finishes with exactly one disposition per task, and the successor adopts the campaign',
    finished.status === 200 && dispositions === 5 && finished.json.campaign.agentId === successor.id,
    `finish -> ${finished.status}; ${dispositions} dispositions for 5 tasks; owner is now the successor: ${finished.json.campaign.agentId === successor.id}`,
    'A destructive action occurs without recorded human approval');

  // 5. Restart: replay must reproduce the record exactly.
  const view = (await api('GET', `/campaigns/${code}`)).json;
  const beforeRestart = raw(view.campaign, view.tasks);
  await new Promise((r) => ro.close(r));
  ro = null;
  await app.close();
  app = makeDaemon();
  await new Promise((r) => app.listen(0, r));
  port = app.server.address().port;
  const view2 = (await api('GET', `/campaigns/${code}`)).json;
  const afterRestart = raw(view2.campaign, view2.tasks);
  check('after a restart, replay reproduces the charter, the dispositions, the triage history, and every task history',
    beforeRestart === afterRestart,
    `${beforeRestart.length} characters compared; identical: ${beforeRestart === afterRestart}`,
    'A campaign or task state fails to replay identically after restart');

  check('the shared daemon on 4319 was never contacted', sharedContacts.length === 0,
    `${sharedContacts.length} attempt(s) refused`, 'An edit lands on a working-tree file outside the campaign scope');
  return { code, dir };
}

let outcome = 'pass';
let stop = null;
try {
  await run();
} catch (e) {
  outcome = 'fail';
  stop = e.stage1Stop || `the run could not complete: ${e.message}`;
  process.stdout.write(`\nSTOP: ${stop}\n`);
} finally {
  if (ro) await new Promise((r) => ro.close(r));
  if (app) await app.close();
  if (dir && !keep) fs.rmSync(dir, { recursive: true, force: true });
}
const summary = {
  stage: 1,
  outcome,
  stop,
  passed: checks.filter((c) => c.pass).length,
  checks: checks.length,
  sharedDaemonContacts: sharedContacts.length,
  fixtureDestroyed: Boolean(dir && !keep && !fs.existsSync(dir)),
  at: new Date().toISOString(),
  results: checks,
};
process.stdout.write(`\nStage 1: ${outcome.toUpperCase()} — ${summary.passed} of ${summary.checks} checks passed; fixture destroyed: ${summary.fixtureDestroyed}\n`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
process.exit(outcome === 'pass' ? 0 : 1);
