import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NodeHealthBadge } from './NodeHealthBadge';
import type { HealthSignal } from './types';

/**
 * This file verifies how roadmap health badges render for each warning signal.
 *
 * The roadmap visualizer uses this component to show compact warning icons beside
 * node labels. These tests ensure every signal kind shows the correct tooltip text
 * and that empty signal arrays render no badge output.
 */

// ============================================================================
// NodeHealthBadge Rendering Rules
// ============================================================================
// The test cases below protect the tooltip text behavior for each signal kind so
// users can hover badges and understand exactly what warning is being shown.
// ============================================================================
describe('NodeHealthBadge', () => {
  // If there are no signals, the component must render nothing to avoid layout noise.
  it('renders nothing when signals is empty', () => {
    const { container } = render(<NodeHealthBadge signals={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // The missing-test warning should expose a tooltip that contains "no test".
  it('renders title matching /no test/i for no-test signal', () => {
    render(<NodeHealthBadge signals={[{ kind: 'no-test', message: 'No test' }]} />);
    expect(screen.getByTitle(/no test/i)).toBeTruthy();
  });

  // The unrun-test warning should expose a tooltip that contains "not run".
  it('renders title matching /not run/i for test-not-run signal', () => {
    render(<NodeHealthBadge signals={[{ kind: 'test-not-run', message: 'Not run yet' }]} />);
    expect(screen.getByTitle(/not run/i)).toBeTruthy();
  });

  // The not-atomized warning should expose a tooltip that contains "split".
  it('renders title matching /split/i for not-atomized signal', () => {
    render(<NodeHealthBadge signals={[{ kind: 'not-atomized', message: 'Split needed' }]} />);
    expect(screen.getByTitle(/split/i)).toBeTruthy();
  });

  // The density warning should expose a tooltip that contains "siblings".
  it('renders title matching /siblings/i for density-warning signal', () => {
    render(
      <NodeHealthBadge
        signals={[{ kind: 'density-warning', message: '14 siblings at this level' }]}
      />
    );
    expect(screen.getByTitle(/siblings/i)).toBeTruthy();
  });

  // Multiple signals should render one tooltip-bearing element per signal.
  it('renders multiple [title] elements for multiple signals', () => {
    const signals: HealthSignal[] = [
      { kind: 'no-test', message: 'No test' },
      { kind: 'not-atomized', message: 'Split needed' }
    ];
    const { container } = render(<NodeHealthBadge signals={signals} />);
    expect(container.querySelectorAll('[title]').length).toBe(2);
  });
});
