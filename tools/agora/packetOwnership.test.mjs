import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  analyzePacketOwnership,
  checkPlanOwnership,
  formatPacketOwnershipReport,
  handoffPromptBlock,
  packetTaskIds,
  validateOwnershipDeclarations,
} from './packetOwnership.mjs';
import { createAgoraServer } from './server.mjs';

const bridge = 'src/utils/combat/combatUtils.ts';
const leaves = [
  'src/components/DesignPreview/steps/raceDomain/leaves/chthonicTieflingRaceLeaf.tsx',
  'src/components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx',
  'src/components/DesignPreview/steps/raceDomain/leaves/firbolgRaceLeaf.tsx',
  'src/components/DesignPreview/steps/raceDomain/leaves/copperDragonbornRaceLeaf.tsx',
];
const boardTasks = [
  { id: 'agora-ddb7', refs: [leaves[0]] },
  { id: 'agora-0ad6', refs: leaves.slice(1) },
];

function historicalPlan() {
  return {
    packets: [
      { id: 'PK-02', files: [bridge], issues: ['agora-ddb7', 'agora-0ad6'] },
    ],
  };
}

test('WF-G209: a source packet must also own its existing sibling regression test', () => {
  const source = 'src/services/EntityResolverService.ts';
  const siblingTest = 'src/services/__tests__/EntityResolverService.test.ts';
  const generationTest = 'src/services/__tests__/EntityResolverServiceGeneration.test.ts';
  assert.ok(fs.existsSync(source));
  assert.ok(fs.existsSync(siblingTest));
  assert.ok(fs.existsSync(generationTest));
  const plan = { packets: [{ id: 'PK-10', files: [source] }] };
  const missing = analyzePacketOwnership(plan);
  assert.equal(missing.ok, false);
  assert.match(formatPacketOwnershipReport(missing), /PK-10.*EntityResolverService\.ts.*EntityResolverService\.test\.ts.*same packet/);
  assert.match(formatPacketOwnershipReport(missing), /EntityResolverServiceGeneration\.test\.ts.*same packet/);

  plan.packets[0].files.push(siblingTest);
  assert.equal(analyzePacketOwnership(plan).ok, false, 'generation coverage is still unowned');
  plan.packets[0].files.push(generationTest);
  assert.equal(analyzePacketOwnership(plan).ok, true);
  plan.packets[0].files.splice(1);
  plan.packets.push({ id: 'PK-tests', files: [siblingTest] });
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan)), /same packet/);
});

test('WF-G209: named sibling tests also count as existing regression coverage', () => {
  const plan = { packets: [{ id: 'PK-combat', files: [bridge] }] };
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /combatUtils\.devPlaytest\.test\.ts/);
  assert.match(formatPacketOwnershipReport(report), /combatUtils\.subclassAndTerrain\.test\.ts/);
});

test('WF-G225 reproduces the live PK-02 mismatch from its claimed task refs', () => {
  const report = analyzePacketOwnership(historicalPlan(), boardTasks);
  assert.deepEqual(packetTaskIds(historicalPlan().packets[0]), ['agora-ddb7', 'agora-0ad6']);
  assert.equal(report.ok, false);
  assert.equal(report.checkedTasks, 2);
  assert.equal(report.errors.filter((message) => message.includes('outside its owned files:')).length, 4);
  for (const file of leaves) assert.ok(formatPacketOwnershipReport(report).includes(file));
  assert.match(formatPacketOwnershipReport(report), /no sibling packet owns it/);
});

test('a sibling may own the refs only with an explicit breakage handoff in the prompt', () => {
  const plan = historicalPlan();
  plan.packets[0].files.push('src/utils/combat/__tests__/combatUtils*.test.ts');
  plan.packets.push({ id: 'PK-leaves', files: [
    ...leaves,
    ...leaves.map((file) => file.replace('/leaves/', '/leaves/__tests__/').replace(/\.tsx$/, '.test.tsx')),
  ] });
  const withoutHandoff = analyzePacketOwnership(plan, boardTasks);
  assert.equal(withoutHandoff.ok, false);
  assert.match(formatPacketOwnershipReport(withoutHandoff), /owned by PK-leaves; add an explicit handoff/);

  plan.packets[0].handoffs = leaves.map((ref) => ({
    ref,
    toPacket: 'PK-leaves',
    expectedBreakage: 'Leaf tests remain red until PK-leaves removes duplicate defenses.',
  }));
  const withHandoff = analyzePacketOwnership(plan, boardTasks);
  assert.equal(withHandoff.ok, true, formatPacketOwnershipReport(withHandoff));
  assert.equal(withHandoff.findings.filter((item) => item.status === 'delegated').length, 4);
  assert.match(handoffPromptBlock(plan.packets[0]), /sibling packet PK-leaves/);
  assert.match(handoffPromptBlock(plan.packets[0]), /Leaf tests remain red/);
});

