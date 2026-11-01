/**
 * First-load JS budget (C13, agora-9ed9.13): parses the entry and every
 * modulepreload from index.html, strips the deploy base, sums gzip sizes, and
 * fails above budget.
 *
 * Exercises: scripts/quality/bundle-budget.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkBudget, initialScripts, measureInitialBundle } from './bundle-budget.mjs';

const html = `<!doctype html><html><head>
<script type="module" crossorigin src="/Aralia/assets/main-abc.js"></script>
<link rel="modulepreload" crossorigin href="/Aralia/assets/vendor-react-def.js">
<link rel="modulepreload" crossorigin href="/Aralia/assets/main-abc.js">
<link rel="stylesheet" href="/Aralia/assets/main-abc.css">
<script src="https://cdn.example.com/x.js"></script>
</head></html>`;

test('initialScripts lists the entry and modulepreloads once, without the base or remote URLs', () => {
  assert.deepEqual(initialScripts(html), ['assets/main-abc.js', 'assets/vendor-react-def.js']);
});

test('measureInitialBundle sums gzip sizes and checkBudget passes or fails on the limit', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-'));
  try {
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), html);
    writeFileSync(path.join(dir, 'assets', 'main-abc.js'), 'x'.repeat(5000));
    // Random-looking text compresses poorly, so the gzip size stays large.
    writeFileSync(path.join(dir, 'assets', 'vendor-react-def.js'), Array.from({ length: 4000 }, (_, i) => ((i * 7919) % 97).toString(36)).join(''));
    const measurement = measureInitialBundle(dir);
    assert.equal(measurement.files.length, 2);
    assert.equal(measurement.rawBytes, 5000 + measurement.files.find((f) => f.file.includes('vendor')).rawBytes);
    assert.ok(measurement.gzipBytes > 0 && measurement.gzipBytes < measurement.rawBytes);

    const pass = checkBudget(measurement, { initialGzipKiB: 1000 });
    assert.equal(pass.ok, true);
    assert.match(pass.lines.at(-1), /^PASS/);
    const fail = checkBudget(measurement, { initialGzipKiB: 0 });
    assert.equal(fail.ok, false);
    assert.match(fail.lines.at(-1), /^FAIL: first-load JS is \d+ KiB gzip over budget/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
