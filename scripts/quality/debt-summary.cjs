#!/usr/bin/env node

/*
 * This script summarizes broad type/lint debt without making that debt a sync
 * blocker by default.
 *
 * It gives humans and agents a compact view of the current quality backlog.
 * Use --strict when a review session intentionally wants lint or typecheck
 * failures to fail the command.
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
// Exit Policy
// ============================================================================
// Normal mode is advisory. Strict mode is available for sessions that deliberately
// choose to make broad quality debt blocking.
// ============================================================================
if (strict && (typecheck.status !== 0 || lint.status !== 0)) {
  process.exit(1);
}

process.exit(0);
