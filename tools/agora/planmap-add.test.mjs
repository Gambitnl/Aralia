// planmap-add.test.mjs — every mutation through planmap-add stamps the touched
// topic with updated: <today> so the freshness machinery has a real date.
// Run: node --test tools/agora/planmap-add.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, 'planmap-add.mjs');

const mkMap = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-'));
  const file = path.join(dir, 'topics.json');
  fs.writeFileSync(file, JSON.stringify({
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [{
      id: 'existing-topic', title: 'Existing', campaign: 'tooling', status: 'parked',
      features: [{ title: 'Old step', status: 'parked' }],
    }],
  }, null, 2) + '\n');
  return file;
};

const run = (file, extra, opts = {}) => {
  const args = ['--file', file, ...(opts.validate ? [] : ['--no-validate']), ...extra];
  try {
    const output = execFileSync(process.execPath, [tool, ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (err) {
    return {
      code: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
};

const readMap = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

test('new topic gets an updated stamp', () => {
  const file = mkMap();
  run(file, ['--new-topic', 'freshness-probe', '--title', 'Probe', '--campaign', 'tooling']);
  const data = readMap(file);
  const t = data.topics.find((x) => x.id === 'freshness-probe');
  assert.match(t.updated, DATE);
});

test('adding a feature stamps the touched topic', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--feature', 'New step']);
  assert.match(readMap(file).topics[0].updated, DATE);
});

test('set-status stamps the touched topic', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--set-status', 'active']);
  const t = readMap(file).topics[0];
  assert.equal(t.status, 'active');
  assert.match(t.updated, DATE);
});

test('write is atomic: no .tmp file left behind', () => {
  const file = mkMap();
  run(file, ['--topic', 'existing-topic', '--set-status', 'active']);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test('validation failure from pre-existing drift does not write or duplicate on retry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-drift-'));
  const file = path.join(dir, 'topics.json');
  const baseline = {
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [
      { id: 'existing-topic', title: 'Existing', campaign: 'tooling', status: 'parked' },
      { id: 'bad-topic', title: 'Broken', campaign: 'tooling', status: 'not-a-status' },
    ],
  };
  fs.writeFileSync(file, JSON.stringify(baseline, null, 2) + '\n');

  const first = run(file, ['--topic', 'existing-topic', '--feature', 'Retry step'], { validate: true });
  const afterFirst = readMap(file);
  const second = run(file, ['--topic', 'existing-topic', '--feature', 'Retry step'], { validate: true });
  const afterSecond = readMap(file);

  assert.equal(first.code, 1);
  assert.equal(second.code, 1);
  assert.match(first.output, /pre-existing plan-map validation errors detected/i);
  assert.deepEqual(afterFirst, baseline);
  assert.deepEqual(afterSecond, baseline);
});

test('successful update only mutates the caller-chosen topic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmadd-target-'));
  const file = path.join(dir, 'topics.json');
  const before = {
    campaigns: { tooling: { label: 'Tooling', color: 'teal' } },
    topics: [
      {
        id: 'existing-topic',
        title: 'Existing',
        campaign: 'tooling',
        status: 'parked',
        features: [{ title: 'Old step', status: 'parked' }],
      },
      {
        id: 'other-topic',
        title: 'Other',
        campaign: 'tooling',
        status: 'active',
        updated: '2026-01-01',
        features: [{ title: 'Other step', status: 'active' }],
      },
    ],
  };
  fs.writeFileSync(file, JSON.stringify(before, null, 2) + '\n');

  const payload = run(file, ['--topic', 'existing-topic', '--feature', 'New step'], { validate: true });
  assert.equal(payload.code, 0);

  const after = readMap(file);
  const beforeTarget = before.topics.find((topic) => topic.id === 'existing-topic');
  const afterTarget = after.topics.find((topic) => topic.id === 'existing-topic');
  const beforeOther = before.topics.find((topic) => topic.id === 'other-topic');
  const afterOther = after.topics.find((topic) => topic.id === 'other-topic');

  assert.equal(beforeTarget.updated, undefined);
  assert.match(afterTarget.updated, DATE);
  assert.equal(beforeTarget.features.length + 1, afterTarget.features.length);
  assert.equal(afterTarget.features.at(-1).title, 'New step');
  assert.deepEqual(afterOther, beforeOther);
});
