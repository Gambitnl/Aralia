import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/**
 * Protects the source/runtime boundary for the Symphony middleman track.
 *
 * Symphony writes local state and proof captures while it runs. Those files
 * belong under ignored runtime directories so they do not block Git sync.
 * Contract verifiers are different: they are the durable tests that explain and
 * protect the workflow, so they must remain visible to Git when they are part of
 * verify:jules-contract.
 */

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = dirname(scriptPath);
const symphonyRoot = resolve(scriptsDir, '..');
const repoRoot = resolve(symphonyRoot, '..', '..');
const packageJson = JSON.parse(await readFile(resolve(symphonyRoot, 'package.json'), 'utf8'));

function checkIgnore(path) {
  const result = spawnSync('git', ['check-ignore', '-q', path], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  if (result.status === 0) {
    return true;
  }

  if (result.status === 1) {
    return false;
  }

  throw new Error(`git check-ignore failed for ${path}`);
}

function extractVerifyScripts(command) {
  return [...command.matchAll(/scripts\/[A-Za-z0-9_.-]+\.mjs/g)]
    .map((match) => `conductor/symphony/${match[0]}`)
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .sort();
}

const contractCommand = packageJson.scripts?.['verify:jules-contract'] ?? '';
const contractScripts = extractVerifyScripts(contractCommand);

assert.ok(
  contractScripts.includes('conductor/symphony/scripts/verify-gitignore-contract-boundary.mjs'),
  'verify:jules-contract should include the gitignore/source-boundary verifier',
);

for (const path of contractScripts) {
  assert.equal(
    checkIgnore(path),
    false,
    `${path} is part of verify:jules-contract and must not be ignored`,
  );
}

for (const path of [
  'conductor/symphony/.symphony/task-drafts.json',
  'conductor/symphony/.symphony/live-proof/example.json',
  'conductor/symphony/.symphony/visual-verification/example.png',
]) {
  assert.equal(checkIgnore(path), true, `${path} should remain ignored runtime/proof output`);
}
