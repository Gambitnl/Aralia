import assert from 'node:assert/strict';
import { buildHandoffOperatorQuestion, normalizeOperatorPreferences } from '../dist/task-intake.js';

// This verifier protects the operator preference packet. Quiet hours started as
// a hardcoded Amsterdam sleep-window rule; the dashboard now needs the same rule
// to be operator-owned local state so future Codex foremen can wait politely
// without pretending the scheduler or Jules should keep running.

const repairDecision = {
  status: 'needs_operator_decision',
  category: 'workflow_setup',
  question: 'Which repair lane should Symphony use?',
  plainLanguageSummary: 'Setup failed before the task tests could run.',
  recommendedFirstStep: 'Create a small setup repair task before sending Jules feedback.',
  evidence: ['npm ci failed before tests ran.'],
  options: [],
  mutatesExternalSystems: false,
  mutatesLocalFiles: false,
  nextExpectedProof: 'Chosen repair lane.',
};

const defaultPreferences = normalizeOperatorPreferences(null);
assert.equal(defaultPreferences.quietHours.enabled, true);
assert.equal(defaultPreferences.quietHours.timeZone, 'Europe/Amsterdam');
assert.equal(defaultPreferences.quietHours.startHour, 1);
assert.equal(defaultPreferences.quietHours.endHour, 9);
assert.equal(defaultPreferences.quietHours.weekdaysOnly, true);
assert.equal(defaultPreferences.mutatesExternalSystems, false);
assert.equal(defaultPreferences.mutatesLocalFiles, false);
assert.equal(defaultPreferences.mutatesGit, false);

const customPreferences = normalizeOperatorPreferences({
  quietHours: {
    enabled: true,
    timeZone: 'America/New_York',
    startHour: 22,
    endHour: 6,
    weekdaysOnly: false,
  },
});

const quietPacket = buildHandoffOperatorQuestion({
  id: 'handoff-custom-quiet',
  title: 'Custom quiet hours proof',
  githubPullRequestRepairDecision: repairDecision,
}, {
  generatedAt: '2026-05-20T03:30:00.000Z',
  operatorPreferences: customPreferences,
});

assert(quietPacket);
assert.equal(quietPacket.quietHours.timeZone, 'America/New_York');
assert.equal(quietPacket.quietHours.appliesNow, true);
assert.equal(quietPacket.canNotifyNow, false);
assert.equal(quietPacket.nextCheckAt, '2026-05-20T10:00:00.000Z');
assert.match(quietPacket.quietHours.policy, /22:00-06:00 America\/New_York/);
assert.match(quietPacket.quietHours.summary, /Quiet hours are active/);

const disabledPreferences = normalizeOperatorPreferences({
  quietHours: {
    enabled: false,
    timeZone: 'Europe/Amsterdam',
    startHour: 1,
    endHour: 9,
    weekdaysOnly: true,
  },
});

const disabledPacket = buildHandoffOperatorQuestion({
  id: 'handoff-disabled-quiet',
  title: 'Disabled quiet hours proof',
  githubPullRequestRepairDecision: repairDecision,
}, {
  generatedAt: '2026-05-20T00:30:00.000Z',
  operatorPreferences: disabledPreferences,
});

assert(disabledPacket);
assert.equal(disabledPacket.quietHours.appliesNow, false);
assert.equal(disabledPacket.canNotifyNow, true);
assert.equal(disabledPacket.nextCheckAt, null);
assert.match(disabledPacket.quietHours.summary, /disabled/);

const wrappedPreferences = normalizeOperatorPreferences({
  quietHours: {
    enabled: true,
    timeZone: 'Europe/Amsterdam',
    startHour: 22,
    endHour: 6,
    weekdaysOnly: false,
  },
});

const daytimePacket = buildHandoffOperatorQuestion({
  id: 'handoff-daytime',
  title: 'Daytime proof',
  githubPullRequestRepairDecision: repairDecision,
}, {
  generatedAt: '2026-05-20T10:00:00.000Z',
  operatorPreferences: wrappedPreferences,
});

assert(daytimePacket);
assert.equal(daytimePacket.quietHours.appliesNow, false);
assert.equal(daytimePacket.canNotifyNow, true);
assert.equal(daytimePacket.nextCheckAt, null);

const dashboard = await import('node:fs/promises').then(fs =>
  fs.readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8')
);
assert.match(dashboard, /Operator Preferences/);
assert.match(dashboard, /data-operator-preference="quietHours\.enabled"/);
assert.match(dashboard, /record-operator-preferences/);
