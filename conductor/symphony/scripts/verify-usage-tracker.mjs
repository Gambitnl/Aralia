import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the dashboard usage tracker. Codex reports spending
// pressure through retained rate-limit and token events, so the browser needs
// to turn those raw event fragments into stable bars instead of making the
// operator read JSON or guess how close a worker is to a usage ceiling.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const usageStart = dashboardSource.indexOf('function usageBar');

assert(usageStart >= 0, 'dashboard.js should contain the usage tracker helpers');

const context = vm.createContext({
  Date,
  JSON,
  Math,
  Number,
  Object,
  RegExp,
  String,
  console,
});

// Evaluate only the pure helper section. The top of dashboard.js attaches DOM
// listeners and starts live refresh; this verifier only cares about converting
// retained usage/rate-limit data into the dashboard meter model.
vm.runInContext(dashboardSource.slice(usageStart), context);

const stateWithLiveLimits = {
  rate_limits: {
    planType: 'prolite',
    rateLimitReachedType: null,
    credits: {
      usedUsd: 3.25,
      remainingUsd: 16.75,
    },
    primary: {
      usedPercent: 23,
      windowDurationMins: 300,
      resetsAt: 1778984151,
    },
    secondary: {
      usedPercent: 74,
      windowDurationMins: 10080,
      resetsAt: 1779570951,
    },
  },
  codex_totals: {
    total_tokens: 123456,
  },
};

const liveSnapshot = context.buildUsageSnapshot(stateWithLiveLimits, {});

assert.equal(liveSnapshot.sourceLabel, 'live Codex limits');
assert.equal(liveSnapshot.summary, 'Plan: prolite; credits: $3.25 used / $16.75 remaining');
assert.equal(liveSnapshot.bars.length, 2);
assert.equal(
  JSON.stringify(liveSnapshot.bars.map(bar => [bar.label, bar.percent, bar.tone])),
  JSON.stringify([
    ['Primary window', 23, 'good'],
    ['Weekly window', 74, 'warning'],
  ]),
);

const detailsById = {
  'ARA-5': {
    activity: [
      {
        source_type: 'rateLimits',
        timestamp: '2026-05-17T00:00:00.000Z',
        detail: 'Primary window used: 91%\nWeekly window used: 4%\nPlan: pro\nCredits used: $7.50\nCredits remaining: $12.25',
      },
      {
        source_type: 'tokenUsage',
        timestamp: '2026-05-17T00:00:01.000Z',
        detail: 'Total tokens: 129,200\ncontext window: 258,400',
      },
    ],
  },
};

const retainedEventSnapshot = context.buildUsageSnapshot({ codex_totals: { total_tokens: 0 } }, detailsById);

// When the server-level rate-limit snapshot is absent, the dashboard should
// still recover useful bars from retained activity. This keeps the tracker
// informative after refreshes or when only per-issue activity has usage data.
assert.equal(retainedEventSnapshot.sourceLabel, 'live Codex limits');
assert.equal(retainedEventSnapshot.summary, 'Plan: pro; credits: $7.50 used / $12.25 remaining');
assert.equal(
  JSON.stringify(retainedEventSnapshot.bars.map(bar => [bar.label, Math.round(bar.percent), bar.tone])),
  JSON.stringify([
    ['Primary window', 91, 'danger'],
    ['Weekly window', 4, 'good'],
    ['Model context', 50, 'good'],
  ]),
);

const emptySnapshot = context.buildUsageSnapshot({ codex_totals: { total_tokens: 42 } }, {});

assert.equal(emptySnapshot.sourceLabel, 'no live limits yet');
assert.equal(emptySnapshot.summary, 'Total runtime tokens: 42');
assert.equal(emptySnapshot.bars[0].label, 'Waiting for Codex usage data');
assert.equal(emptySnapshot.bars[0].tone, 'quiet');
