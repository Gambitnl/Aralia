// Tests for the orchestrator's pure logic: plan validation (disjointness is the
// safety invariant), coordination-prompt generation, and bounded CLI dispatch.
// Fake workers prove queue and terminal-result behavior without spending quota
// or starting any real external model process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAgoraServer } from './server.mjs';
import {
  validatePlan,
  buildPrompt,
  packetVerificationNotes,
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
