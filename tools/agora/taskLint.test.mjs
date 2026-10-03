// tools/agora/taskLint.test.mjs
// WF-G111 (tooling half): the pre-dispatch freshness check for a task body.
//
//   node --test tools/agora/taskLint.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import {
  extractBareFileNames,
  lintTask,
  extractPathTokens,
  extractBacktickedIdentifiers,
  formatLintReport,
  defaultGrepSrc,
  defaultIgnoredPaths,
  isTestPath,
  defaultFindSplitCandidates,
  extractSchemaClaims,
  defaultGrepTypes,
  extractTypeFieldClaims,
  defaultCheckFileFields,
  REPO_ROOT,
} from './taskLint.mjs';

test('extractPathTokens finds repo paths and ignores refs, globs and prose', () => {
  const text = [
    'Split `src/components/Crafting/SalvageModal.tsx` and see docs/projects/GLOBAL_GAPS.md,',
    'per planmap:crafting/salvage and https://example.com/a/b.',
    'Sweep src/systems/**/*.ts and tools/agora for the rest.',
    'The old directory is src/components/BattleMap3D/; the Windows spelling is src\\hooks\\combat\\useBattleMap.ts.',
    'A ratio of 3/4 is not a path.',
  ].join('\n');
  const found = extractPathTokens(text);
  assert.ok(found.includes('src/components/Crafting/SalvageModal.tsx'));
  assert.ok(found.includes('docs/projects/GLOBAL_GAPS.md'));
  assert.ok(found.includes('tools/agora'));
  assert.ok(found.includes('src/components/BattleMap3D'));
  assert.ok(found.includes('src/hooks/combat/useBattleMap.ts'));
  assert.ok(!found.some((t) => t.startsWith('planmap:')), 'a scheme-prefixed ref is not a path');
  assert.ok(!found.some((t) => t.startsWith('https:')), 'a URL is not a path');
  assert.ok(!found.includes('src/systems/**/*.ts'), 'a glob is not a path');
  assert.ok(!found.includes('3/4'), 'a ratio is not a path');
});

test('extractBacktickedIdentifiers takes code names and leaves English words alone', () => {
  const text = 'Wire `TOGGLE_LEDGER_BOOK` into `useModalOrchestration()`, keep `SalvageModal` and set state `open`. Also `store.acquireLock` and `a b`.';
  const found = extractBacktickedIdentifiers(text);
  assert.deepEqual(found, ['TOGGLE_LEDGER_BOOK', 'useModalOrchestration', 'SalvageModal', 'acquireLock']);
  assert.ok(!found.includes('open'), 'a lowercase English word is not an identifier claim');
});

test('lintTask reports missing paths and ungreppable identifiers, and stays clean otherwise', () => {
  const present = new Set(['src/real/thing.ts', 'tools/agora']);
  const greppable = new Set(['RealThing']);
  const result = lintTask(
    {
      id: 'agora-1234',
      title: 'Repair `RealThing`',
      body: 'Edit `src/real/thing.ts` and `src/ghost/absent.ts`; rename `GHOST_ACTION` inside tools/agora.',
      refs: ['src/also/missing.ts', 'workflow:WF-G111'],
    },
    {
      fileExists: (p) => present.has(p),
      ignoredPaths: () => new Set(),
      grepSrc: (n) => greppable.has(n),
    },
  );
  assert.deepEqual(result.missingPaths, ['src/ghost/absent.ts', 'src/also/missing.ts']);
  assert.deepEqual(result.missingIdentifiers, ['GHOST_ACTION']);
  assert.equal(result.clean, false);
  assert.ok(result.checkedPaths.includes('tools/agora'));

  const clean = lintTask(
    { id: 'agora-5678', body: 'Edit `src/real/thing.ts` for `RealThing`.' },
    { fileExists: (p) => present.has(p), ignoredPaths: () => new Set(), grepSrc: (n) => greppable.has(n) },
  );
  assert.deepEqual(clean.missingPaths, []);
  assert.deepEqual(clean.missingIdentifiers, []);
  assert.equal(clean.clean, true);
});

test('a path that EXISTS but is gitignored is a note, never a missing path', () => {
  const result = lintTask(
    { id: 'agora-9999', body: 'The pane is `src/components/DesignPreview/steps/PreviewTown3D.tsx`.' },
    {
      fileExists: () => true,
      ignoredPaths: (paths) => new Set(paths),
      grepSrc: () => true,
    },
  );
  assert.deepEqual(result.missingPaths, []);
  assert.deepEqual(result.ignoredPaths, ['src/components/DesignPreview/steps/PreviewTown3D.tsx']);
  assert.equal(result.clean, true, 'an ignored-but-present file does not fail the lint');
  const report = formatLintReport(result).join('\n');
  assert.match(report, /GITIGNORED/);
});

test('formatLintReport names both defect classes', () => {
  const report = formatLintReport({
    taskId: 'agora-abcd',
    checkedPaths: ['a/b.ts'],
    checkedIdentifiers: ['Xy'],
    missingPaths: ['a/b.ts'],
    ignoredPaths: [],
    missingIdentifiers: ['Xy'],
    clean: false,
  }).join('\n');
  assert.match(report, /MISSING PATHS \(1\)/);
  assert.match(report, /UNGREPPABLE IDENTIFIERS \(1\)/);
});

