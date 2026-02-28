import fs from 'fs';
import path from 'path';
import type { RoadmapNode } from '../../roadmap-server-logic';

/**
 * This file determines whether a roadmap node declares a test file and whether that
 * declared file actually exists on disk.
 *
 * The roadmap data pipeline calls this helper while preparing node payloads so the UI
 * can show health signals for "test declared" versus "test truly present."
 */

// ============================================================================
// Result Contract
// ============================================================================
// This shape gives callers both declaration state and filesystem state, plus the
// resolved absolute path when a declaration exists.
// ============================================================================
export interface TestPresenceResult {
  testFileDeclared: boolean;
  testFileExists: boolean;
  resolvedPath?: string;
}

// ============================================================================
// Presence Check
// ============================================================================
// Resolve a node's test path against repo root and probe the filesystem to see
// whether that path currently exists.
// ============================================================================
export function checkTestPresence(node: RoadmapNode, repoRoot: string): TestPresenceResult {
  // Nodes with no declared test file are immediately marked as undeclared/missing.
  if (!node.testFile) {
    return { testFileDeclared: false, testFileExists: false };
  }

  // Convert relative test paths into an absolute on-disk path from the repository root.
  const resolvedPath = path.resolve(repoRoot, node.testFile);

  // Probe filesystem existence so downstream UI can differentiate declared vs present tests.
  const testFileExists = fs.existsSync(resolvedPath);

  // Return both declaration and existence flags for downstream health logic.
  return { testFileDeclared: true, testFileExists, resolvedPath };
}
