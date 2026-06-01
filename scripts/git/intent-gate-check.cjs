#!/usr/bin/env node

/*
 * This script is the tracked executable for Aralia's local intent gate.
 *
 * The gate checks a local, ignored approval note before a strict push. Keeping
 * the executable in scripts/git makes the hook durable, while the approval note
 * can stay private in .agent/workflows/INTENT-GATE.local.md.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ============================================================================
// Repo Location
// ============================================================================
// Ask Git for the repo root so the same check works from the hook, npm scripts,
// or a direct agent command.
// ============================================================================
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

process.chdir(repoRoot);

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const gatePath = path.join(repoRoot, '.agent', 'workflows', 'INTENT-GATE.local.md');

// ============================================================================
// Emergency Bypass
// ============================================================================
// The bypass is deliberately loud. It exists for rare workflow repairs and
// docs-only syncs where the operator accepts the risk of pushing without a
// completed local approval note.
// ============================================================================
if (process.env.ARALIA_INTENT_GATE_BYPASS === '1') {
  console.warn('Intent gate bypassed because ARALIA_INTENT_GATE_BYPASS=1 is set.');
  process.exit(0);
}

// ============================================================================
// Local Approval File
// ============================================================================
// The approval file is local-only because it records session intent rather than
// product code. A missing file is a clear action item, not a JavaScript failure.
// ============================================================================
if (!fs.existsSync(gatePath)) {
  console.error('Intent gate file is missing.');
  console.error('Create .agent/workflows/INTENT-GATE.local.md with Status: approved before strict push.');
  process.exit(strict ? 1 : 0);
}

const content = fs.readFileSync(gatePath, 'utf8');
const statusMatch = content.match(/^\s*Status\s*:\s*(.+)\s*$/im);
const status = statusMatch ? statusMatch[1].trim().toLowerCase() : '';

if (status !== 'approved') {
  console.error('Intent gate is not approved.');
  console.error(`Current status: ${status || 'missing'}`);
  console.error('Set Status: approved in .agent/workflows/INTENT-GATE.local.md when the push direction is approved.');
  process.exit(strict ? 1 : 0);
}

console.log('Intent gate approved.');
