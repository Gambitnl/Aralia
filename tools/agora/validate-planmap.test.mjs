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

test('WF-G176 / WF-G186: rejects done feature when adoption is not_adopted or partial, accepts when adopted or active', () => {
  const rejected = runOn(wrap({
    ...baseTopic,
    features: [{ title: 'DIAL-001 scripted dialogue graph', status: 'done', adoption: 'not_adopted' }],
  }));
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.out, /status cannot be "done" while adoption is "not_adopted"/);

  const acceptedActive = runOn(wrap({
    ...baseTopic,
    features: [{ title: 'DIAL-001 scripted dialogue graph', status: 'active', adoption: 'not_adopted' }],
  }));
  assert.equal(acceptedActive.code, 0);

  const acceptedDone = runOn(wrap({
    ...baseTopic,
    features: [{ title: 'Seeded silent-path RNG API', status: 'done', adoption: 'adopted' }],
  }));
  assert.equal(acceptedDone.code, 0);
});

test('WF-G188: reachableSymbols fails when a done topic symbol is only called by an unreachable module', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planmap-reach-'));
  try {
    fs.mkdirSync(path.join(dir, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'src', 'data', 'villagePersonalityProfiles.ts'),
      'export function resolveVillageIntegrationProfile() { return {}; }\n',
    );
    // Unreachable caller: nothing in src/ imports villageGenerator.
    fs.writeFileSync(
      path.join(dir, 'src', 'services', 'villageGenerator.ts'),
      'import { resolveVillageIntegrationProfile } from "../data/villagePersonalityProfiles";\nexport function deadGen() { return resolveVillageIntegrationProfile(); }\n',
    );
    const topicFile = path.join(dir, 'topics.json');
    fs.writeFileSync(
      topicFile,
      wrap({
        ...baseTopic,
        status: 'done',
        reachableSymbols: [
          { symbol: 'resolveVillageIntegrationProfile', definedIn: 'src/data/villagePersonalityProfiles.ts' },
        ],
      }),
    );

    let failedOut = '';
    try {
      execFileSync(process.execPath, [validator, '--file', topicFile, '--repo', dir], { encoding: 'utf8' });
      assert.fail('Expected validator to fail when only caller is unreachable');
    } catch (e) {
      failedOut = `${e.stdout}${e.stderr}`;
    }
    assert.match(failedOut, /only called by unreachable production module.*src\/services\/villageGenerator\.ts.*WF-G188/);

    // Now wire a live caller that imports the module.
    fs.writeFileSync(
      path.join(dir, 'src', 'components', 'MapPane.tsx'),
      'import { deadGen } from "../services/villageGenerator";\nexport function MapPane() { return deadGen(); }\n',
    );
    const out = execFileSync(process.execPath, [validator, '--file', topicFile, '--repo', dir], { encoding: 'utf8' });
    assert.match(out, /plan-map validation: clean/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
