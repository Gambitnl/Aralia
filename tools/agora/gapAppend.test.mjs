// tools/agora/gapAppend.test.mjs
// WF-G113: the gap-intake writer. Covers the two failures that made
// GLOBAL_GAPS.md the hottest lock on the 2026-09-09 board — colliding ids under
// concurrent appends, and a rewrite that flips a CRLF registry to LF.
//
//   node --test tools/agora/gapAppend.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { appendGapRow, resolveGapsFile, detectEol, nextGapId, findRegistryTable, allGapIds, updateGapRow } from './gapAppend.mjs';
import { parseGapsMarkdown } from './gapIndex.mjs';

// A registry shaped like WORKFLOW_GAPS.md: YAML header with id_prefix /
// next_free_id, newest row LAST.
const WORKFLOW_LIKE = [
  '---',
  'schema_version: 1',
  'id_prefix: WF-G',
  'next_free_id: WF-G3',
  '---',
  '',
  '# Workflow Gaps',
  '',
  '## Registry',
  '',
  '| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| WF-G1 | open | low | docs | docs | h1 | claude | id-1 | t-1 | 2026-01-01 | one | e | w | n | p | — |',
  '| WF-G2 | open | low | docs | docs | h1 | claude | id-1 | t-1 | 2026-01-02 | two | e | w | n | p | — |',
  '',
  '## Resolved archive',
  '',
  '| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  // WF-G123: an archived id is still TAKEN. The allocator must clear it: the next free id below is WF-G100, not WF-G3.
  '| WF-G99 | resolved | low | docs | docs | h1 | claude | id-1 | t-1 | 2026-01-03 | old | e | w | n | p | — |',
  '',
];

// A registry shaped like GLOBAL_GAPS.md: no frontmatter, newest row FIRST, and
// a blank line splitting the table in the middle (the real file has one).
const GLOBAL_LIKE = [
  '# Global Gap Tracker',
  '',
  '## Gap Log',
  '',
  '| Gap ID | Status | Classification | Detected during | Gap | Evidence/source | Why it matters | Suspected owner/project | Routing decision | Destination | Next action | Next proof/check |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| GG-9 | open | technical_debt | s | nine | e | w | o | r | d | n | p |',
  '| GG-8 | open | technical_debt | s | eight | e | w | o | r | d | n | p |',
  '',
  '| GG-7 | resolved | technical_debt | s | seven | e | w | o | r | d | n | p |',
  '',
  '## Status Vocabulary',
  '',
];

function writeFixture(lines, eol) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-gapappend-'));
  const file = path.join(dir, 'GAPS.md');
  fs.writeFileSync(file, lines.join(eol) , 'utf8');
  return { dir, file };
}

