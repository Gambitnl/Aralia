import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This verifier protects the narrow GitHub Actions improvement allowed by the
// Symphony goal. The check must provide better PR diagnosis without converting
// known quality debt into a noisy merge blocker.

const workflow = await readFile(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');

assert.match(workflow, /quality-scan:/);
assert.match(workflow, /name:\s*Quality Scan \(advisory\)/);
assert.match(workflow, /run:\s*npm run scan/);
assert.match(workflow, /surfaces grouped quality-debt counts/);
assert.match(workflow, /does not block merges/);
assert.match(workflow, /npm --silent run scan -- --json > quality-scan\.json/);
assert.match(workflow, /actions\/upload-artifact@v7/);
assert.match(workflow, /name:\s*quality-scan-json/);
assert.match(workflow, /path:\s*quality-scan\.json/);
assert.match(workflow, /GITHUB_STEP_SUMMARY/);
assert.match(workflow, /Quality scan JSON artifact/);