test('a direct packet file ref outside ownership is checked without a live task lookup', async () => {
  const plan = { packets: [{ id: 'PK-1', files: [bridge], refs: [leaves[0]] }] };
  const report = await checkPlanOwnership(plan, {
    boardLocks: [],
    fetchImpl: () => { throw new Error('should not fetch tasks'); },
  });
  assert.equal(report.ok, false);
  assert.equal(report.checkedTasks, 0);
  assert.ok(report.errors.some((message) => /packet refs names/.test(message)));
});

test('WF-G317: a new packet cannot claim a file already locked by an earlier wave', () => {
  const scene = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
  const nodes = 'src/systems/entities3d/three/gpu/toonNodes.ts';
  const plan = {
    packets: [{ id: 'W14-B', files: [scene, nodes] }],
  };
  const locks = [
    { id: 'deb614de', agentId: 'w13-gpu-nameplates', reason: 'W13-C', paths: [scene], globs: [] },
    { id: 'glob-lock', agentId: 'w13-gpu-nameplates', reason: 'W13-C', paths: [], globs: ['src/systems/entities3d/three/gpu/*.ts'] },
  ];
  const report = analyzePacketOwnership(plan, [], locks);
  assert.equal(report.ok, false);
  assert.equal(report.errors.filter((message) => message.includes('active Agora lock')).length, 2);
  assert.match(formatPacketOwnershipReport(report), /W14-B.*BattleMap3DGpuScene\.tsx.*deb614de.*w13-gpu-nameplates/);
  assert.match(formatPacketOwnershipReport(report), /W14-B.*toonNodes\.ts.*glob-lock/);
});

test('WF-G317: sibling packet globs and exact files are overlapping ownership', () => {
  const scene = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
  const plan = {
    packets: [
      { id: 'W13-C', files: ['src/components/BattleMap/*.tsx'] },
      { id: 'W14-B', files: [scene] },
    ],
  };
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /W13-C.*W14-B/);
});

test('a packet glob satisfies its own task file reference', () => {
  const scene = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
  const plan = { packets: [{ id: 'W14-B', files: [
    'src/components/BattleMap/*.tsx',
    'src/components/BattleMap/__tests__/*.test.*',
  ], taskIds: ['agora-317a'] }] };
  const report = analyzePacketOwnership(plan, [{ id: 'agora-317a', refs: [scene] }]);
  assert.equal(report.ok, true, formatPacketOwnershipReport(report));
});

test('WF-G317: partition reads live locks even when the plan claims no existing tasks', async () => {
  const calls = [];
  const plan = { baseUrl: 'http://localhost:4319', packets: [{ id: 'W14-B', files: [bridge] }] };
  const report = await checkPlanOwnership(plan, {
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ locks: [{ id: 'lock-1', agentId: 'other', paths: [bridge], globs: [] }] }) };
    },
  });
  assert.deepEqual(calls, ['http://localhost:4319/locks']);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /W14-B.*lock-1/);
});

test('WF-G317: an unavailable or malformed lock list blocks dispatch', async () => {
  const plan = { baseUrl: 'http://localhost:4319', packets: [{ id: 'W14-B', files: [bridge] }] };
  await assert.rejects(
    () => checkPlanOwnership(plan, { fetchImpl: async () => { throw new Error('offline'); } }),
    /could not reach live Agora locks: offline/,
  );
  await assert.rejects(
    () => checkPlanOwnership(plan, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /no locks array/,
  );
});

test('missing or multiply claimed live tasks fail rather than silently narrowing coverage', () => {
  const plan = historicalPlan();
  assert.ok(analyzePacketOwnership(plan, []).errors.some((message) => /absent from the live board/.test(message)));
  plan.packets.push({ id: 'PK-other', files: ['src/other.ts'], taskIds: ['agora-ddb7'] });
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan, boardTasks)), /claimed by both PK-02 and PK-other/);
});

test('handoffs must name a real sibling owner and cannot be stale', () => {
  const plan = historicalPlan();
  plan.packets.push({ id: 'PK-owner', files: [leaves[0]] });
  plan.packets.push({ id: 'PK-other', files: ['src/other.ts'] });
  plan.packets[0].handoffs = [{
    ref: leaves[0], toPacket: 'PK-other', expectedBreakage: 'the leaf test remains red',
  }];
  const report = analyzePacketOwnership(plan, boardTasks);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /handoff names PK-other/);
  assert.match(formatPacketOwnershipReport(report), /unused or stale handoff/);

  plan.packets[0].handoffs[0].toPacket = 'PK-not-in-plan';
  assert.throws(() => validateOwnershipDeclarations(plan), /each handoff needs/);
});

