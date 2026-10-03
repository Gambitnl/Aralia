// tools/agora/dashboard/result-disposition.test.mjs
// This focused browser test proves that Agora's real dashboard distinguishes a
// size-declined triage from an evidence-backed review. It starts a private daemon
// and temporary store, authors both task shapes through HTTP, and then inspects
// the rendered board and task inspector without touching the shared service.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright';
import { createAgoraServer } from '../server.mjs';

// Give every external boundary its own diagnostic deadline. If a browser or
// socket stalls, the failure names that boundary instead of ending as an opaque
// whole-test timeout after the private resources have already been created.
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

// The private daemon receives the same JSON requests as the production client.
// Keeping this helper local makes every fixture mutation visible in the test.
async function postJson(baseUrl, pathname, body, token = '') {
  const response = await fetch(baseUrl + pathname, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('dashboard distinguishes triage, unclassified legacy results, and substantive review proof', {
  timeout: 30000,
}, async () => {
  // Every resource is lane-owned: the store is a new OS temp directory, the
  // daemon selects an ephemeral port, and Playwright gets a fresh browser.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-result-dashboard-'));
  const app = createAgoraServer({ dir });
  await within('private daemon listen', new Promise((resolve) => app.listen(0, resolve)));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  let browser = null;

  try {
    // Browser startup belongs inside the cleanup boundary. If Chromium cannot
    // launch, the private daemon and temp store are still closed below.
    browser = await within('Chromium launch', chromium.launch({ headless: true, timeout: 5000 }));

    // Register one fixture author and create the two records whose visual
    // treatment must never collapse into the same completion signal.
    const registration = await postJson(baseUrl, '/agents/register', {
      handle: 'result-dashboard-fixture',
      petSlug: 'gf-sd',
    });
    assert.equal(registration.status, 201);
    const token = registration.body.token;

    const triageCreate = await postJson(baseUrl, '/tasks', {
      title: 'Large review declined at triage',
    }, token);
    await postJson(baseUrl, `/tasks/${triageCreate.body.task.id}/state`, {
      state: 'done',
      result: 'SKIP TOO-BIG: cross-file review deferred',
      resultDisposition: 'triage_only',
    }, token);

    const reviewCreate = await postJson(baseUrl, '/tasks', {
      title: 'Completed technical review',
    }, token);
    await postJson(baseUrl, `/tasks/${reviewCreate.body.task.id}/state`, {
      state: 'done',
      result: 'Review completed.',
      resultDisposition: 'substantive',
      finding: 'The healing branch reads damage dice first.',
      evidence: 'Focused fixture reproduced the wrong total.',
    }, token);

    const legacyCreate = await postJson(baseUrl, '/tasks', {
      title: 'Legacy result without classification',
    }, token);
    await postJson(baseUrl, `/tasks/${legacyCreate.body.task.id}/state`, {
      state: 'done',
      result: 'Bare result preserved for compatibility.',
    }, token);

    // Load the real module-based dashboard and wait for its REST seed to render
    // the task rows. No source-string assertion stands in for browser behavior.
    const page = await within('browser page creation', browser.newPage({ viewport: { width: 1280, height: 900 } }));
    page.setDefaultTimeout(5000);
    await within('dashboard navigation', page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 5000 }));
    const triageRow = page.locator('.task-row', { hasText: 'Large review declined at triage' });
    const reviewRow = page.locator('.task-row', { hasText: 'Completed technical review' });
    const legacyRow = page.locator('.task-row', { hasText: 'Legacy result without classification' });
    await triageRow.waitFor({ state: 'attached' });
    await reviewRow.waitFor({ state: 'attached' });
    await legacyRow.waitFor({ state: 'attached' });

    // Completed work starts collapsed on the board. Expand that real group so
    // the assertions cover what an operator can see and click, not hidden HTML.
    const doneGroup = page.locator('.task-group[data-task-state="done"]');
    if ((await doneGroup.getAttribute('class') || '').includes('collapsed')) {
      await doneGroup.locator('h3').click();
    }
    await triageRow.waitFor({ state: 'visible' });
    await reviewRow.waitFor({ state: 'visible' });
    await legacyRow.waitFor({ state: 'visible' });

    // Triage uses the exact operator label and contains no completion glyph.
    // The authored decline remains visible as the free-form result evidence.
    assert.match(await triageRow.textContent(), /Triage only/);
    assert.match(await triageRow.textContent(), /SKIP TOO-BIG/);
    assert.equal(await triageRow.locator('.task-completion-mark').count(), 0);
    assert.doesNotMatch(await triageRow.textContent(), /✔/);

    // Substantive completion retains the old checkmark and renders finding and
    // evidence as distinct labeled values instead of flattening them together.
    assert.equal(await reviewRow.locator('.task-completion-mark').count(), 1);
    assert.match(await reviewRow.textContent(), /Finding:\s*The healing branch reads damage dice first\./);
    assert.match(await reviewRow.textContent(), /Evidence:\s*Focused fixture reproduced the wrong total\./);

    // Bare done-result records remain readable but do not inherit either review
    // disposition or its completion mark. The label states that uncertainty.
    assert.match(await legacyRow.textContent(), /Unclassified result/);
    assert.match(await legacyRow.textContent(), /Bare result preserved for compatibility\./);
    assert.equal(await legacyRow.locator('.task-completion-mark').count(), 0);
    assert.doesNotMatch(await legacyRow.textContent(), /✔/);

    // Operators may request a durable visual receipt. The default test remains
    // artifact-free; an explicit ignored scratch path captures the proven rows.
    const proofPath = process.env.AGORA_RESULT_PROOF_PATH;
    if (proofPath) {
      fs.mkdirSync(path.dirname(proofPath), { recursive: true });
      await page.screenshot({ path: proofPath, fullPage: true });
    }

    // Inspectors repeat the semantic distinction for the long-form reading path.
    await triageRow.click();
    const triageInspector = page.locator('#entry-inspector-body');
    assert.equal(await triageInspector.getByRole('heading', { name: 'Triage only', exact: true }).count(), 1);
    assert.equal(await triageInspector.getByRole('heading', { name: 'Recorded outcome', exact: true }).count(), 0);
    await page.locator('#entry-inspector-close').click();

    await reviewRow.click();
    const reviewInspector = page.locator('#entry-inspector-body');
    assert.equal(await reviewInspector.getByRole('heading', { name: 'Recorded outcome', exact: true }).count(), 1);
    assert.equal(await reviewInspector.getByRole('heading', { name: 'Finding', exact: true }).count(), 1);
    assert.equal(await reviewInspector.getByRole('heading', { name: 'Evidence', exact: true }).count(), 1);
    await page.locator('#entry-inspector-close').click();

    await legacyRow.click();
    const legacyInspector = page.locator('#entry-inspector-body');
    assert.equal(await legacyInspector.getByRole('heading', { name: 'Unclassified result', exact: true }).count(), 1);
    assert.equal(await legacyInspector.getByRole('heading', { name: 'Recorded outcome', exact: true }).count(), 0);
  } finally {
    // Close only resources created above. This guarantees the focused browser
    // proof cannot leave a listener or browser process behind for other lanes.
    if (browser) await within('Chromium close', browser.close());
    await within('private daemon close', app.close());
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
