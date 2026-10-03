/**
 * This browser test proves the agent inspector shows the pet itself, not only
 * its name or raw record. It uses a private Agora daemon, real asset route and
 * generated atlas so clones need no operator-owned artwork. Missing asset routes
 * or repeated atlas rows still fail visibly.
 *
 * Called by: Node's built-in test runner
 * Depends on: server.mjs and dashboard/index.html
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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

async function postJson(baseUrl, pathname, body) {
  const response = await fetch(baseUrl + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('agent inspector renders the assigned pet portrait and nine distinct still action poses', {
  timeout: 30000,
}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-pet-inspector-'));
  // Exercise the production HTML/CSS and HTTP route with disposable pixels.
  // Each atlas cell has a distinct color; no downloaded pet art enters history.
  const dashboardDir = path.join(dir, 'dashboard');
  const sourceDir = fileURLToPath(new URL('.', import.meta.url));
  fs.cpSync(sourceDir, dashboardDir, { recursive: true, filter: file => !path.relative(sourceDir, file).split(path.sep).includes('pets') });
  const atlas = Buffer.from(Array.from({ length: 72 }, (_, i) => [i * 3, 255 - i * 3, (i * 29) % 256, 255]).flat());
  const imagePath = path.join(dashboardDir, 'pets', 'gf-sd', 'spritesheet.png');
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  await sharp(atlas, { raw: { width: 8, height: 9, channels: 4 } }).png().toFile(imagePath);
  const app = createAgoraServer({ dir, dashboardDir });
  await within('private daemon listen', new Promise((resolve) => app.listen(0, resolve)));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  let browser = null;

  try {
    const registration = await postJson(baseUrl, '/agents/register', {
      handle: 'pet-inspector-fixture',
      petSlug: 'gf-sd',
    });
    assert.equal(registration.status, 201);
    assert.equal(registration.body.pet.displayName, 'SD Girlfriend');

    browser = await within('Chromium launch', chromium.launch({ headless: true, timeout: 5000 }));
    const page = await within('browser page creation', browser.newPage({ viewport: { width: 1280, height: 900 } }));
    page.setDefaultTimeout(5000);
    await within('dashboard navigation', page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 5000 }));

    const agentRow = page.locator('.agent-row', { hasText: 'pet-inspector-fixture' });
    await agentRow.waitFor({ state: 'visible' });
    await agentRow.click();

    const profile = page.locator('.inspector-pet-block');
    await profile.waitFor({ state: 'visible' });
    // Visibility begins while the inspector's 180 ms entrance transition is
    // still moving. Wait for its settled frame before judging viewport fit.
    await page.waitForTimeout(220);
    assert.match(await profile.textContent(), /SD Girlfriend/);
    assert.match(await profile.textContent(), /Canonical 8 x 9 Codex pet atlas/);
    const layout = await profile.evaluate((element) => {
      const inspector = element.closest('#entry-inspector');
      const body = element.closest('.inspector-body');
      const rect = inspector.getBoundingClientRect();
      return {
        inspectorLeft: rect.left,
        inspectorRight: rect.right,
        viewportWidth: window.innerWidth,
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        profileClientWidth: element.clientWidth,
        profileScrollWidth: element.scrollWidth,
      };
    });
    assert.ok(
      layout.inspectorLeft >= 0 && layout.inspectorRight <= layout.viewportWidth,
      `inspector must stay inside the viewport: ${JSON.stringify(layout)}`,
    );
    assert.ok(layout.bodyScrollWidth <= layout.bodyClientWidth, `inspector body overflow: ${JSON.stringify(layout)}`);
    assert.ok(layout.profileScrollWidth <= layout.profileClientWidth, `pet profile overflow: ${JSON.stringify(layout)}`);

    // The hero checks the real browser-computed size and fetches its image URL.
    // This catches both CSS-only placeholders and stale manifest asset paths.
    const hero = profile.locator('.inspector-pet-stage .assigned-pet');
    const heroProof = await hero.evaluate(async (element) => {
      const style = getComputedStyle(element);
      const match = style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
      const response = match ? await fetch(match[1]) : null;
      return {
        width: style.width,
        height: style.height,
        image: style.backgroundImage,
        imageLoaded: Boolean(response && response.ok),
        animated: element.classList.contains('is-animated'),
      };
    });
    assert.equal(heroProof.width, '96px');
    assert.equal(heroProof.height, '104px');
    assert.match(heroProof.image, /spritesheet\.(?:png|webp)/);
    assert.equal(heroProof.imageLoaded, true);
    assert.equal(heroProof.animated, false);

    // The action gallery starts collapsed so the main identity remains compact.
    // Expanding its native disclosure must expose all nine still atlas rows.
    const disclosure = profile.locator('.inspector-pet-actions-disclosure');
    const previews = profile.locator('.inspector-pet-action .assigned-pet');
    assert.equal(await disclosure.getAttribute('open'), null);
    assert.equal(await previews.first().isVisible(), false);
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.getAttribute('open'), '');
    assert.equal(await previews.first().isVisible(), true);
    assert.equal(await previews.count(), 9);
    const poses = await previews.evaluateAll((elements) => elements.map((element) => ({
      action: element.getAttribute('data-pet-action'),
      positionY: getComputedStyle(element).backgroundPositionY,
      animated: element.classList.contains('is-animated'),
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })));
    assert.equal(new Set(poses.map((pose) => pose.action)).size, 9);
    assert.equal(new Set(poses.map((pose) => pose.positionY)).size, 9);
    assert.ok(poses.every((pose) => !pose.animated));
    assert.ok(poses.every((pose) => pose.width === 52 && pose.height === 58));

    // Proof remains opt-in and must point to the repository's ignored scratch
    // area when a human requests a rendered receipt.
    const proofPath = process.env.AGORA_PET_INSPECTOR_PROOF_PATH;
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
