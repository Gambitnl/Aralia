#!/usr/bin/env node

/*
 * This script summarizes broad type/lint debt without making that debt a sync
 * blocker by default.
 *
 * It gives humans and agents a compact view of the current quality backlog.
 * Use --strict when a review session intentionally wants lint or typecheck
 * failures to fail the command. --ratchet is a separate fast CI gate that stops
 * production any types and suppressions growing. --ratchet-update captures the
 * first baseline or lowers it; it never grants an increase.
 */

const { spawnSync } = require('node:child_process');

// ============================================================================
// Command Runner
// ============================================================================
// Child processes are captured so the script can summarize their output instead
// of dumping thousands of lint lines into ordinary workflow logs.
// ============================================================================
function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}


const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const METRICS = ['anyType', 'anyAssertion', 'eslintDisable', 'tsIgnore', 'tsExpectError', 'tsNoCheck'];
const POLICY = 'staged-production-src-v1';

// Match the checkout CI actually receives, including declarations and generated
// source. All intended source edits must be staged before checking. Tests and mocks have their
// own debt; they cannot spend or replenish the production allowance.
function isProductionSource(file) {
  return file.startsWith('src/') && /\.(?:[cm]?[jt]sx?)$/.test(file)
    && !/(?:^|\/)(?:__tests__|__mocks__|tests?|mocks)(?:\/|$)/.test(file)
    && !/\.(?:test|spec)(?:-d)?\.[cm]?[jt]sx?$/.test(file);
}

function productionEntries(root) {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '--stage', '-z', '--', 'src'], {
    cwd: root, encoding: 'utf8', shell: false, windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Cannot read staged source inventory: ' + result.stderr);
  const entries = [];
  for (const row of result.stdout.split('\0').filter(Boolean)) {
    const tab = row.indexOf('\t');
    const file = row.slice(tab + 1);
    if (!isProductionSource(file)) continue;
    const [mode, sha, stage] = row.slice(0, tab).split(' ');
    if (stage !== '0' || !['100644', '100755'].includes(mode)) throw new Error('Unmerged or non-regular source: ' + file);
    entries.push({ file, sha });
  }
  if (!entries.length) throw new Error('Production source inventory is empty. Run from the repository root.');
  return entries.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
}

// Read stage-zero blobs in one Git process. Working-tree edits by other agents
// never enter the baseline; stage intended changes before running this check.
// Byte lengths, rather than line splits, preserve Unicode and embedded newlines.
function stagedSources(root, entries) {
  const hashes = [...new Set(entries.map(entry => entry.sha))];
  const result = spawnSync('git', ['cat-file', '--batch'], {
    cwd: root, input: hashes.join('\n') + '\n', shell: false, windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Cannot read staged source blobs: ' + result.stderr.toString());
  const sources = new Map();
  let offset = 0;
  for (const sha of hashes) {
    const end = result.stdout.indexOf(10, offset);
    const header = result.stdout.subarray(offset, end).toString('utf8').split(' ');
    const size = Number(header[2]);
    if (end < offset || header[0] !== sha || header[1] !== 'blob' || !Number.isSafeInteger(size)
      || size < 0 || end + 1 + size >= result.stdout.length || result.stdout[end + 1 + size] !== 10) {
      throw new Error('Incomplete staged source blob: ' + sha);
    }
    sources.set(sha, result.stdout.subarray(end + 1, end + 1 + size));
    offset = end + 2 + size;
  }
  return sources;
}

// Reuse the scanner's syntax-aware comment projection. In particular, template
// strings, regular expressions, and JSX text must never become suppressions.
async function countSource(source, file) {
  const counts = Object.fromEntries(METRICS.map(key => [key, 0]));
  if (!/\bany\b|eslint-disable|@ts-(?:ignore|expect-error|nocheck)/.test(source)) return counts;
  const ts = require('typescript');
  const { analyzeSource } = await import(pathToFileURL(path.join(__dirname, 'sweep-syntax.mjs')).href);
  const evidence = analyzeSource(source, file);
  if (evidence.errors.length) throw new Error(file + ': syntax analysis failed: ' + evidence.errors[0].message);
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) counts.anyType++;
    if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
      && node.type.kind === ts.SyntaxKind.AnyKeyword) counts.anyAssertion++;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const line of evidence.lines) for (const comment of line.comments) {
    const directive = comment.trim().replace(/^(?:\/\/+|\/\*+|\*)\s*/, '');
    if (/^eslint-disable(?:-next-line|-line)?\b/.test(directive)) counts.eslintDisable++;
    if (/^@ts-ignore\b/.test(directive)) counts.tsIgnore++;
    if (/^@ts-expect-error\b/.test(directive)) counts.tsExpectError++;
    if (/^@ts-nocheck\b/.test(directive)) counts.tsNoCheck++;
  }
  return counts;
}

