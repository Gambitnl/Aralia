import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

// This verifier renders the real dashboard queue conflict panel in Chromium.
// The VM-level contract proves the renderer returns the right strings; this
// browser check proves the human-facing dashboard has a styled, visible block
// for the same Scout/Core conflict context.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const dashboardCss = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');

assert(
  dashboardCss.includes('.queue-conflict-context'),
  'dashboard.css must style queue conflict context instead of leaving raw lists in the next-action panel.',
);

const executableSource = dashboardSource.replace(
  /\nrefreshDashboard\(\);\r?\nstartLiveRefresh\(\);\r?\n/,
  '\n// Automatic dashboard refresh is disabled by the visual verifier fixture.\n',
);
const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Symphony Conflict Queue Visual Fixture</title>
    <style>${dashboardCss}</style>
  </head>
  <body>
    <main>
      <section id="fixture-root" class="card"></section>
    </main>
    <div id="refresh-note"></div>
    <div id="refresh-status"></div>
    <div id="stats-card"></div>
    <div id="task-intake-root"></div>
    <div id="usage-root"></div>
    <div id="approval-root"></div>
    <div id="running-root"></div>
    <div id="retrying-root"></div>
    <div id="activity-root"></div>
    <button id="manual-refresh"></button>
    <script>${executableSource}</script>
    <script>
      document.getElementById('fixture-root').innerHTML = renderQueueNextAction({
        code: 'bridge_cross_handoff_conflicts',
        tone: 'blocked',
        label: 'Bridge Jules PR Conflicts',
        summary: 'Scout must bridge overlapping Jules PR files before Core merges either PR.',
        source_type: 'conflict_watch',
        affected_pr_urls: [
          'https://github.com/example/aralia/pull/41',
          'https://github.com/example/aralia/pull/42'
        ],
        overlap_file_paths: ['src/components/Widget/index.ts'],
        risk_file_paths: ['package.json'],
        steps: [
          'Open the overlapping Jules PRs listed in affected_pr_urls and conflict_watch.overlap_files.',
          'Have Scout decide which PR owns each shared file before Core merges either PR.'
        ]
      });
    </script>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 920, height: 720 } });

try {
  await page.setContent(html, { waitUntil: 'load' });

  const context = page.locator('.queue-conflict-context');
  await context.waitFor({ state: 'visible', timeout: 5000 });

  await assertVisibleText(page, 'Affected Jules PRs');
  await assertVisibleText(page, 'Overlapping files');
  await assertVisibleText(page, 'Conflict-prone files');
  await assertVisibleText(page, 'src/components/Widget/index.ts');
  await assertVisibleText(page, 'package.json');

  const linkCount = await page.locator('.queue-conflict-context a').count();
  assert.equal(linkCount, 2, 'Both affected Jules PR links should be visible in the queue conflict context.');

  const computed = await context.evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: style.display,
      borderTopWidth: style.borderTopWidth,
      width: rect.width,
      height: rect.height,
    };
  });
  assert.equal(computed.display, 'grid');
  assert.notEqual(computed.borderTopWidth, '0px');
  assert(computed.width > 500, `Conflict context should use the panel width, got ${computed.width}.`);
  assert(computed.height > 80, `Conflict context should have enough height for PR/file lists, got ${computed.height}.`);

  // Keeping a screenshot artifact makes the visual check auditable without
  // needing to keep a development server running after the verifier exits.
  const screenshotPath = resolve('.symphony', 'visual-verification', 'conflict-queue-context.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  await browser.close();
}

async function assertVisibleText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert(await locator.first().isVisible(), `Expected visible text: ${text}`);
}
