// Tests for the machine-readable agent registry (agents.json) and its
// enforcement in validatePlan: deprecated/orchestrator-only/unwired agents are
// rejected at plan time instead of failing mid-campaign.
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, loadRegistry, staleConstraints, launchSpec } from './orchestrate.mjs';
import { diffMatrix, hasDispatchWiring, isWorkerDispatchable } from './syncAgents.mjs';

function planWith(agent) {
  return {
    wave: 'w',
    pet: 'gf-sd',
    packets: [{ id: 'PK-1', handle: 'h-1', pet: 'dream-girl', agent, scope: 's', files: ['src/x.ts'] }],
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

test('validatePlan: an onboarded-but-unwired lane is rejected with a dispatch-wiring reason', () => {
  // cursor graduated to wired 2026-09-20 (AM-G1), so the unwired case now uses an
  // injected lane. The rule under test is unchanged: no wiring, no dispatch.
  const registry = { agents: { halfdone: { roles: ['worker'], status: 'ready', dispatch: { type: 'cli', command: null } } } };
  assert.throws(() => validatePlan(planWith('halfdone'), { registry }), /dispatch|not wired/i);
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

// ---------------------------------------------------------------------------
// AM-G1: the registry and the Agent Matrix dashboard ledger had drifted apart,
// so validatePlan rejected every lane the dashboard called worker-ready. These
// tests pin the reconciled rows and the diff that keeps them from drifting again.
// ---------------------------------------------------------------------------

test('registry: cline is a wired worker lane and validatePlan accepts it', () => {
  const reg = loadRegistry();
  const def = reg.agents.cline;
  assert.ok(def, 'cline present');
  assert.ok(def.roles.includes('worker'));
  assert.equal(def.status, 'ready');
  assert.equal(def.dispatch.command, 'cline');
  assert.equal(validatePlan(planWith('cline')), true);
});

test('registry: freebuff is present but rejected — it is TUI-only, with no headless prompt path', () => {
  const reg = loadRegistry();
  const def = reg.agents.freebuff;
  assert.ok(def, 'freebuff present');
  assert.deepEqual(def.roles, []);
  assert.equal(def.dispatch.command, null);
  assert.match(def.notes, /not viable/i);
  assert.throws(() => validatePlan(planWith('freebuff')), /not a worker|orchestrator-only/i);
});

test('validatePlan: an API lane passes on dispatch.type "api" plus an endpoint', () => {
  const reg = loadRegistry();
  assert.equal(reg.agents['groq-free'].dispatch.type, 'api');
  assert.ok(reg.agents['groq-free'].dispatch.endpoint);
  assert.equal(validatePlan(planWith('groq-free')), true);
});

test('validatePlan: an API lane with no endpoint is still unwired', () => {
  const registry = { agents: { ghostapi: { roles: ['worker'], status: 'ready', dispatch: { type: 'api' } } } };
  assert.equal(hasDispatchWiring(registry.agents.ghostapi), false);
  assert.throws(() => validatePlan(planWith('ghostapi'), { registry }), /dispatch|not wired/i);
});

test('launchSpec: a file-prompt lane substitutes {promptFile} and appends no prompt text', () => {
  const registry = {
    agents: {
      filebot: { roles: ['worker'], status: 'ready', dispatch: { type: 'cli', command: 'powershell', args: ['-File', 'run.ps1', '-PromptFile', '{promptFile}'], promptMode: 'file' } },
    },
  };
  const spec = launchSpec('filebot', 'THE PROMPT', registry, { promptFile: 'C:\\tmp\\p.txt' });
  assert.deepEqual(spec.args, ['-File', 'run.ps1', '-PromptFile', 'C:\\tmp\\p.txt']);
  assert.ok(!spec.args.includes('THE PROMPT'), 'prompt text is not appended for a file-prompt lane');
});

test('launchSpec: an API lane has no CLI launch spec and says so', () => {
  const registry = { agents: { apibot: { roles: ['worker'], status: 'ready', dispatch: { type: 'api', endpoint: 'https://example.invalid/v1' } } } };
  assert.throws(() => launchSpec('apibot', 'p', registry), /API lane/i);
});

test('registry: every row declares matrixId (an id, or null for a local-only lane)', () => {
  const reg = loadRegistry();
  const missing = Object.entries(reg.agents).filter(([, def]) => !('matrixId' in def)).map(([id]) => id);
  assert.deepEqual(missing, [], `rows without matrixId: ${missing.join(', ')}`);
});

test('diffMatrix: a worker-ready dashboard lane with no registry row is an error', () => {
  const rows = diffMatrix(
    { agents: { claude: { matrixId: 'claude', roles: ['worker'], status: 'ready', dispatch: { type: 'agent-tool' } } } },
    [
      { id: 'claude', dispatchEligibility: { status: 'worker-ready' } },
      { id: 'newlane-cli', dispatchEligibility: { status: 'worker-ready', reason: 'trial-verified' } },
    ],
  );
  const errors = rows.filter((r) => r.level === 'error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /no agents\.json row carries matrixId "newlane-cli"/);
});

test('diffMatrix: a benched dashboard lane that the registry still dispatches is an error', () => {
  const rows = diffMatrix(
    { agents: { rogue: { matrixId: 'rogue-cli', roles: ['worker'], status: 'ready', dispatch: { type: 'cli', command: 'rogue' } } } },
    [{ id: 'rogue-cli', dispatchEligibility: { status: 'benched', reason: 'benched by operator policy' } }],
  );
  const errors = rows.filter((r) => r.level === 'error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /dashboard says "benched"/);
});

test('diffMatrix: a documented matrixOverride downgrades the error to a reported divergence', () => {
  const rows = diffMatrix(
    {
      agents: {
        claude: {
          matrixId: 'claude', roles: ['worker'], status: 'ready', dispatch: { type: 'agent-tool' },
          matrixOverride: { reason: 'the benched surface is the CLI, not the Agent-tool lane' },
        },
      },
    },
    [{ id: 'claude', dispatchEligibility: { status: 'benched' } }],
  );
  assert.equal(rows.filter((r) => r.level === 'error').length, 0);
  const override = rows.find((r) => r.level === 'override');
  assert.match(override.message, /Agent-tool lane/);
});

test('diffMatrix: a matrixId matching no dashboard offering is an error', () => {
  const rows = diffMatrix(
    { agents: { stale: { matrixId: 'removed-cli', roles: [], status: 'unknown', dispatch: {} } } },
    [{ id: 'other-cli', dispatchEligibility: { status: 'blocked' } }],
  );
  const errors = rows.filter((r) => r.level === 'error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /matches no dashboard offering/);
});

test('isWorkerDispatchable: matches the rules validatePlan enforces', () => {
  assert.equal(isWorkerDispatchable({ roles: ['worker'], status: 'ready', dispatch: { type: 'agent-tool' } }), true);
  assert.equal(isWorkerDispatchable({ roles: ['worker'], status: 'quota_limited', dispatch: { type: 'cli', command: 'x' } }), true);
  assert.equal(isWorkerDispatchable({ roles: ['worker'], status: 'benched', dispatch: { type: 'cli', command: 'x' } }), false);
  assert.equal(isWorkerDispatchable({ roles: ['orchestrator'], status: 'ready', dispatch: { type: 'cli', command: 'x' } }), false);
  assert.equal(isWorkerDispatchable({ roles: ['worker'], status: 'deprecated', dispatch: { type: 'cli', command: 'x' } }), false);
});