test('the default git probes answer over a real temp repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-tasklint-'));
  try {
    // check-ignore only answers inside a repository, so the fixture is one.
    spawnSync('git', ['init', '-q', root], { encoding: 'utf8' });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'real.ts'), 'export const RealSymbol = 1;\n');
    fs.writeFileSync(path.join(root, 'src', 'hidden.ts'), 'export const HiddenSymbol = 2;\n');
    fs.writeFileSync(path.join(root, '.gitignore'), 'src/hidden.ts\n');
    assert.equal(defaultGrepSrc(root, 'RealSymbol'), true);
    assert.equal(defaultGrepSrc(root, 'NoSuchSymbolAnywhere'), false);
    // --no-index means an ignored file's contents are still searched, which is
    // what a worker's own grep would do.
    assert.equal(defaultGrepSrc(root, 'HiddenSymbol'), true);
    const ignored = defaultIgnoredPaths(root, ['src/real.ts', 'src/hidden.ts']);
    assert.equal(ignored.has('src/hidden.ts'), true);
    assert.equal(ignored.has('src/real.ts'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF-G158: a bare file name with no directory is checked by basename across the repo', () => {
  assert.deepEqual(
    extractBareFileNames('Change processEndOfTurnEffects (same file or useTurnOrder.ts) and `useCombatEngine.ts`; skip .ts and foo/bar.ts'),
    ['useTurnOrder.ts', 'useCombatEngine.ts'],
  );
  const known = new Set(['useCombatEngine.ts']);
  const result = lintTask(
    { id: 'agora-9999', body: 'Refactor useTurnOrder.ts and useCombatEngine.ts' },
    { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true, basenameExists: (n) => known.has(n) },
  );
  assert.deepEqual(result.missingFileNames, ['useTurnOrder.ts']);
  assert.equal(result.clean, false);
  assert.ok(formatLintReport(result).some((l) => /MISSING FILE NAMES/.test(l)));
});

test('WF-G158: the default basename probe finds a real file and misses a ghost', () => {
  const real = lintTask({ id: 'x', body: 'see taskLint.mjs' }, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true });
  assert.deepEqual(real.missingFileNames, []);
  const ghost = lintTask({ id: 'y', body: 'see zz-no-such-file-9f8e7d.ts' }, { fileExists: () => true, ignoredPaths: () => new Set(), grepSrc: () => true });
  assert.deepEqual(ghost.missingFileNames, ['zz-no-such-file-9f8e7d.ts']);
});

test('WF-G167: missing test path identifies split test suite candidates', () => {
  assert.equal(isTestPath('src/utils/combat/__tests__/combatUtils.test.ts'), true);
  assert.equal(isTestPath('src/utils/combat/combatUtils.ts'), false);
  assert.equal(isTestPath('tests/foo.spec.js'), true);

  // Live repository check: combatUtils.test.ts is missing, but split suites exist
  const splits = defaultFindSplitCandidates(REPO_ROOT, 'src/utils/combat/__tests__/combatUtils.test.ts');
  assert.ok(splits.length >= 8, 'should find combatUtils split test files');
  assert.ok(splits.includes('combatUtils_attack.test.ts'));
  assert.ok(splits.includes('combatUtils_character.test.ts'));

  const result = lintTask({
    id: 'agora-test-wfg167',
    body: 'Run gate with npx vitest run src/utils/combat/__tests__/combatUtils.test.ts',
  });
  assert.equal(result.clean, false);
  assert.equal(result.missingTestPaths.length, 1);
  assert.equal(result.missingTestPaths[0].path, 'src/utils/combat/__tests__/combatUtils.test.ts');
  assert.ok(result.missingTestPaths[0].splitCandidates.includes('combatUtils_attack.test.ts'));

  const report = formatLintReport(result).join('\n');
  assert.match(report, /MISSING TEST PATHS/);
  assert.match(report, /WF-G167/);
  assert.match(report, /split test suites found/);
});

test('WF-G165: suspect schema claims detect existing types in src/types/**', () => {
  const claims = extractSchemaClaims("Add a schema for savePenalty in src/types/spells.ts; mind-sliver has no schema or handler");
  assert.ok(claims.some((c) => c.typeName === 'savePenalty'));

  // Live repository check: savePenalty exists in spellEffectTypes.ts and combat.ts
  const hits = defaultGrepTypes(REPO_ROOT, 'savePenalty');
  assert.ok(hits.includes('src/types/spellEffectTypes.ts'));

  const result = lintTask({
    id: 'agora-test-wfg165',
    body: 'Add a schema for savePenalty in src/types/spells.ts',
  });
  assert.equal(result.clean, false);
  assert.ok(result.suspectSchemaClaims.some((c) => c.typeName === 'savePenalty'));

  const report = formatLintReport(result).join('\n');
  assert.match(report, /SUSPECT SCHEMA CLAIMS/);
  assert.match(report, /WF-G165/);
  assert.match(report, /src\/types\/spellEffectTypes\.ts/);
});

test('WF-G161: unresolved type fields detect claims of fields missing from named file', () => {
  const claims = extractTypeFieldClaims('Pass town (wealth, biome, dominant races from src/types/world.ts) to generator');
  assert.equal(claims.length, 1);
  assert.equal(claims[0].file, 'src/types/world.ts');
  assert.ok(claims[0].fields.includes('wealth'));

  // Live repository check: wealth is NOT in src/types/world.ts
  const missing = defaultCheckFileFields(REPO_ROOT, 'src/types/world.ts', ['wealth', 'biome']);
  assert.deepEqual(missing, ['wealth'], 'wealth is missing, biome is present');

  const result = lintTask({
    id: 'agora-test-wfg161',
    body: 'Pass the current town (wealth, biome, dominant races from src/types/world.ts) into generator',
  });
  assert.equal(result.clean, false);
  assert.equal(result.unresolvedTypeFields.length, 1);
  assert.ok(result.unresolvedTypeFields[0].missingFields.includes('wealth'));

  const report = formatLintReport(result).join('\n');
  assert.match(report, /UNRESOLVED TYPE FIELDS/);
  assert.match(report, /WF-G161/);
  assert.match(report, /missing \[.*wealth.*\]/);
});
