// tools/agora/store.seats.test.mjs
// Seats: durable identity for campaign ownership. Node built-in runner only:
//   node --test "tools/agora/*.test.mjs"
//
// WHAT THIS HAS TO PROVE. Before seats, a campaign's owner was a session, and
// a session always ends. On 2026-09-07 all 27 live campaigns therefore read
// "owner gone" — not because anyone abandoned them, but because nothing
// outlives itself. Every adoptable computation built on that was inventing an
// answer to a question that could not have one (D-AA).
//
// So the tests below check the REPLACEMENT question rather than the old one:
// is a live session in this seat right now? That is observable, and a test can
// therefore make it false on purpose and watch the answer change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStore } from './store.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agora-seats-'));
}

/** A clock the test drives, so presence can be aged deliberately. */
function makeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => { t += ms; return t; };
  return now;
}

function orchestrator(store, handle = 'orch.seats') {
  return store.registerAgent({
    petSlug: 'gf-sd', handle, role: 'orchestrator', sessionId: 'thread-' + handle,
  });
}

test('a seat is created deliberately, and a typo cannot conjure one', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);

  const made = store.createSeat({ agentId: orch.id, name: 'thornwake', note: 'first seat' });
  assert.equal(made.ok, true, made.error);
  assert.equal(made.seat.name, 'thornwake');
  assert.equal(made.seat.holder, null);

  // Signing in with a seat that does not exist must FAIL LOUDLY rather than
  // create it. A seat carries a diary and a history; conjuring one by
  // misspelling a name would leave junk identities that look like people.
  const typo = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.typo', role: 'orchestrator',
    sessionId: 'thread-typo', seat: 'thornwaek',
  });
  assert.match(typo.seatError, /no seat "seat-thornwaek"/);
  // The registration itself still stands: refusing it would strand an agent
  // holding a token it could not use.
  assert.ok(typo.id);
  assert.equal(typo.seatId, '');
});

test('a seat name may not encode the job or the model (D-N)', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);

  // Naming a seat for the job recreates the role model that D-L rejected.
  const asJob = store.createSeat({ agentId: orch.id, name: 'lead-reviewer' });
  assert.equal(asJob.ok, false);
  assert.match(asJob.error, /names a job or a model/);

  // Naming it for a model kills the seat the day the model changes.
  const asModel = store.createSeat({ agentId: orch.id, name: 'opus-one' });
  assert.equal(asModel.ok, false);
  assert.match(asModel.error, /names a job or a model/);

  assert.equal(store.createSeat({ agentId: orch.id, name: 'greyhollow' }).ok, true);
});

test('creating a seat is control-plane only', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.x' });
  const refused = store.createSeat({ agentId: worker.id, name: 'thornwake' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /orchestrator, master, human/);
});

test('one holder at a time, and a dropped session frees the seat by itself', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({
    dir, now, presenceDropMs: 3_600_000, seatRosterPath: path.join(dir, 'roster.json'),
  });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });

  const first = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.first', role: 'orchestrator',
    sessionId: 'thread-first', seat: 'thornwake',
  });
  assert.equal(first.seatId, 'seat-thornwake');
  assert.equal(first.seatError, undefined);

  // A second live session is refused while the first is alive.
  const second = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.second', role: 'orchestrator',
    sessionId: 'thread-second', seat: 'thornwake',
  });
  assert.match(second.seatError, /held by a live session/);
  assert.equal(second.seatId, '');

  // THE CRASHED-AGENT WORRY, answered. The seat is freed the moment the
  // holder's presence drops — no seat-level timer exists, and none has to be
  // argued over, because presence is already measured accurately.
  now.advance(3_600_001);
  const third = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.third', role: 'orchestrator',
    sessionId: 'thread-third', seat: 'thornwake',
  });
  assert.equal(third.seatError, undefined);
  assert.equal(third.seatId, 'seat-thornwake');
});

