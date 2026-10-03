// tools/agora/store.triage.test.mjs
// Charters, the campaign read model, and triage — design §6, §7, §10, §22, §72.
// One test per acceptance criterion in the campaign charter, plus the rules the
// first trial's Stage 0 found broken (design §71).
// Run: node --test tools/agora/store.triage.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { createStore } from './store.mjs';
import { validateCharter, measuredTier, planMapHealth, taskTimes } from './campaign-model.mjs';

function tmpDir() {
  const d = path.join(os.tmpdir(), 'agora-test', crypto.randomUUID());
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function rm(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function makeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => { t += ms; return t; };
  return now;
}

const TOPICS = {
  topics: [
    { id: 'coord', status: 'active', features: [
      { title: 'Charter contract', status: 'active' },
      { title: 'Finished thing', status: 'done' },
    ] },
    { id: 'old-lane', status: 'superseded', features: [] },
  ],
};

function charter(over = {}) {
  return {
    mission: 'Prove the model.',
    outcome: 'One campaign closes with a full audit trail.',
    currentState: 'Nothing exists.',
    planMapPrimary: 'planmap:coord/charter-contract',
    scope: ['charter rules'],
    nonScope: ['game source'],
    tier: 'large',
    effort: { taskCount: 8, fileCount: 12 },
    risk: 'high',
    riskReason: 'changes the daemon every agent uses',
    touches: ['daemon-protocol'],
    affectedDomains: ['tools/agora'],
    milestones: [{ id: 'M1', title: 'Rules' }],
    workstreams: [{ id: 'W1', title: 'Store' }],
    dependencies: ['planmap:coord'],
    acceptance: [{ text: 'A bad charter is refused', evidence: 'store.triage.test.mjs' }],
    verification: 'store tests plus a disposable daemon',
    adoptionPolicy: 'escalate',
    owner: 'seat:doralon',
    author: 'campaignwright',
    openDecisions: [{ text: 'D1 trial state', owner: 'human' }],
    escalationPath: 'post on the command channel; wake the operator',
    ...over,
  };
}

function setup({ now = makeClock(), presenceDropMs = 3_600_000 } = {}) {
  const dir = tmpDir();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs, readPlanmap: () => TOPICS, seatRosterPath: null });
  return { dir, store, now };
}

// --- charter rules (acceptance 1, 2, 3; Stage 0 findings) -------------------

test('acceptance 1: a charter missing a required field for its tier is refused, with the field named', () => {
  const { store, dir } = setup();
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'c-orch', role: 'orchestrator', sessionId: 's1' });
  store.claimCampaign({ agentId: orch.id, campaignId: 'trial', scope: 'x', paths: ['tools/x'] });
  const body = charter();
  delete body.workstreams;
  const r = store.putCharter({ campaignId: 'trial', agentId: orch.id, body, summary: 'first' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e === 'missing required field for tier large: workstreams'), r.errors.join('\n'));
  store.close(); rm(dir);
});

test('Stage 0 finding: a stated tier lower than its measures is refused, and the higher tier is owed', () => {
  const v = validateCharter(charter({ tier: 'standard', workstreams: [] }), { topics: TOPICS, campaignState: 'active' });
  assert.equal(v.ok, false);
  assert.equal(v.owedTier, 'large');
  assert.ok(v.errors.some((e) => /lower than the measures require/.test(e)));
  assert.ok(v.errors.some((e) => /tier large: workstreams/.test(e)));
  assert.deepEqual(measuredTier({ effort: { taskCount: 8, fileCount: 12 }, risk: 'medium' }).tier, 'standard');
  assert.deepEqual(measuredTier({ effort: { taskCount: 3, fileCount: 2 }, risk: 'low', touches: ['save-format'] }).tier, 'large');
});

