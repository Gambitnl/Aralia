#!/usr/bin/env node

/*
 * This installer wires the local Git pre-push hook to Aralia's tracked policy.
 *
 * Git does not store .git/hooks in commits, so every checkout has its own hidden
 * hook directory. This script keeps the hidden hook tiny and points it at
 * scripts/git/pre-push-aralia.sh, where the real project policy is visible.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ============================================================================
// Repo Location
// ============================================================================
// Ask Git for the repo root so this script works from any current directory
// inside Aralia, including when it is called through npm.
// ============================================================================
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const hooksDir = path.join(repoRoot, '.git', 'hooks');
const prePushHook = path.join(hooksDir, 'pre-push');

// ============================================================================
// Hook Body
// ============================================================================
// Keep the local hook as a delegator only. Future changes should happen in the
// tracked policy script, not in the hidden .git/hooks copy.
// ============================================================================
const hookBody = `#!/bin/sh

# This local Git hook delegates to the tracked Aralia policy script.
#
# Git does not commit files inside .git/hooks, so the real behavior lives in
# scripts/git/pre-push-aralia.sh where future agents can read and update it.

exec sh scripts/git/pre-push-aralia.sh "$@"
`;

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(prePushHook, hookBody, { encoding: 'utf8' });

// On Unix-like shells the executable bit matters. On Windows Git can run the hook
// by path even without chmod support, so chmod failures are reported but not fatal.
try {
  fs.chmodSync(prePushHook, 0o755);
} catch (error) {
  console.warn(`Hook installed, but chmod was skipped: ${error.message}`);
}

console.log(`Installed Aralia pre-push hook at ${prePushHook}`);
