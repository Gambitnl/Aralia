// tools/agora/boardUx.fixes.test.mjs
// The board-surface repairs of agora-bf4d.7: the readiness marker, the two
// task-lint declaration markers, the category derivation, and the seed identity
// rule. Each test names the gap it holds closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lintTask, formatLintReport, extractDeclaredCreates, extractDeclaredAbsent } from './taskLint.mjs';
import { classificationForSurface } from './client.mjs';
import { resolveSeedIdentity, commandsNamedInGuidance, buildVerificationStep } from './orchestrate.mjs';

// ---------------------------------------------------------- WF-G191 / WF-G193
test('extractDeclaredCreates and extractDeclaredAbsent read the body markers', () => {
  const body = [
    'CREATES (new file, does not exist yet, this task creates it): src/utils/visuals/conditionPalette.ts',
    'Then wire it into src/components/BattleMap/BattleMap.tsx.',
    'EXPECTED-ABSENT: docs/projects/town/GAPS.md, docs/projects/town-description-system/GAPS.md',
  ].join('\n');
  assert.deepEqual(extractDeclaredCreates(body), ['src/utils/visuals/conditionPalette.ts']);
  assert.deepEqual(extractDeclaredAbsent(body), [
    'docs/projects/town/GAPS.md',
    'docs/projects/town-description-system/GAPS.md',
  ]);
});

test('a CREATES path is a NEW PATH, not a missing path, so the task lints clean (WF-G191)', () => {
  // agora-f821.10 said exactly this in its body and still exited 1 with
  // "MISSING PATHS (1)" and the advice to say what the task creates.
  const result = lintTask(
    { id: 'demo.10', title: 'Add the condition palette', body: 'CREATES: src/utils/visuals/conditionPalette.ts' },
    { fileExists: () => false, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true },
  );
  assert.deepEqual(result.missingPaths, []);
  assert.deepEqual(result.newPaths, ['src/utils/visuals/conditionPalette.ts']);
  assert.equal(result.clean, true);
  assert.match(formatLintReport(result).join('\n'), /NEW PATHS \(1\)/);
});

test('a CREATES path that ALREADY exists is a stale claim and fails (WF-G191)', () => {
  const result = lintTask(
    { id: 'demo.11', title: 'Add it again', body: 'CREATES: src/utils/visuals/conditionPalette.ts' },
    { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true },
  );
  assert.deepEqual(result.staleCreates, ['src/utils/visuals/conditionPalette.ts']);
  assert.equal(result.clean, false);
  assert.match(formatLintReport(result).join('\n'), /would overwrite work that has already landed/);
});

test('EXPECTED-ABSENT is clean while the path is absent and FAILS when it returns (WF-G193)', () => {
  // The marker owns its own line — that is what makes it machine-read rather
  // than guessed at out of prose.
  const body = [
    'The doc cites a registry that no longer exists. Remove the citation.',
    'EXPECTED-ABSENT: docs/projects/town/GAPS.md',
  ].join('\n');
  const absent = lintTask(
    { id: 'demo.34', title: 'Repair the doc', body },
    { fileExists: () => false, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true },
  );
  assert.equal(absent.clean, true, 'a doc-repair task must be able to NAME the path it says is gone');
  assert.deepEqual(absent.presentDespiteAbsent, []);

  const back = lintTask(
    { id: 'demo.34', title: 'Repair the doc', body },
    { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => true },
  );
  assert.equal(back.clean, false, 'the premise of the task has changed, so the lint must say so');
  assert.deepEqual(back.presentDespiteAbsent, ['docs/projects/town/GAPS.md']);
});

test('a declared path does not also get reported as a missing bare file name (WF-G193)', () => {
  const result = lintTask(
    { id: 'demo.35', title: 'x', body: 'CREATES: src/utils/visuals/conditionPalette.ts' },
    { fileExists: () => false, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: () => false },
  );
  assert.deepEqual(result.missingFileNames, []);
});

// ------------------------------------------------------------------ WF-G204
test('classificationForSurface derives a real class so no row carries an em dash', () => {
  assert.equal(classificationForSurface('planmap-dice'), 'planning');
  assert.equal(classificationForSurface('agora-daemon'), 'daemon');
  assert.equal(classificationForSurface('agora-gap-add'), 'client-tooling');
  assert.equal(classificationForSurface('agora-orchestrate-seed'), 'dispatch');
  assert.equal(classificationForSurface('agents-registry'), 'registry');
  assert.equal(classificationForSurface(''), 'workflow', 'no surface still yields a real class, never a blank');
});

// ------------------------------------------------------------------ WF-G172
test('seed reuses a live orchestrator identity from AGORA_AGENT_ID (WF-G172)', async () => {
  const plan = { wave: 'board-drain' };
  const agents = [{ handle: 'orch-fable-20260920', role: 'orchestrator', status: 'online' }];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ agents }) });
  try {
    const reuse = await resolveSeedIdentity(plan, {
      processEnv: { AGORA_AGENT_ID: 'orch-fable-20260920' },
      baseUrl: 'http://localhost:4319',
    });
    assert.equal(reuse.reuse, true);
    assert.equal(reuse.handle, 'orch-fable-20260920');

    // A worker identity must NOT be reused: it may not own a campaign.
    agents[0].role = 'worker';
    const worker = await resolveSeedIdentity(plan, {
      processEnv: { AGORA_AGENT_ID: 'orch-fable-20260920' },
      baseUrl: 'http://localhost:4319',
    });
    assert.equal(worker.reuse, false);
    assert.equal(worker.handle, 'orchestrator-board-drain');
    assert.match(worker.reason, /registered as worker/);

    // No AGORA_AGENT_ID at all is the original behavior, unchanged.
    const fresh = await resolveSeedIdentity(plan, { processEnv: {}, baseUrl: 'http://localhost:4319' });
    assert.equal(fresh.reuse, false);
    assert.equal(fresh.handle, 'orchestrator-board-drain');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a board that cannot be read never makes seed reuse an identity it did not verify (WF-G172)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    const out = await resolveSeedIdentity({ wave: 'w' }, {
      processEnv: { AGORA_AGENT_ID: 'orch-x' },
      baseUrl: 'http://localhost:4319',
    });
    assert.equal(out.reuse, false);
    assert.match(out.reason, /board unreachable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ------------------------------------------------------------------ WF-G175
test('commandsNamedInGuidance names only the commands the Guidance really asks for', () => {
  assert.deepEqual(commandsNamedInGuidance('Run node --test scripts/x.test.mjs.'), ['node --test']);
  assert.deepEqual(commandsNamedInGuidance('Match the surrounding style.'), []);
  assert.deepEqual(commandsNamedInGuidance('Run npx vitest run a.test.ts'), ['vitest']);
});

test('STEP 3 quotes the Guidance commands instead of forbidding them (WF-G175)', () => {
  const step = buildVerificationStep({
    id: 'PK-IB-GAPS',
    guidance: 'Run node --test scripts/idea-board/validate.test.mjs and report the real result.',
  });
  assert.match(step, /Run ONLY the commands the Guidance names/);
  assert.match(step, /node --test scripts\/idea-board\/validate\.test\.mjs/);
  assert.doesNotMatch(step, /Do NOT run/);
});