test('a campaign keeps its owner after the session that claimed it ends', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({
    dir, now, presenceDropMs: 3_600_000, seatRosterPath: path.join(dir, 'roster.json'),
  });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });

  const holder = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.holder', role: 'orchestrator',
    sessionId: 'thread-holder', seat: 'thornwake',
  });
  const claimed = store.claimCampaign({
    agentId: holder.id, campaignId: 'seat-trial', paths: ['tools/agora/seat-trial.md'],
  });
  assert.equal(claimed.ok, true, claimed.error);
  assert.equal(claimed.campaign.seatId, 'seat-thornwake');

  // Attended while a live session sits in the seat.
  let row = store.listCampaigns().find((c) => c.name === 'seat-trial');
  assert.equal(row.attended, true);
  assert.equal(row.adoptable, false);
  assert.equal(row.seatName, 'thornwake');

  // THE WHOLE POINT. The session ends. The campaign still names its owner,
  // and it now reads unattended rather than owner-gone — a fact about who is
  // on it, not a guess about whether it was abandoned.
  now.advance(3_600_001);
  row = store.listCampaigns().find((c) => c.name === 'seat-trial');
  assert.equal(row.seatId, 'seat-thornwake', 'the durable owner survives the session');
  assert.equal(row.attended, false);
  assert.equal(row.adoptable, true);

  // A new session takes the same seat, and the campaign is attended again
  // WITHOUT being re-claimed. That is what durable ownership means.
  const successor = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.successor', role: 'orchestrator',
    sessionId: 'thread-successor', seat: 'thornwake',
  });
  assert.equal(successor.seatId, 'seat-thornwake');
  row = store.listCampaigns().find((c) => c.name === 'seat-trial');
  assert.equal(row.attended, true);
  assert.equal(row.adoptable, false);
});

test('a campaign with no seat is unattended forever, and says so', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  // No seat: this is every campaign claimed before seats existed.
  store.claimCampaign({ agentId: orch.id, campaignId: 'legacy', paths: ['tools/agora/legacy.md'] });
  const row = store.listCampaigns().find((c) => c.name === 'legacy');
  assert.equal(row.seatId, '');
  assert.equal(row.attended, false, 'no durable owner means it can never be attended');
  assert.equal(row.adoptable, true);
});

test('a rename keeps every name the seat has carried (D-N)', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });

  const renamed = store.renameSeat({
    seatId: 'seat-thornwake', agentId: orch.id, name: 'greyhollow', why: 'clash with a live entity',
  });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(renamed.seat.name, 'greyhollow');
  assert.deepEqual(renamed.seat.formerNames, ['thornwake']);
  assert.equal(renamed.seat.renames.length, 1);
  assert.equal(renamed.seat.renames[0].from, 'thornwake');
  assert.equal(renamed.seat.renames[0].why, 'clash with a live entity');
});

// WF-G140 (2026-09-09): after a rename the seat must answer to its new name,
// its old name, and its id; a new seat may not take a name still in use.
test('a renamed seat is reachable by its new name, its former name, and its id', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });
  const renamed = store.renameSeat({ seatId: 'seat-thornwake', agentId: orch.id, name: 'greyhollow', why: 'clash' });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(store.resolveSeatId('greyhollow'), 'seat-thornwake', 'new name');
  assert.equal(store.resolveSeatId('thornwake'), 'seat-thornwake', 'former name');
  assert.equal(store.resolveSeatId('seat-thornwake'), 'seat-thornwake', 'id');
  assert.equal(store.resolveSeatId('Greyhollow'), 'seat-thornwake', 'case-insensitive');
  const holder = store.registerAgent({ petSlug: 'gf-sd', handle: 'sitter', role: 'orchestrator', sessionId: 'sess-sitter', seat: 'greyhollow' });
  assert.equal(holder.seatError, undefined, holder.seatError);
  assert.equal(store.listSeats().find((x) => x.id === 'seat-thornwake').holder, holder.id, 'sign-in by the new name holds the seat');
  const clashOld = store.createSeat({ agentId: orch.id, name: 'thornwake' });
  assert.equal(clashOld.ok, false, 'the former name still maps to the immutable id');
  assert.match(clashOld.error, /already exists/);
  const clashNew = store.createSeat({ agentId: orch.id, name: 'greyhollow' });
  assert.equal(clashNew.ok, false, 'the current name cannot become a second seat');
  assert.match(clashNew.error, /already a name of seat seat-thornwake/);
  assert.equal(store.resolveSeatId('nobody'), 'seat-nobody', 'an unknown name still derives an id, as before');
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a seat and its diary survive a restart', () => {
  const dir = tmpDir();
  const rosterPath = path.join(dir, 'roster.json');
  const s1 = createStore({ dir, seatRosterPath: rosterPath });
  const orch = orchestrator(s1);
  s1.createSeat({ agentId: orch.id, name: 'thornwake' });
  s1.seatDiary({ seatId: 'seat-thornwake', agentId: orch.id, text: 'the overlap rule bites on -expanded campaigns' });
  s1.close();

  // A seat that vanished on restart would be a session wearing a longer name,
  // which is the exact thing seats exist to stop being.
  const s2 = createStore({ dir, seatRosterPath: rosterPath });
  const seat = s2.listSeats().find((x) => x.id === 'seat-thornwake');
  assert.ok(seat, 'the seat survived');
  assert.equal(seat.diary.length, 1);
  assert.match(seat.diary[0].text, /-expanded campaigns/);
});

