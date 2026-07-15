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

const run = (file, extra) => execFileSync(process.execPath, [
  tool, '--file', file, '--no-validate', ...extra,
], { encoding: 'utf8' });

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