test('appendGapRow allocates the header next_free_id and files the row last', () => {
  const { dir, file } = writeFixture(WORKFLOW_LIKE, '\n');
  try {
    const result = appendGapRow(file, {
      gap: 'a thing is missing',
      evidence: 'board result X',
      whyItMatters: 'it costs a discovery pass',
      nextAction: 'do the thing',
      nextProof: 'the test passes',
      severity: 'high',
      classification: 'coordination',
      surface: 'agora-client',
      suggestedAgent: 'claude',
      registeredBy: 'worker-1',
      registrantAgentId: 'uuid-1',
      registrantTaskId: 'thread-1',
    });
    assert.equal(result.id, 'WF-G100');
    const after = fs.readFileSync(file, 'utf8');
    // The row landed at the END of the open registry, not in the archive.
    const lines = after.split('\n');
    assert.match(lines[14], /^\| WF-G100 \|/);
    assert.match(lines[13], /^\| WF-G2 \|/);
    // The archive table is untouched.
    assert.ok(after.includes('| WF-G99 | resolved |'));
    // The header's next_free_id moved ahead of the row just filed.
    assert.ok(after.includes('next_free_id: WF-G101'));
    // The parser reads the new row back with every value in its own column.
    const rows = parseGapsMarkdown(after);
    const filed = rows.find((r) => r.id === 'WF-G100');
    assert.equal(filed.gap, 'a thing is missing');
    assert.equal(filed.evidence, 'board result X');
    assert.equal(filed.nextAction, 'do the thing');
    assert.equal(filed.severity, 'high');
    assert.equal(filed.surface, 'agora-client');
    assert.equal(filed.registrantAgentId, 'uuid-1');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('two appends in a row allocate DIFFERENT ids and never rewrite each other', () => {
  const { dir, file } = writeFixture(WORKFLOW_LIKE, '\n');
  try {
    const before = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.startsWith('| WF-G'));
    const a = appendGapRow(file, { gap: 'first concurrent row', registeredBy: 'w1' });
    const b = appendGapRow(file, { gap: 'second concurrent row', registeredBy: 'w2' });
    assert.notEqual(a.id, b.id);
    assert.deepEqual([a.id, b.id], ['WF-G100', 'WF-G101']);
    const after = fs.readFileSync(file, 'utf8');
    // Both rows exist, exactly once each.
    assert.equal((after.match(/\| WF-G100 \|/g) || []).length, 1);
    assert.equal((after.match(/\| WF-G101 \|/g) || []).length, 1);
    // Every pre-existing row survived byte-identical.
    for (const row of before) assert.ok(after.includes(row), `lost row: ${row.slice(0, 20)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('two appends serialized as concurrent promises still allocate different ids', async () => {
  const { dir, file } = writeFixture(WORKFLOW_LIKE, '\n');
  try {
    // This is the shape server.mjs uses: one promise chain, so the second
    // append reads the file only after the first has written it.
    let chain = Promise.resolve();
    const serialize = (fn) => {
      const next = chain.then(fn, fn);
      chain = next.then(() => {}, () => {});
      return next;
    };
    const [a, b] = await Promise.all([
      serialize(() => appendGapRow(file, { gap: 'racer A' })),
      serialize(() => appendGapRow(file, { gap: 'racer B' })),
    ]);
    assert.notEqual(a.id, b.id);
    const ids = parseGapsMarkdown(fs.readFileSync(file, 'utf8')).map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, 'no duplicate ids in the registry');
    assert.ok(ids.includes('WF-G100') && ids.includes('WF-G101'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a CRLF registry stays CRLF and gains no lone LF', () => {
  const { dir, file } = writeFixture(GLOBAL_LIKE, '\r\n');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    assert.equal(detectEol(raw), '\r\n');
    const result = appendGapRow(file, { gap: 'a CRLF-safe row', evidence: 'e' });
    const after = fs.readFileSync(file, 'utf8');
    // Every newline is still a CRLF: no bare LF anywhere in the file.
    assert.equal(/[^\r]\n/.test(after), false, 'a lone LF appeared in a CRLF file');
    assert.equal((after.match(/\r\n/g) || []).length, GLOBAL_LIKE.length - 1 + 1);
    assert.ok(after.includes('a CRLF-safe row'));
    assert.equal(result.id, 'GG-10');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a newest-first registry files the new row FIRST, and bridges the split table for ids', () => {
  const { dir, file } = writeFixture(GLOBAL_LIKE, '\r\n');
  try {
    appendGapRow(file, { gap: 'newest', evidence: 'e' });
    const rows = fs.readFileSync(file, 'utf8').split('\r\n').filter((l) => l.startsWith('| GG-'));
    assert.match(rows[0], /^\| GG-10 \|/);
    assert.match(rows[1], /^\| GG-9 \|/);
    // The row below the blank-line split (GG-7) was seen when the id was
    // allocated — it is inside the same registry, not a separate table.
    const table = findRegistryTable(fs.readFileSync(file, 'utf8').split(/\r?\n/));
    assert.equal(table.rowIndexes.length, 4);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a stale next_free_id never mints a duplicate id', () => {
  // The header claims WF-G3 is free, but WF-G7 is filed and the archive holds WF-G99 (WF-G123: archive ids count).
  const lines = [...WORKFLOW_LIKE];
  lines.splice(13, 0, '| WF-G7 | open | low | docs | docs | h1 | claude | id-1 | t-1 | 2026-01-02 | seven | e | w | n | p | — |');
  const { dir, file } = writeFixture(lines, '\n');
  try {
    const result = appendGapRow(file, { gap: 'after a stale header' });
    assert.equal(result.id, 'WF-G100');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('nextGapId derives the prefix from the rows when there is no frontmatter', () => {
  const { id, prefix } = nextGapId('# no header\n', ['GG-1', 'GG-12', 'GG-3']);
  assert.equal(prefix, 'GG-');
  assert.equal(id, 'GG-13');
});

test('resolveGapsFile maps the three registry kinds and refuses an unknown project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-gaproot-'));
  try {
    fs.mkdirSync(path.join(root, 'docs', 'projects', 'spells'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'projects', 'spells', 'GAPS.md'), '# x\n');
    assert.equal(resolveGapsFile('workflow', root), path.join(root, 'tools', 'agora', 'WORKFLOW_GAPS.md'));
    assert.equal(resolveGapsFile('global', root), path.join(root, 'docs', 'projects', 'GLOBAL_GAPS.md'));
    assert.equal(resolveGapsFile('spells', root), path.join(root, 'docs', 'projects', 'spells', 'GAPS.md'));
    assert.throws(() => resolveGapsFile('no-such-project', root), /no gap registry/);
    assert.throws(() => resolveGapsFile('', root), /project is required/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a value containing a pipe or a newline cannot break the table', () => {
  const { dir, file } = writeFixture(WORKFLOW_LIKE, '\n');
  try {
    appendGapRow(file, { gap: 'a | b\nsecond line', evidence: 'x' });
    const after = fs.readFileSync(file, 'utf8');
    const rows = parseGapsMarkdown(after);
    assert.equal(rows.length, 3, 'the row did not split into extra columns');
    const filed = rows.find((r) => r.id === 'WF-G100');
    assert.equal(filed.gap, 'a &#124; b second line');
    assert.equal(filed.evidence, 'x');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// WF-G123 (2026-09-09): GLOBAL_GAPS.md carries a second, hand-filed table
// below the registry. Its ids must count, or `gap add` mints duplicates.
test('WF-G123: ids in a second table below the registry are never reused', () => {
  const { dir, file } = writeFixture(GLOBAL_LIKE, '\r\n');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const second = [
      '',
      '## Untriaged (hand-filed)',
      '',
      '| Gap ID | Status | Kind | Source | Gap |',
      '|---|---|---|---|---|',
      '| GG-146 | untriaged | feature_coverage_gap | hand | first hand row |',
      '| GG-150 | untriaged | correctness_gap | hand | later hand row |',
      '',
    ].join('\r\n');
    fs.writeFileSync(file, raw.trimEnd() + '\r\n' + second, 'utf8');
    const ids = allGapIds(fs.readFileSync(file, 'utf8').split(/\r?\n/), 0);
    assert.ok(ids.includes('GG-150'), `second table ids missing: ${ids.join(',')}`);
    const result = appendGapRow(file, { gap: 'a row filed after the hand table', evidence: 'e' });
    assert.equal(result.id, 'GG-151', 'next id must clear BOTH tables');
    const after = fs.readFileSync(file, 'utf8');
    assert.equal(after.split('| GG-151 |').length, 2, 'filed exactly once');
    assert.ok(after.includes('| GG-150 | untriaged'), 'hand table untouched');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// WF-G124 (2026-09-09): a worker can repair or resolve one row without the lock.
test('WF-G124: updateGapRow rewrites only the named cells of one row and leaves every other byte alone', () => {
  const { dir, file } = writeFixture(WORKFLOW_LIKE, '\n');
  try {
    const before = fs.readFileSync(file, 'utf8');
    const r = updateGapRow(file, 'WF-G2', { status: 'resolved', note: 'fixed by t-9' });
    assert.deepEqual(r.changed, ['status', 'note']);
    const after = fs.readFileSync(file, 'utf8');
    const b = before.split('\n');
    const a = after.split('\n');
    assert.equal(a.length, b.length, 'no line added or removed');
    for (let i = 0; i < b.length; i++) {
      if (i === r.line - 1) continue;
      assert.equal(a[i], b[i], `line ${i + 1} changed`);
    }
    const row = parseGapsMarkdown(after).find((x) => x.id === 'WF-G2');
    assert.equal(row.status, 'resolved');
    assert.equal(row.gap, 'two', 'untouched cell kept');
    assert.match(a[r.line - 1], /fixed by t-9 \|$/);
    // The archive table has its own header; a row there is found by that header.
    const r2 = updateGapRow(file, 'WF-G99', { notes: 'archived note' });
    assert.deepEqual(r2.changed, ['notes']);
    assert.throws(() => updateGapRow(file, 'WF-G42', { status: 'open' }), /no row with id WF-G42/);
    assert.throws(() => updateGapRow(file, 'WF-G1', {}), /nothing to update/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// GLOBAL_GAPS.md carries no Notes column: a note lands in Next action instead.
test('WF-G124: a note on a registry without Notes appends to Next action', () => {
  const { dir, file } = writeFixture(GLOBAL_LIKE, '\r\n');
  try {
    const ids = parseGapsMarkdown(fs.readFileSync(file, 'utf8')).map((r) => r.id);
    const r = updateGapRow(file, ids[0], { note: 'closed by t-9' });
    assert.deepEqual(r.changed, ['note']);
    assert.match(r.row, /closed by t-9/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
