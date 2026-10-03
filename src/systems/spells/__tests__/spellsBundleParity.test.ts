/**
 * Spells Bundle Parity Verification Test (WF-G162)
 *
 * This test ensures that the compiled runtime artifact `public/data/spells_bundle.json`
 * stays exactly in sync with the individual source spell JSON files located in
 * `public/data/spells/`.
 *
 * In Aralia, game systems and UI load spell data at runtime from `spells_bundle.json`
 * for optimal performance. If an author or automated agent modifies or adds a spell in
 * `public/data/spells/` without regenerating the bundle, the running game continues to
 * load stale spell definitions.
 *
 * If this test fails:
 *   Run: `npm run spells:bundle`
 *
 * Related:
 *   - scripts/bundle-static-data.ts (--spells flag)
 *   - tools/agora/WORKFLOW_GAPS.md (WF-G162)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Define paths to public static data
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SPELLS_DIR = path.join(PUBLIC_DIR, 'data', 'spells');
const SPELLS_MANIFEST_PATH = path.join(PUBLIC_DIR, 'data', 'spells_manifest.json');
const SPELLS_BUNDLE_PATH = path.join(PUBLIC_DIR, 'data', 'spells_bundle.json');

describe('Spells Bundle Parity (WF-G162)', () => {
  it('manifest and bundle files exist on disk', () => {
    expect(fs.existsSync(SPELLS_MANIFEST_PATH)).toBe(true);
    expect(fs.existsSync(SPELLS_BUNDLE_PATH)).toBe(true);
  });

  it('every individual spell JSON matches its entry in spells_bundle.json', () => {
    // Read the compiled spells bundle
    const bundleRaw = fs.readFileSync(SPELLS_BUNDLE_PATH, 'utf-8');
    const bundle = JSON.parse(bundleRaw) as Record<string, any>;

    // Discover all spell JSON files on disk
    const files = glob.sync('**/*.json', { cwd: SPELLS_DIR });
    expect(files.length).toBeGreaterThan(0);

    const mismatches: string[] = [];
    const missingInBundle: string[] = [];

    // Check each file on disk against the bundle
    for (const relativePath of files) {
      const fullPath = path.join(SPELLS_DIR, relativePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const spellData = JSON.parse(content);
      const spellId = spellData.id;

      if (!spellId) {
        mismatches.push(`File ${relativePath} is missing an 'id' property.`);
        continue;
      }

      const bundledEntry = bundle[spellId];
      if (!bundledEntry) {
        missingInBundle.push(`${spellId} (${relativePath})`);
        continue;
      }

      // Deep compare the source file data with the bundled object
      if (JSON.stringify(spellData) !== JSON.stringify(bundledEntry)) {
        mismatches.push(`${spellId} (${relativePath})`);
      }
    }

    // Report clean, actionable failure messages if drift is detected
    if (missingInBundle.length > 0 || mismatches.length > 0) {
      const errorMsg = [
        'Spells bundle is out of sync with source JSON files!',
        missingInBundle.length ? `Missing from bundle (${missingInBundle.length}):\n  - ${missingInBundle.join('\n  - ')}` : '',
        mismatches.length ? `Data mismatch with bundle (${mismatches.length}):\n  - ${mismatches.join('\n  - ')}` : '',
        '\nRun `npm run spells:bundle` to update public/data/spells_bundle.json.'
      ].filter(Boolean).join('\n');

      expect.fail(errorMsg);
    }
  });

  it('bundle contains no extra orphaned spells not present in the manifest', () => {
    const bundleRaw = fs.readFileSync(SPELLS_BUNDLE_PATH, 'utf-8');
    const bundle = JSON.parse(bundleRaw) as Record<string, any>;

    const manifestRaw = fs.readFileSync(SPELLS_MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestRaw) as Record<string, any>;

    const bundleKeys = Object.keys(bundle);
    const manifestKeys = new Set(Object.keys(manifest));

    const orphanedInBundle = bundleKeys.filter((id) => !manifestKeys.has(id));
    expect(orphanedInBundle).toEqual([]);
  });
});
