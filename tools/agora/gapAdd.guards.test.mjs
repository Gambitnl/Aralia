// tools/agora/gapAdd.guards.test.mjs
// The guards agora-bf4d.7 put in front of a gap-registry write.
//
// WF-G205 / WF-G184 — `gap add` used to accept a missing Suggested agent and
// write the registry's em dash, which the registry's OWN validator then
// rejected. Every filed row made gapIndex.test.mjs redder, so a real provenance
// fault would have been invisible inside the noise.
//
// WF-G200 — three workers filed the same defect as WF-G189, WF-G192 and
// WF-G196 inside one hour, because nothing compared a new row against the open
// ones.
//
// WF-G206 / WF-G180 — an open() of a repo file fails at random on this Windows
// host with UNKNOWN / EBUSY / EPERM while another process holds a short-lived
// handle on it, and the daemon reported it as a bare 500 with no cause and no
// advice to retry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  agentRegistryKeys,
  gapRegistryProjects,
  gapTokens,
  gapOverlap,
  findNearDuplicateGaps,
  run,
} from './client.mjs';
import { withOpenRetry } from './gapAppend.mjs';
import { readAllowedVocabularies, validateWorkflowGapRows, CLOSED_STATUSES } from './gapIndex.mjs';

test('WF-G244: invalid gap project is refused before classification or a network write', async () => {
  const projects = gapRegistryProjects();
  assert.ok(projects.includes('global'));
  assert.ok(projects.includes('workflow'));
  assert.ok(projects.includes('spells'));
  assert.ok(!projects.includes('aralia'));

  const result = await run([
    'gap', 'add', '--project', 'aralia', '--gap', 'invalid project probe',
    '--evidence', 'no registry', '--why', 'misrouted gap', '--next', 'choose registry',
    '--proof', 'clean refusal', '--suggested-agent', 'claude', '--surface', 'agora-client', '--force',
  ], {
    baseUrl: 'http://127.0.0.1:1',
    env: { AGORA_AGENT_ID: 'wfg244-noidentity', AGORA_DIR: path.join(os.tmpdir(), 'agora-wfg244-noidentity') },
  });
  assert.equal(result.code, 1);
  assert.match(result.lines.join('\n'), /gap add refused: --project "aralia" has no gap registry/);
  assert.match(result.lines.join('\n'), /Available registries: global, workflow/);
  assert.doesNotMatch(result.lines.join('\n'), /No --classification|not registered|daemon not reachable|ReferenceError/);
});

test('WF-G253: a board task id cannot be filed as a repair surface', async () => {
  const result = await run([
    'gap', 'add', '--project', 'workflow', '--gap', 'task-id surface probe',
    '--evidence', 'board task id', '--why', 'misroutes repair', '--next', 'choose surface',
    '--proof', 'clean refusal', '--suggested-agent', 'claude', '--surface', 'agora-6acd', '--force',
  ], {
    baseUrl: 'http://127.0.0.1:1',
    env: { AGORA_AGENT_ID: 'wfg253-noidentity', AGORA_DIR: path.join(os.tmpdir(), 'agora-wfg253-noidentity') },
  });
  assert.equal(result.code, 1);
  assert.match(result.lines.join('\n'), /gap add refused: --surface "agora-6acd" is a board task id/);
  assert.match(result.lines.join('\n'), /--detected-during agora-6acd/);
  assert.doesNotMatch(result.lines.join('\n'), /Filed |not registered|daemon not reachable/);
});

test('WF-G216: gap add help lists the current accepted routing lanes before filing', async () => {
  const result = await run(['gap', 'add', '--help'], { baseUrl: 'http://127.0.0.1:1' });
  assert.equal(result.code, 1);
  assert.match(result.lines.join('\n'), /--suggested-agent is REQUIRED/);
  assert.match(result.lines.join('\n'), /Accepted --suggested-agent values: .*claude.*human-operator/);
});

// --------------------------------------------------------------- WF-G205
test('agentRegistryKeys returns the agents.json keys plus human-operator (WF-G205)', () => {
  const keys = agentRegistryKeys();
  assert.ok(keys.includes('claude'), 'the default repair lane must be an accepted value');
  assert.ok(keys.includes('human-operator'), 'hard rule 3 allows human-operator');
  assert.ok(!keys.includes('agora-daemon'), 'a service is not an agents.json key (WF-G184)');
  assert.deepEqual(keys, [...keys].sort(), 'the list is printed in a refusal, so it must be ordered');
});

