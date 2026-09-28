import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';
import { OPEN_STATUSES, parseGapsMarkdown } from './gapIndex.mjs';

test('WF-G259: a daemon repair stays open and listable until post-restart resolution', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg259-'));
  const repoRoot = path.join(root, 'repo');
  const registryFile = path.join(repoRoot, 'tools', 'agora', 'WORKFLOW_GAPS.md');
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  fs.writeFileSync(registryFile, [
    '---',
    'schema_version: 1',
    'id_prefix: WF-G',
    'next_free_id: WF-G51',
    'allowed_statuses: [open, pending_restart, resolved]',
    '---',
    '## Registry',
    '| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    '| WF-G50 | open | medium | daemon | agora-daemon | fixture | claude | fixture-id | fixture-task | 2026-09-23 | daemon retry is not loaded yet | worktree test passes | reader needs live status | restart daemon | live request succeeds | — |',
    '',
  ].join('\n'));
  let app = createAgoraServer({ dir: path.join(root, 'state'), gapsRepoRoot: repoRoot, seatRosterPath: null });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    let baseUrl = 'http://127.0.0.1:' + app.server.address().port;
    const env = { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'wfg259-fixture', AGORA_PET: 'gf-sd' };
    const call = (argv) => run(argv, { env, baseUrl });
    const registration = await call(['register', 'wfg259-fixture', '--pet', 'gf-sd', '--session', 'wfg259-fixture-task']);
    assert.equal(registration.code, 0, registration.lines.join('\n'));
    const token = registration.identity.token;

    const missingNote = await call(['gap', 'pending-restart', 'WF-G50', '--project', 'workflow']);
    assert.equal(missingNote.code, 1);
    assert.equal(parseGapsMarkdown(fs.readFileSync(registryFile, 'utf8'))[0].status, 'open');

    const pending = await call(['gap', 'pending-restart', 'WF-G50', '--project', 'workflow', '--note', 'server.mjs repair passes local tests']);
    assert.equal(pending.code, 0, pending.lines.join('\n'));
    assert.equal(parseGapsMarkdown(fs.readFileSync(registryFile, 'utf8'))[0].status, 'pending_restart');
    assert.equal(OPEN_STATUSES.has('pending_restart'), true);
    const openBefore = await fetch(baseUrl + '/gaps?project=workflow&open=1').then((response) => response.json());
    assert.ok(openBefore.gaps.some((gap) => gap.id === 'WF-G50' && gap.status === 'pending_restart'));
    const listed = await call(['gap', 'pending-restart', '--project', 'workflow']);
    assert.equal(listed.code, 0, listed.lines.join('\n'));
    assert.match(listed.lines.join('\n'), /WF-G50.*daemon retry is not loaded yet/);

    await app.close();
    app = createAgoraServer({ dir: path.join(root, 'state'), gapsRepoRoot: repoRoot, seatRosterPath: null });
    await new Promise((resolve) => app.listen(0, resolve));
    baseUrl = 'http://127.0.0.1:' + app.server.address().port;
    const openAfter = await fetch(baseUrl + '/gaps?project=workflow&open=1').then((response) => response.json());
    assert.ok(openAfter.gaps.some((gap) => gap.id === 'WF-G50' && gap.status === 'pending_restart'),
      'restart alone must not claim a repair is verified');

    const resolved = await call(['gap', 'resolve', 'WF-G50', '--project', 'workflow', '--token', token, '--note', 'post-restart live request passes']);
    assert.equal(resolved.code, 0, resolved.lines.join('\n'));
    assert.equal(parseGapsMarkdown(fs.readFileSync(registryFile, 'utf8'))[0].status, 'resolved');
    const pendingAfter = await call(['gap', 'pending-restart', '--project', 'workflow']);
    assert.equal(pendingAfter.code, 0);
    assert.doesNotMatch(pendingAfter.lines.join('\n'), /WF-G50/);
  } finally {
    await app.close();
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
