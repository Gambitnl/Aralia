// Tests for the orchestrator's pure logic: plan validation (disjointness is the
// safety invariant), coordination-prompt generation, and bounded CLI dispatch.
// Fake workers prove queue and terminal-result behavior without spending quota
// or starting any real external model process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePlan,
  buildPrompt,
  dispatchPacketWave,
  resolveDispatchMax,
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
