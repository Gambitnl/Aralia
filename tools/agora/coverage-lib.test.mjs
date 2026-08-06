// coverage-lib.test.mjs — the coverage checker must find what is MISSING, and
// must never report "cannot look" as "nothing wrong".
// Run: node --test tools/agora/coverage-lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listCodeAreas,
  textCoversArea,
  domainDocCoverage,
  domainDocDrift,
  coverageReport,
} from './coverage-lib.mjs';

/** Build a throwaway repo with the given files. Returns its root. */
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return root;
}

test('finds a code area that no domain doc names', () => {
  const root = fixture({
    'src/systems/world3d/a.ts': '',
    'src/systems/world3d/b.ts': '',
    'src/systems/combat/a.ts': '',
    'docs/architecture/domains/combat.md': 'Entry points:\n- src/systems/combat/a.ts\n',
  });
  const r = domainDocCoverage(root);
  assert.equal(r.checkable, true);
  const names = r.gaps.map((g) => g.name);
  assert.ok(names.includes('world3d'), 'world3d is undocumented and must be reported');
  assert.ok(!names.includes('combat'), 'combat is named by a doc and must not be reported');
});

test('ranks gaps by size, largest first', () => {
  const root = fixture({
    'src/systems/small/a.ts': '',
    'src/systems/big/a.ts': '',
    'src/systems/big/b.ts': '',
    'src/systems/big/c.ts': '',
    'docs/architecture/domains/other.md': 'nothing relevant',
  });
  const r = domainDocCoverage(root);
  assert.equal(r.gaps[0].name, 'big', 'the biggest gap must come first');
});

test('an ignored area is still reported, only marked', () => {
  // Rank, do not filter. An ignore list records a judgment; it must not hide
  // the entry, or the report stops being a complete picture.
  const root = fixture({
    'src/components/ui/a.ts': '',
    'docs/architecture/domains/other.md': 'nothing relevant',
  });
  const r = domainDocCoverage(root, { ignore: ['ui'] });
  const ui = r.gaps.find((g) => g.name === 'ui');
  assert.ok(ui, 'an ignored area must still appear');
  assert.equal(ui.ignored, true);
});

test('a bare area name in prose does not count as coverage', () => {
  // 'party' and 'dice' occur in ordinary sentences. Only a path segment counts.
  const root = fixture({
    'src/systems/party/a.ts': '',
    'docs/architecture/domains/x.md': 'The party rolls dice before combat.',
  });
  const r = domainDocCoverage(root);
  assert.ok(r.gaps.some((g) => g.name === 'party'), 'prose mention must not count');
});

test('a path segment does count as coverage', () => {
  const root = fixture({
    'src/systems/party/a.ts': '',
    'docs/architecture/domains/x.md': 'See src/systems/party/a.ts for details.',
  });
  const r = domainDocCoverage(root);
  assert.ok(!r.gaps.some((g) => g.name === 'party'));
});

test('drift finds a doc naming a file that no longer exists', () => {
  const root = fixture({
    'src/systems/combat/live.ts': '',
    'docs/architecture/domains/combat.md':
      '- src/systems/combat/live.ts\n- src/systems/combat/deleted.ts\n',
  });
  const r = domainDocDrift(root);
  assert.equal(r.checkable, true);
  assert.equal(r.stale.length, 1);
  assert.deepEqual(r.stale[0].missing, ['src/systems/combat/deleted.ts']);
});

test('drift ignores prose that is not a source path', () => {
  const root = fixture({
    'src/systems/combat/live.ts': '',
    'docs/architecture/domains/combat.md':
      'The combat domain owns `initiative` and `rounds`.\n- src/systems/combat/live.ts\n',
  });
  const r = domainDocDrift(root);
  assert.equal(r.stale.length, 0, 'backticked words are not paths');
});

test('a missing domain directory reports uncheckable, not clean', () => {
  // The load-bearing case: "cannot look" must never render as "no gaps".
  const root = fixture({ 'src/systems/world3d/a.ts': '' });
  const r = domainDocCoverage(root);
  assert.equal(r.checkable, false);
  assert.ok(r.reason.length > 0, 'an uncheckable surface must say why');
  assert.deepEqual(r.gaps, []);
});

test('the report declares surfaces it cannot check', () => {
  const root = fixture({
    'src/systems/a/x.ts': '',
    'docs/architecture/domains/a.md': 'src/systems/a/x.ts',
  });
  const report = coverageReport(root);
  assert.equal(report.adrs.checkable, false);
  assert.ok(report.adrs.reason.includes('no trace'));
  assert.equal(report.judgmentSurfaces.checkable, false);
  // Every surface carries the population it claims to cover, so a reader can
  // tell what a clean result actually means.
  for (const key of Object.keys(report)) {
    assert.ok(report[key].population, `${key} must declare its population`);
  }
});

test('listCodeAreas counts files for ranking', () => {
  const root = fixture({
    'src/systems/x/a.ts': '',
    'src/systems/x/b.ts': '',
  });
  const areas = listCodeAreas(root);
  const x = areas.find((a) => a.name === 'x');
  assert.equal(x.files, 2);
  assert.equal(x.repoPath, 'src/systems/x');
});

test('textCoversArea matches a repo path and a path segment only', () => {
  const area = { name: 'world3d', repoPath: 'src/systems/world3d', files: 1 };
  assert.equal(textCoversArea('see src/systems/world3d/a.ts', area), true);
  assert.equal(textCoversArea('under /world3d/ there is', area), true);
  assert.equal(textCoversArea('the world3d effort', area), false);
});

test('a .tsx path is not reported as a missing .ts file', () => {
  // The regression that made 58 of 83 first-run findings false. Alternation
  // ordered ts|tsx with no end boundary matches the PREFIX of BattleMap.tsx.
  const root = fixture({
    'src/components/BattleMap/BattleMap.tsx': '',
    'docs/architecture/domains/battle-map.md': '- src/components/BattleMap/BattleMap.tsx\n',
  });
  const r = domainDocDrift(root);
  assert.deepEqual(r.stale, [], 'a live .tsx file must not report its .ts prefix as missing');
});

test('a genuinely missing .ts file is still reported', () => {
  const root = fixture({
    'docs/architecture/domains/x.md': '- src/utils/glossaryUtils.ts\n',
  });
  const r = domainDocDrift(root);
  assert.equal(r.stale.length, 1);
  assert.deepEqual(r.stale[0].missing, ['src/utils/glossaryUtils.ts']);
});
