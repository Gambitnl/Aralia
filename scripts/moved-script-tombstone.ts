#!/usr/bin/env tsx

/**
 * This helper is the "tombstone" runner for moved scripts.
 *
 * Why this exists:
 * Agents and shell aliases often call scripts by hardcoded paths. When scripts are moved to a
 * better workflow folder, those old calls silently break unless we fail loudly and explain where
 * the script moved. This helper standardizes that behavior so every tombstone prints the same
 * guidance and exits with a non-zero code.
 *
 * How this connects:
 * Old script paths keep a tiny wrapper that imports this file and calls runMovedScriptTombstone.
 * New script paths live in scripts/workflows/... and contain the actual automation logic.
 */

// ============================================================================
// Types
// ============================================================================
// This describes the migration metadata that each tombstone must provide.
// Keeping this structured makes the output consistent across all moved scripts.
// ============================================================================
export interface MovedScriptTombstoneOptions {
  oldPath: string;
  newPath: string;
  reason: string;
  followUp: string;
}

// ============================================================================
// Runner
// ============================================================================
// This prints a loud migration message and fails the process intentionally.
// The non-zero exit code is deliberate: CI and agent flows should stop immediately
// so the caller updates the path instead of accidentally continuing with stale logic.
// ============================================================================
export function runMovedScriptTombstone(options: MovedScriptTombstoneOptions): never {
  const lines = [
    '',
    'SCRIPT PATH MOVED (TOMBSTONE)',
    `- Old path: ${options.oldPath}`,
    `- New path: ${options.newPath}`,
    `- Reason: ${options.reason}`,
    `- Required action: ${options.followUp}`,
    '- Agent instruction: report this path mismatch to the user and update the calling flow.',
    ''
  ];

  for (const line of lines) console.error(line);
  process.exit(2);
}