test('the roster mirror is a copy: one file, atomic, no campaigns in it', () => {
  const dir = tmpDir();
  const rosterPath = path.join(dir, 'nested', 'roster.json');
  const store = createStore({ dir, seatRosterPath: rosterPath });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake', note: 'trial seat' });
  store.claimCampaign({ agentId: orch.id, campaignId: 'mirrored', paths: ['tools/agora/mirrored.md'] });

  assert.ok(fs.existsSync(rosterPath), 'the mirror is written on a seat change');
  const doc = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  assert.equal(doc.seats.length, 1);
  assert.equal(doc.seats[0].name, 'thornwake');
  assert.match(doc._readme, /never read back/);

  // It holds SEATS ONLY. A roster that grew a campaign list would become the
  // local campaign tracker that the dashboard-only rule forbids.
  assert.equal(JSON.stringify(doc).includes('mirrored'), false, 'no campaign list in the mirror');

  // No temp file is left behind, so the write is atomic rather than in place.
  const leftovers = fs.readdirSync(path.dirname(rosterPath)).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('the mirror can be switched off, and nothing else breaks', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: null });
  const orch = orchestrator(store);
  const made = store.createSeat({ agentId: orch.id, name: 'thornwake' });
  assert.equal(made.ok, true, 'the record is the daemon; the mirror is optional');
  assert.equal(store.listSeats().length, 1);
});

test('a clean exit hands the seat back and says it was deliberate', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });
  const holder = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.holder', role: 'orchestrator',
    sessionId: 'thread-holder', seat: 'thornwake',
  });

  store.retireAgent(holder.id, { note: 'done for the day' });
  const seat = store.listSeats().find((x) => x.id === 'seat-thornwake');
  assert.equal(seat.holder, null);
  assert.equal(seat.attended, false);
  const last = seat.history[seat.history.length - 1];
  assert.equal(last.action, 'released');
  assert.equal(last.why, 'retired', 'a hand-back reads differently from a session that just stopped');
});

