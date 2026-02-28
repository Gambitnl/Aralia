import type { RoadmapNode } from '../../../../../scripts/roadmap-server-logic';
import type { HealthSignal } from './types';

/**
 * This file translates roadmap-node metadata into UI health warning signals.
 *
 * The roadmap visualizer calls this function while rendering each node badge row.
 * It centralizes all health-signal rules so tests and UI rendering share one source
 * of truth for "missing tests", "not atomized", and "too many siblings" warnings.
 */

// ============================================================================
// Signal Thresholds
// ============================================================================
// This threshold marks the sibling count where roadmap density starts to look
// unhealthy and should be surfaced as a warning signal in the UI.
// ============================================================================
const DENSITY_WARNING_THRESHOLD = 12;

// ============================================================================
// Signal Computation
// ============================================================================
// This function inspects a node and its siblings and produces a list of warnings
// that the visualizer can turn into colored badge icons.
// ============================================================================
export function computeHealthSignals(node: RoadmapNode, siblings: RoadmapNode[]): HealthSignal[] {
  // Build signals in order so the UI presents consistent warning ordering.
  const signals: HealthSignal[] = [];

  // If no test file is declared at all, mark the node as missing tests.
  // If a test file exists but no run metadata exists, mark it as not run yet.
  if (!node.testFile) {
    signals.push({
      kind: 'no-test',
      message: 'No test file declared for this node.'
    });
  } else if (!node.lastTestRun) {
    signals.push({
      kind: 'test-not-run',
      message: 'Test file exists but has never been run.'
    });
  }

  // Treat undefined component metadata as an empty list so the atomization rule
  // can run without extra null checks.
  const componentFiles = node.componentFiles ?? [];

  // A node tied to multiple component files likely combines too much scope and
  // should be split into smaller roadmap units.
  if (componentFiles.length > 1) {
    signals.push({
      kind: 'not-atomized',
      message: `Node maps to ${componentFiles.length} component files; consider splitting.`
    });
  }

  // Large sibling groups are a proxy for scope creep at a single roadmap level.
  if (siblings.length >= DENSITY_WARNING_THRESHOLD) {
    signals.push({
      kind: 'density-warning',
      message: `${siblings.length} siblings at this level; possible scope creep.`
    });
  }

  // Return every triggered warning so the caller can render one badge per signal.
  return signals;
}