test('the live workflow registry declares its vocabularies and every row passes (WF-G204, WF-G205)', () => {
  const file = path.resolve(import.meta.dirname, 'WORKFLOW_GAPS.md');
  const text = fs.readFileSync(file, 'utf8');
  const vocab = readAllowedVocabularies(text);
  // WF-G204: the header had been lost entirely, so every closed-vocabulary
  // check was silently skipped.
  // Surface is an OPEN namespace and carries no allowed_ list on purpose:
  // closing it made the registry go red every time a sibling filed a row for a
  // part of the system the header had not met yet (WF-G204, second pass).
  assert.equal(vocab.surface, undefined, 'Surface must stay an open namespace');
  for (const field of ['status', 'severity', 'classification']) {
    assert.ok(vocab[field] && vocab[field].size, `allowed list for ${field} is missing from the header`);
  }
  assert.match(text, /^next_free_id: WF-G\d+$/m);
  assert.ok(!vocab.classification.has('\u2014'), 'an em dash is not a classification (WF-G205 swept them)');
});

test('duplicate is a CLOSED status, so a merged row falls out of the open count (WF-G200)', () => {
  assert.ok(CLOSED_STATUSES.has('duplicate'));
});

test('validateWorkflowGapRows still rejects an em-dash Suggested agent (WF-G184)', () => {
  const errors = validateWorkflowGapRows(
    [{
      id: 'WF-G999',
      status: 'open',
      severity: 'medium',
      classification: 'workflow',
      surface: 'agora-client',
      suggestedAgent: '\u2014',
      registeredBy: 'w0b-agora-fixes',
      registrantAgentId: '089c11ea-5b7a-41f2-94c7-a63bfd448046',
      registrantTaskId: 'agora-bf4d.7',
    }],
    { allowedAgentIds: ['claude'] },
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Suggested agent must be an agents\.json key/);
});

// --------------------------------------------------------------- WF-G200
test('gapTokens drops stop words and short words so overlap measures the defect (WF-G200)', () => {
  const tokens = gapTokens('task edit --append-body always returns 400 nothing to edit');
  assert.ok(tokens.has('append'), 'the distinctive words survive');
  assert.ok(!tokens.has('task'), 'a word every gap row carries cannot distinguish two rows');
  assert.ok(!tokens.has('to'), 'a word under four letters is noise');
});

test('findNearDuplicateGaps finds the three rows one defect was filed as (WF-G200)', () => {
  // The real WF-G189 / WF-G192 / WF-G196 texts, shortened.
  const open = [
    { id: 'WF-G189', status: 'open', gap: 'task edit --append-body is documented in the help text but the server rejects every call with 400 nothing to edit' },
    { id: 'WF-G192', status: 'open', gap: 'task edit --append-body returns 400 nothing to edit: every named field already has that value' },
    { id: 'WF-G201', status: 'open', gap: 'the dashboard renders a campaign chart without an axis label' },
  ];
  const matches = findNearDuplicateGaps('task edit --append-body always answers 400 nothing to edit', open);
  assert.equal(matches.length, 2, matches.map((m) => m.gap.id).join(', '));
  assert.deepEqual(matches.map((m) => m.gap.id).sort(), ['WF-G189', 'WF-G192']);
  assert.ok(matches[0].score >= matches[1].score, 'the closest match is reported first');
});

test('the measure is containment, because Jaccard could not separate the real rows (WF-G200)', () => {
  // Measured live on 2026-09-20 against the open workflow rows. A one-line
  // restatement of WF-G189 scored 0.29 by Jaccard — under any usable
  // threshold — because the existing row is three times longer and length
  // alone sank the score. The first tuning of this check let that duplicate
  // straight through and filed WF-G254.
  const short = 'task edit --append-body returns 400 nothing to edit on every call';
  const long = 'task edit --append-body is documented in the help text but the server rejects every call with 400 nothing to edit: every named field already has that value';
  assert.ok(gapOverlap(short, long) >= 0.75, `containment was ${gapOverlap(short, long)}`);
  // The nearest UNRELATED row of that same registry must stay well below it.
  const unrelated = 'The WF-G129 lock warning tells the agent to run git diff on a file it has just called untracked';
  assert.ok(gapOverlap(short, unrelated) < 0.6, `containment was ${gapOverlap(short, unrelated)}`);
});