test('the read-only check rejects malformed board data and accepts supplied task evidence', async () => {
  const plan = historicalPlan();
  await assert.rejects(
    () => checkPlanOwnership(plan, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /no tasks array/,
  );
  const report = await checkPlanOwnership(plan, { boardTasks });
  assert.equal(report.checkedTasks, 2);
  assert.equal(report.ok, false);
});

test('partition CLI reports the mismatch and makes no board writes', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url === '/locks' ? { locks: [] } : { tasks: boardTasks }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg225-cli-'));
  try {
    const plan = {
      ...historicalPlan(),
      wave: 'wfg225-cli-fixture',
      pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + server.address().port,
    };
    plan.packets[0] = {
      ...plan.packets[0],
      handle: 'wfg225-worker',
      pet: 'dream-girl',
      agent: 'claude',
      scope: 'bridge packet',
    };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', 'partition', planFile], {
        cwd: repoRoot,
      });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /Partition ownership: 2 claimed task\(s\), 4 file ref\(s\), \d+ error\(s\)/);
    assert.match(result.output, /PK-02 task agora-ddb7 names/);
    assert.deepEqual(requests, ['GET /tasks', 'GET /locks']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('WF-G209: partition and seed block a source-only packet; a widened prompt owns and locks the test', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg209-live-'));
  const app = createAgoraServer({ dir: path.join(fixtureDir, 'server') });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    const source = 'src/services/EntityResolverService.ts';
    const siblingTest = 'src/services/__tests__/EntityResolverService.test.ts';
    const generationTest = 'src/services/__tests__/EntityResolverServiceGeneration.test.ts';
    const plan = {
      wave: 'wfg209-live', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + app.server.address().port,
      packets: [{ id: 'PK-10', handle: 'wfg209-worker', pet: 'dream-girl', agent: 'claude',
        scope: 'Entity resolver repair', files: [source] }],
    };
    const planFile = path.join(fixtureDir, 'plan.json');
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const runCommand = (command, packetId) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath,
        ['tools/agora/orchestrate.mjs', command, planFile, ...(packetId ? [packetId] : [])],
        { cwd: repoRoot });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    fs.writeFileSync(planFile, JSON.stringify(plan));
    for (const command of ['partition', 'seed', 'dispatch']) {
      const result = await runCommand(command);
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /EntityResolverService\.test\.ts.*same packet/);
      assert.deepEqual(app.store.listTasks(), [], command + ' must not create tasks');
      assert.deepEqual(app.store.listCampaigns(), [], command + ' must not claim a campaign');
      assert.deepEqual(app.store.listAgents(), [], command + ' must not register an agent');
    }

    plan.packets[0].files.push(siblingTest);
    plan.packets[0].files.push(generationTest);
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const partition = await runCommand('partition');
    assert.equal(partition.code, 0, partition.output);
    const prompt = await runCommand('prompt', 'PK-10');
    assert.equal(prompt.code, 0, prompt.output);
    assert.ok(prompt.output.includes('Owned files (edit ONLY these): `' + source + '`, `' + siblingTest + '`, `' + generationTest + '`'));
    assert.ok(prompt.output.includes('lock ' + source + ' ' + siblingTest + ' ' + generationTest));
  } finally {
    await app.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('WF-G317: partition, seed, and dispatch refuse an earlier wave\'s live lock before writing or launching', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg317-live-'));
  const app = createAgoraServer({ dir: path.join(fixtureDir, 'server') });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    const holder = app.store.registerAgent({ handle: 'w13-gpu-nameplates', petSlug: 'cyberman' });
    const owned = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
    const lock = app.store.acquireLock({ agentId: holder.id, paths: [owned], reason: 'W13-C' });
    assert.equal(lock.ok, true);
    const plan = {
      wave: 'wfg317-live', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + app.server.address().port,
      packets: [{ id: 'W14-B', handle: 'w14-b', pet: 'dream-girl', agent: 'claude', scope: 'GPU follow-up', files: [owned] }],
    };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const runCommand = (command) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile], { cwd: repoRoot });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    for (const command of ['partition', 'seed', 'dispatch']) {
      const result = await runCommand(command);
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /W14-B.*BattleMap3DGpuScene\.tsx.*W13-C/);
      assert.ok(result.output.includes(holder.id), command + ' must identify the lock holder');
      assert.deepEqual(app.store.listTasks(), [], command + ' must not create tasks');
      assert.deepEqual(app.store.listCampaigns(), [], command + ' must not claim a campaign');
      assert.equal(app.store.listAgents().length, 1, command + ' must not register a second agent');
    }
  } finally {
    await app.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
