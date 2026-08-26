// tools/agora/server.seats.test.mjs
// SEATS-4 (board task agora-8148.3): the five /seats HTTP routes and the seat
// path through POST /agents/register, proven over the real daemon.
//
//   node --test tools/agora/server.seats.test.mjs
//
// WHY THIS FILE EXISTS. store.seats.test.mjs proves the seat MODEL, but until
// now nothing touched the routes that expose it. The route layer is where the
// two decisions a caller actually feels are made, and neither lives in the
// store:
//
//   1. WHICH STATUS a refusal carries. server.mjs maps a refused seat NAME to
//      400 and a refused ROLE to 403 by matching /needs one of/ on the store's
//      error string. That mapping is a string coupling between two files, so a
//      reworded store error would silently turn a permission refusal into a
//      "bad request" and nothing would notice.
//   2. WHICH SEAT a bare call means. /seats/release and /seats/diary fall back
//      to the caller's own seat when the body names none, and answer 400 with
//      a sentence that names the fix when the caller holds no seat at all.
//
// And PROTOCOL.md (Seats) states the register contract these tests pin:
// "Registration always succeeds; a refused seat comes back as seatError so the
// caller is never stranded with a token it cannot use."
//
// The store is built here with an injected clock (presence, and therefore
// `attended`, is time-based) and a seatRosterPath inside the test's temp dir.
// The tracked tools/agora/seat-roster.json is never written by this file.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';

let app;
let port;
let tmpDir;
let rosterPath;
// A clock the test drives. `attended` on GET /seats asks whether a LIVE session
// holds the seat, so presence has to be ageable on purpose rather than by wall
// clock. Nothing here advances it, which keeps every registered agent live.
let clock = Date.UTC(2026, 8, 9, 9, 0, 0);

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-server-seats-test-'));
  rosterPath = path.join(tmpDir, 'seat-roster.json');
  app = createAgoraServer({
    dir: tmpDir,
    storeFactory: ({ dir }) => createStore({
      dir,
      now: () => clock,
      // Never the tracked roster: the mirror is written on every seat write.
      seatRosterPath: rosterPath,
      workspaceRoot: 'F:/Repos/Aralia',
    }),
  });
  await new Promise((resolve) => app.listen(0, resolve));
  port = app.server.address().port;
});