test('Stage 0 finding: a time estimate in effort is refused by name', () => {
  const v = validateCharter(charter({ effort: { taskCount: 8, fileCount: 12, agentHours: '8 to 14' } }), { topics: TOPICS });
  assert.ok(v.errors.includes('effort.agentHours is a time estimate; size a charter by taskCount and fileCount only'));
});

test('Stage 0 finding: an approval task owned by a role that may not approve the tier is refused', () => {
  const v = validateCharter(charter({ tasks: [{ id: 'T1', title: 'Manual intake and charter approval', milestone: 'M1', role: 'orchestrator' }] }), { topics: TOPICS });
  assert.ok(v.errors.some((e) => /T1 approves the charter, but role "orchestrator"/.test(e)));
  const ok = validateCharter(charter({ tasks: [{ id: 'T1', kind: 'approval', title: 'Approve', milestone: 'M1', role: 'human' }] }), { topics: TOPICS });
  assert.equal(ok.ok, true, ok.errors.join('\n'));
});

test('hierarchy: an unknown milestone and a dependency cycle are both refused', () => {
  const v = validateCharter(charter({ tasks: [
    { id: 'A', milestone: 'M9', deps: ['B'] },
    { id: 'B', milestone: 'M1', deps: ['A'] },
  ] }), { topics: TOPICS });
  assert.ok(v.errors.some((e) => /names milestone M9/.test(e)));
  assert.ok(v.errors.some((e) => /cycle: A -> B -> A|cycle: B -> A -> B/.test(e)));
});

test('acceptance 2: zero or two primary Plan Map references are refused', () => {
  assert.ok(validateCharter(charter({ planMapPrimary: '' }), { topics: TOPICS }).errors.some((e) => /no primary Plan Map reference/.test(e)));
  assert.ok(validateCharter(charter({ planMapPrimary: ['planmap:coord', 'planmap:coord/charter-contract'] }), { topics: TOPICS })
    .errors.includes('planMapPrimary must be exactly one reference, got 2'));
});

test('acceptance 3: a missing topic, an unresolved slug, and a superseded topic are refused', () => {
  assert.ok(planMapHealth('planmap:nope', TOPICS).problems.includes('topic "nope" does not exist'));
  assert.ok(planMapHealth('planmap:coord/no-such', TOPICS).problems[0].includes('does not resolve'));
  assert.ok(planMapHealth('planmap:old-lane', TOPICS).problems.includes('topic "old-lane" is superseded'));
  assert.equal(planMapHealth('planmap:coord/charter-contract', TOPICS).ok, true);
});

test('§71 stop condition: a reference that reads done while the campaign is active is a contradiction', () => {
  const h = planMapHealth('planmap:coord/finished-thing', TOPICS, { campaignState: 'active' });
  assert.equal(h.ok, false);
  assert.match(h.problems[0], /contradiction/);
  assert.equal(planMapHealth('planmap:coord/finished-thing', TOPICS, { campaignState: 'done' }).ok, true);
});

test('approval: an orchestrator cannot approve a large charter, the author cannot approve its own, a human can, and an edit resets it', () => {
  const { store, dir } = setup();
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'a-orch', role: 'orchestrator', sessionId: 's1' });
  const master = store.registerAgent({ petSlug: 'gf-sd', handle: 'a-master', role: 'master', sessionId: 's2' });
  const human = store.registerAgent({ petSlug: 'gf-sd', handle: 'a-human', role: 'human', sessionId: 's3' });
  store.claimCampaign({ agentId: orch.id, campaignId: 'trial', scope: 'x', paths: ['tools/x'] });
  assert.equal(store.putCharter({ campaignId: 'trial', agentId: orch.id, body: charter(), summary: 'v1' }).ok, true);

  assert.match(store.approveCharter({ campaignId: 'trial', agentId: master.id, note: 'read it' }).error, /needs approval from: human/);
  const approved = store.approveCharter({ campaignId: 'trial', agentId: human.id, note: 'read all sections' });
  assert.equal(approved.ok, true);
  assert.equal(approved.charter.status, 'approved');

  const edited = store.putCharter({ campaignId: 'trial', agentId: orch.id, body: charter({ tier: 'large', mission: 'Prove it again.' }), summary: 'v2' });
  assert.equal(edited.charter.status, 'needs-review');
  assert.deepEqual(edited.charter.approvals, []);
  assert.equal(edited.charter.revisions.length, 2);

  // A standard charter: the master may approve, but not one it submitted.
  store.claimCampaign({ agentId: master.id, campaignId: 'small-one', scope: 'y', paths: ['tools/y'] });
  const std = charter({ tier: 'standard', risk: 'medium', touches: [], workstreams: undefined, dependencies: undefined, openDecisions: undefined, escalationPath: undefined });
  assert.equal(store.putCharter({ campaignId: 'small-one', agentId: master.id, body: std, summary: 'v1' }).ok, true);
  assert.match(store.approveCharter({ campaignId: 'small-one', agentId: master.id, note: 'mine' }).error, /may not approve/);
  store.close(); rm(dir);
});