test('the sweep refuses everything it should, and says why for each', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });
  const holder = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.holder', role: 'orchestrator',
    sessionId: 'thread-holder', seat: 'thornwake',
  });

  // Four campaigns, each hitting one branch of the rule.
  store.claimCampaign({ agentId: orch.id, campaignId: 'old-and-empty', paths: ['tmp/sweep-a'] });
  store.claimCampaign({ agentId: orch.id, campaignId: 'old-with-work', paths: ['tmp/sweep-b'] });
  store.claimCampaign({ agentId: holder.id, campaignId: 'somebody-on-it', paths: ['tmp/sweep-c'] });
  store.createTask({ agentId: orch.id, title: 'real work', category: 'agent-tooling', campaignId: 'old-with-work' });

  now.advance(40 * 86400000); // everything above is now 40 days old
  store.claimCampaign({ agentId: orch.id, campaignId: 'brand-new', paths: ['tmp/sweep-d'] });

  // A live session takes the seat again. Without this, 40 days of silence has
  // dropped every presence, so NOTHING is attended and the "somebody is on it"
  // branch is never reached — the first run of this test swept two campaigns
  // for exactly that reason, and the code was right.
  const backOn = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.backon', role: 'orchestrator',
    sessionId: 'thread-backon', seat: 'thornwake',
  });
  assert.equal(backOn.seatId, 'seat-thornwake');

  // A worker may not run it. One call closes campaigns across the board.
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.sweep' });
  assert.equal(store.sweepEmptyCampaigns({ agentId: worker.id }).ok, false);

  const dry = store.sweepEmptyCampaigns({ agentId: orch.id, minAgeDays: 30 });
  assert.equal(dry.dryRun, true, 'the preview is the default');
  assert.equal(dry.wouldClose, 1);
  assert.equal(dry.closing[0].name, 'old-and-empty');

  // Every refusal names its own reason, so the list is auditable rather than
  // a number the reader has to trust.
  const why = Object.fromEntries(dry.kept.map((k) => [k.name, k.why]));
  assert.match(why['old-with-work'], /holds 1 task/);
  assert.match(why['somebody-on-it'], /somebody is on it/);
  assert.match(why['brand-new'], /under the 30-day limit/);

  // Nothing was written by the preview.
  assert.equal(store.listCampaigns().filter((c) => c.state === 'done').length, 0);

  const done = store.sweepEmptyCampaigns({ agentId: orch.id, minAgeDays: 30, dryRun: false });
  assert.equal(done.closed, 1);
  const closed = store.listCampaigns().find((c) => c.name === 'old-and-empty');
  assert.equal(closed.state, 'done');
  assert.match(closed.closedReason, /empty and unattended/);
  // Closing is a state change, not a deletion: the history survives.
  assert.ok(closed.history.some((h) => h.action === 'swept-closed'));
  assert.equal(store.sweepEmptyCampaigns({ agentId: orch.id, minAgeDays: 30, dryRun: false }).closed, 0);
});

test('WF-G106: a swept-empty campaign is not offered as a home for any task', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);

  // Two campaigns claiming the SAME file. One will hold real work; the other
  // will hold nothing and get swept. This is the live board's shape in
  // miniature: on 2026-09-08, 39 of 40 tied tasks were tied against
  // `todo-sweep-gemini`, which held zero tasks.
  store.claimCampaign({ agentId: orch.id, campaignId: 'real-work', globs: ['tmp/shared/**'] });
  store.claimCampaign({ agentId: orch.id, campaignId: 'never-used', globs: ['tmp/shared/**'], role: 'deputy', leadCampaignId: 'real-work' });
  const anchor = store.createTask({ agentId: orch.id, title: 'anchor', category: 'agent-tooling', campaignId: 'real-work' });
  assert.ok(anchor.id);

  // An orphan touching that shared ground matches BOTH, so it ties.
  const orphan = store.createTask({ agentId: orch.id, title: 'orphan', category: 'agent-tooling' });
  store.claimTask({ taskId: orphan.id, agentId: orch.id });
  store.checkpointTask({ taskId: orphan.id, agentId: orch.id, did: 'touched it', files: ['tmp/shared/thing.ts'] });

  const before = store.inferTaskMembership({ agentId: orch.id, dryRun: true });
  assert.equal(before.tally.ambiguous, 1, 'two live candidates means a tie, and a tie is never broken');
  assert.equal(before.tally.inferred, 0);

  // Sweep the empty one. It held zero tasks, which is WHY it closed.
  now.advance(40 * 86400000);
  const swept = store.sweepEmptyCampaigns({ agentId: orch.id, minAgeDays: 30, dryRun: false });
  assert.equal(swept.closed, 1);
  assert.equal(swept.closing[0].name, 'never-used');

  // THE FIX. A campaign closed for holding nothing cannot be any task's home,
  // so it stops being a candidate — and the tie resolves to the one real
  // answer that was there all along. Before this, closing the empty campaign
  // changed nothing: the tie survived against a home already proved empty.
  const after = store.inferTaskMembership({ agentId: orch.id, dryRun: true });
  assert.equal(after.tally.ambiguous, 0, 'the tie was against an empty campaign');
  assert.equal(after.tally.inferred, 1);
  const placed = after.changes.find((c) => c.membership === 'inferred');
  assert.equal(store.listCampaigns().find((c) => c.id === placed.campaignId).name, 'real-work');

  // A campaign that held real work and then finished NORMALLY stays a
  // candidate. The filter is "the sweep proved it empty", not "it is closed".
  const done = store.listCampaigns().find((c) => c.name === 'real-work');
  assert.equal(done.closedReason, undefined, 'only a swept campaign carries a reason');
});

