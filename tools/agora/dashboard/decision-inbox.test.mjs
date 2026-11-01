/**
 * Proves that the owner's inbox finds direct requests without turning every
 * dependent blocker into a question. Browser checks use disposable board data,
 * and verify source navigation, safe text, filters and narrow-screen layout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createAgoraServer } from '../server.mjs';
import { TASK_DEP_TYPES } from '../store.mjs';
import { collectHumanRequests, humanRequestKind, sourceLinks, blockingDependents, resolveTaskDependencies } from './decision-inbox.mjs';

const now = Date.now();
function task(id, reason, fields = {}) {
  return { id, title: 'Decision ' + id, state: 'blocked', updatedAt: now,
    body: 'Choose A or B. A preserves behavior; B changes it.',
    history: [{ action: 'state', state: 'blocked', reason }], ...fields };
}
test('direct human decisions, action requests and explicit categories are identified', () => {
  assert.equal(humanRequestKind(task('a', 'BLOCKED ON REMY: choose the skeleton canon')), 'decision');
  assert.equal(humanRequestKind(task('b', "Needs Remy's hands: download the rigged file")), 'action');
  assert.equal(humanRequestKind(task('c', '', { category: 'human-decision', state: 'open' })), 'decision');
  assert.equal(humanRequestKind(task('d', '', { categories: ['human-action'] })), 'action');
  assert.equal(humanRequestKind(task('e', 'NEEDS REMY RULING: pick A', { state: 'done' })), null);
  const sharedNote = 'human-operator: Remy decision or review item (H10 remote/visibility; P1 eyeball backlog; P2 question sheet)';
  assert.equal(humanRequestKind(task('remote', sharedNote, { title: 'H10 - Decide remote + visibility' })), 'decision');
  assert.equal(humanRequestKind(task('review', sharedNote, { title: 'P1 - Remy eyeball backlog' })), 'action');
});
test('dependency-only waits and ordinary technical blockers do not become questions', () => {
  for (const reason of ['GATED BEHIND CANON; upstream blocked on Remy', 'R1 has not landed; waits on a question-sheet answer', 'Its own body: do not start before T11 blocked on Remy', 'CI proof missing', 'NEEDS SPLIT: several lanes']) {
    assert.equal(humanRequestKind(task('x', reason)), null, reason);
  }
});
test('latest blocked reason wins and old requests carry a freshness warning', () => {
  const row = task('x', 'CI failed', { updatedAt: now - 15 * 86400000 });
  row.history.push({ action: 'state', state: 'blocked', reason: 'NEEDS REMY RULING: choose A' });
  const requests = collectHumanRequests([row, task('z', '', { category: 'human-action', priority: 0 })], { now });
  assert.equal(requests[0].task.id, 'z');
  assert.equal(requests[1].stale, true);
  assert.match(requests[1].reason, /choose A/);
});
test('source links refuse executable schemes and blocking edges match store vocabulary', () => {
  assert.deepEqual(sourceLinks(task('x', 'see https://example.com/question.', { refs: ['javascript:alert(1)', 'https://example.com/question'], body: '' })), ['https://example.com/question']);
  const rows = Object.entries(TASK_DEP_TYPES).map(([type]) => task(type, '', { deps: [{ id: 'x', type }] }));
  assert.deepEqual(blockingDependents(rows, 'x').map((row) => row.id), Object.entries(TASK_DEP_TYPES).filter(([, spec]) => spec.blocking).map(([type]) => type));
  assert.equal(blockingDependents([task('done', '', { state: 'done', deps: ['x'] })], 'x').length, 0);
});

test('WF353: dependency presentation retains every board relationship and explicit missing targets',()=>{
  const target={id:'agora-current',title:'Current target',state:'done',formerIds:['old-id']};
  for(const [type,spec]of Object.entries(TASK_DEP_TYPES)){
    const [dep]=resolveTaskDependencies({deps:[{id:target.id,type}]},[target]);
    assert.equal(dep.type,type);assert.equal(dep.blocking,spec.blocking);assert.equal(dep.task,target);assert.equal(dep.missing,false);
  }
  const [legacy,missing,unknown,malformed]=resolveTaskDependencies({deps:['old-id',
    {id:'agora-absent',type:'waits-for'},{id:target.id,type:'future-type'},null]},[target]);
  assert.equal(legacy.id,target.id);assert.equal(legacy.originalId,'old-id');assert.equal(legacy.type,'blocks');
  assert.equal(missing.id,'agora-absent');assert.equal(missing.missing,true);assert.equal(missing.blocking,true);
  assert.equal(unknown.type,'future-type');assert.equal(unknown.invalid,true);assert.equal(unknown.blocking,null);
  assert.equal(malformed.id,'(missing dependency ID)');assert.equal(malformed.invalid,true);
  const [ambiguous]=resolveTaskDependencies({deps:['old-id']},[target,{id:'agora-other',formerIds:['old-id']}]);
  assert.equal(ambiguous.ambiguous,true);assert.equal(ambiguous.task,null);
});

test('WF353: inspector resolves typed and legacy dependencies; badges count only unfinished blockers', {timeout:30000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agora-dependency-render-'));
  const app=createAgoraServer({dir});let browser;
  try{
    await new Promise(resolve=>app.listen(0,resolve));
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    page.setDefaultTimeout(5000);
    const rows=[task('agora-done','',{state:'done',title:'Finished predecessor',formerIds:['legacy-done'],deps:[]}),
      task('agora-open','',{state:'open',title:'Related pending work',deps:[]}),
      task('agora-ready','',{state:'open',title:'Ready task',deps:[{id:'agora-done',type:'blocks'},{id:'agora-open',type:'related'}]}),
      task('agora-held','',{state:'open',title:'Held task',deps:[{id:'agora-open',type:'waits-for'},{id:'agora-absent',type:'blocks'},'legacy-done']}),
      task('agora-legacy','',{state:'open',title:'Legacy task',deps:['legacy-done']}),
      task('agora-unknown','',{state:'open',title:'Unknown relationship',deps:[{id:'agora-open',type:'future-type'},null]})];
    const mutations=[],errors=[],responses=[];
    page.on('request',r=>{if(r.method()!=='GET')mutations.push(r.method());});page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().endsWith('/tasks'))responses.push({url:r.url(),status:r.status()});});
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.route('**/tasks',route=>route.fulfill({json:{tasks:rows}}));
    // The board seeds itself through both REST and the initial SSE hello.
    // Keep fixture snapshots consistent instead of racing an empty server.
    await page.route('**/events',route=>route.fulfill({contentType:'text/event-stream',
      body:'event: hello\ndata: '+JSON.stringify({snapshot:{tasks:rows}})+'\n\n'}));
    await page.goto(`http://127.0.0.1:${app.server.address().port}/`);
    const ready=page.locator('.task-row[data-entry-id="agora-ready"]');
    try{await ready.waitFor();}catch(error){throw new Error('Dashboard render failed: '+JSON.stringify({errors,responses,tasks:await page.locator('#tasks').innerText(),count:await page.locator('#b-tasks').innerText()}),{cause:error});}
    assert.equal(await ready.locator('.task-waiting').count(),0);
    assert.equal(await page.locator('[data-entry-id="agora-legacy"] .task-waiting').count(),0);
    assert.match(await page.locator('[data-entry-id="agora-held"] .task-waiting').innerText(),/waiting on 2 dep/);
    assert.equal(await page.locator('[data-entry-id="agora-unknown"] .task-waiting').count(),0);
    assert.match(await page.locator('[data-entry-id="agora-unknown"] .task-dependency-warning').innerText(),/needs review/);
    await ready.click();
    const dependencies=page.locator('#entry-inspector-body .inspector-block').filter({has:page.getByRole('heading',{name:'Dependencies',exact:true})});
    let text=await dependencies.innerText();
    assert.match(text,/Finished predecessor/);assert.match(text,/done.*blocks/);assert.match(text,/Related pending work/);assert.match(text,/open.*related/);
    assert.doesNotMatch(text,/Missing task record|\[object Object\]/);
    await page.locator('#entry-inspector-close').click();await page.locator('[data-entry-id="agora-held"]').click();
    text=await dependencies.innerText();assert.match(text,/agora-absent/);assert.match(text,/missing.*blocks/);
    assert.match(text,/Finished predecessor/);assert.match(text,/agora-done/);assert.match(text,/waits-for/);
    await page.setViewportSize({width:390,height:844});assert.equal(await dependencies.isVisible(),true);
    assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
  }finally{
    await browser?.close();await app.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('disclosures survive polling, manual refresh and task switches without freezing board content', { timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-decision-folds-'));
  const app = createAgoraServer({ dir });
  let browser;
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    // Call the real registered poll callback without making the test wait 30s.
    await page.addInitScript(() => {
      const native = window.setInterval;
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 30000) { window.pollInbox = callback; return 1; }
        return native(callback, delay, ...args);
      };
    });
    const rows = ['a', 'b'].map((id) => task(id, 'NEEDS REMY RULING: choose A or B', {
      title: 'Choose ' + id, refs: ['source-' + id], result: 'Original evidence',
    }));
    await page.route('**/tasks', (route) => route.fulfill({ json: { tasks: rows } }));
    await page.route('**/campaigns', (route) => route.fulfill({ json: { campaigns: [] } }));
    await page.goto(`http://127.0.0.1:${app.server.address().port}/dashboard/decisions.html`);
    const references = page.locator('#detail details').filter({ has: page.getByText('References', { exact: true }) });
    const brief = page.locator('#detail details').filter({ has: page.getByText('Full work brief', { exact: true }) });
    const evidence = page.locator('#detail details').filter({ has: page.getByText('Progress and evidence', { exact: true }) });
    await references.locator('summary').waitFor();
    assert.equal(await references.evaluate((block) => block.open), false);
    for (const section of [references, brief, evidence]) await section.locator('summary').click();
    rows[0].body = 'Updated board brief';
    await page.evaluate(() => window.pollInbox());
    for (const section of [references, brief, evidence]) assert.equal(await section.evaluate((block) => block.open), true);
    assert.match(await brief.innerText(), /Updated board brief/);
    await references.locator('summary').click();
    await page.locator('#refresh').click();
    await page.waitForFunction(() => !document.getElementById('refresh').disabled);
    assert.equal(await references.evaluate((block) => block.open), false);
    assert.equal(await brief.evaluate((block) => block.open), true);
    await page.getByRole('button', { name: /Choose b/ }).click();
    for (const section of [references, brief, evidence]) assert.equal(await section.evaluate((block) => block.open), false);
    await references.locator('summary').click();
    await page.getByRole('button', { name: /Choose a/ }).click();
    assert.equal(await references.evaluate((block) => block.open), false);
    assert.equal(await brief.evaluate((block) => block.open), true);
    await page.getByRole('button', { name: /Choose b/ }).click();
    assert.equal(await references.evaluate((block) => block.open), true);
    await page.reload();
    await references.locator('summary').waitFor();
    assert.equal(await references.evaluate((block) => block.open), false);
  } finally {
    await browser?.close(); await app.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('inbox renders safe readable requests and filters on desktop/mobile without mutations', { timeout: 45000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-decisions-'));
  const app = createAgoraServer({ dir });
  let browser;
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const rows = [task('pick', 'NEEDS REMY RULING: choose A or B', { title: 'Choose skeleton canon', campaignId: 'canon', refs: ['https://example.com/sheet'], creatorAgent: { handle: 'planner-123' } }),
      task('hands', "Needs Remy's hands: download the result", { title: 'Download rig', body: '<script>window.untrusted = true</script>' }),
      task('dep', 'GATED BEHIND CANON; upstream blocked on Remy', { deps: [{ id: 'pick', type: 'blocks' }] })];
    const mutations = [];
    page.on('request', (request) => { if (request.method() !== 'GET') mutations.push(request.method()); });
    await page.route('**/tasks', (route) => route.fulfill({ json: { tasks: rows } }));
    await page.route('**/campaigns', (route) => route.fulfill({ json: { campaigns: [{ id: 'canon', name: 'Skeleton' }] } }));
    await page.goto(`http://127.0.0.1:${app.server.address().port}/dashboard/decisions.html`);
    await page.getByRole('button', { name: /Choose skeleton canon/ }).waitFor();
    assert.match(await page.locator('#detail').innerText(), /planner-123/);
    assert.match(await page.locator('#detail').innerText(), /1 task waiting on this/);
    assert.equal(await page.locator('#request-list .request').count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Open task on board' }).first().getAttribute('href'), '/?task=pick');
    await page.getByRole('button', { name: /Hands-on requests/ }).click();
    assert.match(await page.locator('#detail').innerText(), /Download rig/);
    assert.equal(await page.evaluate(() => window.untrusted), undefined);
    await page.locator('#search').fill('no match');
    assert.match(await page.locator('#detail').innerText(), /No matching requests/);
    await page.locator('#search').fill('');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.locator('#refresh').click();
    await page.waitForFunction(() => !document.getElementById('refresh').disabled);
    assert.match(await page.locator('#detail').innerText(), /Download rig/);
    await page.route('**/tasks', (route) => route.fulfill({ status: 503, body: 'offline' }));
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.getElementById('status').hasAttribute('data-error'));
    assert.match(await page.locator('#detail').innerText(), /Download rig/);
    assert.deepEqual(mutations, []);
  } finally {
    await browser?.close(); await app.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
