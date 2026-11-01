// Tests for the orchestrator's pure logic: plan validation (disjointness is the
// safety invariant), coordination-prompt generation, and bounded CLI dispatch.
// Fake workers prove queue and terminal-result behavior without spending quota
// or starting any real external model process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createAgoraServer } from './server.mjs';
import { captureUnchangedUnionContext } from './unionConsumerOwnership.mjs';
import {
  validatePlan,
  buildPrompt,
  packetVerificationNotes,
  dispatchPacketWave,
  resolveDispatchMax,
  loadRegistry,
  promptCampaignId,
  withSeededTasks,
} from './orchestrate.mjs';

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

test('WF283: packet member declarations refuse unavailable source and retain worker checks in both variants', () => {
  for (const packet of plan.packets) {
    assert.match(buildPrompt(plan, packet), /SOURCE MEMBERS \(WF-G283\).*Re-read task show and task lint/);
    assert.throws(() => buildPrompt(plan, { ...packet, sourceMembers: [{}] }), /WF-G283/);
    assert.throws(() => buildPrompt(plan, { ...packet, sourceMembers: Array(33).fill({}) }), /at most32/);
    assert.throws(() => buildPrompt(plan, { ...packet, sourceMembers: [{ file: 'src/no-such-wf283-source.ts', symbol: 'Cultural', kind: 'string-union', quote: 'type Cultural = "shrine";', members: ['shrine'] }] }), /WF-G283/);
  }
});

