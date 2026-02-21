import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const baseUrl = process.env.ROADMAP_URL || 'http://127.0.0.1:3001/Aralia/misc/roadmap.html';
const outDir = path.resolve('artifacts', 'roadmap-playwright-audit-2026-02-20');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
const page = await context.newPage();

const failures = [];

const snap = async (name) => {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
};

const recordFailure = async (id, title, detail, shotName) => {
  const screenshot = await snap(shotName);
  failures.push({ id, title, detail, screenshot });
};

await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('text=Aralia Feature Roadmap', { timeout: 60000 });
await snap('baseline-loaded.png');

const expandAll = page.getByRole('button', { name: /expand all/i });
if (await expandAll.count()) {
  await expandAll.first().click();
  await page.waitForTimeout(450);
}
await snap('after-expand-all.png');

// F1: crosslink toggle missing
const crosslinkToggle = page.getByRole('button', { name: /crosslink|dependency|show links|links/i });
if ((await crosslinkToggle.count()) === 0) {
  await recordFailure(
    'F1',
    'Missing crosslink visibility toggle',
    'Expected a UI toggle for dotted cross-feature dependency lines, but no such control is present.',
    'failure-F1-missing-crosslink-toggle.png'
  );
}

// F2: layout save/persist control missing
const saveLayout = page.getByRole('button', { name: /save layout|save roadmap|persist layout|save positions/i });
if ((await saveLayout.count()) === 0) {
  await recordFailure(
    'F2',
    'Missing layout persistence control',
    'No explicit layout save/persist action is available in the roadmap UI.',
    'failure-F2-missing-layout-save-control.png'
  );
}

// Open a non-toggle node detail panel for node-action checks
const rootNode = page.locator('button[data-node-id="aralia_chronicles"]').first();
if (await rootNode.count()) {
  await rootNode.click();
  await page.waitForTimeout(300);
}
await snap('detail-panel-opened.png');

// F3: open in VS code missing
const openVsCode = page.getByRole('button', { name: /open in vs code|vs code|vscode/i });
if ((await openVsCode.count()) === 0) {
  await recordFailure(
    'F3',
    'Missing Open in VS Code action',
    'Detail panel does not expose a direct VS Code action for linked docs.',
    'failure-F3-missing-open-in-vscode.png'
  );
}

const dragTargets = await page.evaluate(() => {
  const projectButtons = Array.from(document.querySelectorAll('button[data-node-kind="project"]'));
  const branchButtons = Array.from(document.querySelectorAll('button[data-node-kind="branch"]'));

  for (const project of projectButtons) {
    const projectId = project.getAttribute('data-node-id') || '';
    if (!projectId) continue;
    const child = branchButtons.find((branch) => {
      const parentId = branch.getAttribute('data-parent-id') || '';
      const projectIdRef = branch.getAttribute('data-project-id') || '';
      return parentId === projectId || projectIdRef === projectId;
    });
    if (child) {
      return {
        projectId,
        childId: child.getAttribute('data-node-id') || '',
      };
    }
  }
  return null;
});

// F4: parent node drag does not reposition node
const projectCandidate = dragTargets?.projectId
  ? page.locator(`button[data-node-id="${dragTargets.projectId}"]`)
  : page.locator('button.rounded-full').nth(1);
if ((await projectCandidate.count()) > 0) {
  const before = await projectCandidate.boundingBox();
  if (before) {
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 220, before.y + before.height / 2 + 40, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(250);

    const after = await projectCandidate.boundingBox();
    if (after) {
      const dx = Math.abs(after.x - before.x);
      const dy = Math.abs(after.y - before.y);
      if (dx < 8 && dy < 8) {
        const detail = 'Dragging a parent node did not move it (dx=' + dx.toFixed(1) + ', dy=' + dy.toFixed(1) + ').';
        await recordFailure(
          'F4',
          'Node-level drag repositioning missing',
          detail,
          'failure-F4-parent-node-drag-no-move.png'
        );
      }
    }
  }
}

// F5: branch cascade movement missing when dragging parent
const parentNode = dragTargets?.projectId
  ? page.locator(`button[data-node-id="${dragTargets.projectId}"]`)
  : page.locator('button.rounded-full').nth(1);
const childNode = dragTargets?.childId
  ? page.locator(`button[data-node-id="${dragTargets.childId}"]`)
  : page.locator('button.rounded-xl').first();
if ((await parentNode.count()) > 0 && (await childNode.count()) > 0) {
  const p1 = await parentNode.boundingBox();
  const c1 = await childNode.boundingBox();
  if (p1 && c1) {
    await page.mouse.move(p1.x + p1.width / 2, p1.y + p1.height / 2);
    await page.mouse.down();
    await page.mouse.move(p1.x + p1.width / 2 + 260, p1.y + p1.height / 2 + 20, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(250);

    const p2 = await parentNode.boundingBox();
    const c2 = await childNode.boundingBox();
    if (p2 && c2) {
      const pdx = Math.abs(p2.x - p1.x);
      const pdy = Math.abs(p2.y - p1.y);
      const cdx = Math.abs(c2.x - c1.x);
      const cdy = Math.abs(c2.y - c1.y);
      const parentMoved = pdx >= 8 || pdy >= 8;
      const childMovedWithParent = cdx >= 8 || cdy >= 8;

      if (!parentMoved || !childMovedWithParent) {
        const detail = 'Parent movement=' + String(parentMoved) + ' (dx=' + pdx.toFixed(1) + ', dy=' + pdy.toFixed(1) + '), child movement=' + String(childMovedWithParent) + ' (dx=' + cdx.toFixed(1) + ', dy=' + cdy.toFixed(1) + ').';
        await recordFailure(
          'F5',
          'Parent->child cascade drag missing',
          detail,
          'failure-F5-parent-child-cascade-missing.png'
        );
      }
    }
  }
}

// F6: no dashed dependency edges rendered after expansion
const dashedEdges = await page.locator('svg path[stroke-dasharray]').count();
if (dashedEdges === 0) {
  await recordFailure(
    'F6',
    'No dashed dependency/crosslink edges rendered',
    'After expanding roadmap, there are no dashed edges, so cross-feature dependency rendering is absent.',
    'failure-F6-no-dashed-crosslinks.png'
  );
}

await snap('final-state.png');

const summaryPath = path.join(outDir, 'audit-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify({ baseUrl, failures, failureCount: failures.length }, null, 2));

console.log(JSON.stringify({ outDir, summaryPath, failureCount: failures.length, failures }, null, 2));

await browser.close();