// SEATS-6 (agora-8148.5, 2026-09-09). The four store paths the file above
// never reached: releaseSeat called directly (it was only ever exercised
// through retireAgent), seatDiary's empty-text refusal, renameSeat's
// control-plane gate, and the roster mirror written by writers other than
// createSeat. Each store here takes its OWN seatRosterPath under its own temp
// dir, so the tracked tools/agora/seat-roster.json is never written.

test('releaseSeat is the deliberate hand-back, and it refuses a stranger and a seat that is not there', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });

  // A hand-back for a seat that does not exist is a typo, not a no-op. It has
  // to say so, for the same reason sign-in refuses to conjure a seat.
  const nowhere = store.releaseSeat({ seatId: 'seat-nowhere', agentId: orch.id });
  assert.equal(nowhere.ok, false);
  assert.match(nowhere.error, /no seat "seat-nowhere"/);

  const holder = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.holder', role: 'orchestrator',
    sessionId: 'thread-holder', seat: 'thornwake',
  });
  assert.equal(holder.seatId, 'seat-thornwake', holder.seatError);

  // ONE HOLDER AT A TIME cuts both ways: a session that never took the seat
  // may not hand it back either, or any passer-by could evict the holder
  // without the force flag holdSeat makes you pass on purpose.
  const stranger = store.releaseSeat({ seatId: 'seat-thornwake', agentId: orch.id });
  assert.equal(stranger.ok, false);
  assert.match(stranger.error, /is not held by this session/);
  assert.equal(store.listSeats().find((x) => x.id === 'seat-thornwake').holder, holder.id, 'the refusal changed nothing');

  // The holder's own hand-back succeeds and is RECORDED with its reason, so a
  // deliberate exit reads differently from a session that simply stopped.
  const given = store.releaseSeat({ seatId: 'seat-thornwake', agentId: holder.id, why: 'handing over mid-wave' });
  assert.equal(given.ok, true, given.error);
  assert.equal(given.seat.holder, null);
  assert.equal(given.seat.heldSince, null);
  const last = given.seat.history[given.seat.history.length - 1];
  assert.equal(last.action, 'released');
  assert.equal(last.why, 'handing over mid-wave');

  // Releasing an already-free seat is idempotent rather than an error: the
  // caller asked for a state the seat is already in.
  const again = store.releaseSeat({ seatId: 'seat-thornwake', agentId: holder.id });
  assert.equal(again.ok, true);
  assert.equal(again.already, true);
  assert.equal(given.seat.history.length, store.listSeats().find((x) => x.id === 'seat-thornwake').history.length,
    'an idempotent release writes no second history line');

  // A freed seat is takeable again immediately, without waiting for presence
  // to drop. That is the whole point of a deliberate hand-back.
  const successor = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.successor', role: 'orchestrator',
    sessionId: 'thread-successor', seat: 'thornwake',
  });
  assert.equal(successor.seatError, undefined, successor.seatError);
  assert.equal(successor.seatId, 'seat-thornwake');

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a diary entry needs text, and a seat that is not there has no diary', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });

  const nowhere = store.seatDiary({ seatId: 'seat-nowhere', agentId: orch.id, text: 'learned a thing' });
  assert.equal(nowhere.ok, false);
  assert.match(nowhere.error, /no seat "seat-nowhere"/);

  // An empty line is the diary equivalent of the typo'd seat name: it looks
  // like memory to the next reader and carries none. Whitespace counts as
  // empty, because the store trims before it stores.
  for (const text of [undefined, '', '   ', '\n\t ']) {
    const refused = store.seatDiary({ seatId: 'seat-thornwake', agentId: orch.id, text });
    assert.equal(refused.ok, false, `text ${JSON.stringify(text)} should be refused`);
    assert.match(refused.error, /a diary entry needs text/);
  }
  assert.equal(store.listSeats().find((x) => x.id === 'seat-thornwake').diary.length, 0);

  const kept = store.seatDiary({ seatId: 'seat-thornwake', agentId: orch.id, text: '  the overlap rule bites on -expanded campaigns  ' });
  assert.equal(kept.ok, true, kept.error);
  assert.equal(kept.seat.diary.length, 1);
  assert.equal(kept.seat.diary[0].text, 'the overlap rule bites on -expanded campaigns', 'stored trimmed');
  assert.equal(kept.seat.diary[0].by, orch.id);

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('renaming a seat is control-plane only, exactly like creating one', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });

  // A rename rewrites a durable identity that written records point at, so it
  // is gated like creation. A worker renaming a seat mid-wave would strand
  // every note that names the old one.
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.x' });
  const refused = store.renameSeat({ seatId: 'seat-thornwake', agentId: worker.id, name: 'greyhollow' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /renaming a seat needs one of: orchestrator, master, human/);
  assert.equal(store.listSeats().find((x) => x.id === 'seat-thornwake').name, 'thornwake', 'the refusal changed nothing');

  // An unregistered caller is refused by the same gate, not by a null crash.
  const ghost = store.renameSeat({ seatId: 'seat-thornwake', agentId: 'nobody-at-all', name: 'greyhollow' });
  assert.equal(ghost.ok, false);
  assert.match(ghost.error, /renaming a seat needs one of/);

  // The gate is checked BEFORE the seat exists and before the name is
  // validated, so a worker learns it may not rename rather than learning
  // which seats exist.
  const missing = store.renameSeat({ seatId: 'seat-nowhere', agentId: orch.id, name: 'greyhollow' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /no seat "seat-nowhere"/);

  // A bad new name is refused with the D-N reason, not silently applied.
  const asJob = store.renameSeat({ seatId: 'seat-thornwake', agentId: orch.id, name: 'lead-reviewer' });
  assert.equal(asJob.ok, false);
  assert.match(asJob.error, /names a job or a model/);

  // Renaming to the name it already carries is a no-op, not a self-rename
  // that would push a pointless entry into formerNames.
  const same = store.renameSeat({ seatId: 'seat-thornwake', agentId: orch.id, name: 'thornwake' });
  assert.equal(same.ok, true);
  assert.equal(same.already, true);
  assert.deepEqual(same.seat.formerNames, []);
  assert.equal(same.seat.renames.length, 0);

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the roster mirror is written by every seat writer, not only createSeat (D-R, D-X)', () => {
  const dir = tmpDir();
  const rosterPath = path.join(dir, 'roster.json');
  const store = createStore({ dir, seatRosterPath: rosterPath });
  const orch = orchestrator(store);

  // The mirror exists because `.agent/` is git-ignored and `git clean -fdx`
  // can erase it. A writer that skipped the mirror would leave the surviving
  // copy quietly behind the record — the exact rot the mirror was built to
  // avoid. So each writer is checked on its own: delete the file, call the
  // writer, and the file has to come back with that change in it.
  const rewritten = (label) => {
    assert.ok(fs.existsSync(rosterPath), `${label} did not write the mirror`);
    return JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  };
  const clear = () => fs.rmSync(rosterPath, { force: true });

  // 1. createSeat
  clear();
  assert.equal(store.createSeat({ agentId: orch.id, name: 'thornwake', note: 'trial' }).ok, true);
  assert.equal(rewritten('createSeat').seats[0].name, 'thornwake');

  // 2. holdSeat, called directly rather than through sign-in.
  const holder = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.holder', role: 'orchestrator', sessionId: 'thread-holder',
  });
  clear();
  assert.equal(store.holdSeat({ seatId: 'seat-thornwake', agentId: holder.id }).ok, true);
  rewritten('holdSeat');

  // 3. releaseSeat, the deliberate hand-back.
  clear();
  assert.equal(store.releaseSeat({ seatId: 'seat-thornwake', agentId: holder.id, why: 'proof' }).ok, true);
  rewritten('releaseSeat');

  // 4. renameSeat. The mirror carries both names, so a clean tree can still
  // resolve a record that names the old one.
  clear();
  assert.equal(store.renameSeat({ seatId: 'seat-thornwake', agentId: orch.id, name: 'greyhollow', why: 'proof' }).ok, true);
  const renamed = rewritten('renameSeat').seats[0];
  assert.equal(renamed.name, 'greyhollow');
  assert.deepEqual(renamed.formerNames, ['thornwake']);
  assert.equal(renamed.renames.length, 1);
  assert.equal(renamed.id, 'seat-thornwake', 'the id is immutable, so the mirror keeps resolving');

  // 5. seatDiary. The mirror keeps the COUNT, not the text: it is a copy for
  // survival, not a second editable home for the seat's memory.
  clear();
  assert.equal(store.seatDiary({ seatId: 'seat-thornwake', agentId: orch.id, text: 'a line worth keeping' }).ok, true);
  const withDiary = rewritten('seatDiary').seats[0];
  assert.equal(withDiary.diaryEntries, 1);
  assert.equal(JSON.stringify(withDiary).includes('a line worth keeping'), false, 'the mirror counts diary entries, it does not copy them');

  // 6. retireAgent, which hands the seat back on a clean exit.
  const leaver = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.leaver', role: 'orchestrator',
    sessionId: 'thread-leaver', seat: 'greyhollow',
  });
  assert.equal(leaver.seatId, 'seat-thornwake', leaver.seatError);
  clear();
  store.retireAgent(leaver.id, { note: 'done for the day' });
  rewritten('retireAgent');
  assert.equal(store.listSeats().find((x) => x.id === 'seat-thornwake').holder, null);

  // No temp file survives any of the six writes, so every one of them was
  // atomic rather than in place.
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp')), []);

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// CHARACTERIZATION, not an endorsement. Found while covering renameSeat for
// SEATS-6 (agora-8148.5) and filed as a gap; the fix belongs in store.mjs,
// which this task may not touch. createSeat carries a WF-G140 collision gate
// ("already a name of seat ...") and renameSeat carries none, so a rename can
// still produce two seats answering to one name and hide the second one from
// every by-name lookup — the exact failure WF-G140 was written to end, reached
// through the other door. Change this test when the gate lands.
// WF-G142 (2026-09-09): renameSeat carries the same collision gate as createSeat,
// so two seats can never answer to one name and sign-in lands where it says.
test('renameSeat refuses a name another seat answers to (WF-G142)', () => {
  const dir = tmpDir();
  const store = createStore({ dir, seatRosterPath: path.join(dir, 'roster.json') });
  const orch = orchestrator(store);
  store.createSeat({ agentId: orch.id, name: 'thornwake' });
  store.createSeat({ agentId: orch.id, name: 'greyhollow' });

  const collide = store.renameSeat({ seatId: 'seat-greyhollow', agentId: orch.id, name: 'thornwake', why: 'collision probe' });
  assert.equal(collide.ok, false, 'a current name of another seat is refused');
  assert.match(collide.error, /already a name of seat seat-thornwake/);

  // A FORMER name of another seat is refused too: it still resolves there.
  const ren = store.renameSeat({ seatId: 'seat-thornwake', agentId: orch.id, name: 'ashfall', why: 'move on' });
  assert.equal(ren.ok, true, ren.error);
  const former = store.renameSeat({ seatId: 'seat-greyhollow', agentId: orch.id, name: 'thornwake', why: 'take the old name' });
  assert.equal(former.ok, false, 'a former name still belongs to its seat');

  // A seat may take back a name it carried itself.
  const back = store.renameSeat({ seatId: 'seat-thornwake', agentId: orch.id, name: 'thornwake', why: 'revert' });
  assert.equal(back.ok, true, back.error);

  const names = store.listSeats().map((s) => s.name).sort();
  assert.deepEqual(names, ['greyhollow', 'thornwake'], 'every seat keeps a unique current name');
  const sitter = store.registerAgent({
    petSlug: 'gf-sd', handle: 'orch.sitter', role: 'orchestrator', sessionId: 'thread-sitter', seat: 'greyhollow',
  });
  assert.equal(sitter.seatId, 'seat-greyhollow', 'sign-in lands in the seat that carries the name');

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
