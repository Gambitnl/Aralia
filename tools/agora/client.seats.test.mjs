// tools/agora/client.seats.test.mjs
// CLI tests for the seat subcommands (list, new, release, rename, diary) and for
// the seat lines `register` prints at sign-in.
//   node --test "tools/agora/*.test.mjs"
//
// WHY THIS FILE EXISTS (SEATS-5, agora-8148.4). Two seat rules from design doc
// section 69 are only ever MET at the CLI, so only the CLI can prove them:
//
//   1. "Registration always succeeds, even when the seat is refused. Failing it
//      would strand an agent holding a token it could not use. The refusal comes
//      back as seatError." — so a refused seat must print and still exit 0.
//   2. "Created deliberately. A seat carries a diary and a history, so a
//      misspelling at sign-in must not conjure one." — so `seat new` is its own
//      step, and the error names it.
//
// The whole suite runs against a PRIVATE in-process server on an ephemeral port
// with its own temp store dir, and passes its own `seatRosterPath` so the store
// never writes the tracked tools/agora/seat-roster.json. Nothing here touches the
// live daemon on :4319.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';

let app;
let serverDir;
let clientDir;
let rosterPath;
let baseUrl;
let env;

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-seat-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-seat-id-'));
  // D-R: the store mirrors seats to a tracked file in production. A test that
  // let it default would rewrite tools/agora/seat-roster.json for everyone in
  // this shared checkout, so the mirror is redirected into the temp dir.
  rosterPath = path.join(serverDir, 'seat-roster.json');
  app = createAgoraServer({ dir: serverDir, seatRosterPath: rosterPath });
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  env = { AGORA_DIR: clientDir, AGORA_PET: 'gf-sd' };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) {
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

/** One CLI caller = one identity file, exactly as two real sessions would be. */
function cliFor(agentId) {
  const scoped = { ...env, AGORA_AGENT_ID: agentId };
  return (argv) => run(argv, { env: scoped, baseUrl });
}

const text = (r) => r.lines.join('\n');

test('seat list on an empty board teaches how to make the first seat', async () => {
  const cli = cliFor('seat-cli-empty');
  const reg = await cli(['register', 'seat-cli-empty', '--role', 'orchestrator', '--session', 'seat-cli-empty-thread']);
  assert.equal(reg.code, 0);

  const listed = await cli(['seat', 'list']);
  assert.equal(listed.code, 0);
  assert.deepEqual(listed.seats, []);
  // The empty listing is the only place a first-time reader learns the command
  // and what a seat is for, so both lines are load-bearing.
  assert.match(text(listed), /No seats yet\. Create one: seat new <name>/);
  assert.match(text(listed), /keeps its owner after your session ends/);
});

test('seat new is its own deliberate step: it prints the take-it-at-sign-in hint', async () => {
  const cli = cliFor('seat-cli-maker');
  await cli(['register', 'seat-cli-maker', '--role', 'orchestrator', '--session', 'seat-cli-maker-thread']);

  const made = await cli(['seat', 'new', 'north-wind', '--note', 'keeps the CLI honest']);
  assert.equal(made.code, 0);
  assert.equal(made.seat.name, 'north-wind');
  assert.equal(made.seat.id, 'seat-north-wind');
  assert.match(text(made), /^Seat created: north-wind$/m);
  // D-AB: a seat is TAKEN at sign-in, not at campaign claim. The hint is the
  // only place the CLI says so, and it names the exact next command.
  assert.match(text(made), /Take it at sign-in: register <handle> --pet <slug> --seat north-wind/);

  // Bare `seat new` explains the two naming constraints instead of guessing.
  const usage = await cli(['seat', 'new']);
  assert.equal(usage.code, 1);
  assert.match(text(usage), /Usage: seat new <name>/);
  assert.match(text(usage), /may not say the JOB/);
  assert.match(text(usage), /may not name a model/);

  // D-N: a name that says the job, or names a model, is refused by name.
  const jobName = await cli(['seat', 'new', 'night-orchestrator']);
  assert.equal(jobName.code, 1);
  assert.match(text(jobName), /seat new failed \(400\)/);
  assert.match(text(jobName), /which names a job or a model/);

  const modelName = await cli(['seat', 'new', 'opus-keeper']);
  assert.equal(modelName.code, 1);
  assert.match(text(modelName), /contains "opus"/);

  // A second seat with the same name is refused, not silently reused.
  const dupe = await cli(['seat', 'new', 'north-wind']);
  assert.equal(dupe.code, 1);
  assert.match(text(dupe), /seat "north-wind" already exists/);
});

test('register --seat prints "Seat held", and a refused seat prints "Seat NOT held" with exit 0', async () => {
  const maker = cliFor('seat-cli-maker');
  const made = await maker(['seat', 'new', 'quiet-harbor']);
  assert.equal(made.code, 0);

  // The holder takes it at sign-in and is told plainly that it got it.
  const holder = cliFor('seat-cli-holder');
  const held = await holder([
    'register', 'seat-cli-holder', '--role', 'orchestrator',
    '--session', 'seat-cli-holder-thread', '--seat', 'quiet-harbor',
  ]);
  assert.equal(held.code, 0);
  assert.equal(held.identity.seatId, 'seat-quiet-harbor');
  assert.match(text(held), /^Seat held: seat-quiet-harbor$/m);
  assert.doesNotMatch(text(held), /Seat NOT held/);

  // Section 69: registration always succeeds even when the seat is refused.
  // A rival session gets a token it can use, and is told the seat is not its.
  const rival = cliFor('seat-cli-rival');
  const refused = await rival([
    'register', 'seat-cli-rival', '--role', 'orchestrator',
    '--session', 'seat-cli-rival-thread', '--seat', 'quiet-harbor',
  ]);
  assert.equal(refused.code, 0, 'a refused seat must NOT fail registration');
  assert.ok(refused.identity.token, 'the refused session still holds a usable token');
  assert.equal(refused.identity.seatId, '', 'the refused session sits in no seat');
  assert.match(text(refused), /Seat NOT held: seat "quiet-harbor" is held by a live session \(seat-cli-holder\)/);
  assert.match(text(refused), /any campaign you claim will have no durable owner/);

  // The token really is usable: the refused session can still work the board.
  const stillWorks = await rival(['seat', 'list']);
  assert.equal(stillWorks.code, 0);

  // A misspelling at sign-in must not conjure a seat. It is refused the same
  // way, exit stays 0, and the error names the step that creates one.
  const typo = cliFor('seat-cli-typo');
  const missed = await typo([
    'register', 'seat-cli-typo', '--role', 'orchestrator',
    '--session', 'seat-cli-typo-thread', '--seat', 'quiet-harbour',
  ]);
  assert.equal(missed.code, 0);
  assert.match(text(missed), /Seat NOT held: no seat "seat-quiet-harbour"\. Create it first: seat new <name>/);
  const roster = await typo(['seat', 'list']);
  assert.equal(roster.seats.filter((s) => s.name === 'quiet-harbour').length, 0);
});

test('seat list prints who is on each seat, and what it owns', async () => {
  const holder = cliFor('seat-cli-holder');
  // A campaign claimed from the seat gives the seat a durable owner to show.
  const claim = await holder([
    'campaign', 'claim', 'seat-cli-harbor-wave',
    '--role', 'lead', '--path', 'tmp/seat-cli-harbor',
  ]);
  assert.equal(claim.code, 0);

  const listed = await cliFor('seat-cli-maker')(['seat', 'list']);
  assert.equal(listed.code, 0);
  const held = listed.seats.find((s) => s.name === 'quiet-harbor');
  assert.equal(held.attended, true);
  assert.equal(held.holderHandle, 'seat-cli-holder');
  assert.equal(held.campaigns.length, 1);
  // ATTENDED is a fact about a live session, so the line names the handle.
  assert.match(text(listed), /quiet-harbor {2}\(held by seat-cli-holder\) {2}owns 1/);
  // north-wind was created and never taken; the listing says so rather than
  // guessing that it was abandoned.
  assert.match(text(listed), /north-wind {2}\(nobody on it\) {2}— keeps the CLI honest/);
});

test('seat diary records a line for the successor and counts the entries', async () => {
  const holder = cliFor('seat-cli-holder');

  // With no --seat, the diary goes to the seat this session is sitting in.
  const first = await holder(['seat', 'diary', 'the CLI hint is the only place D-AB is stated']);
  assert.equal(first.code, 0);
  assert.equal(first.seat.name, 'quiet-harbor');
  assert.equal(first.seat.diary.length, 1);
  assert.equal(first.seat.diary[0].text, 'the CLI hint is the only place D-AB is stated');
  assert.match(text(first), /^Noted on seat quiet-harbor \(1 entries\)$/m);

  const second = await holder(['seat', 'diary', 'second line', '--seat', 'quiet-harbor']);
  assert.equal(second.seat.diary.length, 2);
  assert.match(text(second), /\(2 entries\)/);

  // An empty diary line is refused rather than stored as a blank memory.
  const blank = await holder(['seat', 'diary']);
  assert.equal(blank.code, 1);
  assert.match(text(blank), /seat diary failed \(400\).*a diary entry needs text/);

  // A session with no seat is told which flag names one.
  const seatless = cliFor('seat-cli-rival');
  const nowhere = await seatless(['seat', 'diary', 'into the void']);
  assert.equal(nowhere.code, 1);
  assert.match(text(nowhere), /you are not sitting in a seat/);
});

test('seat rename keeps the old name and prints what the seat also answers to', async () => {
  const holder = cliFor('seat-cli-holder');

  const renamed = await holder(['seat', 'rename', 'quiet-harbor', 'still-harbor', '--why', 'clearer']);
  assert.equal(renamed.code, 0);
  assert.equal(renamed.seat.name, 'still-harbor');
  // D-N: the rename is RECORDED, never overwritten.
  assert.deepEqual(renamed.seat.formerNames, ['quiet-harbor']);
  assert.match(text(renamed), /^Seat renamed to still-harbor; it also answers to quiet-harbor$/m);

  // WF-G140: the former name still resolves, so the diary written under the old
  // name is still reachable by it.
  const byOldName = await holder(['seat', 'diary', 'renamed, same person', '--seat', 'quiet-harbor']);
  assert.equal(byOldName.code, 0);
  assert.equal(byOldName.seat.name, 'still-harbor');
  assert.equal(byOldName.seat.diary.length, 3);

  // The listing carries the former name too, so a stale reference still lands.
  const listed = await holder(['seat', 'list']);
  assert.match(text(listed), /also known as: quiet-harbor/);

  // WF-G142: a rename may not steal a name another seat already answers to.
  const collide = await holder(['seat', 'rename', 'still-harbor', 'north-wind']);
  assert.equal(collide.code, 1);
  assert.match(text(collide), /already a name of seat seat-north-wind/);

  // A renamed seat is still refused a job/model name.
  const badName = await holder(['seat', 'rename', 'still-harbor', 'harbor-worker']);
  assert.equal(badName.code, 1);
  assert.match(text(badName), /which names a job or a model/);
});

test('seat release frees the seat, and the listing stops claiming anyone is on it', async () => {
  const holder = cliFor('seat-cli-holder');

  const released = await holder(['seat', 'release', 'still-harbor', '--why', 'handing off']);
  assert.equal(released.code, 0);
  assert.equal(released.seat.name, 'still-harbor');
  assert.equal(released.seat.holder, null);
  assert.match(text(released), /^Seat released: still-harbor$/m);

  const listed = await holder(['seat', 'list']);
  // The id is derived at CREATION and never changes, so a renamed seat keeps
  // its original id; only the by-name lookup learned the new name (WF-G140).
  const seat = listed.seats.find((s) => s.id === 'seat-quiet-harbor');
  assert.equal(seat.name, 'still-harbor');
  assert.equal(seat.attended, false);
  assert.match(text(listed), /still-harbor {2}\(nobody on it\)/);

  // Now free, the seat can be taken by the session that was refused it before.
  const rival = cliFor('seat-cli-rival');
  const took = await rival([
    'register', 'seat-cli-rival-2', '--role', 'orchestrator',
    '--session', 'seat-cli-rival-thread', '--seat', 'still-harbor',
  ]);
  assert.equal(took.code, 0);
  assert.match(text(took), /^Seat held: seat-quiet-harbor$/m);

  // Releasing a seat this session does not hold is refused, not silently done.
  const notMine = await holder(['seat', 'release', 'still-harbor']);
  assert.equal(notMine.code, 1);
  assert.match(text(notMine), /is not held by this session/);
});

test('an unknown seat subcommand lists the five that exist', async () => {
  const cli = cliFor('seat-cli-maker');
  const bogus = await cli(['seat', 'sit']);
  assert.equal(bogus.code, 1);
  assert.match(text(bogus), /unknown seat subcommand "sit"\. Use: seat list\|new\|release\|rename\|diary/);
});

test('the seat roster mirror is written to the path this test owns, never the tracked one', async () => {
  // D-R exists because .agent/ is git-ignored, so the mirror is a tracked file
  // in production. This asserts the test never wrote that one.
  const mirror = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const names = mirror.seats.map((s) => s.name).sort();
  assert.deepEqual(names, ['north-wind', 'still-harbor']);
});

// WF-G145 (2026-09-09): the seat has the same environment fallback as the pet,
// the model and the session, so a dispatch template can carry it.
test('register takes the seat from AGORA_SEAT when --seat is absent, and --seat wins over it', async () => {
  const maker = cliFor('seat-env-maker');
  const reg = await maker(['register', 'seat-env-maker', '--role', 'orchestrator', '--session', 'seat-env-maker-thread']);
  assert.equal(reg.code, 0, text(reg));
  const a = await maker(['seat', 'new', 'env-harbor']);
  assert.equal(a.code, 0, text(a));
  const b = await maker(['seat', 'new', 'flag-harbor']);
  assert.equal(b.code, 0, text(b));
  const viaEnv = await run(
    ['register', 'seat-env-sitter', '--role', 'orchestrator', '--session', 'seat-env-thread'],
    { env: { ...env, AGORA_AGENT_ID: 'seat-env-sitter', AGORA_SEAT: 'env-harbor' }, baseUrl },
  );
  assert.equal(viaEnv.code, 0, text(viaEnv));
  assert.equal(viaEnv.identity.seatId, 'seat-env-harbor');
  assert.match(text(viaEnv), /^Seat held: seat-env-harbor$/m);
  const viaFlag = await run(
    ['register', 'seat-flag-sitter', '--role', 'orchestrator', '--session', 'seat-flag-thread', '--seat', 'flag-harbor'],
    { env: { ...env, AGORA_AGENT_ID: 'seat-flag-sitter', AGORA_SEAT: 'env-harbor' }, baseUrl },
  );
  assert.equal(viaFlag.identity.seatId, 'seat-flag-harbor', 'the flag wins over the environment');
});
