// tools/agora/client.migrations.test.mjs
// The migration commands: what they PRINT, what they WRITE, and in what order
// they must run. Node built-in runner only:
//   node --test "tools/agora/*.test.mjs"
//
// The live 2026-09-07 migration exposed three defects that no existing test
// could have caught, because every other test asserts on returned data and
// never on the text a person reads or the ORDER the steps run in:
//
//   1. `task migrate-deps` printed "[object Object]". A dep row carries ARRAYS,
//      and a typed dep is an object, so both went through string interpolation.
//      It looked like corrupt data.
//   2. `task migrate-ids` renames campaigns AND tasks and called the total
//      "task(s)". 247 records read as 247 tasks, wrong by 27.
//   3. WF-G105: `--dry` on migrate-deps WROTE and then printed "Nothing was
//      written". The store had no dry branch and the route ignored `?dry=1`.
//
// Each test owns its own board. They mutate global state — a rename touches
// every record — so sharing one server would make each test depend on the
// order the runner happens to use.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';

/** One task record in the shape the board held BEFORE either migration. */
function preMigrationTask(over = {}) {
  return {
    id: crypto.randomUUID(), title: 'task', body: '', category: '', campaignId: '', wave: '',
    state: 'done', createdBy: 'seed', creatorAgent: null, claimedBy: null, claimedAgent: null,
    assignedPet: null, retraceFiles: [], deps: [], priority: 0, refs: [], result: 'done',
    resultDisposition: null, finding: null, evidence: null,
    createdAt: 1, updatedAt: 1, history: [{ at: 1, by: 'seed', action: 'created', state: 'open' }],
    ...over,
  };
}

/** A fresh board holding one dependency in the genuine PRE-migration shape:
 *  `deps` is a bare STRING, which is what all 25 live edges were. Written as a
 *  journal rather than reached in through a setter, so the migration is proved
 *  against the thing it has to convert. */
async function board(t) {
  const serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-mig-srv-'));
  const clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-mig-id-'));

  const target = preMigrationTask({ title: 'target' });
  const dependent = preMigrationTask({
    title: 'dependent', state: 'open', result: null, deps: [target.id],
  });
  fs.writeFileSync(
    path.join(serverDir, 'journal.jsonl'),
    [
      { seq: 1, type: 'task.create', payload: { task: target }, ts: 1 },
      { seq: 2, type: 'task.create', payload: { task: dependent }, ts: 2 },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n',
  );

  const app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const env = { AGORA_DIR: clientDir, AGORA_AGENT_ID: 'migration-test', AGORA_PET: 'gf-sd' };

  t.after(async () => {
    await app.close();
    for (const d of [serverDir, clientDir]) fs.rmSync(d, { recursive: true, force: true });
  });

  // Both migrations are control-plane acts, so the caller must be one.
  const reg = await run(
    ['register', 'orch.migprint', '--role', 'orchestrator', '--session', 'thread-migprint'],
    { env, baseUrl },
  );
  assert.equal(reg.code, 0, reg.lines.join('\n'));

  const cli = (argv) => run(argv, { env, baseUrl });
  return { cli, targetId: target.id };
}

test('migrate-deps prints each edge as id:type, never "[object Object]"', async (t) => {
  const { cli, targetId } = await board(t);

  const dry = await cli(['task', 'migrate-deps', '--dry']);
  assert.equal(dry.code, 0);
  const text = dry.lines.join('\n');

  // The defect, stated as the assertion that would have caught it.
  assert.doesNotMatch(text, /\[object Object\]/, 'a typed dep must print its own fields');
  assert.match(text, new RegExp(`${targetId}\\s+->\\s+${targetId}:blocks`));
  assert.match(text, /WOULD change 1 task\(s\)\./);
  assert.match(text, /Nothing was written/);

  // WF-G105: the sentence above must be TRUE. The store had no dry branch and
  // the route never read `?dry=1`, so a check-before-committing wrote the board
  // and then said it had not. If the dry run wrote, this comes back 0.
  const applied = await cli(['task', 'migrate-deps']);
  assert.equal(applied.code, 0);
  assert.equal(applied.migrated, 1, 'the dry run must not have written the edge');
  assert.doesNotMatch(applied.lines.join('\n'), /\[object Object\]/);

  // Idempotent: nothing untyped is left, so a third call writes none.
  assert.equal((await cli(['task', 'migrate-deps'])).migrated, 0);
});

test('the correct order needs no repair: type the deps, THEN rename', async (t) => {
  const { cli } = await board(t);

  await cli(['task', 'migrate-deps']);
  await cli(['task', 'migrate-ids']);

  // The rename followed the typed edge, so there is nothing stale to fix.
  // This is the assertion that proves the corrected order is actually correct,
  // rather than merely different from the one that failed.
  const check = await cli(['task', 'migrate-dep-ids', '--dry']);
  assert.equal(check.migrated, 0, 'a correctly ordered run leaves no stale edge');
});

test('WF-G104: the wrong order strands an edge, and migrate-dep-ids repairs it', async (t) => {
  const { cli, targetId } = await board(t);

  // THE WRONG ORDER, exactly as the design doc stated it and the live run used
  // it. `ids.migrate` follows a rename into an edge by reading `d.id`. The dep
  // is still a bare STRING here, so `d.id` is undefined and no edge matches.
  await cli(['task', 'migrate-ids']);
  // The typing step then wraps the bare string and preserves the stale id.
  await cli(['task', 'migrate-deps']);

  const dry = await cli(['task', 'migrate-dep-ids', '--dry']);
  assert.equal(dry.code, 0);
  const text = dry.lines.join('\n');
  assert.doesNotMatch(text, /\[object Object\]/);
  assert.match(
    text,
    new RegExp(`${targetId}:blocks\\s+->\\s+agora-[0-9a-f]{4}:blocks`),
    'the edge names the old id and must be repointed at the current one',
  );
  assert.match(text, /Nothing was written/);

  // The dry run must not have written: the real run finds the same edge.
  const applied = await cli(['task', 'migrate-dep-ids']);
  assert.equal(applied.migrated, 1, 'the dry run must not have written the edge');

  // Idempotent once repaired.
  assert.equal((await cli(['task', 'migrate-dep-ids'])).migrated, 0);
});

test('migrate-ids counts campaigns as well as tasks, and says so', async (t) => {
  const { cli } = await board(t);

  const claimed = await cli(['campaign', 'claim', 'print-check', '--path', 'tools/agora/print-check.md']);
  assert.equal(claimed.code, 0, claimed.lines.join('\n'));

  const dry = await cli(['task', 'migrate-ids', '--dry']);
  assert.equal(dry.code, 0);
  const text = dry.lines.join('\n');

  // "task(s)" undercounted by one per campaign on the live board.
  assert.match(text, /record\(s\) — campaigns and tasks/);
  assert.doesNotMatch(text, /\d+ task\(s\)\./);
  assert.doesNotMatch(text, /\[object Object\]/);

  // Every renamed record prints both names, so a reader can follow the move.
  assert.match(text, /->\s+agora-[0-9a-f]{4}/);
});
