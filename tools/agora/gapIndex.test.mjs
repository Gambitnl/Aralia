// Tests for the GAPS.md → JSON gap index (the tracker bridge orchestrators use
// to intake open gaps programmatically instead of reading markdown trees).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  parseGapsMarkdown,
  indexGaps,
  OPEN_STATUSES,
  validateWorkflowGapRows,
  readAllowedVocabularies,
} from './gapIndex.mjs';

const SAMPLE = `---
gap_schema: v2
---
# Spells — GAPS

Some prose the parser must ignore.

| Gap ID | Status | Severity | Classification | Owner | Gap | Evidence | Why it matters | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G10 | resolved | high | mechanics | worker-1 | Concentration breaks | 34 files / 67 tests | core sustain | none |
| G12 | in_progress | medium | execution-path | worker-2 | Upcast ignores slots | src/spells/upcast.ts:40 | wrong damage | wire slot level |
| G14 | blocked | critical | blocked_human_decision | — | Summon HP ambiguous | DECISIONS.md D9 pending | crashes fights | await D9 |

## Another section

| Not | A | Gaps | Table |
| - | - | - | - |
| x | y | z | w |
`;

test('WF-G259 pending_restart is an open, declared workflow status', () => {
  assert.equal(OPEN_STATUSES.has('pending_restart'), true);
  const workflowFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'WORKFLOW_GAPS.md');
  const vocab = readAllowedVocabularies(fs.readFileSync(workflowFile, 'utf8'));
  assert.equal(vocab.status.has('pending_restart'), true);
});

function tmpTree() {
  const root = path.join(os.tmpdir(), 'gapindex-test', crypto.randomUUID());
  fs.mkdirSync(path.join(root, 'spells'), { recursive: true });
  fs.mkdirSync(path.join(root, 'worldforge', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'spells', 'GAPS.md'), SAMPLE);
  fs.writeFileSync(
    path.join(root, 'worldforge', 'sub', 'GAPS.md'),
    '| Gap ID | Status | Gap | Next action |\n|-|-|-|-|\n| G1 | open | seams pop | stitch windows |\n',
  );
  fs.writeFileSync(path.join(root, 'worldforge', 'NOTES.md'), '| Gap ID | Status |\n|-|-|\n| GX | open |\n');
  return root;
}

test('parseGapsMarkdown extracts rows from the Gap ID table only', () => {
  const rows = parseGapsMarkdown(SAMPLE);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.id), ['G10', 'G12', 'G14']);
  assert.equal(rows[1].status, 'in_progress');
  assert.equal(rows[1].severity, 'medium');
  assert.equal(rows[1].gap, 'Upcast ignores slots');
  assert.equal(rows[1].nextAction, 'wire slot level');
  assert.equal(rows[2].classification, 'blocked_human_decision');
});

test('workflow gap fields identify both the best repair agent and the registrant', () => {
  const md = `| Gap ID | Status | Suggested agent | Registered by | Registrant ID | Task/thread | Gap |
|---|---|---|---|---|---|---|
| WF-G99 | open | claude | claude.capture-owner | 123e4567-e89b-42d3-a456-426614174000 | thread-99 | orphaned capture process |`;
  const [row] = parseGapsMarkdown(md);

  assert.equal(row.suggestedAgent, 'claude');
  assert.equal(row.registeredBy, 'claude.capture-owner');
  assert.equal(row.registrantAgentId, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(row.registrantTaskId, 'thread-99');
  assert.deepEqual(validateWorkflowGapRows([row], { allowedAgentIds: ['claude'] }), []);
});

test('workflow gap validation rejects generic registrants and unknown executor lanes', () => {
  const errors = validateWorkflowGapRows([{
    id: 'WF-G100',
    suggestedAgent: 'mystery-agent',
    registeredBy: 'orchestrator (violet-mage)',
    registrantAgentId: 'short-id',
    registrantTaskId: '',
  }], { allowedAgentIds: ['claude'] });

  assert.equal(errors.length, 4);
  assert.ok(errors.some((error) => error.includes('agents.json')));
  assert.ok(errors.some((error) => error.includes('generic role label')));
  assert.ok(errors.some((error) => error.includes('full Agora UUID')));
  assert.ok(errors.some((error) => error.includes('Task/thread')));
});

test('gapIndex.workflowGaps: the real WORKFLOW_GAPS.md parses; archive rows are NOT indexed', () => {
  // Every live registry row must remain a well-formed workflow gap with enough
  // assignment and provenance data for an orchestrator to route it safely.
  const gaps = indexGaps({ root: 'tools/agora' });
  assert.ok(Array.isArray(gaps), 'registry parses without error');
  assert.ok(gaps.every((g) => /^WF-G\d+$/.test(g.id) && g.project === 'workflow'),
    `unexpected rows: ${JSON.stringify(gaps.map((g) => g.project + ':' + g.id))}`);
  // Archived resolutions must NOT leak into the machine index.
  assert.ok(gaps.every((g) => g.id !== 'WF-G7'), 'archive table is not indexed');
  const agentRegistry = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'agents.json'), 'utf8'));
  assert.deepEqual(
    validateWorkflowGapRows(gaps, { allowedAgentIds: Object.keys(agentRegistry.agents) }),
    [],
    'every live workflow row has valid executor fit and registrant provenance',
  );
});