// --- read model (acceptance 4) ----------------------------------------------

test('acceptance 4: one read returns the charter, the tasks with computed times and trail, and progress', () => {
  const now = makeClock();
  const { store, dir } = setup({ now });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'v-orch', role: 'orchestrator', sessionId: 's1' });
  const w1 = store.registerAgent({ petSlug: 'gf-sd', handle: 'v-w1' });
  const w2 = store.registerAgent({ petSlug: 'gf-sd', handle: 'v-w2' });
  store.claimCampaign({ agentId: orch.id, campaignId: 'trial', scope: 'x', paths: ['tools/x'] });
  store.putCharter({ campaignId: 'trial', agentId: orch.id, body: charter(), summary: 'v1' });
  const code = store.canonicalId('trial');
  const t = store.createTask({ agentId: orch.id, title: 'one', campaignId: code });
  store.createTask({ agentId: orch.id, title: 'two', campaignId: code });
  now.advance(10); store.claimTask({ taskId: t.id, agentId: w1.id });
  now.advance(10); store.handoffTask({ taskId: t.id, agentId: w1.id, toAgentId: w2.id });
  now.advance(10); store.setTaskState({ taskId: t.id, agentId: w2.id, state: 'done', result: 'ok' });

  const view = store.campaignView('trial');
  assert.equal(view.ok, true);
  assert.equal(view.legacy, false);
  assert.equal(view.campaign.charter.body.mission, 'Prove the model.');
  assert.equal(view.validation.ok, true);
  const row = view.tasks.find((x) => x.id === t.id);
  assert.equal(row.startedAt, 1_000_010);
  assert.equal(row.completedAt, 1_000_030);
  assert.deepEqual(row.agentTrail, [w1.id, w2.id]);
  assert.equal(view.progress.total, 2);
  assert.equal(view.progress.percent, 50);
  assert.deepEqual(taskTimes({ state: 'open', history: [] }), { startedAt: null, startedFrom: null, completedAt: null, agentTrail: [] });
  store.close(); rm(dir);
});

// --- triage (acceptance 5, 6, 7, 8) -----------------------------------------

function abandonedCampaign() {
  const now = makeClock();
  const ctx = setup({ now, presenceDropMs: 5000 });
  const { store } = ctx;
  const owner = store.registerAgent({ petSlug: 'gf-sd', handle: 'gone-owner' });
  store.claimCampaign({ agentId: owner.id, campaignId: 'abandoned', scope: 'x', paths: ['tmp/abandoned'] });
  const code = store.canonicalId('abandoned');
  const tasks = ['continue me', 'reopen me', 'reassign me', 'block me', 'close me', 'survivor'].map((title) =>
    store.createTask({ agentId: owner.id, title, campaignId: code }));
  store.claimTask({ taskId: tasks[1].id, agentId: owner.id });
  store.claimTask({ taskId: tasks[2].id, agentId: owner.id });
  now.advance(60_000); // the owner falls past the drop horizon
  const master = store.registerAgent({ petSlug: 'gf-sd', handle: 'successor', role: 'orchestrator', sessionId: 'succ' });
  const human = store.registerAgent({ petSlug: 'gf-sd', handle: 'operator', role: 'human', sessionId: 'op' });
  const helper = store.registerAgent({ petSlug: 'gf-sd', handle: 'helper' });
  return { ...ctx, owner, master, human, helper, code, tasks };
}

