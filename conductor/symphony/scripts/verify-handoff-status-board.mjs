import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';

// This verifier protects the dashboard-first middleman view. Per-handoff cards
// can be detailed, but the operator also needs one compact status board that
// says where each Jules delegation sits across session, PR, Scout/Core, and
// local sync without opening Linear or reading raw JSON.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const dashboardCss = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');
const boardStart = dashboardSource.indexOf('function renderHandoffStatusBoard');

assert(boardStart >= 0, 'dashboard.js should contain renderHandoffStatusBoard');

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

vm.runInContext(dashboardSource.slice(boardStart), context);

const handoffs = [
  {
    id: 'handoff-ready',
    title: 'Ready widget task',
    status: 'sent_to_jules',
    julesState: 'RUNNING',
    julesSessionId: 'jules-session-1',
    julesSessionUrl: 'https://jules.google/session/1',
    githubPullRequestUrl: 'https://github.com/example/aralia/pull/41',
    githubPullRequestState: 'OPEN',
    githubPullRequestMergeable: 'MERGEABLE',
    githubPullRequestChecks: { conclusion: 'passing', pending: 0, failing: 0 },
    scoutCoreStatus: { status: 'scout_required', summary: 'Scout bridge review is required before Core merge.' },
    localSyncStatus: { status: 'waiting_for_merge', summary: 'Wait for GitHub merge before local sync.' },
    next_action: {
      code: 'core_validate_and_merge',
      label: 'Core Validate and Merge',
      summary: 'Core can validate after Scout review.',
    },
  },
  {
    id: 'handoff-blocked',
    title: 'Blocked registry task',
    status: 'sent_to_jules',
    julesState: 'AWAITING_PLAN_APPROVAL',
    julesSessionId: 'jules-session-2',
    julesSessionUrl: 'https://jules.google/session/2',
    githubPullRequestUrl: 'https://github.com/example/aralia/pull/42',
    githubPullRequestState: 'OPEN',
    githubPullRequestMergeable: 'CONFLICTING',
    githubPullRequestChecks: { conclusion: 'failing', pending: 1, failing: 2 },
    githubPullRequestRisk: {
      level: 'high',
      reasons: ['Conflict-prone files changed: package.json'],
    },
    localSyncStatus: { status: 'blocked', summary: 'Local master has uncommitted work.' },
    next_action: {
      code: 'approve_jules_plan',
      label: 'Approve Jules Plan',
      summary: 'Review the Jules plan before approving.',
    },
  },
];

const boardHtml = context.renderHandoffStatusBoard(handoffs);

assert.match(boardHtml, /Jules handoff status board/);
assert.match(boardHtml, /Ready widget task/);
assert.match(boardHtml, /Blocked registry task/);
assert.match(boardHtml, /Session:[\s\S]*RUNNING/);
assert.match(boardHtml, /PR:[\s\S]*OPEN/);
assert.match(boardHtml, /Checks:[\s\S]*passing/);
assert.match(boardHtml, /Checks:[\s\S]*failing/);
assert.match(boardHtml, /Risk:[\s\S]*high/);
assert.match(boardHtml, /Scout\/Core:[\s\S]*scout_required/);
assert.match(boardHtml, /Local sync:[\s\S]*waiting_for_merge/);
assert.match(boardHtml, /Next:[\s\S]*Core Validate and Merge/);
assert.match(boardHtml, /Next:[\s\S]*Approve Jules Plan/);
assert.match(boardHtml, /href="https:\/\/jules.google\/session\/1"/);
assert.match(boardHtml, /href="https:\/\/github.com\/example\/aralia\/pull\/42"/);

const executableSource = dashboardSource.replace(
  /\nrefreshDashboard\(\);\r?\nstartLiveRefresh\(\);\r?\n/,
  '\n// Automatic dashboard refresh is disabled by the handoff board visual verifier fixture.\n',
);

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Symphony Handoff Status Board Visual Fixture</title>
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
      document.getElementById('fixture-root').innerHTML = renderHandoffStatusBoard(${JSON.stringify(handoffs)});
    </script>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 980, height: 760 } });

try {
  await page.setContent(html, { waitUntil: 'load' });

  await assertVisibleText(page, 'Jules handoff status board');
  await assertVisibleText(page, 'Ready widget task');
  await assertVisibleText(page, 'Blocked registry task');
  await assertVisibleText(page, 'Checks: failing');
  await assertVisibleText(page, 'Local sync: blocked');

  const layout = await page.locator('.handoff-status-board').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      display: getComputedStyle(element).display,
      width: rect.width,
      height: rect.height,
      scrollWidth: element.scrollWidth,
    };
  });

  assert.equal(layout.display, 'grid');
  assert(layout.width > 500, `Handoff board should use dashboard width, got ${layout.width}.`);
  assert(layout.height > 180, `Handoff board should have room for multiple handoffs, got ${layout.height}.`);
  assert(
    layout.scrollWidth <= Math.ceil(layout.width) + 1,
    `Handoff board should wrap instead of overflowing horizontally (${layout.scrollWidth} > ${layout.width}).`,
  );

  const screenshotPath = resolve('.symphony', 'visual-verification', 'handoff-status-board.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  await browser.close();
}

async function assertVisibleText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert(await locator.first().isVisible(), `Expected visible text: ${text}`);
}
