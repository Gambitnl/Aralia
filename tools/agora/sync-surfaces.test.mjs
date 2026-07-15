// tools/agora/sync-surfaces.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSync } from './sync-surfaces.mjs';

// Build a minimal fake repo: planmap + one project docset.
const mkRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'syncrepo-'));
  fs.mkdirSync(path.join(root, 'public', 'planmap'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'projects', 'combat'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), JSON.stringify({
    campaigns: { combat: { title: 'Combat' } },
    topics: [{
      id: 'fip', title: 'Fight in place', campaign: 'combat', status: 'active',
      updated: '2026-07-01', docset: 'combat', tier: 'strategic',
      features: [{ title: 'Camera', status: 'active' }],
    }],
  }, null, 2));
  fs.writeFileSync(path.join(root, 'docs', 'projects', 'combat', 'NORTH_STAR.md'),
    '---\nschema_version: 1\nslug: combat\nstatus: active\nlast_updated: 2026-07-01\n---\n# Combat\n');
  fs.writeFileSync(path.join(root, 'docs', 'projects', 'combat', 'GAPS.md'),
    '---\nopen_gap_count: 7\n---\n');
  return root;
};

test('health step writes health.json with ages and gap counts', async () => {
  const root = mkRepo();
  const res = await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [] });
  assert.equal(res.ok, true);
  const health = JSON.parse(fs.readFileSync(path.join(root, 'public', 'planmap', 'health.json'), 'utf8'));
  assert.equal(health.topics.fip.ageDays, 13);
  assert.equal(health.topics.fip.openGaps, 7);
});

test('run-twice golden: byte-identical outputs', async () => {
  const root = mkRepo();
  const now = new Date('2026-07-14');
  await runSync({ repoRoot: root, now, steps: ['board', 'docs', 'health'], tasksProvider: async () => [] });
  const snap = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  const first = [snap('public/planmap/topics.json'), snap('public/planmap/health.json'), snap('docs/projects/combat/NORTH_STAR.md')];
  await runSync({ repoRoot: root, now, steps: ['board', 'docs', 'health'], tasksProvider: async () => [] });
  const second = [snap('public/planmap/topics.json'), snap('public/planmap/health.json'), snap('docs/projects/combat/NORTH_STAR.md')];
  assert.deepEqual(second, first);
});

test('invalid topics.json refuses all writes', async () => {
  const root = mkRepo();
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), '{ not json');
  const res = await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [] });
  assert.equal(res.ok, false);
  assert.equal(fs.existsSync(path.join(root, 'public', 'planmap', 'health.json')), false);
});