test('WF283: quoted command and count members never authorize verification or create measurement obligations', () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dir = fs.mkdtempSync(path.join(repo, '.agent/scratch/wf283-reference-'));
  try {
    const file = path.relative(repo, path.join(dir, 'labels.ts')).replaceAll('\\', '/');
    const quote = 'export type Label = "npm run build" | "npm run typecheck" | "20 files" | "30 files";';
    fs.writeFileSync(path.join(repo, file), quote);
    const claim = { file, symbol: 'Label', kind: 'string-union', quote, members: ['npm run build', 'npm run typecheck', '20 files', '30 files'] };
    for (const prefix of ['SOURCE-MEMBERS: ', 'REFERENCE-ONLY: SOURCE-MEMBERS: ']) {
      const guidance = prefix + JSON.stringify(claim);
      const packet = { ...validPlan().packets[0], files: ['tools/agora/taskLint.mjs'], refs: [], issues: [], guidance, forbidCommands: ['build', 'tsc'] };
      assert.equal(validatePlan({ ...validPlan(), packets: [packet] }), true);
      const prompt = buildPrompt(plan, packet); assert.match(prompt, /This Guidance names none of those verification commands/);
      assert.ok(prompt.includes('REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(claim)));
      assert.equal(prompt.includes('\nGuidance:\n' + guidance), false, 'retain quoted records in the reference section, not operational guidance');
    }
  } finally { assert.equal(path.dirname(dir), path.join(repo, '.agent/scratch')); assert.match(path.basename(dir), /^wf283-reference-/); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('WF283: incorrect packet members refuse native seed before mutations; verified records persist in tasks and all prompts', async () => {
  const { seedPlan } = await import('./orchestrate.mjs');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const sourceDir = fs.mkdtempSync(path.join(repo, '.agent/scratch/wf283-seed-'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-member-seed-'));
  const app = createAgoraServer({ dir: path.join(root, 'server'), seatRosterPath: null });
  try {
    const file = path.relative(repo, path.join(sourceDir, 'member.ts')).replaceAll('\\', '/');
    const quote = 'export enum Phase { Ready = "idle", Busy = 2 }'; fs.writeFileSync(path.join(repo, file), quote);
    const claim = { file, symbol: 'Phase', kind: 'enum', quote, members: ['Ready', 'gatehouse'] };
    const packet = { ...validPlan().packets[0], files: ['tools/agora/taskLint.mjs'], refs: [], issues: [], scope: 'Check source member premise', sourceMembers: [claim] };
    await new Promise(resolve => app.listen(0, resolve));
    const candidate = { ...validPlan(), wave: 'member-fixture', baseUrl: 'http://127.0.0.1:' + app.server.address().port, packets: [packet] };
    const snapshot = () => ({ agents: app.store.listAgents(), campaigns: app.store.listCampaigns(), tasks: app.store.listTasks(), locks: app.store.listLocks() });
    const before = snapshot(); assert.throws(() => validatePlan(candidate), /WF-G283.*member mismatch/);
    assert.throws(() => buildPrompt(candidate, packet), /WF-G283.*member mismatch/);
    await assert.rejects(() => seedPlan(candidate, { env: { AGORA_DIR: path.join(root, 'identity') } }), /WF-G283/);
    assert.deepEqual(snapshot(), before);
    claim.members = ['Ready', 'Busy']; assert.equal(validatePlan(candidate), true);
    for (const agent of ['claude', 'codex', 'gemini']) for (const taskId of [undefined, 'agora-f283']) {
      const prompt = buildPrompt(candidate, { ...packet, agent }, { taskId });
      assert.ok(prompt.includes('REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(claim)));
      assert.match(prompt, /Re-read task show and task lint/);
    }
    // Scope metadata must survive once as a reference, never flattened into title or prose.
    packet.scope += '\nREFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(claim); delete packet.sourceMembers;
    const seeded = await seedPlan(candidate, { env: { AGORA_DIR: path.join(root, 'identity') } });
    const task = app.store.listTasks().find(item => item.id === seeded[packet.id]);
    assert.ok(task.body.includes('REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(claim)));
    assert.match(task.body, /SOURCE MEMBERS \(WF-G283\)/); assert.equal(task.state, 'open'); assert.deepEqual(app.store.listLocks(), []);
    assert.equal(task.title, packet.id + ': Check source member premise');
    assert.equal(task.body.split('\n').filter(line => line.startsWith('REFERENCE-ONLY: SOURCE-MEMBERS:')).length, 1);
    const { inspectSourceMembers, extractTaskOwnershipPaths } = await import('./taskLint.mjs');
    assert.equal(inspectSourceMembers(task).issues.length, 0);
    assert.ok(!extractTaskOwnershipPaths(task).some(item => item.ref === file));
    const { checkPlanOwnership, checkPacketLaunchLocks } = await import('./packetOwnership.mjs');
    const mapped = withSeededTasks(candidate, seeded);
    assert.deepEqual(mapped.packets[0].taskIds, [task.id]); assert.equal(packet.taskIds, undefined);
    assert.throws(() => withSeededTasks(candidate, []), /seed map/);
    assert.throws(() => withSeededTasks(candidate, { wrongPacket: task.id }), /seed map/);
    const badBody = 'SOURCE-MEMBERS: ' + JSON.stringify({ ...claim, members: ['Ready', 'gatehouse'] });
    app.store.editTask({ taskId: task.id, agentId: task.createdBy, fields: { body: badBody }, reason: 'Private regression fixture for a later stale member list.' });
    const beforeRefusal = snapshot();
    const partition = await checkPlanOwnership(mapped); assert.equal(partition.ok, false); assert.match(partition.errors.join('\n'), /WF-G283.*|member mismatch/);
    const launch = await checkPacketLaunchLocks(candidate, packet, { taskId: task.id });
    assert.equal(launch.ok, false); assert.equal(launch.checkedTasks, 1); assert.match(launch.errors.join('\n'), /member mismatch.*WF-G283/);
    const planFile = path.join(sourceDir, 'plan.json'); fs.writeFileSync(planFile, JSON.stringify(candidate));
    const seedPath = path.join(repo, '.agent/scratch/orchestrate', 'seed-member-fixture.json');
    assert.equal(fs.existsSync(seedPath), false, 'never overwrite an existing wave seed map');
    fs.writeFileSync(seedPath, JSON.stringify(seeded));
    try {
      for (const command of ['partition', 'prompt', 'dispatch']) {
        const result = await promisify(execFile)(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile, ...(command === 'partition' ? [] : [packet.id])], { cwd: repo, timeout: 30000 }).then(value => ({ ...value, code: 0 }), error => ({ ...error, code: error.code }));
        assert.equal(result.code, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /WF-G283/);
      }
      assert.deepEqual(snapshot(), beforeRefusal, 'all native refusals precede registration, seed, prompt output or worker launch');
    } finally { assert.equal(path.dirname(seedPath), path.join(repo, '.agent/scratch/orchestrate')); fs.unlinkSync(seedPath); }
  } finally {
    await app.close(); assert.equal(path.dirname(sourceDir), path.join(repo, '.agent/scratch')); assert.match(path.basename(sourceDir), /^wf283-seed-/); fs.rmSync(sourceDir, { recursive: true, force: true });
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); assert.match(path.basename(root), /^agora-member-seed-/); fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF-G330: pure prompts distinguish supplied observations from unknown lock state in both variants', () => {
  const snapshot = { source: 'supplied', observedAt: null, locks: [{
    id: 'fixture-lock', agentId: 'peer', paths: ['docs/peer.md'], globs: ['src/peer/**'],
    expiresAt: Date.parse('2026-10-09T18:00:00Z'), reason: 'fixture only',
  }] };
  for (const packet of plan.packets) {
    assert.match(buildPrompt(plan, packet), /LOCK OBSERVATION.*none supplied.*NOT evidence/);
    const prompt = buildPrompt(plan, packet, { lockSnapshot: snapshot });
    assert.match(prompt, /LOCK OBSERVATION.*supplied, observed unknown/);
    assert.match(prompt, /fixture-lock.*peer.*docs\/peer\.md.*src\/peer\/\*\*.*2026-10-09T18:00:00\.000Z/);
    assert.doesNotMatch(prompt, /LOCK OBSERVATION.*live daemon/);
  }
});

// Explicit unchanged context for pre-existing metadata-only fixtures, not a
// production baseline refresher or evidence that an intended type edit is safe.
function unchangedFixtureUnions(files) {
  return [...new Set(fs.globSync(files))].map(file => file.replaceAll('\\','/')).filter(file => file.startsWith('src/') && /\.[jt]sx?$/.test(file) && !/\.d\.ts$/.test(file))
    .map(file => captureUnchangedUnionContext(file, 'Metadata-only regression fixture: finite union contracts deliberately remain unchanged; isolate the existing gate.')).filter(Boolean);
}

test('WF237: core audits and durable action delivery policy survive seeded and unseeded prompt variants', () => {
  const core={...validPlan().packets[0],issues:[],files:['src/state/actionTypes.ts'],refs:['src/state/actionTypes.ts']};
  assert.throws(()=>validatePlan({...validPlan(),packets:[core]}),/WF-G237/);assert.throws(()=>buildPrompt(plan,core),/WF-G237/);
  core.actionWiringReview={reason:'Read-only source-comment fixture: dispatch, action members and payload fields remain unchanged.',sources:[{file:core.files[0],quote:'export type AppAction ='}]};
  core.unionReviews=unchangedFixtureUnions(core.files);
  assert.equal(validatePlan({...validPlan(),packets:[core]}),true);
  for(const agent of ['claude','codex','gemini'])for(const taskId of [undefined,'fixture-task']){
    const prompt=buildPrompt(plan,{...core,agent},{taskId});assert.match(prompt,/ACTION DELIVERY \(WF-G237\)/);assert.match(prompt,/ACTION-WIRING-UNCHANGED:/);assert.match(prompt,/grant no files, locks or commands/);
  }
});

test('WF282: exact unchanged context and self-check persist in all prompt variants', () => {
  const packet={...validPlan().packets[0],files:['src/systems/worldforge/town/population.ts'],issues:[]};
  assert.throws(()=>buildPrompt(plan,packet),/unreviewed owned finite union/);
  packet.unionReviews=unchangedFixtureUnions(packet.files);
  for(const agent of ['claude','codex','gemini'])for(const taskId of [undefined,'fixture-task']){
    const prompt=buildPrompt(plan,{...packet,agent},{taskId});assert.match(prompt,/REFERENCE-ONLY: UNION-REVIEW:/);assert.match(prompt,/UNION CONSUMERS \(WF-G282\)/);assert.match(prompt,/grant no files, locks or commands/);
  }
  packet.unionReviews[0].hash='0'.repeat(64);assert.throws(()=>buildPrompt(plan,packet),/stale unchanged/);
});

test('private scratch rules keep worker identities distinct, contained and dependency-aware', () => {
  const directory = prompt => /Private scratch directory: `([^`]+)`/.exec(prompt)?.[1];
  const first = buildPrompt(plan, plan.packets[0]);
  const second = buildPrompt(plan, plan.packets[1]);
  assert.equal(directory(first), '.agent/scratch/orchestrate/demo/fix-a/');
  assert.equal(directory(second), '.agent/scratch/orchestrate/demo/fix-b/');
  assert.notEqual(directory(first), directory(second));
  const unusual = directory(buildPrompt({ ...plan, wave: '../escape/one' },
    { ...plan.packets[0], handle: '../escape/two' }));
  assert.ok(unusual.startsWith('.agent/scratch/orchestrate/'));
  assert.equal(unusual.split('/').length, 6, 'encoded names remain two path segments');
  assert.equal(unusual.includes('../'), false);
  for (const prompt of [first, second]) {
    assert.match(prompt, /git check-ignore -v/);
    assert.match(prompt, /Node resolves packages from the script location, NOT the shell's cwd/);
    assert.match(prompt, /absolute file URL/);
    assert.match(prompt, /AGENT\.md#private-scratch-and-capture-helpers/);
    assert.match(prompt, /does not authorize.*starting a dev server/);
  }
  assert.ok(fs.readFileSync(new URL('./AGENT.md', import.meta.url), 'utf8')
    .includes('### Private Scratch And Capture Helpers'), 'the stable guide anchor exists');
});

test('in-repo scratch imports Playwright; external scratch imports its absolute entry regardless of cwd', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const scratchRoot = path.join(repoRoot, '.agent', 'scratch');
  fs.mkdirSync(scratchRoot, { recursive: true });
  const internal = fs.mkdtempSync(path.join(scratchRoot, 'agora-scratch-resolution-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-scratch-resolution-'));
  try {
    const probe = path.join(internal, 'import-check.mjs');
    const ignored = spawnSync('git', ['-c', 'core.fsmonitor=false', 'check-ignore', '-q', probe], { cwd: repoRoot });
    assert.equal(ignored.status, 0, 'verify the private scratch path is ignored before writing');
    const check = "console.log(typeof chromium.launch);";
    fs.writeFileSync(probe, "import { chromium } from 'playwright';\n" + check);
    assert.equal(execFileSync(process.execPath, [probe], { cwd: os.tmpdir(), encoding: 'utf8' }).trim(), 'function');
    const externalProbe = path.join(external, 'import-check.mjs');
    const esmEntry = path.join(path.dirname(createRequire(import.meta.url).resolve('playwright')), 'index.mjs');
    assert.ok(fs.existsSync(esmEntry), 'verify the documented ESM entry, not the CommonJS entry');
    const playwrightEntry = pathToFileURL(esmEntry).href;
    fs.writeFileSync(externalProbe, `import { chromium } from ${JSON.stringify(playwrightEntry)};\n${check}`);
    assert.equal(execFileSync(process.execPath, [externalProbe], { cwd: repoRoot, encoding: 'utf8' }).trim(), 'function');
  } finally {
    // These unique fixture directories are the only paths this test removes.
    assert.ok(path.resolve(internal).startsWith(path.resolve(scratchRoot) + path.sep));
    assert.ok(path.resolve(external).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(internal, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test('WF307: packet review changes refuse before seed and worker policy requires durable preservation', async () => {
  const { captureSourceReview } = await import('./taskLint.mjs');
  const review = captureSourceReview({ id: 'fixture-review', file: 'tools/agora/taskLint.mjs', start: 'export function inspectSymbolChecks(', end: '/** Resolve literal evidence against current bytes;', symbols: ['inspectSymbolChecks'], reason: 'Current read-only fixture block.' });
  const packet = { ...validPlan().packets[0], issues: [], refs: ['tools/agora/taskLint.mjs'], files: ['tools/agora/taskLint.mjs'], sourceReviews: [{ ...review, sha256: '0'.repeat(64) }] };
  assert.throws(() => validatePlan({ ...validPlan(), packets: [packet] }), /WF-G307/); assert.throws(() => buildPrompt(plan, packet), /WF-G307/);
  packet.sourceReviews = [review]; assert.equal(validatePlan({ ...validPlan(), packets: [packet] }), true);
  for (const agent of ['claude', 'codex', 'gemini']) for (const taskId of [undefined, 'fixture-task']) {
    const prompt = buildPrompt(plan, { ...packet, agent }, { taskId });
    assert.match(prompt, /SIBLING PRESERVATION \(WF-G307\)/); assert.match(prompt, /not.*semantic/i); assert.match(prompt, /SOURCE-REVIEW:/);
  }
  for (const name of ['AGENT.md', 'ORCHESTRATOR.md', 'PROTOCOL.md']) assert.match(fs.readFileSync(new URL('./' + name, import.meta.url), 'utf8'), /WF-G307/);
});

test('WF272: stale packet claims refuse before board mutation, corrected declarations persist into task briefs', async () => {
  const declaration = { file: 'tools/agora/taskLint.mjs', symbol: 'NonexistentWf272CallSite', expect: 'present' };
  const packet = { ...validPlan().packets[0], issues: [], refs: ['tools/agora/taskLint.mjs'], files: ['tools/agora/taskLint.mjs'], scope: 'Review exact symbol premise', symbolChecks: [declaration] };
  const { seedPlan } = await import('./orchestrate.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-symbol-seed-'));
  const app = createAgoraServer({ dir: path.join(root, 'server'), seatRosterPath: null });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const candidate = { ...validPlan(), wave: 'symbol-check-fixture', baseUrl: 'http://127.0.0.1:' + app.server.address().port, packets: [packet] };
    const snapshot = () => ({ agents: app.store.listAgents(), campaigns: app.store.listCampaigns(), tasks: app.store.listTasks(), locks: app.store.listLocks() });
    const before = snapshot(); assert.throws(() => validatePlan(candidate), /WF-G272/);
    assert.throws(() => buildPrompt(candidate, packet), /WF-G272/);
    await assert.rejects(() => seedPlan(candidate, { env: { AGORA_DIR: path.join(root, 'identity') } }), /WF-G272/); assert.deepEqual(snapshot(), before);
    declaration.expect = 'absent'; assert.equal(validatePlan(candidate), true);
    for (const bad of ['not-array', Array(65).fill(declaration)]) assert.throws(() => validatePlan({ ...candidate, packets: [{ ...packet, symbolChecks: bad }] }), /WF-G272/);
    assert.throws(() => buildPrompt(candidate, { ...packet, guidance: 'SYMBOL-CHECK-UNVERIFIED: ' + JSON.stringify({ file: declaration.file, symbol: 'unknown', reason: 'VERIFY source' }) }), /WF-G272/);
    const seeded = await seedPlan(candidate, { env: { AGORA_DIR: path.join(root, 'identity') } });
    const task = app.store.listTasks().find(item => item.id === seeded[packet.id]);
    assert.ok(task.body.includes('SYMBOL-CHECK: ' + JSON.stringify(declaration)));
    assert.match(task.body, /FILE\/SYMBOL PREMISES \(WF-G272\)/); assert.equal(task.state, 'open'); assert.deepEqual(app.store.listLocks(), []);
  } finally { await app.close(); assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF272: all prompt variants and guides require exact-file rechecks rather than fabricated call sites', () => {
  for (const agent of ['claude', 'codex', 'gemini']) for (const taskId of [undefined, 'agora-fixture.1']) {
    const prompt = buildPrompt(plan, { ...plan.packets[0], agent }, { taskId });
    assert.match(prompt, /FILE\/SYMBOL PREMISES \(WF-G272\)/); assert.match(prompt, /every named file\/symbol pair/);
    assert.match(prompt, /global.*hit.*not.*file proof/); assert.match(prompt, /do not fabricate call sites/);
    assert.match(prompt, /literal.*not semantic/); assert.match(prompt, /already-present field/);
  }
  for (const name of ['ORCHESTRATOR.md', 'AGENT.md', 'PROTOCOL.md']) {
    const text = fs.readFileSync(new URL('./' + name, import.meta.url), 'utf8');
    assert.match(text, /WF-G272/); assert.match(text, /SYMBOL-CHECK-UNVERIFIED/);
  }
});

test('WF291: seeded and unseeded worker variants require the whole-document audit before Verified metadata', () => {
  for (const agent of ['claude', 'codex', 'gemini']) for (const taskId of [undefined, 'agora-fixture.1']) {
    const packet = { ...plan.packets[0], agent, scope: 'Correct the renderer claim at docs/architecture/domains/town-map.md:107-134',
      files: ['docs/architecture/domains/town-map.md'], guidance: 'Preserve the cited historical motivation; do not launch or run application tests.' };
    const prompt = buildPrompt(plan, packet, { taskId });
    assert.match(prompt, /DOCUMENTATION AUDIT \(WF-G291\):/);
    assert.match(prompt, /read each repaired document end to end/);
    assert.match(prompt, /Historical line ranges are motivating citations, not exhaustive acceptance/);
    assert.match(prompt, /every repository path presented as current/);
    assert.match(prompt, /every absence claim anywhere in the document/);
    assert.match(prompt, /Historical, retired and planned references need separate classification/);
    assert.match(prompt, /before changing Verified:/);
    assert.match(prompt, /File existence is not proof of wiring, test execution or rendered behavior/);
    assert.match(prompt, /This audit does not grant extra files or commands/);
    assert.ok(prompt.includes(packet.scope)); assert.ok(prompt.includes(packet.guidance));
  }
});

test('WF291: durable seeded briefs retain whole-document acceptance beyond the motivating line range', async () => {
  const { seedPlan } = await import('./orchestrate.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-doc-audit-seed-'));
  const app = createAgoraServer({ dir: path.join(root, 'store'), seatRosterPath: null });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    // Drop the inherited menu issue and explicitly author the documentation ref.
    const packet = { ...validPlan().packets[0], issues: [], refs: ['docs/architecture/domains/town-map.md'], scope: 'Correct town-map documentation at lines 107-134 and 151-161', files: ['docs/architecture/domains/town-map.md'] };
    const candidate = { ...validPlan(), wave: 'doc-audit-fixture', baseUrl: 'http://127.0.0.1:' + app.server.address().port, packets: [packet] };
    const seeded = await seedPlan(candidate, { env: { AGORA_DIR: path.join(root, 'identity') } });
    const task = app.store.listTasks().find(item => item.id === seeded[packet.id]);
    assert.ok(task.body.includes(packet.scope)); assert.match(task.body, /DOCUMENTATION AUDIT \(WF-G291\):/);
    assert.match(task.body, /every absence claim anywhere in the document/);
    assert.match(task.body, /including sections outside the cited ranges/);
    // Human prose can capitalize sentences; enforce the policy, not case style.
    assert.match(task.body, /unresolved claims block the corresponding acceptance and verification-date claim/i);
    assert.match(task.body, /partial verification by section/); assert.match(task.body, /parent authorization and your own locks/);
    assert.equal(task.state, 'open'); assert.deepEqual(task.refs, packet.files); assert.deepEqual(app.store.listLocks(), []);
    assert.doesNotMatch(task.body, /npm run typecheck|npm run test|start a dev server/);
  } finally { await app.close(); assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF291: worker and author guides distinguish whole-document audit from behavior and wider ownership', () => {
  for (const name of ['AGENT.md', 'ORCHESTRATOR.md', 'PROTOCOL.md']) {
    const text = fs.readFileSync(new URL('./' + name, import.meta.url), 'utf8');
    assert.match(text, /WF-G291/); assert.match(text, /whole-document/i); assert.match(text, /absence claim/);
    assert.match(text, /Verified:/); assert.match(text, /partial verification/);
  }
});

test('WF325: contradictory deduplication packets fail before seed and corrected contracts persist on the board', async () => {
  const packet = { ...validPlan().packets[0], scope: 'One status-icon function, not two', files: ['tools/agora/shared-fixture.mjs'],
    dedupAcceptance: { canonical: 'shared table', canonicalCount: 1, obsolete: 'legacy switches', obsoleteCount: 1,
      consumers: ['combatUtils', 'BattleMapOverlay'], verification: 'Both consumers delegate and preserve status fallback.' } };
  assert.throws(() => validatePlan({ ...validPlan(), packets: [packet] }), /WF-G325/);
  assert.throws(() => buildPrompt(plan, packet), /WF-G325/);
  const { seedPlan } = await import('./orchestrate.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-dedup-seed-'));
  const app = createAgoraServer({ dir: path.join(root, 'store') });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const candidate = { ...validPlan(), wave: 'dedup-contract-fixture', baseUrl: 'http://127.0.0.1:' + app.server.address().port, packets: [packet] };
    const env = { AGORA_DIR: path.join(root, 'identity') };
    const snapshot = () => ({ agents: app.store.listAgents(), campaigns: app.store.listCampaigns(), tasks: app.store.listTasks(), locks: app.store.listLocks() });
    const before = snapshot(); await assert.rejects(() => seedPlan(candidate, { env }), /WF-G325/); assert.deepEqual(snapshot(), before);
    packet.dedupAcceptance.obsoleteCount = 0;
    assert.equal(validatePlan(candidate), true);
    const seeded = await seedPlan(candidate, { env });
    const task = app.store.listTasks().find(item => item.id === seeded[packet.id]);
    assert.ok(task.body.includes('DEDUP-ACCEPTANCE: ' + JSON.stringify(packet.dedupAcceptance)));
    assert.match(task.body, /DEDUP-GOAL:/);
    assert.match(buildPrompt(candidate, packet, { taskId: task.id }), /DEDUPLICATION.*WF-G325/);
    assert.equal(task.state, 'open'); assert.deepEqual(app.store.listLocks(), []);
  } finally { await app.close(); assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF-G343: count-dependent packets fail before seed unless measurement commands are declared and authorized', async () => {
  const packet = { ...validPlan().packets[0], scope: 'Repair 20 Enchantment Gap rows' };
  assert.throws(() => validatePlan({ ...validPlan(), packets: [packet] }), /WF-G343.*COUNT-SOURCE/);
  const command = 'node --import tsx tools/agora/countSpellGaps.mjs';
  packet.countSources = [command];
  assert.throws(() => validatePlan({ ...validPlan(), packets: [packet] }), /Guidance.*measurement/);
  packet.guidance = 'Read-only measurement before editing: ' + command;
  assert.equal(validatePlan({ ...validPlan(), packets: [packet] }), true);
  const inline = { ...packet, countSources: [], guidance: 'COUNT-SOURCE: ' + command };
  assert.ok(buildPrompt(plan, inline).includes('COUNT-SOURCE: ' + command), 'inline guidance sources are retained even with an empty array');
  const prompt = buildPrompt(plan, packet);
  assert.ok(prompt.includes('COUNT-SOURCE: ' + command), 'source survives generated task body');
  assert.match(prompt, /WF-G343.*before acting on.*count/);
  assert.match(prompt, /timestamp.*command.*current count.*result/);
  assert.match(prompt, /not execute.*automatically.*do not widen/);
  for (const countSources of ['not-an-array', [''], ['echo 20'], ['node one.mjs\nnode two.mjs']]) {
    assert.throws(() => validatePlan({ ...validPlan(), packets: [{ ...packet, countSources }] }), /countSources|COUNT-SOURCE/);
  }
  assert.throws(() => validatePlan({ ...validPlan(), packets: [{ ...packet,
    guidance: 'Do not run ' + command }] }), /Guidance.*measurement/);
  const forbidden = { ...packet, countSources: ['npm run build'], guidance: 'Run npm run build', forbidCommands: ['build'] };
  assert.throws(() => validatePlan({ ...validPlan(), packets: [forbidden] }), /forbid|CONFLICT/);
  for (const pkt of plan.packets) assert.match(buildPrompt(plan, pkt), /COUNT PREMISES.*WF-G343/);

  // The command must survive on the board, not merely in a transient prompt.
  // A refused premise must leave presence, campaigns and tasks untouched.
  const { seedPlan } = await import('./orchestrate.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-count-seed-'));
  const app = createAgoraServer({ dir: path.join(root, 'store') });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const env = { AGORA_DIR: path.join(root, 'identity') };
    const candidate = { ...validPlan(), baseUrl, wave: 'count-source-proof',
      packets: [{ ...packet, issues: [], refs: [] }] };
    const snapshot = () => ({ agents: app.store.listAgents(), campaigns: app.store.listCampaigns(), tasks: app.store.listTasks() });
    const before = snapshot();
    await assert.rejects(() => seedPlan({ ...candidate, packets: [{ ...candidate.packets[0], countSources: [], guidance: '' }] }, { env }), /WF-G343/);
    assert.deepEqual(snapshot(), before);
    const seeded = await seedPlan(candidate, { env });
    const stored = app.store.listTasks().find(task => task.id === seeded[packet.id]);
    assert.ok(stored.body.includes('\nCOUNT-SOURCE: ' + command));
    assert.ok(buildPrompt(candidate, candidate.packets[0], { taskId: stored.id }).includes('task show'));
  } finally {
    await app.close();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF-G333: implementation seed and generated prompts fail unresolved discovery before any mutation', async () => {
  const { seedPlan } = await import('./orchestrate.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-discovery-seed-'));
  const app = createAgoraServer({ dir: path.join(root, 'store') });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const candidate = { ...validPlan(), baseUrl, packets: [validPlan().packets[0]] };
    const packet = candidate.packets[0];
    const before = { agents: app.store.listAgents(), tasks: app.store.listTasks(), campaigns: app.store.listCampaigns() };
    for (const amend of [{ files: ['discover: the settings UI component'] },
      { scope: 'DISCOVER: the production settings surface' }, { guidance: 'DISCOVERY-REQUIRED: pick the UI location' }]) {
      const pending = { ...packet, ...amend };
      assert.throws(() => validatePlan({ ...candidate, packets: [pending] }), /WF-G333/);
      assert.throws(() => buildPrompt(candidate, pending), /WF-G333/);
      await assert.rejects(() => seedPlan({ ...candidate, packets: [pending] }, { env: { AGORA_DIR: path.join(root, 'identity') } }), /WF-G333/);
      assert.deepEqual({ agents: app.store.listAgents(), tasks: app.store.listTasks(), campaigns: app.store.listCampaigns() }, before);
    }
    packet.files = ['tools/agora/deliberate-new.mjs'];
    packet.scope = 'Implement in the parent-selected new source path';
    assert.equal(validatePlan(candidate), true);
    assert.match(buildPrompt(candidate, packet), /DISCOVERY.*WF-G333.*orchestrator.*before.*edit/i);
    for (const pkt of plan.packets) assert.match(buildPrompt(plan, pkt), /WF-G333/);
  } finally {
    await app.close();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF327: data from-values survive seed/prompt; stale and literal already-present targets refuse before mutations', async () => {
  const { seedPlan } = await import('./orchestrate.mjs');
  const scratch = path.resolve('.agent/scratch'); fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'agora-data-seed-'));
  const file = path.relative(process.cwd(), path.join(root, 'input.json')).replace(/\\/g, '/');
  assert.equal(spawnSync('git', ['-c', 'core.fsmonitor=false', 'check-ignore', '-q', file]).status, 0);
  fs.writeFileSync(path.join(root, 'input.json'), JSON.stringify({ value: ['original'] }));
  const app = createAgoraServer({ dir: path.join(root, 'store') });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const p = { ...validPlan(), baseUrl: `http://127.0.0.1:${app.server.address().port}`, wave: 'data-premise-seed',
      packets: [{ ...validPlan().packets[0], scope: 'Review a data value before editing', files: [file], issues: [],
        dataEdits: [{ file, field: ['value'], from: ['original'], to: ['revised'] }],
        dataValues: [{ file, field:['value'],value:['revised'],origin:{kind:'new',reason:'Private baseline regression intentionally proposes a revised fixture value, not corpus canon.'}}] }] };
    const env = { AGORA_DIR: path.join(root, 'identity') };
    const snapshot = () => ({ agents: app.store.listAgents(), tasks: app.store.listTasks(), campaigns: app.store.listCampaigns() });
    const before = snapshot();
    for (const edit of [{ ...p.packets[0].dataEdits[0], from: ['stale'] }, { ...p.packets[0].dataEdits[0], to: ['original'] }]) {
      const invalid = { ...p, packets: [{ ...p.packets[0], dataEdits: [edit] }] };
      assert.throws(() => validatePlan(invalid), /WF-G327/);
      assert.throws(() => buildPrompt(invalid, invalid.packets[0]), /WF-G327/);
      await assert.rejects(() => seedPlan(invalid, { env }), /WF-G327/);
      assert.deepEqual(snapshot(), before);
    }
    delete p.packets[0].dataEdits[0].from;
    const warnings = []; assert.equal(validatePlan(p, { onWarn: message => warnings.push(message) }), true);
    assert.ok(warnings.some(message => /VERIFY BEFORE EDITING/.test(message)));
    for (const agent of ['claude', 'codex']) {
      const prompt = buildPrompt(p, { ...p.packets[0], agent });
      assert.match(prompt, /DATA EDIT PREMISES \(WF-G327\)/);
      assert.match(prompt, /VERIFY BEFORE EDITING/);
      assert.match(prompt, /normalizer.*semantically equivalent/);
      assert.match(prompt, /does not grant files or commands/);
    }
    const seeded = await seedPlan(p, { env });
    let stored = app.store.listTasks().find(t => t.id === seeded[p.packets[0].id]);
    const prefix = 'REFERENCE-ONLY: DATA-EDIT: ';
    const pending = JSON.parse(stored.body.split('\n').find(line => line.startsWith(prefix)).slice(prefix.length));
    assert.equal(pending.verification, 'VERIFY BEFORE EDITING'); assert.equal(Object.hasOwn(pending, 'from'), false);
    p.packets[0].dataEdits[0].from = ['original'];
    for (const agent of ['claude', 'codex']) {
      for (const taskId of [undefined, stored.id]) {
        const prompt = buildPrompt(p, { ...p.packets[0], agent }, { taskId });
        assert.match(prompt, /DATA EDIT DECLARATIONS \(WF-G327\)/);
        assert.match(prompt, /"from":\["original"\]/);
      }
    }
    const recorded = { ...p, wave: 'data-premise-recorded' };
    // Two disjoint private campaigns exercise both durable declaration states
    // without bypassing the real overlapping-campaign safety check.
    const recordedFile = path.relative(process.cwd(), path.join(root, 'recorded.json')).replace(/\\/g, '/');
    fs.writeFileSync(path.join(root, 'recorded.json'), JSON.stringify({ value: ['original'] }));
    recorded.packets = [{ ...p.packets[0], files: [recordedFile],
      dataValues: [{file:recordedFile,field:['value'],value:['src/unowned-fiction.ts'],origin:{kind:'new',reason:'Private fixture deliberately tests path-like value serialization without an edit grant.'}}],
      dataEdits: [{ ...p.packets[0].dataEdits[0], file: recordedFile, to: ['src/unowned-fiction.ts'] }] }];
    const recordedIds = await seedPlan(recorded, { env });
    stored = app.store.listTasks().find(t => t.id === recordedIds[p.packets[0].id]);
    const declaration = JSON.parse(stored.body.split('\n').find(line => line.startsWith(prefix)).slice(prefix.length));
    assert.deepEqual(declaration.from, ['original']); assert.equal(declaration.verification, 'RECHECK BEFORE EDITING');
    const { extractTaskOwnershipPaths } = await import('./taskLint.mjs');
    assert.equal(extractTaskOwnershipPaths(stored).some(item => item.ref === 'src/unowned-fiction.ts'), false,
      'path-like JSON values are reference data, not new edit obligations');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'input.json'))), { value: ['original'] });
  } finally {
    await app.close(); assert.equal(path.dirname(root), scratch); fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF327: worker and author docs require current raw values and semantic review, not automatic data churn', () => {
  const worker = fs.readFileSync(new URL('./AGENT.md', import.meta.url), 'utf8');
  const author = fs.readFileSync(new URL('./ORCHESTRATOR.md', import.meta.url), 'utf8');
  assert.match(worker, /Data edit premises \(WF-G327\)/);
  assert.match(author, /dataEdits/); assert.match(author, /VERIFY BEFORE EDITING/);
  assert.match(author, /Semantic equivalence is not inferred/);
  assert.match(author, /sameFilterValues/);
});

test('validatePlan accepts a disjoint plan', () => {
  assert.equal(validatePlan(validPlan()), true);
});

test('validatePlan REJECTS overlapping files (the safety invariant)', () => {
  const bad = validPlan();
  bad.packets[1].files = ['src/a.tsx']; // same file as PK-a
  assert.throws(() => validatePlan(bad), /DISJOINTNESS VIOLATION/);
});

test('WF-G281: an owned-file glob must match a real file before packet dispatch', () => {
  const packetPlan = validPlan();
  packetPlan.packets[0].files = ['src/systems/worldforge/town/props/**'];
  assert.throws(() => validatePlan(packetPlan), /PK-a.*town\/props\/\*\*.*matches no files/);

  packetPlan.packets[0].files = ['src/systems/worldforge/props/**'];
  assert.equal(validatePlan(packetPlan), true);

  // Literal names can still represent files the packet is explicitly creating.
  packetPlan.packets[0].files = ['src/a-new-file.ts'];
  assert.equal(validatePlan(packetPlan), true);
});

test('WF-G281: prompt CLI refuses an empty owned glob before handing out a packet', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg281-'));
  // A clean CI clone has no shared daemon. Keep the live-lock safety check
  // intact and point both CLI cases at this test's private, empty lock store.
  const app = createAgoraServer({ dir });
  await new Promise(resolve => app.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const file = path.join(dir, 'plan.json');
  const run = async (packetPlan) => {
    packetPlan.baseUrl = baseUrl;
    fs.writeFileSync(file, JSON.stringify(packetPlan));
    try {
      const result = await promisify(execFile)(process.execPath, ['tools/agora/orchestrate.mjs', 'prompt', file, 'PK-a'], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 10_000,
      });
      return { ...result, status: 0 };
    } catch (error) {
      return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', status: error.code };
    }
  };
  try {
    const packetPlan = validPlan();
    packetPlan.packets[0].files = ['src/systems/worldforge/town/props/**'];
    const bad = await run(packetPlan);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr + bad.stdout, /PK-a.*town\/props\/\*\*.*matches no files/);
    assert.doesNotMatch(bad.stdout, /Owned files \(edit ONLY these\)/);

    packetPlan.packets[0].files = ['src/systems/worldforge/props/**'];
    packetPlan.packets[0].unionReviews=unchangedFixtureUnions(packetPlan.packets[0].files);
    const good = await run(packetPlan);
    assert.equal(good.status, 0, good.stderr);
    assert.match(good.stdout, /Owned files \(edit ONLY these\): `src\/systems\/worldforge\/props\/\*\*`/);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
  assert.match(p, /task done "TASK_ID_HERE"/);
  assert.match(p, /unlock --mine/);
  assert.match(p, /WORKFLOW:/);                                  // feedback loop
  assert.match(p, /heartbeat --daemonize --every 600 --for 30/); // harness-safe bounded helper
  assert.doesNotMatch(p, /heartbeat[^\n]*&/);                    // no brittle shell background recipe
  // WF-G175: no verification command is named, but read-only Git is still
  // available for the shared-checkout inspection required by WF-G257.
  assert.match(p, /STEP 3 — Run ONLY the test\/build\/typecheck\/dev-server commands the Guidance names/);
  assert.match(p, /This Guidance names none of those verification commands, so run none of them/);
  assert.doesNotMatch(p, /No git commands/);                    // claude variant: not the external hard-rules
});

test('buildPrompt STEP 3 never forbids a command the Guidance asks for (WF-G175)', () => {
  // The real case: PK-IB-GAPS STEP 3 said "Do NOT run vitest ... " while its own
  // Guidance said "Run node --test ... and report the real result". The
  // orchestrator had to send an out-of-band override to say which block won.
  const pkt = {
    ...plan.packets[0],
    guidance: 'Run node --test scripts/idea-board/validate.test.mjs and report the real result.',
  };
  const prompt = buildPrompt(plan, pkt);
  assert.match(prompt, /STEP 3 — Run ONLY the test\/build\/typecheck\/dev-server commands the Guidance names, and report their real output/);
  assert.match(prompt, /node --test scripts\/idea-board\/validate\.test\.mjs/);
  // The old blanket denial must be gone: it is what contradicted the Guidance.
  assert.doesNotMatch(prompt, /Do NOT run tsc\/build\/vitest/);
});

test('WF-G208: ordinary full compiles fail before seeding; scoped typechecks and explicit repo verification remain distinct', () => {
  for (const guidance of [
    'Run npx tsc --noEmit -p tsconfig.json | grep a.tsx',
    'Run npm run typecheck',
    'Run npm.cmd run typecheck',
  ]) {
    const packet = { ...plan.packets[0], guidance };
    assert.throws(() => buildPrompt(plan, packet), /WF-G208.*typecheck:files/);
    assert.throws(() => validatePlan({ ...validPlan(), packets: [packet] }), /WF-G208/);
    assert.throws(() => buildPrompt(plan, { ...packet, verificationScope: 'repository' }), /verificationReason/);
    const explicit = buildPrompt(plan, { ...packet, verificationScope: 'repository',
      verificationReason: 'Operator requested the repository-wide cleanup gate.' });
    assert.match(explicit, /Repository-wide verification only.*does not widen edit ownership/);
    assert.ok(explicit.includes(guidance.slice(4)), 'never silently replace the authorized command');
  }
  for (const command of ['npm run typecheck:files -- src/a.tsx', 'npm.cmd run typecheck:files -- src/a.tsx']) {
    assert.ok(buildPrompt(plan, { ...plan.packets[0], guidance: 'Run ' + command }).includes(command));
  }
  assert.doesNotThrow(() => buildPrompt(plan, { ...plan.packets[0],
    guidance: 'Run npm.cmd run typecheck:files -- src/a.tsx\nNever run a full tsc.' }));
  assert.throws(() => buildPrompt(plan, { ...plan.packets[0],
    guidance: 'Never run unrelated checks; Run npm.cmd run typecheck' }), /WF-G208/);
});

test('WF-G213: rendered proof attaches to the declared local surface without dev-server permission', () => {
  const packet = { ...plan.packets[0], forbidCommands: ['dev-server'],
    visualProof: { url: 'http://127.0.0.1:4319/dashboard/decisions.html', acceptance: 'The reference disclosure stays open after refresh.' } };
  assert.equal(validatePlan({ ...validPlan(), packets: [packet] }), true);
  const prompt = buildPrompt(plan, packet);
  assert.match(prompt, /attach to the already-running server at http:\/\/127\.0\.0\.1:4319\/dashboard\/decisions\.html/);
  assert.match(prompt, /The reference disclosure stays open after refresh/);
  assert.match(prompt, /Do not start, restart or stop a dev server/);
  assert.match(prompt, /fresh filename.*confirm it is ignored.*inspect the rendered image/);
  assert.match(prompt, /verification is blocked.*instead of task done/);
  assert.match(buildPrompt(plan, plan.packets[0]), /No visualProof URL is declared.*blocked, not done/);
  for (const url of ['https://example.com/page', 'javascript:alert(1)', 'http://user:secret@localhost:4319/', 'http://localhost@evil.example/']) {
    const invalid = { ...packet, visualProof: { ...packet.visualProof, url } };
    assert.throws(() => validatePlan({ ...validPlan(), packets: [invalid] }), /visualProof needs/);
  }
  assert.throws(() => buildPrompt(plan, { ...packet, visualProof: { url: packet.visualProof.url } }), /acceptance text/);
});

test('WF-G215/WF-G216: feedback carries complete routing fields and separates surface from task provenance', () => {
  for (const packet of plan.packets) {
    const prompt = buildPrompt(plan, packet, { taskId: 'agora-feed.1' });
    const search = prompt.split('\n').find(line => line.includes(' gap search '));
    const add = prompt.split('\n').find(line => line.includes(' gap add '));
    assert.ok(search && add && prompt.indexOf(search) < prompt.indexOf(add));
    for (const flag of ['--project', '--gap', '--evidence', '--why', '--next', '--proof', '--surface', '--detected-during', '--suggested-agent']) {
      assert.ok(add.includes(flag + ' '), 'missing feedback flag ' + flag);
    }
    assert.ok(add.includes('--detected-during "agora-feed.1"'));
    assert.ok(add.includes('--notes "Detected during task agora-feed.1"'));
    assert.ok(add.includes('--surface "<repair component>"'));
    assert.match(prompt, /--surface names a component, never a board task id/);
    const laneLine = prompt.split('\n').find(line => line.includes('Accepted --suggested-agent keys'));
    for (const key of [...Object.keys(loadRegistry().agents), 'human-operator']) assert.ok(laneLine.includes(key));
    assert.match(prompt, /do not file a template stub/);
  }
});

test('WF-G251/WF-G252/WF-G241: workers do not backfill membership or acquire overflow scope themselves', () => {
  for (const packet of plan.packets) {
    const prompt = buildPrompt({ ...plan, campaign: { id: 'assigned-campaign' } }, packet, { taskId: 'agora-parent.1' });
    assert.match(prompt, /task show "agora-parent\.1"/);
    assert.match(prompt, /Do not run task campaign or backfill legacy membership yourself/);
    assert.match(prompt, /deliberate standalone with a reason, and NONE RECORDED are different/);
    const followup = prompt.split('\n').find(line => line.includes(' task new "Ownership review'));
    assert.ok(followup.includes('--campaign "assigned-campaign"'));
    assert.ok(followup.includes('--dep "agora-parent.1:discovered-from"'));
    assert.ok(followup.includes('--ref "<extra repo-relative file>"'));
    assert.match(prompt, /A free lock is NOT authorization/);
    assert.match(prompt, /task state "agora-parent\.1" blocked.*missing/);
    assert.match(prompt, /ask its owner.*rather than overwriting its state/);
    assert.match(prompt, /EDIT CAPABILITY.*CRLF multi-line anchor failure is not an instruction to rewrite.*Bash/);
    assert.match(prompt, /UNKNOWN\/-4094 write race is not proof of sandbox denial/);
    assert.doesNotMatch(prompt, /lock <extra|or a script rewrite/);
  }
});

test('WF-G251: follow-up campaign uses the same roadmap namespace as seed', () => {
  const roadmap = { ...plan, wave: 'arbitrary-wave', packets: [{ ...plan.packets[0],
    refs: ['planmap:co-orchestration-pipeline'] }] };
  assert.equal(promptCampaignId(roadmap, roadmap.packets[0]), 'planmap:tooling:co-orchestration-pipeline');
  assert.match(buildPrompt(roadmap, roadmap.packets[0]), /--campaign "planmap:tooling:co-orchestration-pipeline"/);
  assert.equal(promptCampaignId({ ...roadmap, campaignId: 'explicit' }, roadmap.packets[0]), 'explicit');
  assert.equal(promptCampaignId(roadmap, { ...roadmap.packets[0], campaign: 'deputy' }), 'deputy');
});

test('WF-G221: a vendor-only packet does not demand undiscoverable tests or a clean root typecheck', () => {
  const vendor = {
    ...plan.packets[0],
    files: ['public/vendor/azgaar/versioning.js'],
  };
  const prompt = buildPrompt(plan, vendor);
  assert.match(prompt, /VENDOR-ONLY VERIFICATION.*Vitest.*vendor/i);
  assert.match(prompt, /do not add an in-vendor unit test/i);
  assert.match(prompt, /baseline.*delta/i);
  assert.doesNotMatch(prompt, /add or extend a unit test next to each changed module/i);
  assert.match(packetVerificationNotes({ packets: [vendor] }).join('\n'), /PK-a: VENDOR-ONLY VERIFICATION/);

  const badTest = { ...vendor, guidance: 'Add or extend a unit test next to each changed module.' };
  assert.throws(() => buildPrompt(plan, badTest), /WF-G221.*vendor.*Vitest/i);
  assert.throws(() => validatePlan({ ...validPlan(), packets: [badTest] }), /WF-G221.*vendor.*Vitest/i);

  const badTsc = { ...vendor, guidance: 'Run npm run typecheck:files, then require tsc clean for owned files.' };
  assert.throws(() => buildPrompt(plan, badTsc), /WF-G221.*vendor.*typecheck/i);

  const mixed = buildPrompt(plan, { ...vendor, files: [...vendor.files, 'src/a.tsx'] });
  assert.doesNotMatch(mixed, /VENDOR-ONLY VERIFICATION/);
});

test('unseeded task body quotes shell metacharacters in both packet variants', () => {
  const scope = 'Fix "$MODE" then `token`';
  const bashLine = buildPrompt(plan, { ...plan.packets[0], scope })
    .split('\n').find((line) => line.includes(' task new '));
  assert.ok(bashLine.includes('\\"\\$MODE\\"'), bashLine);
  assert.ok(bashLine.includes('\\`token\\`'), bashLine);
  assert.match(bashLine, /--body "Packet PK-a:/);

  const powershellLine = buildPrompt(plan, { ...plan.packets[1], scope })
    .split('\n').find((line) => line.includes(' task new '));
  assert.ok(powershellLine.includes('`"`$MODE`"'), powershellLine);
  assert.ok(powershellLine.includes('``token``'), powershellLine);
  assert.match(powershellLine, /--body "Packet PK-b:/);
});

test('WF-G225: buildPrompt names the sibling and expected cross-packet effect', () => {
  const p = validPlan();
  p.packets[0].handoffs = [{
    ref: 'src/b.ts',
    toPacket: 'PK-b',
    expectedBreakage: 'The bridge test remains red until PK-b updates its leaf.',
  }];
  assert.equal(validatePlan(p), true);
  const prompt = buildPrompt(p, p.packets[0]);
  assert.match(prompt, /src\/b\.ts belongs to sibling packet PK-b/);
  assert.match(prompt, /bridge test remains red until PK-b updates its leaf/);
  assert.match(prompt, /do not edit sibling files/);
});

test('buildPrompt REFUSES a packet whose Guidance names a command it also forbids (WF-G175)', () => {
  const pkt = {
    ...plan.packets[0],
    guidance: 'Run npx vitest run src/a.test.tsx and report the count.',
    forbidCommands: ['vitest'],
  };
  assert.throws(
    () => buildPrompt(plan, pkt),
    /cannot both ask for a command and forbid it \(WF-G175\)/,
  );
});

test('buildPrompt (external) adds the read-only Git / PowerShell hard rules + report ask', () => {
  const p = buildPrompt(plan, plan.packets[1]);
  assert.match(p, /external fix-agent "fix-b"/);
  assert.match(p, /No state-changing git/);
  assert.match(p, /Read-only git .* is allowed and expected/);
  assert.match(p, /PowerShell host/);
  assert.match(p, /lock src\/b\.ts --reason "PK-b"/);
  assert.match(p, /report to \.agent\/scratch\/orchestrate\/fix-b\.md/);
});

test('WF-G257: packet permits read-only Git checks while refusing state-changing Git', () => {
  for (const pkt of plan.packets) {
    const prompt = buildPrompt(plan, {
      ...pkt,
      guidance: 'Check git ls-files --eol src/b.ts before editing; inspect git diff -- src/b.ts after a pre-modified lock warning.',
    });
    assert.match(prompt, /Read-only git .*status, diff, log, ls-files, show.* (?:allowed|expected)/i);
    assert.match(prompt, /no state-changing git .*commit.*branch.*worktree.*checkout.*reset.*stash.*clean/i);
    assert.doesNotMatch(prompt, /No git commands|run NO command here/);
    assert.match(prompt, /STEP 3[^]*Read-only git .*allowed/i);
    assert.match(prompt, /STEP 3[^]*git ls-files --eol prints no result for untracked files/i);
    assert.match(prompt, /use the EOL reading in the lock warning/i);
  }

  const withTest = buildPrompt(plan, {
    ...plan.packets[1],
    guidance: 'Run node --test tools/agora/orchestrate.test.mjs and report the result.',
  });
  assert.match(withTest, /node --test tools\/agora\/orchestrate\.test\.mjs/);
  assert.match(withTest, /git ls-files --eol prints no result for untracked files/);
  assert.doesNotMatch(withTest, /Do NOT run builds\/tsc\/tests/);
});

test('WF-G344: every generated Agora command scopes identity in its own shell call', () => {
  for (const pkt of plan.packets) {
    for (const taskId of [undefined, 'agora-seeded.1']) {
      const prompt = buildPrompt(plan, pkt, { taskId });
      const lines = prompt.split('\n').filter((line) => /node tools\/agora\/client\.mjs/.test(line));
      const prefix = pkt.agent === 'gemini'
        ? `$env:AGORA_AGENT_ID='${pkt.handle}'; node tools/agora/client.mjs`
        : `AGORA_AGENT_ID=${pkt.handle} node tools/agora/client.mjs`;
      assert.ok(lines.length >= 9, 'join and wrap-up commands must be present');
      assert.ok(lines.every((line) => line.trim().startsWith(prefix)), 'every command must carry its own identity scope');
      assert.match(prompt, new RegExp(`${pkt.handle}.*register ${pkt.handle} --pet`));
      assert.doesNotMatch(prompt, /(?:^|\n)\s*export AGORA_AGENT_ID=/);
      assert.doesNotMatch(prompt, /--url \$B/);
      if (taskId) {
        assert.match(prompt, /task claim "agora-seeded\.1"/);
        assert.match(prompt, /task done "agora-seeded\.1"/);
      } else {
        assert.match(prompt, /task new .*--id-only/);
        assert.match(prompt, /task new .*--body "Packet PK-[ab]: .*Owned files: src\/[ab]\.tsx?\. Acceptance:/);
        assert.match(prompt, /replace TASK_ID_HERE in claim and done/);
      }
    }
  }
});

test('buildPrompt injects optional guidance when present', () => {
  const withG = structuredClone(plan);
  withG.packets[0].guidance = 'Use the existing color tokens.';
  const p = buildPrompt(withG, withG.packets[0]);
  assert.match(p, /Guidance:\nUse the existing color tokens\./);
});

// ============================================================================
// Bounded External Dispatch
// ============================================================================
// These small registries isolate the concurrency policy from installed CLIs.
// The local lane has a declared ceiling; the second local lane exercises the
// default-of-four contract; and the remote lane retains its prior free fan-out.
// ============================================================================
const dispatchRegistry = {
  agents: {
    local: { dispatch: { type: 'cli', command: 'fake', localEngine: true, maxConcurrent: 2 } },
    localDefault: { dispatch: { type: 'cli', command: 'fake', localEngine: true } },
    remote: { dispatch: { type: 'cli', command: 'fake' } },
  },
};

// Give queued promise continuations one event-loop turn to start the next job.
// This is deterministic because tests release fake workers explicitly.
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test('dispatchPacketWave queues a larger-than-cap local wave and records every terminal output', async () => {
  const packets = Array.from({ length: 7 }, (_, index) => ({ id: `PK-${index + 1}`, agent: 'local' }));
  const releases = [];
  const starts = [];
  let active = 0;
  let maxActive = 0;

  // Each fake worker occupies its slot until the test releases it. This proves
  // the third job cannot start while both cap-two slots remain busy.
  const wave = dispatchPacketWave(packets, {
    registry: dispatchRegistry,
    runPacket: (packet) => new Promise((resolve) => {
      starts.push(packet.id);
      active += 1;
      maxActive = Math.max(maxActive, active);
      releases.push(() => {
        active -= 1;
        resolve({ exitCode: 0, output: `output:${packet.id}`, result: `result:${packet.id}` });
      });
    }),
  });

  await nextTurn();
  assert.deepEqual(starts, ['PK-1', 'PK-2']);
  assert.equal(releases.length, 2);

  // Release one slot at a time. Every release admits exactly one queued packet,
  // so the observed activity can never climb above the selected ceiling.
  for (let index = 0; index < packets.length; index += 1) {
    releases[index]();
    await nextTurn();
  }
  const records = await wave;

  assert.equal(maxActive, 2);
  assert.deepEqual(starts, packets.map((packet) => packet.id));
  assert.equal(records.length, packets.length);
  assert.ok(records.every((record) => record.status === 'succeeded' && record.exitCode === 0));
  assert.deepEqual(records.map((record) => record.output), packets.map((packet) => `output:${packet.id}`));
  assert.deepEqual(records.map((record) => record.result), packets.map((packet) => `result:${packet.id}`));
});

test('dispatch cap precedence is CLI, registry, local default four, then unchanged non-local width', () => {
  assert.equal(resolveDispatchMax('local', 9, { registry: dispatchRegistry }), 2);
  assert.equal(resolveDispatchMax('local', 9, { registry: dispatchRegistry, cliMax: '3' }), 3);
  assert.equal(resolveDispatchMax('localDefault', 9, { registry: dispatchRegistry }), 4);
  assert.equal(resolveDispatchMax('remote', 9, { registry: dispatchRegistry }), 9);
});

test('explicit CLI cap is shared across mixed registry lanes and still records every packet', async () => {
  const packets = Array.from({ length: 8 }, (_, index) => ({
    id: `mixed-${index + 1}`,
    agent: index % 2 === 0 ? 'local' : 'localDefault',
  }));
  const releases = [];
  let active = 0;
  let maxActive = 0;

  // Both fake agent ids represent local lanes, but --max three is deliberately
  // a shared wave budget. The fourth packet must wait even though its own lane
  // would otherwise have an available registry-default slot.
  const wave = dispatchPacketWave(packets, {
    registry: dispatchRegistry,
    cliMax: 3,
    runPacket: (packet) => new Promise((resolve) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      releases.push(() => {
        active -= 1;
        resolve({ exitCode: 0, output: `mixed-output:${packet.id}` });
      });
    }),
  });

  await nextTurn();
  assert.equal(releases.length, 3);
  for (let index = 0; index < packets.length; index += 1) {
    releases[index]();
    await nextTurn();
  }
  const records = await wave;

  assert.equal(maxActive, 3);
  assert.equal(records.length, packets.length);
  assert.deepEqual(records.map((record) => record.packetId), packets.map((packet) => packet.id));
  assert.ok(records.every((record) => record.status === 'succeeded' && record.output.startsWith('mixed-output:')));
});

test('invalid CLI and registry caps reject before any worker launches', async () => {
  let launches = 0;
  const packets = [{ id: 'PK-invalid', agent: 'local' }];
  const runPacket = async () => {
    launches += 1;
    return { exitCode: 0, output: 'should-not-run' };
  };

  await assert.rejects(
    dispatchPacketWave(packets, { registry: dispatchRegistry, cliMax: 0, runPacket }),
    /--max must be a positive whole number/,
  );

  const badRegistry = structuredClone(dispatchRegistry);
  badRegistry.agents.local.dispatch.maxConcurrent = 1.5;
  await assert.rejects(
    dispatchPacketWave(packets, { registry: badRegistry, runPacket }),
    /agents\.json local\.dispatch\.maxConcurrent must be a positive whole number/,
  );
  assert.equal(launches, 0);
});

test('single-packet and non-local dispatch retain immediate launch behavior', async () => {
  const remotePackets = Array.from({ length: 5 }, (_, index) => ({ id: `remote-${index + 1}`, agent: 'remote' }));
  let active = 0;
  let maxActive = 0;

  // A tiny asynchronous completion window lets every uncapped remote packet
  // enter before any leaves, demonstrating that WF-G42 did not impose four on it.
  const records = await dispatchPacketWave(remotePackets, {
    registry: dispatchRegistry,
    runPacket: async (packet) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await nextTurn();
      active -= 1;
      return { exitCode: 0, output: `remote-output:${packet.id}` };
    },
  });

  assert.equal(maxActive, remotePackets.length);
  assert.equal(records.length, remotePackets.length);

  const single = await dispatchPacketWave([{ id: 'single', agent: 'local' }], {
    registry: dispatchRegistry,
    runPacket: async () => ({ exitCode: 0, output: 'single-output' }),
  });
  assert.equal(single[0].status, 'succeeded');
  assert.equal(single[0].output, 'single-output');
});

test('a non-zero fake worker exit is surfaced with packet id, status, output, and result', async () => {
  const [record] = await dispatchPacketWave([{ id: 'PK-fail', agent: 'local' }], {
    registry: dispatchRegistry,
    runPacket: async () => ({ exitCode: 17, output: 'fake stderr log', result: 'fake worker rejected input' }),
  });

  assert.deepEqual(record, {
    packetId: 'PK-fail',
    agent: 'local',
    status: 'failed',
    exitCode: 17,
    signal: null,
    output: 'fake stderr log',
    result: 'fake worker rejected input',
  });
});
