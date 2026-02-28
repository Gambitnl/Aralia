import { describe, expect, it } from 'vitest';
import { computeHealthSignals } from './compute-health-signals';
import type { RoadmapNode } from '../../../../../scripts/roadmap-server-logic';

/**
 * This file verifies the health-signal rules for roadmap nodes.
 *
 * The roadmap visualizer calls `computeHealthSignals` to decide which warning badges
 * should appear beside each node. These tests lock down that behavior so future edits
 * do not silently remove important warnings that guide roadmap quality.
 */

// ============================================================================
// Test Fixtures
// ============================================================================
// This section creates a minimal node helper so each test can focus on one
// warning rule at a time without repeating shared node fields.
// ============================================================================
const baseNode = (): RoadmapNode => ({
  id: 'test_node',
  label: 'Test Node',
  type: 'milestone',
  status: 'active'
});

// ============================================================================
// computeHealthSignals Behavior
// ============================================================================
// Each test below validates one warning rule and confirms that unrelated warning
// kinds are not emitted accidentally for the same node state.
// ============================================================================
describe('computeHealthSignals', () => {
  // A node with no declared test file must be flagged as missing tests.
  it('returns no-test when testFile is absent', () => {
    expect(computeHealthSignals(baseNode(), []).some((s) => s.kind === 'no-test')).toBe(true);
  });

  // A node with a test file but no execution record must be flagged as not run yet.
  it('returns test-not-run when testFile exists but no lastTestRun', () => {
    const node: RoadmapNode = { ...baseNode(), testFile: 'src/foo.test.ts' };
    const sigs = computeHealthSignals(node, []);

    expect(sigs.some((s) => s.kind === 'test-not-run')).toBe(true);
    expect(sigs.some((s) => s.kind === 'no-test')).toBe(false);
  });

  // Once a node has both test metadata fields, it should not show test setup warnings.
  it('returns no test signals when both testFile and lastTestRun present', () => {
    const node: RoadmapNode = {
      ...baseNode(),
      testFile: 'src/foo.test.ts',
      lastTestRun: {
        timestamp: '2026-02-27T00:00:00Z',
        status: 'pass'
      }
    };
    const sigs = computeHealthSignals(node, []);

    expect(sigs.some((s) => s.kind === 'no-test')).toBe(false);
    expect(sigs.some((s) => s.kind === 'test-not-run')).toBe(false);
  });

  // Multiple component files indicate the node likely bundles too much scope.
  it('returns not-atomized when componentFiles has >1 entry', () => {
    expect(
      computeHealthSignals(
        { ...baseNode(), componentFiles: ['src/A.tsx', 'src/B.tsx'] },
        []
      ).some((s) => s.kind === 'not-atomized')
    ).toBe(true);
  });

  // Zero or one component file is acceptable and should not trigger atomization warnings.
  it('does not return not-atomized for 0 or 1 componentFiles', () => {
    expect(computeHealthSignals(baseNode(), []).some((s) => s.kind === 'not-atomized')).toBe(false);
    expect(
      computeHealthSignals({ ...baseNode(), componentFiles: ['src/A.tsx'] }, []).some(
        (s) => s.kind === 'not-atomized'
      )
    ).toBe(false);
  });

  // Large sibling groups should be flagged as a potential roadmap density problem.
  it('returns density-warning when siblings.length >= 12', () => {
    const siblings: RoadmapNode[] = Array.from({ length: 14 }, (_, i) => ({
      ...baseNode(),
      id: `sib_${i}`
    }));
    expect(computeHealthSignals(baseNode(), siblings).some((s) => s.kind === 'density-warning')).toBe(
      true
    );
  });

  // Smaller sibling groups should not show the density warning.
  it('does not return density-warning for siblings.length < 12', () => {
    const siblings: RoadmapNode[] = Array.from({ length: 5 }, (_, i) => ({
      ...baseNode(),
      id: `sib_${i}`
    }));
    expect(computeHealthSignals(baseNode(), siblings).some((s) => s.kind === 'density-warning')).toBe(
      false
    );
  });
});
