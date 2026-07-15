import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(here, 'validate-planmap.mjs');

const baseTopic = {
  id: 'sample-topic', title: 'Sample', campaign: 'tooling', status: 'active', deps: [],
};
const wrap = (topic) => JSON.stringify({
  campaigns: { tooling: { label: 'Tooling', color: 'amber' } }, topics: [topic],
}, null, 2);

const runOn = (json) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planmap-'));
  const file = path.join(dir, 'topics.json');
  fs.writeFileSync(file, json);
  try {
    execFileSync(process.execPath, [validator, '--file', file], { encoding: 'utf8' });
    return { code: 0 };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
};

test('accepts valid updated/tier/status_note and feature decision', () => {
  const r = runOn(wrap({
    ...baseTopic,
    updated: '2026-07-14', tier: 'strategic', status_note: 'nuance',
    features: [{ title: 'Step one', status: 'specced', status_note: 'x', decision: true }],
  }));
  assert.equal(r.code, 0);
});

test('rejects bad tier', () => {
  assert.notEqual(runOn(wrap({ ...baseTopic, tier: 'huge' })).code, 0);
});

test('rejects malformed updated', () => {
  assert.notEqual(runOn(wrap({ ...baseTopic, updated: 'yesterday' })).code, 0);
});

test('rejects non-boolean feature decision', () => {
  const r = runOn(wrap({
    ...baseTopic,
    features: [{ title: 'Step', status: 'specced', decision: 'yes' }],
  }));
  assert.notEqual(r.code, 0);
});

test('rejects non-string status_note', () => {
  assert.notEqual(runOn(wrap({ ...baseTopic, status_note: 42 })).code, 0);
});