async function collectDebt(root) {
  const files = {};
  const inventory = productionEntries(root);
  const sources = stagedSources(root, inventory);
  for (const { file, sha } of inventory) {
    const counts = await countSource(sources.get(sha).toString('utf8'), file);
    if (METRICS.some(key => counts[key] > 0)) files[file] = counts;
  }
  return { schemaVersion: 1, policy: POLICY, files };
}

function validateBaseline(baseline) {
  if (!baseline || baseline.schemaVersion !== 1 || baseline.policy !== POLICY
    || !baseline.files || typeof baseline.files !== 'object' || Array.isArray(baseline.files)) {
    throw new Error('Invalid debt baseline schema or production policy.');
  }
  for (const [file, counts] of Object.entries(baseline.files)) {
    if (!isProductionSource(file) || file.includes('\\') || file.split('/').includes('..')
      || !counts || Object.keys(counts).length !== METRICS.length
      || !METRICS.every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
      || counts.anyAssertion > counts.anyType) throw new Error('Invalid debt baseline entry: ' + file);
  }
  return baseline;
}

function compareDebt(current, baseline) {
  const increases = [];
  const decreases = [];
  for (const file of [...new Set([...Object.keys(current.files), ...Object.keys(baseline.files)])].sort()) {
    for (const metric of METRICS) {
      const now = current.files[file]?.[metric] || 0;
      const limit = baseline.files[file]?.[metric] || 0;
      const change = { file, metric, current: now, baseline: limit };
      if (now > limit) increases.push(change);
      if (now < limit) decreases.push(change);
    }
  }
  return { increases, decreases };
}

// Updating may only lower existing allowances. First capture is explicit; normal
// checks never create or rewrite the baseline, especially inside CI. Review and
// move baseline paths with intentional source moves instead of granting new debt.
async function runRatchet({ root = process.cwd(), update = false, log = console.log } = {}) {
  const baselinePath = path.join(root, 'scripts/quality/debt-baseline.json');
  const current = await collectDebt(root);
  let baseline;
  try { baseline = validateBaseline(JSON.parse(fs.readFileSync(baselinePath, 'utf8'))); }
  catch (error) {
    if (!(update && error.code === 'ENOENT')) throw error;
  }
  const changes = baseline ? compareDebt(current, baseline) : { increases: [], decreases: [] };
  const totals = Object.fromEntries(METRICS.map(key => [key,
    Object.values(current.files).reduce((sum, row) => sum + row[key], 0)]));
  log('Staged production debt (stage intended edits first): ' + JSON.stringify(totals));
  for (const change of changes.increases.slice(0, 20)) {
    log('INCREASE ' + change.file + ' ' + change.metric + ': ' + change.current + ' > ' + change.baseline);
  }
  if (changes.increases.length) {
    log('FAIL: ' + changes.increases.length + ' production debt increases; baseline was not changed.');
    log('For intentional source moves, review and move the matching baseline path; do not grant a new allowance.');
    return { exitCode: 1, current, ...changes };
  }
  if (update) {
    const { writeFileWithRetry } = await import(pathToFileURL(path.join(__dirname, '../writeWithRetry.mjs')).href);
    await writeFileWithRetry(baselinePath, JSON.stringify(current, null, 2) + '\n');
    log('Baseline captured or lowered. Hold the Agora baseline lock in shared checkouts.');
  } else if (changes.decreases.length) {
    log('FAIL: ' + changes.decreases.length + ' allowances can shrink. Run node scripts/quality/debt-summary.cjs --ratchet-update and include the lower baseline.');
    return { exitCode: 1, current, ...changes };
  }
  log('PASS: production debt matches its ratcheted baseline.');
  return { exitCode: 0, current, ...changes };
}

