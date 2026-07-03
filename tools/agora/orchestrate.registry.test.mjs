// Tests for the machine-readable agent registry (agents.json) and its
// enforcement in validatePlan: deprecated/orchestrator-only/unwired agents are
// rejected at plan time instead of failing mid-campaign.
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, loadRegistry, staleConstraints } from './orchestrate.mjs';

function planWith(agent) {
  return {
    wave: 'w',
    packets: [{ id: 'PK-1', handle: 'h-1', agent, scope: 's', files: ['src/x.ts'] }],
  };
}

test('registry: agents.json loads and contains the core fleet with statuses', () => {
  const reg = loadRegistry();
  assert.ok(reg.agents.claude, 'claude present');
  assert.ok(reg.agents.codex, 'codex present');
  assert.ok(reg.agents.gemini, 'gemini present');
  assert.equal(reg.agents.gemini.status, 'deprecated');
  assert.ok(reg.agents.claude.roles.includes('worker'));
  assert.ok(!reg.agents.codex.roles.includes('worker'), 'codex is orchestrator-only by policy');
});

test('validatePlan: claude worker packet passes', () => {
  assert.equal(validatePlan(planWith('claude')), true);
});

test('validatePlan: deprecated agent (gemini) is rejected with the policy reason', () => {
  assert.throws(() => validatePlan(planWith('gemini')), /deprecated/i);
});

test('validatePlan: orchestrator-only agent (codex) is rejected for worker packets', () => {
  assert.throws(() => validatePlan(planWith('codex')), /orchestrator-only|not a worker/i);
});

test('validatePlan: onboarded-but-unwired agent (cursor) is rejected with a dispatch-wiring reason', () => {
  // kilo graduated to wired 2026-07-02 (verified PROBE_OK); cursor remains unwired.
  assert.throws(() => validatePlan(planWith('cursor')), /dispatch|not wired/i);
});

test('validatePlan: unknown agent lists the known registry ids', () => {
  assert.throws(() => validatePlan(planWith('bogus')), /unknown agent .*claude/);
});

test('validatePlan: an injected registry overrides the file (test/ops seam)', () => {
  const registry = {
    agents: {
      testbot: {
        roles: ['worker'], status: 'ready',
        dispatch: { type: 'cli', command: 'testbot' },
      },
    },
  };
  assert.equal(validatePlan(planWith('testbot'), { registry }), true);
});

test('staleConstraints: flags date-bound constraints that have passed', () => {
  const def = {
    constraints: [
      { note: 'quota exhausted', expiresAt: '2026-07-10' },
      { note: 'evergreen rule' },
    ],
  };
  const before = staleConstraints(def, new Date('2026-07-01'));
  assert.equal(before.length, 0);
  const after = staleConstraints(def, new Date('2026-07-11'));
  assert.equal(after.length, 1);
  assert.match(after[0].note, /quota exhausted/);
});
