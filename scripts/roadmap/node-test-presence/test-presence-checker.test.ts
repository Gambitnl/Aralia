import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';

// Force `existsSync` to be a true vi.fn so test cases can set return values safely.
const { existsSyncMock } = vi.hoisted(() => ({ existsSyncMock: vi.fn() }));
vi.mock('fs', () => ({
  default: { existsSync: existsSyncMock },
  existsSync: existsSyncMock
}));
import { checkTestPresence } from './test-presence-checker';
import type { RoadmapNode } from '../../roadmap-server-logic';

/**
 * This file verifies the roadmap test-presence checker behavior.
 *
 * The roadmap server uses this checker to annotate nodes with whether a declared
 * test file exists on disk. These tests protect that contract so missing tests and
 * undeclared tests are reported consistently.
 */

// ============================================================================
// Test Fixtures
// ============================================================================
// This section provides a minimal roadmap node helper so each test can focus on
// one test-presence scenario without repeating shared fields.
// ============================================================================
const baseNode = (): RoadmapNode => ({
  id: 'test_node',
  label: 'Test Node',
  type: 'milestone',
  status: 'active'
});

// ============================================================================
// checkTestPresence Scenarios
// ============================================================================
// These cases cover all required states: no declared test path, declared but
// missing path, and declared + present file on disk.
// ============================================================================
describe('checkTestPresence', () => {
  // Reset mock state so every scenario is isolated.
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // A node without testFile metadata should report "not declared" and "not present".
  it('returns testFileExists: false when testFile not declared', () => {
    const result = checkTestPresence(baseNode(), '/repo/root');
    expect(result.testFileExists).toBe(false);
    expect(result.testFileDeclared).toBe(false);
  });

  // A declared file that does not exist on disk should remain marked as missing.
  it('returns testFileDeclared: true, testFileExists: false when file missing on disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = checkTestPresence({ ...baseNode(), testFile: 'src/foo.test.ts' }, '/repo/root');
    expect(result.testFileDeclared).toBe(true);
    expect(result.testFileExists).toBe(false);
  });

  // A declared file that exists on disk should be marked as present.
  it('returns testFileDeclared: true, testFileExists: true when file exists on disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = checkTestPresence({ ...baseNode(), testFile: 'src/foo.test.ts' }, '/repo/root');
    expect(result.testFileDeclared).toBe(true);
    expect(result.testFileExists).toBe(true);
  });
});
