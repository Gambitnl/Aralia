// Tests for the GAPS.md → JSON gap index (the tracker bridge orchestrators use
// to intake open gaps programmatically instead of reading markdown trees).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { parseGapsMarkdown, indexGaps, OPEN_STATUSES } from './gapIndex.mjs';

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

test('gapIndex.workflowGaps: the real WORKFLOW_GAPS.md parses; archive rows are NOT indexed', () => {
  // The live Registry table indexes (currently empty — all WF-G1..14 resolved
  // and moved to the archive 2026-07-02); any row that appears must be a
  // well-formed WF-G id tagged with project 'workflow'. Schema drift fails here.
  const gaps = indexGaps({ root: 'tools/agora' });
  assert.ok(Array.isArray(gaps), 'registry parses without error');
  assert.ok(gaps.every((g) => /^WF-G\d+$/.test(g.id) && g.project === 'workflow'),
    `unexpected rows: ${JSON.stringify(gaps.map((g) => g.project + ':' + g.id))}`);
  // Archived resolutions must NOT leak into the machine index.
  assert.ok(gaps.every((g) => g.id !== 'WF-G7'), 'archive table is not indexed');
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
