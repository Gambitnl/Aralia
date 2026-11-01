/**
 * This file tests the domain documentation current-state path checker (`domainDocCheck.mjs`).
 *
 * It verifies that missing paths under current-state headings ("Verified Current Entry Points",
 * "Current Domain Shape", "What Is Materially Implemented") are caught, while historical or
 * retired headings and explicit absence statements are ignored, and that the real
 * `docs/architecture/domains/*.md` corpus passes with zero unresolved paths (WF-G195).
 *
 * Called by: `node --test tools/agora/domainDocCheck.test.mjs`
 * Depends on: `tools/agora/domainDocCheck.mjs`
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkDomainDocText,
  checkAllDomainDocs,
  isCurrentStateHeading,
} from './domainDocCheck.mjs';

// ============================================================================
// Unit & Integration Tests
// ============================================================================
// Tests heading classification, synthetic doc scanning, and the live repository
// domain documentation corpus.
// ============================================================================

test('WF-G195: isCurrentStateHeading distinguishes current-state from retired/historical headings', () => {
  assert.equal(isCurrentStateHeading('Verified Current Entry Points'), true);
  assert.equal(isCurrentStateHeading('Current Domain Shape'), true);
  assert.equal(isCurrentStateHeading('What Is Materially Implemented'), true);
  assert.equal(isCurrentStateHeading('Retired Legacy Entry Points'), false);
  assert.equal(isCurrentStateHeading('Historical Drift Corrected'), false);
  assert.equal(isCurrentStateHeading('Open Questions and Gaps'), false);
});

test('WF-G195: checkDomainDocText flags missing paths under current-state headings and ignores retired headings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-domain-doc-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'src', 'systems'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'systems', 'liveSystem.ts'), 'export {};\n');

    const markdown = [
      '# Sample Domain',
      '',
      'Verified: 2026-10-22',
      '',
      '## Historical Drift Corrected',
      '- `src/systems/deletedLegacy.ts` was removed.',
      '',
      '## Verified Current Entry Points',
      '- Live file: `src/systems/liveSystem.ts`',
      '- Stale file: `src/systems/missingEntry.ts`',
      '- Explicit absence note: `src/systems/absentByDesign.ts` is not present in the current repo.',
    ].join('\n');

    const result = checkDomainDocText(markdown, {
      repoRoot: tmpDir,
      file: 'docs/architecture/domains/sample.md',
    });

    assert.equal(result.checked.length, 2);
    assert.equal(result.unresolved.length, 1);
    assert.equal(result.unresolved[0].path, 'src/systems/missingEntry.ts');
    assert.equal(result.unresolved[0].line, 10);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('WF-G195: all docs/architecture/domains/*.md files have zero unresolved paths under current-state headings', () => {
  const result = checkAllDomainDocs();
  assert.ok(result.filesScanned >= 40, `Expected at least 40 domain docs, got ${result.filesScanned}`);
  assert.ok(result.checkedCount >= 100, `Expected at least 100 checked paths, got ${result.checkedCount}`);
  assert.deepEqual(result.unresolved, []);
});
