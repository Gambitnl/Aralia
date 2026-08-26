// tools/agora/server.gaps.test.mjs
// WF-G113: POST /gaps — the daemon-backed gap intake, proven in-process.
//
//   node --test tools/agora/server.gaps.test.mjs
//
// The failure this replaces: docs/projects/GLOBAL_GAPS.md was the hottest lock
// on the 2026-09-09 board because every worker owed it a one-row append. Ids
// collided, Windows threw EBUSY mid-write, and 3-hour locks held for one row
// blocked six workers. The daemon now owns the write and serializes it in
// process, so two concurrent callers get two different ids and no file lock.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { parseGapsMarkdown } from './gapIndex.mjs';

let app;
let port;
let tmpDir;
let repoRoot;

const WORKFLOW_FIXTURE = [
  '---',
  'schema_version: 1',
  'id_prefix: WF-G',
  'next_free_id: WF-G50',
  '---',
  '',
  '## Registry',
  '',
  '| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| WF-G49 | open | low | docs | docs | h | claude | id | t | 2026-01-01 | prior | e | w | n | p | — |',
  '',
].join('\n');

// CRLF on purpose: the real GLOBAL_GAPS.md is CRLF in the worktree.
const GLOBAL_FIXTURE = [
  '# Global Gap Tracker',
  '',
  '| Gap ID | Status | Classification | Detected during | Gap | Evidence/source | Why it matters | Suspected owner/project | Routing decision | Destination | Next action | Next proof/check |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| GG-2 | open | technical_debt | s | two | e | w | o | r | d | n | p |',
  '| GG-1 | open | technical_debt | s | one | e | w | o | r | d | n | p |',
  '',
].join('\r\n');

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-gaps-server-'));
  repoRoot = path.join(tmpDir, 'repo');
  fs.mkdirSync(path.join(repoRoot, 'tools', 'agora'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'docs', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'tools', 'agora', 'WORKFLOW_GAPS.md'), WORKFLOW_FIXTURE);
  fs.writeFileSync(path.join(repoRoot, 'docs', 'projects', 'GLOBAL_GAPS.md'), GLOBAL_FIXTURE);
  app = createAgoraServer({ dir: path.join(tmpDir, 'state'), gapsRepoRoot: repoRoot, seatRosterPath: null });
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

let petCursor = -1;
async function registerAgent(handle) {
  const pets = (await request('GET', '/pets')).json.pets;
  petCursor += 1;
  const r = await request('POST', '/agents/register', {
    body: { handle, petSlug: pets[petCursor].slug, sessionId: `session-${handle}`, note: 'gap intake test' },
  });
  assert.equal(r.status, 201, r.raw);
  return { id: r.json.agentId, token: r.json.token };
}

const readWorkflow = () => fs.readFileSync(path.join(repoRoot, 'tools', 'agora', 'WORKFLOW_GAPS.md'), 'utf8');
const readGlobal = () => fs.readFileSync(path.join(repoRoot, 'docs', 'projects', 'GLOBAL_GAPS.md'), 'utf8');

test('POST /gaps requires a token', async () => {
  const r = await request('POST', '/gaps', { body: { project: 'workflow', gap: 'x' } });
  assert.equal(r.status, 401);
});

test('POST /gaps refuses an empty gap and an unknown project', async () => {
  const agent = await registerAgent('gap-filer-validation');
  const noGap = await request('POST', '/gaps', { token: agent.token, body: { project: 'workflow', gap: '  ' } });
  assert.equal(noGap.status, 400);
  assert.match(noGap.json.error, /gap \(string\) is required/);
  const noProject = await request('POST', '/gaps', { token: agent.token, body: { project: 'not-a-project', gap: 'x' } });
  assert.equal(noProject.status, 400);
  assert.match(noProject.json.error, /no gap registry/);
});