after(async () => {
  if (app) await app.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function request(method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
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

// Pet identity is unique per LIVE agent and every agent registered here stays
// live, so each registration takes the next free catalog entry.
let petCursor = -1;
async function registerAgent(handle, { role = 'worker', seat } = {}) {
  const pets = (await request('GET', '/pets')).json.pets;
  const pet = pets[++petCursor].slug;
  const body = { handle, petSlug: pet, sessionId: `thread-${handle}`, role, note: 'seat route test' };
  if (seat !== undefined) body.seat = seat;
  const r = await request('POST', '/agents/register', { body });
  assert.equal(r.status, 201, r.raw);
  return { id: r.json.agentId, token: r.json.token, handle, json: r.json };
}

/** Read one seat out of GET /seats by its immutable id. */
async function getSeat(seatId) {
  const r = await request('GET', '/seats');
  assert.equal(r.status, 200, r.raw);
  return (r.json.seats || []).find((s) => s.id === seatId) || null;
}

// A command-channel caller (creating and renaming seats needs one) and a plain
// worker (which must be refused), shared by the refusal tests below.
let orch;
let worker;

test('GET /seats carries attended, holderHandle, formerNames, diary and the campaigns the seat owns', async () => {
  orch = await registerAgent('seat-routes.orch', { role: 'orchestrator' });
  worker = await registerAgent('seat-routes.worker');

  // A seat is created deliberately, by a command-channel role.
  const made = await request('POST', '/seats', {
    token: orch.token,
    body: { name: 'thornwake', note: 'seat route proof' },
  });
  assert.equal(made.status, 200, made.raw);
  assert.equal(made.json.seat.id, 'seat-thornwake');
  assert.equal(made.json.seat.holder, null);

  // Before anyone sits in it, the seat is UNATTENDED — a fact, not a guess.
  const empty = await getSeat('seat-thornwake');
  assert.equal(empty.attended, false);
  assert.equal(empty.holderHandle, '');
  assert.deepEqual(empty.formerNames, []);
  assert.deepEqual(empty.diary, []);
  assert.deepEqual(empty.campaigns, []);

  // The seat is taken AT SIGN-IN (PROTOCOL.md, Seats), not when a campaign is
  // claimed, so it travels on the register call.
  const holder = await registerAgent('seat-routes.holder', { role: 'orchestrator', seat: 'thornwake' });
  assert.equal(holder.json.seatId, 'seat-thornwake');
  assert.equal(holder.json.seatError, '');

  // A campaign claimed by that session belongs to the SEAT, which is the whole
  // point of seats: the session ends, the durable owner does not.
  const campaign = await request('POST', '/campaigns', {
    token: holder.token,
    body: { id: 'seat-route-probe', paths: ['tools/agora/server.seats.test.mjs'] },
  });
  assert.equal(campaign.status, 201, campaign.raw);

  const diary = await request('POST', '/seats/diary', {
    token: holder.token,
    body: { text: 'the route table is the contract' },
  });
  assert.equal(diary.status, 200, diary.raw);

  const held = await getSeat('seat-thornwake');
  assert.equal(held.attended, true);
  assert.equal(held.holderHandle, 'seat-routes.holder');
  assert.equal(held.diary.length, 1);
  assert.equal(held.diary[0].text, 'the route table is the contract');
  assert.deepEqual(held.campaigns, [campaign.json.campaign.id]);

  // A rename KEEPS the old name (D-N): written records name it and must keep
  // resolving. The id never changes.
  const renamed = await request('POST', '/seats/rename', {
    token: orch.token,
    body: { seat: 'thornwake', name: 'thornwake-vale', why: 'route proof' },
  });
  assert.equal(renamed.status, 200, renamed.raw);

  const after2 = await getSeat('seat-thornwake');
  assert.equal(after2.name, 'thornwake-vale');
  assert.deepEqual(after2.formerNames, ['thornwake']);
  // Renaming does not disturb what the seat already carried.
  assert.equal(after2.attended, true);
  assert.equal(after2.diary.length, 1);

  // The roster MIRROR is written to the injected temp path, never to the
  // tracked tools/agora/seat-roster.json.
  assert.ok(fs.existsSync(rosterPath), 'seat roster mirror written to the temp path');
  const mirrored = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const mirroredSeats = Array.isArray(mirrored) ? mirrored : mirrored.seats;
  assert.ok(
    mirroredSeats.some((s) => s.id === 'seat-thornwake'),
    'the temp roster mirror holds the seat this test created',
  );
});

test('POST /seats answers 400 for a bad name and 403 for a role that may not create seats', async () => {
  // A name that breaks the grammar is the CALLER's mistake: 400.
  const shouty = await request('POST', '/seats', { token: orch.token, body: { name: 'Thornwake Vale' } });
  assert.equal(shouty.status, 400, shouty.raw);
  assert.match(shouty.json.error, /lowercase words joined by hyphens/);

  const nameless = await request('POST', '/seats', { token: orch.token, body: {} });
  assert.equal(nameless.status, 400, nameless.raw);
  assert.match(nameless.json.error, /a seat needs a name/);

  // A name that encodes the job or the model is refused by name (D-N), and is
  // still a 400 rather than a permission problem.
  const jobName = await request('POST', '/seats', { token: orch.token, body: { name: 'lead-reviewer' } });
  assert.equal(jobName.status, 400, jobName.raw);
  assert.match(jobName.json.error, /names a job or a model/);

  // A refused ROLE is permission: 403. Note the status is chosen by matching
  // the store's wording, so this assertion is what stops a reworded store
  // error from quietly demoting a permission refusal to a bad request.
  const byWorker = await request('POST', '/seats', { token: worker.token, body: { name: 'quillhollow' } });
  assert.equal(byWorker.status, 403, byWorker.raw);
  assert.match(byWorker.json.error, /needs one of: orchestrator, master, human/);

  // The refused seat was not created as a side effect of the refusal.
  assert.equal(await getSeat('seat-quillhollow'), null);
});

test('POST /seats/release answers 400 with no seat held, and 400 when the caller is not the holder', async () => {
  // No body.seat and no seat of one's own: the error has to name the fix,
  // because the caller cannot tell from a bare 400 what it should have sent.
  const bare = await request('POST', '/seats/release', { token: worker.token, body: {} });
  assert.equal(bare.status, 400, bare.raw);
  assert.match(bare.json.error, /you are not sitting in a seat/);
  assert.match(bare.json.error, /seat release <name>/);

  // Naming a seat somebody else holds is refused: releasing is the holder's
  // act, not a way to evict a live session.
  const notMine = await request('POST', '/seats/release', {
    token: worker.token,
    body: { seat: 'thornwake-vale' },
  });
  assert.equal(notMine.status, 400, notMine.raw);
  assert.match(notMine.json.error, /is not held by this session/);

  // ...and the seat is still attended by its real holder afterwards.
  const seat = await getSeat('seat-thornwake');
  assert.equal(seat.attended, true);
  assert.equal(seat.holderHandle, 'seat-routes.holder');
});

test('POST /seats/rename answers 400 for a bad name and 403 for a role that may not rename', async () => {
  const bad = await request('POST', '/seats/rename', {
    token: orch.token,
    body: { seat: 'thornwake-vale', name: 'NOT A SEAT NAME' },
  });
  assert.equal(bad.status, 400, bad.raw);
  assert.match(bad.json.error, /lowercase words joined by hyphens/);

  const byWorker = await request('POST', '/seats/rename', {
    token: worker.token,
    body: { seat: 'thornwake-vale', name: 'brackenmoor' },
  });
  assert.equal(byWorker.status, 403, byWorker.raw);
  assert.match(byWorker.json.error, /needs one of: orchestrator, master, human/);

  // An unknown seat is a 400, not a 403: nothing about permission failed.
  const missing = await request('POST', '/seats/rename', {
    token: orch.token,
    body: { seat: 'seat-nowhere', name: 'brackenmoor' },
  });
  assert.equal(missing.status, 400, missing.raw);
  assert.match(missing.json.error, /no seat "seat-nowhere"/);

  // None of the three refusals moved the name.
  assert.equal((await getSeat('seat-thornwake')).name, 'thornwake-vale');
});

test('POST /seats/diary answers 400 with no seat and 400 on empty text', async () => {
  const bare = await request('POST', '/seats/diary', { token: worker.token, body: { text: 'nowhere to write' } });
  assert.equal(bare.status, 400, bare.raw);
  assert.match(bare.json.error, /there is no diary to write to/);
  assert.match(bare.json.error, /seat diary <text> --seat <name>/);

  // A named seat plus blank text is the other half: whitespace is not an entry.
  const blank = await request('POST', '/seats/diary', {
    token: orch.token,
    body: { seat: 'thornwake-vale', text: '   ' },
  });
  assert.equal(blank.status, 400, blank.raw);
  assert.match(blank.json.error, /a diary entry needs text/);

  // A diary line may be written by a session that does not hold the seat: the
  // diary is the SEAT's memory, and refusing a note from the agent who just
  // learned something would lose exactly the note worth keeping.
  const byOther = await request('POST', '/seats/diary', {
    token: orch.token,
    body: { seat: 'thornwake-vale', text: 'written by a non-holder on purpose' },
  });
  assert.equal(byOther.status, 200, byOther.raw);

  const seat = await getSeat('seat-thornwake');
  assert.equal(seat.diary.length, 2);
  assert.equal(seat.diary[1].by, orch.id);
});

test('POST /agents/register always succeeds and reports a refused seat as seatError', async () => {
  // A TYPO must not conjure a seat, and must not cost the caller its token.
  const typo = await registerAgent('seat-routes.typo', { role: 'orchestrator', seat: 'thornwaek' });
  assert.equal(typo.json.seatId, '');
  assert.match(typo.json.seatError, /no seat "seat-thornwaek"/);
  assert.ok(typo.json.token, 'registration still issued a usable token');
  // The token works: the caller is not stranded.
  const whoami = await request('POST', '/agents/heartbeat', { token: typo.token });
  assert.equal(whoami.status, 200, whoami.raw);
  // ...and no seat was created by the misspelling.
  assert.equal(await getSeat('seat-thornwaek'), null);

  // A seat a LIVE session already holds is refused the same way: reported, not
  // thrown, and with the live holder named so the caller can act on it.
  const contender = await registerAgent('seat-routes.contender', { role: 'orchestrator', seat: 'thornwake-vale' });
  assert.equal(contender.json.seatId, '');
  assert.match(contender.json.seatError, /is held by a live session \(seat-routes\.holder\)/);
  assert.ok(contender.json.token);

  // The seat is unchanged: still attended by the original holder.
  const seat = await getSeat('seat-thornwake');
  assert.equal(seat.holderHandle, 'seat-routes.holder');

  // Registering with NO seat is the ordinary case and reports neither field.
  const seatless = await registerAgent('seat-routes.seatless');
  assert.equal(seatless.json.seatId, '');
  assert.equal(seatless.json.seatError, '');
});
