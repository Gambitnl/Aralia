/** Prove runner separation without requiring an application or a live service. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nodeTestFiles } from './node-test-inventory.mjs';
import { forbiddenFiles } from './repository-policy.mjs';

test('inventory includes nested Node tests and excludes Vitest files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-ci-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of [['scripts/nested/node.test.mjs', "import test from 'node:test';"], ['tools/agora/node.test.mjs', 'import { test } from "node:test";'], ['scripts/browser.test.js', "import { test } from 'vitest';"]]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  assert.deepEqual(nodeTestFiles(root), ['scripts/nested/node.test.mjs', 'tools/agora/node.test.mjs']);
});

test('dependency changes are allowed while compiler caches are rejected', () => {
  assert.deepEqual(forbiddenFiles(['package.json', 'package-lock.json', 'pnpm-lock.yaml']), []);
  assert.deepEqual(forbiddenFiles(['tsconfig.tsbuildinfo', 'nested/tsconfig.node.tsbuildinfo', 'custom.tsbuildinfo']), ['tsconfig.tsbuildinfo', 'nested/tsconfig.node.tsbuildinfo', 'custom.tsbuildinfo']);
});