test('acceptance 5: the triage report changes no record — the serialized state is identical before and after', () => {
  const { store, dir, code, master } = abandonedCampaign();
  store.startTriage({ campaignId: code, agentId: master.id, reason: 'owner gone' });
  store.snapshot();
  const before = fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8');
  const seqBefore = store.lastSeq;
  const report = store.triageReport(code);
  assert.equal(report.ok, true);
  assert.equal(report.readOnly, true);
  assert.equal(report.tasks.length, 6);
  assert.equal(report.tasks.find((r) => r.title === 'reopen me').recommendation.disposition, 'reopen');
  assert.equal(store.lastSeq, seqBefore);
  store.snapshot();
  assert.equal(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8'), before);
  store.close(); rm(dir);
});

test('start: triage needs the command channel, a reason, and an adoptable campaign', () => {
  const { store, dir, code, helper, master } = abandonedCampaign();
  assert.match(store.startTriage({ campaignId: code, agentId: helper.id, reason: 'x' }).error, /command channel/);
  assert.match(store.startTriage({ campaignId: code, agentId: master.id }).error, /needs a reason/);
  assert.equal(store.startTriage({ campaignId: code, agentId: master.id, reason: 'owner gone' }).ok, true);
  assert.match(store.startTriage({ campaignId: code, agentId: master.id, reason: 'again' }).error, /already in review/);
  store.close(); rm(dir);
});

test('acceptance 6 + 7: each task takes exactly one disposition; destructive ones need the human; finish needs them all', () => {
  const { store, dir, code, master, human, helper, tasks } = abandonedCampaign();
  store.startTriage({ campaignId: code, agentId: master.id, reason: 'owner gone' });
  const [cont, reopen, reassign, block, close, survivor] = tasks;
  const apply = (taskId, disposition, extra = {}) => store.applyDisposition({ campaignId: code, taskId, agentId: master.id, disposition, reason: 'judged', ...extra });

  assert.equal(apply(cont.id, 'continue').ok, true);
  assert.match(apply(cont.id, 'escalate').error, /already has a disposition: continue/);

  const r1 = apply(reopen.id, 'reopen');
  assert.equal(r1.task.state, 'open');
  assert.equal(r1.task.claimedBy, null);
  assert.equal(r1.record.from, 'claimed');

  const r2 = apply(reassign.id, 'reassign', { toAgentId: helper.id });
  assert.equal(r2.task.claimedBy, helper.id);

  assert.match(apply(block.id, 'block').error, /named blocker/);
  assert.equal(apply(block.id, 'block', { blocker: 'waits on the save format decision' }).task.state, 'blocked');

  // acceptance 7: no human, no destruction — even from the successor.
  assert.match(apply(close.id, 'close-obsolete').error, /needs recorded human approval/);
  const noQuote = store.applyDisposition({ campaignId: code, taskId: close.id, agentId: human.id, disposition: 'close-obsolete', reason: 'gone' });
  assert.match(noQuote.error, /approval quote/);

  assert.match(store.finishTriage({ campaignId: code, agentId: master.id, reason: 'done' }).error, /missing: /);

  const closed = store.applyDisposition({ campaignId: code, taskId: close.id, agentId: human.id, disposition: 'close-obsolete', reason: 'the feature was removed', approvalQuote: 'yes, close it' });
  assert.equal(closed.task.state, 'done');
  assert.equal(closed.task.closedReason, 'obsolete: the feature was removed');
  assert.deepEqual(closed.record.approval, { by: human.id, quote: 'yes, close it' });
  const last = closed.task.history[closed.task.history.length - 1];
  assert.deepEqual([last.action, last.from, last.state, last.reason], ['disposition', 'open', 'done', 'the feature was removed']);

  assert.equal(apply(survivor.id, 'escalate').task.escalated, true);

  const done = store.finishTriage({ campaignId: code, agentId: master.id, reason: 'all six judged' });
  assert.equal(done.ok, true);
  assert.equal(done.campaign.triage.state, 'applied');
  assert.equal(Object.keys(done.campaign.triage.dispositions).length, 6);
  assert.equal(done.campaign.agentId, master.id);
  assert.equal(done.campaign.history.at(-1).action, 'adopted');
  store.close(); rm(dir);
});

test('supersede names a surviving task and needs the human', () => {
  const { store, dir, code, master, human, tasks } = abandonedCampaign();
  store.startTriage({ campaignId: code, agentId: master.id, reason: 'owner gone' });
  assert.match(store.applyDisposition({ campaignId: code, taskId: tasks[0].id, agentId: human.id, disposition: 'supersede', reason: 'dup', approvalQuote: 'ok' }).error, /surviving task/);
  const r = store.applyDisposition({ campaignId: code, taskId: tasks[0].id, agentId: human.id, disposition: 'supersede', reason: 'dup', supersededBy: tasks[5].id, approvalQuote: 'ok' });
  assert.equal(r.task.supersededBy, tasks[5].id);
  assert.equal(r.task.closedReason, `superseded by ${tasks[5].id}`);
  store.close(); rm(dir);
});

test('acceptance 8: snapshot plus journal replay reproduces the charter, the dispositions, and the triage history', () => {
  const { store, dir, code, master, owner } = abandonedCampaign();
  // The owner is gone, so the successor writes the charter as command channel.
  assert.equal(store.putCharter({ campaignId: code, agentId: master.id, body: charter(), summary: 'backfill' }).ok, true);
  store.startTriage({ campaignId: code, agentId: master.id, reason: 'owner gone' });
  const tasks = store.campaignView(code).tasks;
  store.applyDisposition({ campaignId: code, taskId: tasks[0].id, agentId: master.id, disposition: 'continue', reason: 'fine' });
  store.snapshot(); // fold the first half into the snapshot
  store.applyDisposition({ campaignId: code, taskId: tasks[1].id, agentId: master.id, disposition: 'reopen', reason: 'dead claimant' });
  const live = JSON.stringify(store.campaignView(code).campaign.triage) + JSON.stringify(store.campaignView(code).campaign.charter);
  const liveTask = JSON.stringify(store.listTasks().find((t) => t.id === tasks[1].id).history);
  store.close();

  const again = createStore({ dir, now: () => 2_000_000, readPlanmap: () => TOPICS, seatRosterPath: null });
  const view = again.campaignView(code);
  assert.equal(JSON.stringify(view.campaign.triage) + JSON.stringify(view.campaign.charter), live);
  assert.equal(JSON.stringify(again.listTasks().find((t) => t.id === tasks[1].id).history), liveTask);
  assert.ok(owner.id);
  again.close(); rm(dir);
});

test('a legacy campaign with no charter reads as legacy, and its report says when it holds no tasks', () => {
  const { store, dir } = setup();
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'l-orch', role: 'orchestrator', sessionId: 's1' });
  store.claimCampaign({ agentId: orch.id, campaignId: 'empty', scope: 'x', paths: ['tools/e'] });
  const view = store.campaignView('empty');
  assert.equal(view.legacy, true);
  assert.equal(view.progress.percent, null);
  const report = store.triageReport('empty');
  assert.equal(report.legacy, true);
  assert.match(report.notes[0], /no tasks/);
  store.close(); rm(dir);
});
