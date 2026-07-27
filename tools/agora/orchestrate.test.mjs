// Tests for the orchestrator's pure logic: plan validation (disjointness is the
// safety invariant) and coordination-prompt generation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, buildPrompt } from './orchestrate.mjs';

const plan = {
  wave: 'demo',
  pet: 'gf-sd',
  baseUrl: 'http://localhost:4319',
  baseline: 220,
  packets: [
    { id: 'PK-a', handle: 'fix-a', pet: 'dream-girl', agent: 'claude', scope: 'fix the menu colors', files: ['src/a.tsx'], issues: ['M1'] },
    { id: 'PK-b', handle: 'fix-b', pet: 'nous-girl', agent: 'gemini', scope: 'cap bridges', files: ['src/b.ts'] },
  ],
};

// NOTE: the fixture keeps a gemini packet for buildPrompt's external-variant
// coverage; validatePlan now REJECTS gemini (deprecated in the agent registry),
// so validation tests use a policy-clean copy.
function validPlan() {
  const p = structuredClone(plan);
  p.packets[1].agent = 'claude';
  return p;
}

test('validatePlan accepts a disjoint plan', () => {
  assert.equal(validatePlan(validPlan()), true);
});

test('validatePlan REJECTS overlapping files (the safety invariant)', () => {
  const bad = validPlan();
  bad.packets[1].files = ['src/a.tsx']; // same file as PK-a
  assert.throws(() => validatePlan(bad), /DISJOINTNESS VIOLATION/);
});

test('validatePlan rejects duplicate handles (identity collision)', () => {
  const bad = validPlan();
  bad.packets[1].handle = 'fix-a';
  assert.throws(() => validatePlan(bad), /duplicate handle/);
});

test('validatePlan rejects missing or unknown pet identities before dispatch', () => {
  const missingPlanPet = validPlan();
  delete missingPlanPet.pet;
  assert.throws(() => validatePlan(missingPlanPet), /plan\.pet is required/);

  const missingWorkerPet = validPlan();
  delete missingWorkerPet.packets[0].pet;
  assert.throws(() => validatePlan(missingWorkerPet), /missing required pet identity/);

  const unknownWorkerPet = validPlan();
  unknownWorkerPet.packets[0].pet = 'not-a-real-pet';
  assert.throws(() => validatePlan(unknownWorkerPet), /not in dashboard\/pets\/pets\.json/);
});

test('validatePlan rejects a packet with no files / missing fields / unknown agent', () => {
  assert.throws(() => validatePlan({ pet: 'gf-sd', packets: [{ id: 'x', handle: 'h', pet: 'dream-girl', scope: 's', files: [] }] }), /no files/);
  assert.throws(() => validatePlan({ pet: 'gf-sd', packets: [{ id: 'x', handle: 'h', pet: 'dream-girl', files: ['a'] }] }), /missing id\/handle\/scope/);
  assert.throws(() => validatePlan({ pet: 'gf-sd', packets: [{ id: 'x', handle: 'h', pet: 'dream-girl', scope: 's', files: ['a'], agent: 'bogus' }] }), /unknown agent/);
  assert.throws(() => validatePlan({ packets: [] }), /non-empty array/);
});

test('buildPrompt (claude) carries owned files + the full coordination contract', () => {
  const p = buildPrompt(plan, plan.packets[0]);
  assert.match(p, /fix-a/);
  assert.match(p, /Owned files \(edit ONLY these\): `src\/a\.tsx`/);
  assert.match(p, /AGORA_AGENT_ID=fix-a/);                      // unique orchestrator-assigned identity
  assert.match(p, /register fix-a --pet dream-girl/);           // pet chosen before presence
  assert.match(p, /--session <your-task-or-thread-id>/);        // traceable worker provenance
  assert.match(p, /client\.mjs lock src\/a\.tsx --reason "PK-a"/); // lock-before-edit
  assert.match(p, /CONFLICT\/409/);                              // 409 = hard stop
  assert.match(p, /task done "\$TID"/);
  assert.match(p, /unlock --mine/);
  assert.match(p, /WORKFLOW:/);                                  // feedback loop
  assert.match(p, /heartbeat --daemonize --every 600 --for 30/); // harness-safe bounded helper
  assert.doesNotMatch(p, /heartbeat[^\n]*&/);                    // no brittle shell background recipe
  assert.match(p, /Do NOT run tsc\/build\/vitest/);             // no heavy commands
  assert.doesNotMatch(p, /No git commands/);                    // claude variant: not the external hard-rules
});

test('buildPrompt (external) adds the no-git / PowerShell hard rules + report ask', () => {
  const p = buildPrompt(plan, plan.packets[1]);
  assert.match(p, /external fix-agent "fix-b"/);
  assert.match(p, /No git commands/);
  assert.match(p, /PowerShell host/);
  assert.match(p, /lock src\/b\.ts --reason "PK-b"/);
  assert.match(p, /report to \.agent\/scratch\/orchestrate\/fix-b\.md/);
});

test('buildPrompt injects optional guidance when present', () => {
  const withG = structuredClone(plan);
  withG.packets[0].guidance = 'Use the existing color tokens.';
  const p = buildPrompt(withG, withG.packets[0]);
  assert.match(p, /Guidance:\nUse the existing color tokens\./);
});
