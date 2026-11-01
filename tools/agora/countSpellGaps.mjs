// WF-G343: measure the live spell corpus instead of copying an old task count.
// The existing integrity checker owns all spell rules and reviewed clearances.
// This read-only adapter groups its actual findings by FILE, stamps the result,
// and refuses usable counts when parsing/schema validation left files unchecked.
// Run: node --import tsx tools/agora/countSpellGaps.mjs [--root <fixture-dir>]
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../../public/data/spells');

/** A complete scan can contain gaps; that is a measurement, not a passing gate. */
export function summarizeSpellGaps(result, { root = DEFAULT_ROOT, measuredAt = new Date().toISOString() } = {}) {
  if (!result || !Number.isInteger(result.scanned) || result.scanned < 0
    || !Number.isInteger(result.checked) || result.checked < 0 || result.checked > result.scanned
    || !Array.isArray(result.failures) || !Array.isArray(result.cleared)
    || result.failures.some(item => typeof item?.file !== 'string' || !Array.isArray(item.issues)
      || item.issues.some(issue => typeof issue !== 'string'))) throw new Error('Invalid canonical integrity result');
  const complete = result.scanned > 0 && result.checked === result.scanned;
  const gapFiles = Object.fromEntries(['Enchantment Gap', 'Upcast Gap'].map(label => [label,
    [...new Set(result.failures.filter(item => item.issues.some(issue => issue.startsWith(label + ':')))
      .map(item => item.file))].sort()]));
  return { measuredAt, root: path.resolve(root), source: 'scripts/validateSpellIntegrity.ts#checkSpellIntegrity',
    unit: 'files', scanned: result.scanned, checked: result.checked, complete,
    counts: complete ? Object.fromEntries(Object.entries(gapFiles).map(([label, files]) => [label, files.length])) : null,
    gapFiles: complete ? gapFiles : null, mechanicalGatePass: complete && result.failures.length === 0,
    reviewedClearances: result.cleared, failures: result.failures,
    limitation: 'A timestamped snapshot, not future corpus authority. Incomplete scans provide no usable gap counts.' };
}

export async function measureSpellGaps(root = DEFAULT_ROOT) {
  // tsx is already the repository's TypeScript CLI loader. No replacement
  // rules engine, test run, server startup or source/data writes occur here.
  const { checkSpellIntegrity } = await import('../../scripts/validateSpellIntegrity.ts');
  return summarizeSpellGaps(checkSpellIntegrity(path.resolve(root)), { root });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1] || args[1].startsWith('--'))) {
      throw new Error('Usage: node --import tsx tools/agora/countSpellGaps.mjs [--root <fixture-dir>]');
    }
    const receipt = await measureSpellGaps(args[1] || DEFAULT_ROOT);
    console.log(JSON.stringify(receipt, null, 2));
    if (!receipt.complete) process.exitCode = 2;
  } catch (error) {
    console.log(JSON.stringify({ measuredAt: new Date().toISOString(), complete: false, counts: null,
      error: error.message, guidance: 'Use the repository tsx loader and repair measurement input; never substitute zero counts.' }, null, 2));
    process.exitCode = 2;
  }
}
