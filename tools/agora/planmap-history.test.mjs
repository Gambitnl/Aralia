// WF-G107 (2026-09-09): this file was written for vitest, but vitest.config.ts
// EXCLUDES tools/agora/**/*.test.mjs on the assumption that the standalone
// `node --test "tools/agora/*.test.mjs"` suite covers them — so it ran nowhere
// and failed under node --test ("Cannot read properties of undefined (reading
// 'config')"). Same assertions, node:test API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, collapseDaily, buildHistory } from './planmap-history.mjs';

test('parseSnapshot returns the topics array for valid json', () => {
  assert.deepEqual(parseSnapshot('{"topics":[{"id":"a"}]}'), [{ id: 'a' }]);
});

test('parseSnapshot returns null for garbage or missing topics', () => {
  assert.equal(parseSnapshot('not json'), null);
  assert.equal(parseSnapshot('{"nope":1}'), null);
});

test('collapseDaily keeps the LAST commit of each calendar day, sorted ascending', () => {
  const commits = [
    { hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: [{ id: 'x', status: 'parked' }] },
    { hash: 'c2', dateISO: '2026-07-01T22:00:00Z', topics: [{ id: 'x', status: 'specced' }] },
    { hash: 'c3', dateISO: '2026-07-02T02:00:00Z', topics: [{ id: 'x', status: 'active' }] },
  ];
  const days = collapseDaily(commits);
  assert.deepEqual(days.map((d) => d.date), ['2026-07-01', '2026-07-02']);
  assert.equal(days[0].commit, 'c2');
  assert.equal(days[0].topics[0].status, 'specced');
});

test('collapseDaily skips commits whose snapshot failed to parse (null topics)', () => {
  const days = collapseDaily([{ hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: null }]);
  assert.deepEqual(days, []);
});

test('buildHistory wraps days with a generatedAt stamp', () => {
  const h = buildHistory([{ hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: [{ id: 'x' }] }]);
  assert.equal(h.days.length, 1);
  assert.equal(typeof h.generatedAt, 'string');
});