function runAdvisory() {
  const strict = process.argv.includes('--strict');

  // ============================================================================
  // TypeScript Summary
  // ============================================================================
  // Typecheck output is summarized by TypeScript diagnostic code so broad failures
  // are visible as a shape, not as a wall of text.
  // ============================================================================
  printSection('TypeScript Debt');
  const typecheck = run('npm', ['run', 'typecheck', '--', '--pretty', 'false']);
  const typeOutput = `${typecheck.stdout || ''}\n${typecheck.stderr || ''}`.trim();

  if (typecheck.status === 0) {
    console.log('Typecheck: passed.');
  } else {
    const codeCounts = new Map();
    const diagnosticRegex = /error (TS\d+):/g;
    let match;
    while ((match = diagnosticRegex.exec(typeOutput)) !== null) {
      codeCounts.set(match[1], (codeCounts.get(match[1]) || 0) + 1);
    }

    const total = [...codeCounts.values()].reduce((sum, count) => sum + count, 0);
    console.log(`Typecheck: failed with ${total || 'unknown'} reported TypeScript diagnostics.`);
    for (const [code, count] of [...codeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`- ${code}: ${count}`);
    }
  }

  // ============================================================================
  // ESLint Summary
  // ============================================================================
  // ESLint JSON output is grouped by rule and by broad file area. This keeps the
  // existing debt legible without implying it must be fixed during unrelated work.
  // ============================================================================
  printSection('Lint Debt');
  const lint = run('npx', ['eslint', 'src', 'scripts', 'tests', '--format', 'json']);
  const lintOutput = lint.stdout || '[]';

  try {
    const results = JSON.parse(lintOutput);
    const ruleCounts = new Map();
    const areaCounts = new Map();
    let warningCount = 0;
    let errorCount = 0;

    for (const fileResult of results) {
      const normalizedPath = fileResult.filePath.replace(/\\/g, '/');
      const area = normalizedPath.includes('/src/')
        ? 'src'
        : normalizedPath.includes('/scripts/')
          ? 'scripts'
          : normalizedPath.includes('/tests/')
            ? 'tests'
            : 'other';

      for (const message of fileResult.messages) {
        if (message.severity === 2) errorCount += 1;
        if (message.severity === 1) warningCount += 1;

        const ruleId = message.ruleId || 'parser-or-config';
        ruleCounts.set(ruleId, (ruleCounts.get(ruleId) || 0) + 1);
        areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
      }
    }

    console.log(`ESLint: ${errorCount} errors, ${warningCount} warnings.`);
    console.log('Top rule groups:');
    for (const [rule, count] of [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`- ${rule}: ${count}`);
    }

    console.log('File areas:');
    for (const [area, count] of [...areaCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`- ${area}: ${count}`);
    }
  } catch (error) {
    console.log('ESLint summary could not parse JSON output.');
    console.log(error.message);
  }

  // ============================================================================
  // Import Hygiene (GG-122 / GG-123)
  // ============================================================================
  // Orphan modules (zero inbound imports) and tracked-file imports that resolve
  // under gitignored paths. Advisory here; the underlying check is
  // scripts/quality/import-hygiene.cjs, which exits 1 on ignored imports.
  // ============================================================================
  printSection('Import Hygiene (orphans + gitignored imports)');
  const hygiene = run('node', ['scripts/quality/import-hygiene.cjs']);
  console.log((hygiene.stdout || '').trim().split('\n').slice(0, 6).join('\n'));
  if (hygiene.status !== 0) {
    console.log('- gitignored-import violations found: run `node scripts/quality/import-hygiene.cjs` for details');
  }

  // ============================================================================
  // Exit Policy
  // ============================================================================
  // Normal mode is advisory. Strict mode is available for sessions that deliberately
  // choose to make broad quality debt blocking.
  // ============================================================================
  if (strict && (typecheck.status !== 0 || lint.status !== 0)) {
    return 1;
  }

  return 0;
}

module.exports = { isProductionSource, countSource, collectDebt, compareDebt, validateBaseline, runRatchet };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--ratchet') || args.includes('--ratchet-update')) {
    if (args.length !== 1) { console.error('Use exactly --ratchet or --ratchet-update.'); process.exitCode = 1; }
    else runRatchet({ update: args[0] === '--ratchet-update' })
      .then(result => { process.exitCode = result.exitCode; })
      .catch(error => { console.error('Debt ratchet failed: ' + error.message); process.exitCode = 1; });
  } else { process.exitCode = runAdvisory(); }
}
