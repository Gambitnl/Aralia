/**
 * This browser test proves the Presence panel answers "who is here AND what are
 * they standing on" — the live roster row must carry the campaigns its agent
 * owns (joined through the durable SEAT, not only the session id) and the file
 * locks it holds, and an agent holding neither must say so rather than look the
 * same as a busy one.
 *
 * It drives a private Agora daemon through the same three routes the dashboard
 * polls (/agents, /locks, /campaigns), so a broken join, a dropped render on
 * lock/campaign refresh, or a silently empty holdings line fails visibly.
 *
 * Called by: Node's built-in test runner
 * Depends on: server.mjs and dashboard/index.html
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright';
import { createAgoraServer } from '../server.mjs';

// Bound each external step so a failed browser or daemon reports its own edge
// and still reaches the private-resource cleanup in the test's finally block.
async function within(label, promise, timeoutMs = 5000) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(baseUrl, pathname, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(baseUrl + pathname, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('presence rows show the campaigns each live agent owns by seat and the locks it holds', {
  timeout: 30000,
}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-presence-holdings-'));
  const app = createAgoraServer({ dir });
  await within('private daemon listen', new Promise((resolve) => app.listen(0, resolve)));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  let browser = null;

  try {
    // The founder creates the seat and then holds nothing: it doubles as the
    // negative case, so "idle" and "busy" cannot render identically.
    const founder = await postJson(baseUrl, '/agents/register', {
      handle: 'holdings-founder',
      petSlug: 'gf-sd',
      role: 'orchestrator',
      sessionId: 'holdings-founder-thread',
    });
    assert.equal(founder.status, 201);
    const seat = await postJson(baseUrl, '/seats', { name: 'holdproof' }, founder.body.token);
    assert.equal(seat.status, 200);

    // The owner takes the seat AT SIGN-IN, which is what makes the campaign it
    // claims seat-owned rather than only session-owned.
    const owner = await postJson(baseUrl, '/agents/register', {
      handle: 'holdings-owner',
      petSlug: 'dream-girl',
      role: 'orchestrator',
      sessionId: 'holdings-owner-thread',
      seat: 'holdproof',
    }, null);
    assert.equal(owner.status, 201);
    assert.equal(owner.body.seatError || '', '');
    assert.equal(owner.body.seatId, 'seat-holdproof');

    const campaign = await postJson(baseUrl, '/campaigns', {
      id: 'holdings-wave',
      scope: 'presence holdings proof',
      paths: ['src/holdings/alpha.ts'],
    }, owner.body.token);
    assert.equal(campaign.status, 201);
    assert.equal(campaign.body.campaign.seatId, 'seat-holdproof');

    const lock = await postJson(baseUrl, '/locks', {
      paths: ['src/holdings/alpha.ts', 'src/holdings/beta.ts'],
      reason: 'presence holdings proof',
      ttlMs: 10 * 60 * 1000,
    }, owner.body.token);
    assert.equal(lock.status, 201);

    // A worker that holds ONLY a claimed task is busy, not idle. The row used to
    // read "idle" beside a pet line that read "working" (Remy, 2026-09-13).
    const worker = await postJson(baseUrl, '/agents/register', {
      handle: 'holdings-worker',
      petSlug: 'gf-sd',
      role: 'worker',
      sessionId: 'holdings-worker-thread',
    });
    assert.equal(worker.status, 201);
    const task = await postJson(baseUrl, '/tasks', { title: 'holdings task proof' }, worker.body.token);
    assert.equal(task.status, 201);
    const claim = await postJson(baseUrl, `/tasks/${task.body.task.id}/claim`, {}, worker.body.token);
    assert.equal(claim.status, 200);
    const checkpoint = await postJson(baseUrl, `/tasks/${task.body.task.id}/checkpoint`,
      { did: 'wired the holdings proof', next: 'assert the row' }, worker.body.token);
    assert.equal(checkpoint.status, 200);

    browser = await within('Chromium launch', chromium.launch({ headless: true, timeout: 5000 }));
    const page = await within('browser page creation', browser.newPage({ viewport: { width: 1280, height: 900 } }));
    page.setDefaultTimeout(5000);
    await within('dashboard navigation', page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 5000 }));

    const ownerRow = page.locator('.agent-row', { hasText: 'holdings-owner' });
    await ownerRow.waitFor({ state: 'visible' });

    // Campaign chip: the id, the campaign name, and the SEAT it is owned through.
    const campaignChip = ownerRow.locator('.hold.campaign');
    await campaignChip.waitFor({ state: 'visible' });
    const campaignText = await campaignChip.textContent();
    assert.match(campaignText, /holdings-wave/);
    assert.match(campaignText, /seat:holdproof/);

    // Lock chip: an exact count plus the file names, so a busy holder is never
    // under-reported by the truncation.
    const lockChip = ownerRow.locator('.hold.lock');
    const lockText = await lockChip.textContent();
    assert.match(lockText, /1 lock\b/);
    assert.match(lockText, /alpha\.ts/);
    assert.match(lockText, /beta\.ts/);
    assert.equal(await ownerRow.locator('.hold.none').count(), 0);

    // The negative case must be explicit, not an empty line.
    const idleRow = page.locator('.agent-row', { hasText: 'holdings-founder' });
    await idleRow.waitFor({ state: 'visible' });
    assert.match(await idleRow.locator('.hold.none').textContent(), /no tasks, no campaigns, no locks/);
    assert.equal(await idleRow.locator('.hold.campaign').count(), 0);
    assert.equal(await idleRow.locator('.hold.lock').count(), 0);
    assert.equal(await idleRow.locator('.hold.task').count(), 0);

    const workerRow = page.locator('.agent-row', { hasText: 'holdings-worker' });
    const taskChip = workerRow.locator('.hold.task');
    await taskChip.waitFor({ state: 'visible' });
    assert.match(await taskChip.textContent(), /1 task\b/);
    assert.match(await taskChip.textContent(), new RegExp(task.body.task.id));
    assert.equal(await workerRow.locator('.hold.none').count(), 0);
    // The chip carries the newest checkpoint note, and a fresh claim is not stale.
    assert.match(await taskChip.textContent(), /wired the holdings proof/);
    assert.equal(await workerRow.locator('.hold.task.stale').count(), 0);

    // LAST ACTION counts real work only, never the heartbeat (Remy, 2026-09-13).
    const workerAction = workerRow.locator('.agent-action');
    assert.match(await workerAction.textContent(), new RegExp('checkpoint on ' + task.body.task.id));
    assert.equal(await workerRow.locator('.agent-action.stale').count(), 0);
    // The founder only registered and made a seat, so no action is on the board.
    assert.match(await idleRow.locator('.agent-action').textContent(), /none on the board/);

    // Three hours on, with no new action, the same claim must read as stale.
    const later = await within('stale-clock page', browser.newPage({ viewport: { width: 1280, height: 900 } }));
    later.setDefaultTimeout(5000);
    await later.clock.install({ time: Date.now() + 3 * 60 * 60 * 1000 });
    await within('stale-clock navigation', later.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 5000 }));
    const lateWorker = later.locator('.agent-row', { hasText: 'holdings-worker' });
    await lateWorker.locator('.hold.task.stale').waitFor({ state: 'visible' });
    assert.match(await lateWorker.locator('.hold.task').textContent(), /stale/);
    assert.equal(await lateWorker.locator('.agent-action.stale').count(), 1);
    await later.close();

    // The drill-down must agree with the row that was clicked.
    await ownerRow.click();
    const inspector = page.locator('#entry-inspector');
    await inspector.waitFor({ state: 'visible' });
    const inspectorText = await inspector.textContent();
    assert.match(inspectorText, /campaigns owned/);
    assert.match(inspectorText, /holdings-wave/);
    assert.match(inspectorText, /seat-holdproof/);

    // A released lock must leave the roster on the next poll of /locks, not
    // linger until some unrelated event happens to re-render the panel.
    await page.keyboard.press('Escape');
    const lockId = lock.body.lock.id;
    const released = await fetch(`${baseUrl}/locks/${lockId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${owner.body.token}` },
    });
    assert.equal(released.ok, true);
    // No manual refetch: the release travels over SSE, and the dashboard's
    // lock handler must re-render Presence, not only the Locks panel.
    await ownerRow.locator('.hold.lock').waitFor({ state: 'detached' });
    assert.equal(await ownerRow.locator('.hold.campaign').count(), 1);

    // Proof remains opt-in and must point to the repository's ignored scratch
    // area when a human requests a rendered receipt.
    const proofPath = process.env.AGORA_PRESENCE_HOLDINGS_PROOF_PATH;
    if (proofPath) {
      fs.mkdirSync(path.dirname(proofPath), { recursive: true });
      await page.screenshot({ path: proofPath, fullPage: true });
    }
  } finally {
    if (browser) await within('Chromium close', browser.close());
    await within('private daemon close', app.close());
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
