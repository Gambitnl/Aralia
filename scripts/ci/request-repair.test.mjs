/** Mock HTTP receipts prove failure visibility and authority limits without consuming quota. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { findRepairPullRequest, prepareRepair, submitRepair } from './request-repair.mjs';
const sha = 'a'.repeat(40);
const run = { conclusion: 'failure', event: 'pull_request', path: '.github/workflows/ci.yml', head_sha: sha, head_branch: 'feature', html_url: 'https://github.com/fixture/repo/actions/runs/1' };
const pr = { number: 2, state: 'open', title: 'Feature', head: { sha, ref: 'feature', repo: { full_name: 'fixture/repo' } } };
test('missing workflow associations resolve only the current internal PR tip', async () => {
  const routes=[];
  const result=await findRepairPullRequest(run,'fixture/repo',async route=>{ routes.push(route); return [{...pr,head:{...pr.head,sha:'b'.repeat(40)}},pr]; });
  assert.equal(result,pr); assert.match(routes[0],/head=fixture%3Afeature/);
  assert.equal(await findRepairPullRequest(run,'fixture/repo',async()=>[]),undefined);
  assert.equal(await findRepairPullRequest(run,'fixture/repo',async()=>[{...pr,head:{...pr.head,repo:{full_name:'fork/repo'}}}]),undefined);
});
test('an invalid reused receipt fails without sending another POST', async () => {
  const payload=prepareRepair(run,pr,'fixture/repo');
  await assert.rejects(submitRepair(payload,'fixture-key',async()=>({ok:true,json:async()=>({sessions:[{title:payload.title}]})})),/no valid receipt/);
});
test('only current internal PR failures produce a separate review PR request', () => {
  const payload = prepareRepair(run, pr, 'fixture/repo');
  assert.equal(payload.automationMode, 'AUTO_CREATE_PR'); assert.match(payload.prompt, /lockfiles consistent/);
  for (const changed of [{ ...pr, state: 'closed' }, { ...pr, title: '[CI repair] fix' }, { ...pr, head: { ...pr.head, sha: 'b'.repeat(40) } }, { ...pr, head: { ...pr.head, repo: { full_name: 'other/repo' } } }]) assert.ok(prepareRepair(run, changed, 'fixture/repo').skipped);
  assert.ok(prepareRepair({ ...run, event: 'push' }, pr, 'fixture/repo').skipped);
});
test('HTTP errors fail the repair step and never expose its key', async () => {
  await assert.rejects(submitRepair(prepareRepair(run, pr, 'fixture/repo'), 'fixture-key', async () => ({ ok: false, status: 403 })), /lookup failed \(HTTP 403\)/);
  let calls = 0;
  await assert.rejects(submitRepair(prepareRepair(run, pr, 'fixture/repo'), 'fixture-key', async () => ++calls === 1 ? { ok: true, json: async () => ({ sessions: [] }) } : { ok: false, status: 429 }), /creation failed \(HTTP 429\)/);
});
test('an existing session is recovered through pagination without another POST', async () => {
  const payload = prepareRepair(run, pr, 'fixture/repo'); const methods = [];
  const result = await submitRepair(payload, 'fixture-key', async (url, options) => { methods.push(options.method || 'GET'); return { ok: true, json: async () => url.includes('pageToken=') ? { sessions: [{ title: payload.title, name: 'sessions/existing' }] } : { sessions: [], nextPageToken: 'next' } }; });
  assert.deepEqual(result, { name: 'sessions/existing', reused: true }); assert.deepEqual(methods, ['GET', 'GET']);
});
test('successful creation requires an attributable session receipt', async () => {
  let calls = 0;
  const result = await submitRepair(prepareRepair(run, pr, 'fixture/repo'), 'fixture-key', async () => ({ ok: true, json: async () => ++calls === 1 ? { sessions: [] } : { name: 'sessions/new' } }));
  assert.deepEqual(result, { name: 'sessions/new', reused: false });
});
