import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';

// This verifier protects the browser-facing worker identity surfaces. The API
// already carries worker callsigns and approval state; this test makes sure the
// dashboard actually shows the useful human context instead of hiding it inside
// JSON fields that only another agent would inspect.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const dashboardCss = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');
const rosterStart = dashboardSource.indexOf('function renderWorkerRoster');

assert(rosterStart >= 0, 'dashboard.js should contain the worker roster renderer');

const context = vm.createContext({
  Date,
  JSON,
  Math,
  Number,
  RegExp,
  Set,
  String,
  console,
});

// Evaluate only the pure renderer/helper section. The top of dashboard.js wires
// browser events and fetch loops, which would make this contract check depend
// on a running local Symphony server.
vm.runInContext(dashboardSource.slice(rosterStart), context);

const approvalWorker = {
  designation: 'worker-ARA-5-run-0042',
  status: 'running',
  issue_identifier: 'ARA-5',
  workspace_path: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5',
  thread_id: 'thread-ara-5',
  model: 'gpt-5.5',
  reasoning_effort: 'high',
  last_activity_at: '2026-05-17T00:00:00.000Z',
  waiting_on_approval: true,
  approval_summary: 'Review Jules plan before launch',
  detail_url: '/api/v1/ARA-5',
};

const rosterHtml = context.renderWorkerRoster([approvalWorker]);

assert.match(rosterHtml, /Worker roster/);
assert.match(rosterHtml, /worker-ARA-5-run-0042/);
assert.match(rosterHtml, /ARA-5/);
assert.match(rosterHtml, /approval needed/);
assert.match(rosterHtml, /Review Jules plan before launch/);
assert.match(rosterHtml, /thread-ara-5/);
assert.match(rosterHtml, /gpt-5\.5 \/ high/);
assert.match(rosterHtml, /F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5/);
assert.match(rosterHtml, /href="\/api\/v1\/ARA-5"/);

const identityHtml = context.renderWorkerIdentity({
  issue_identifier: 'ARA-5',
  waiting_on_approval: true,
  approval_summary: 'Review Jules plan before launch',
  workspace: {
    path: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5',
  },
  worker: {
    designation: 'worker-ARA-5-run-0042',
    run_number: 42,
    attempt: 1,
    thread_id: 'thread-ara-5',
    model: 'gpt-5.5',
    reasoning_effort: 'high',
    started_at: '2026-05-17T00:00:00.000Z',
  },
});

assert.match(identityHtml, /Foreman/);
assert.match(identityHtml, /worker-ARA-5-run-0042/);
assert.match(identityHtml, /Issue ARA-5/);
assert.match(identityHtml, /Model gpt-5\.5 \/ high/);
assert.match(identityHtml, /Workspace F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5/);
assert.match(identityHtml, /Approval needed: Review Jules plan before launch/);

const executableSource = dashboardSource.replace(
  /\nrefreshDashboard\(\);\r?\nstartLiveRefresh\(\);\r?\n/,
  '\n// Automatic dashboard refresh is disabled by the worker visual verifier fixture.\n',
);

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Symphony Worker Identity Visual Fixture</title>
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
      document.getElementById('fixture-root').innerHTML = [
        renderWorkerRoster(${JSON.stringify([approvalWorker])}),
        renderWorkerIdentity(${JSON.stringify({
          issue_identifier: 'ARA-5',
          waiting_on_approval: true,
          approval_summary: 'Review Jules plan before launch',
          workspace: {
            path: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5',
          },
          worker: {
            designation: 'worker-ARA-5-run-0042',
            run_number: 42,
            attempt: 1,
            thread_id: 'thread-ara-5',
            model: 'gpt-5.5',
            reasoning_effort: 'high',
            started_at: '2026-05-17T00:00:00.000Z',
          },
        })})
      ].join('');
    </script>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });

try {
  await page.setContent(html, { waitUntil: 'load' });

  await assertVisibleText(page, 'Worker roster');
  await assertVisibleText(page, 'approval needed');
  await assertVisibleText(page, 'Review Jules plan before launch');
  await assertVisibleText(page, 'Foreman:');
  await assertVisibleText(page, 'Model gpt-5.5 / high');
  await assertVisibleText(page, 'Issue ARA-5');
  await assertVisibleText(page, 'Approval needed: Review Jules plan before launch');

  const layout = await page.locator('#fixture-root').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      scrollWidth: element.scrollWidth,
    };
  });

  assert(layout.width > 500, `Worker fixture should render at dashboard width, got ${layout.width}.`);
  assert(layout.height > 160, `Worker fixture should include both identity surfaces, got ${layout.height}.`);
  assert(
    layout.scrollWidth <= Math.ceil(layout.width) + 1,
    `Worker identity text should wrap instead of overflowing horizontally (${layout.scrollWidth} > ${layout.width}).`,
  );

  // Keeping the screenshot makes the rendered worker identity surface auditable
  // without leaving the local Symphony server or browser session running.
  const screenshotPath = resolve('.symphony', 'visual-verification', 'worker-dashboard.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  await browser.close();
}

async function assertVisibleText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert(await locator.first().isVisible(), `Expected visible text: ${text}`);
}