test('indexGaps walks GAPS.md files, tags project paths, and filters open-only', () => {
  const root = tmpTree();
  const all = indexGaps({ root });
  // NOTES.md is not a GAPS.md — ignored even though it has a Gap ID table.
  assert.equal(all.length, 4);
  const projects = [...new Set(all.map((g) => g.project))].sort();
  assert.deepEqual(projects, ['spells', 'worldforge/sub']);

  const open = indexGaps({ root, openOnly: true });
  assert.deepEqual(open.map((g) => g.id).sort(), ['G1', 'G12', 'G14']); // G10 resolved
  assert.ok(open.every((g) => OPEN_STATUSES.has(g.status)));
  fs.rmSync(root, { recursive: true, force: true });
});

// WF-G87: the registry declares four closed vocabularies in its own frontmatter
// and NOTHING read them. Only Suggested agent was validated, against
// agents.json, so row WF-G80 carried an invented Classification and an invented
// Surface for two days and was found by eye rather than by tooling.
test('WF-G87: allowed_* vocabularies are read from the frontmatter', () => {
  const vocab = readAllowedVocabularies([
    '---',
    'id_prefix: WF-G',
    'allowed_statuses: [open, resolved, wont_fix]',
    'allowed_severities: [low, high]',
    'allowed_classifications: [daemon, docs]',
    'allowed_surfaces: [agora-daemon, gap-index]',
    'unrelated: value',
    '---',
    '# body',
  ].join('\n'));

  assert.deepEqual([...vocab.status], ['open', 'resolved', 'wont_fix']);
  assert.deepEqual([...vocab.severity], ['low', 'high']);
  assert.deepEqual([...vocab.classification], ['daemon', 'docs']);
  assert.deepEqual([...vocab.surface], ['agora-daemon', 'gap-index']);

  // A file with no frontmatter declares nothing, and is therefore not checked.
  assert.deepEqual(readAllowedVocabularies('# just a heading'), {});
  // A frontmatter with no lists likewise yields no vocabulary.
  assert.deepEqual(readAllowedVocabularies('---\nid_prefix: G\n---\nbody'), {});
});

test('WF-G87: a value outside a declared vocabulary is refused, and a valid row passes', () => {
  const vocab = {
    status: new Set(['open', 'resolved']),
    severity: new Set(['low', 'high']),
    classification: new Set(['daemon', 'client-tooling']),
    surface: new Set(['agora-daemon', 'agora-client']),
  };
  const provenance = {
    suggestedAgent: 'claude',
    registeredBy: 'builder-fa2989',
    registrantAgentId: '4b2f171c-3113-4e6d-a593-d657caa1990c',
    registrantTaskId: 'session-1',
  };

  // The exact shape WF-G80 carried before its repair: two invented values.
  const bad = validateWorkflowGapRows([{
    id: 'WF-G80',
    status: 'open',
    severity: 'low',
    classification: 'agent-tooling',
    surface: 'crlf-editing',
    ...provenance,
  }], { allowedAgentIds: ['claude'], vocab });

  assert.equal(bad.length, 2, 'both invented values are reported, not just the first');
  assert.match(bad.join('\n'), /Classification "agent-tooling" is not one of/);
  assert.match(bad.join('\n'), /Surface "crlf-editing" is not one of/);

  // A legal row passes.
  assert.deepEqual(validateWorkflowGapRows([{
    id: 'WF-G99',
    status: 'open',
    severity: 'high',
    classification: 'daemon',
    surface: 'agora-daemon',
    ...provenance,
  }], { allowedAgentIds: ['claude'], vocab }), []);

  // An empty closed column is refused rather than skipped.
  const missing = validateWorkflowGapRows([{
    id: 'WF-G98',
    status: 'open',
    severity: '',
    classification: 'daemon',
    surface: 'agora-daemon',
    ...provenance,
  }], { allowedAgentIds: ['claude'], vocab });
  assert.deepEqual(missing, ['WF-G98: Severity is required']);

  // With NO declared vocabulary, nothing is checked — project GAPS.md files
  // keep their looser schema.
  assert.deepEqual(validateWorkflowGapRows([{
    id: 'WF-G97',
    status: 'whatever',
    severity: 'enormous',
    classification: 'invented',
    surface: 'nowhere',
    ...provenance,
  }], { allowedAgentIds: ['claude'] }), []);
});

test('WF-G87: the Surface column is parsed, not merely displayed', () => {
  const rows = parseGapsMarkdown([
    '| Gap ID | Status | Severity | Classification | Surface | Gap |',
    '|---|---|---|---|---|---|',
    '| WF-G1 | open | low | daemon | agora-daemon | something broke |',
  ].join('\n'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].surface, 'agora-daemon');
  assert.equal(rows[0].classification, 'daemon');
});

test('WF-G84: a blank line inside the registry table bridges the rows and warns', async () => {
  const { parseGapsMarkdownWithWarnings } = await import('./gapIndex.mjs');
  const split = SAMPLE.replace('| G12 |', '\n\n| G12 |');
  const parsed = parseGapsMarkdownWithWarnings(split);
  assert.deepEqual(parsed.rows.map((r) => r.id), ['G10', 'G12', 'G14'], 'rows after the gap are still indexed');
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /split by 2 blank line/);
  // A genuinely separate table (new header) is still ignored, with no warning.
  const clean = parseGapsMarkdownWithWarnings(SAMPLE);
  assert.equal(clean.warnings.length, 0);
  assert.equal(clean.rows.length, 3);
});