test('a two-word coincidence is not a duplicate (WF-G200)', () => {
  // Containment scores 1.0 whenever the shorter side is fully contained, so a
  // very short probe would otherwise match almost everything.
  const open = [{ id: 'WF-G189', status: 'open', gap: 'task edit --append-body returns 400 nothing to edit: every named field already has that value' }];
  assert.deepEqual(findNearDuplicateGaps('append body', open), []);
});

test('an unrelated gap is not a near duplicate (WF-G200)', () => {
  const open = [{ id: 'WF-G189', status: 'open', gap: 'task edit --append-body returns 400 nothing to edit' }];
  assert.deepEqual(findNearDuplicateGaps('the mountain shader renders black at noon', open), []);
  assert.equal(gapOverlap('', 'anything'), 0, 'an empty text overlaps nothing');
});

// --------------------------------------------------------------- WF-G206
test('withOpenRetry retries a transient open failure and then succeeds (WF-G206)', () => {
  let calls = 0;
  const slept = [];
  const value = withOpenRetry('C:/x/WORKFLOW_GAPS.md', () => {
    calls++;
    if (calls < 3) {
      const e = new Error('UNKNOWN: unknown error, open');
      e.code = 'UNKNOWN';
      throw e;
    }
    return 'the file';
  }, { sleep: (ms) => slept.push(ms) });
  assert.equal(value, 'the file');
  assert.equal(calls, 3);
  assert.deepEqual(slept, [50, 100], 'the backoff grows between attempts');
});

test('withOpenRetry names the file, the errno and the likely holder when the budget runs out (WF-G206)', () => {
  const failing = () => {
    const e = new Error('EBUSY: resource busy or locked, open');
    e.code = 'EBUSY';
    throw e;
  };
  assert.throws(
    () => withOpenRetry('F:/Repos/Aralia/tools/agora/WORKFLOW_GAPS.md', failing, { attempts: 3, sleep: () => {} }),
    (err) => {
      // The bare "UNKNOWN: unknown error" reads as a refusal and made agents
      // either stop or file the row twice.
      assert.match(err.message, /WORKFLOW_GAPS\.md/);
      assert.match(err.message, /EBUSY after 3 attempts/);
      assert.match(err.message, /dashboard polling the registry, an editor, or a virus scanner/);
      assert.equal(err.transient, true, 'the daemon answers 503 on this flag, not 500');
      return true;
    },
  );
});

test('withOpenRetry rethrows a NON-transient error at once (WF-G206)', () => {
  let calls = 0;
  assert.throws(
    () => withOpenRetry('C:/x/missing.md', () => {
      calls++;
      const e = new Error('ENOENT: no such file or directory');
      e.code = 'ENOENT';
      throw e;
    }, { sleep: () => { throw new Error('must not sleep'); } }),
    /ENOENT/,
  );
  assert.equal(calls, 1, 'a missing file is not going to appear; retrying it wastes the caller\'s time');
});

// --------------------------------------------------- the real append path
test('appendGapRow reads and writes through the retry path (WF-G206)', async () => {
  const { appendGapRow } = await import('./gapAppend.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-gapretry-'));
  const file = path.join(dir, 'WORKFLOW_GAPS.md');
  try {
    fs.writeFileSync(file, [
      '---',
      'id_prefix: WF-G',
      'next_free_id: WF-G10',
      '---',
      '',
      '## Registry',
      '| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| WF-G9 | open | low | workflow | agora-client | me | claude | id | task | 2026-09-20 | a | b | c | d | e | f |',
      '',
    ].join('\n'));
    const result = appendGapRow(file, {
      gap: 'a new row', suggestedAgent: 'claude', severity: 'medium', classification: 'workflow', surface: 'agora-client',
      registeredBy: 'w0b-agora-fixes', registrantAgentId: 'id', registrantTaskId: 'agora-bf4d.7',
    }, { repoRoot: dir });
    assert.equal(result.id, 'WF-G10');
    const after = fs.readFileSync(file, 'utf8');
    assert.match(after, /\| WF-G10 \|/);
    assert.match(after, /next_free_id: WF-G11/, 'the declared next id stays ahead of the row just filed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