test('POST /gaps appends one row, allocates the next id, and stamps the caller as registrant', async () => {
  const agent = await registerAgent('gap-filer-one');
  const before = readWorkflow();
  const r = await request('POST', '/gaps', {
    token: agent.token,
    body: {
      project: 'workflow',
      gap: 'the daemon cannot file its own gaps',
      evidence: 'agora-8a7f.16 board result',
      why: 'the intake the contract mandates was unusable',
      next: 'add POST /gaps',
      proof: 'two workers append in one minute with no collision',
      severity: 'high',
      classification: 'coordination',
      surface: 'agora-daemon',
      suggestedAgent: 'claude',
    },
  });
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.json.id, 'WF-G50');
  assert.equal(r.json.file, 'tools/agora/WORKFLOW_GAPS.md');

  const after = readWorkflow();
  // Exactly one line was added, and the prior row is byte-identical.
  assert.equal(after.split('\n').length, before.split('\n').length + 1);
  assert.ok(after.includes('| WF-G49 | open | low | docs | docs | h | claude | id | t | 2026-01-01 | prior | e | w | n | p | — |'));

  const filed = parseGapsMarkdown(after).find((row) => row.id === 'WF-G50');
  assert.equal(filed.status, 'open');
  assert.equal(filed.severity, 'high');
  assert.equal(filed.classification, 'coordination');
  assert.equal(filed.surface, 'agora-daemon');
  assert.equal(filed.gap, 'the daemon cannot file its own gaps');
  assert.equal(filed.nextAction, 'add POST /gaps');
  // Provenance comes from the authenticated agent, never from the body.
  assert.equal(filed.registeredBy, 'gap-filer-one');
  assert.equal(filed.registrantAgentId, agent.id);
  assert.equal(filed.registrantTaskId, 'session-gap-filer-one');
  // The header's next_free_id advanced with the write.
  assert.ok(after.includes('next_free_id: WF-G51'));
});

test('two CONCURRENT POST /gaps calls allocate different ids and both rows survive', async () => {
  const a = await registerAgent('gap-racer-a');
  const b = await registerAgent('gap-racer-b');
  const [ra, rb] = await Promise.all([
    request('POST', '/gaps', { token: a.token, body: { project: 'workflow', gap: 'racer A row', evidence: 'concurrent' } }),
    request('POST', '/gaps', { token: b.token, body: { project: 'workflow', gap: 'racer B row', evidence: 'concurrent' } }),
  ]);
  assert.equal(ra.status, 201, ra.raw);
  assert.equal(rb.status, 201, rb.raw);
  assert.notEqual(ra.json.id, rb.json.id);

  const rows = parseGapsMarkdown(readWorkflow());
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'the registry holds no duplicate id');
  const gaps = rows.map((row) => row.gap);
  assert.ok(gaps.includes('racer A row'), 'row A survived the concurrent write');
  assert.ok(gaps.includes('racer B row'), 'row B survived the concurrent write');
});

test('a CRLF registry keeps its line endings across a POST /gaps append', async () => {
  const agent = await registerAgent('gap-filer-crlf');
  const before = readGlobal();
  assert.equal(/[^\r]\n/.test(before), false);
  const r = await request('POST', '/gaps', {
    token: agent.token,
    body: {
      project: 'global',
      gap: 'a row filed into a CRLF registry',
      evidence: 'server.gaps.test.mjs',
      why: 'a flipped EOL rewrites every line in the diff',
      next: 'preserve the file EOL',
      proof: 'no lone LF appears',
      detectedDuring: 'agora-8a7f.16',
    },
  });
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.json.id, 'GG-3');
  const after = readGlobal();
  assert.equal(/[^\r]\n/.test(after), false, 'a lone LF appeared in a CRLF registry');
  assert.equal((after.match(/\r\n/g) || []).length, (before.match(/\r\n/g) || []).length + 1);
  const filed = parseGapsMarkdown(after).find((row) => row.id === 'GG-3');
  assert.equal(filed.gap, 'a row filed into a CRLF registry');
  assert.equal(filed.nextAction, 'preserve the file EOL');
  // GLOBAL_GAPS.md files newest FIRST; the append followed the file's order.
  assert.equal(parseGapsMarkdown(after)[0].id, 'GG-3');
});
