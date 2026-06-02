/**
 * @file DebugHUD.worldGen.test.tsx
 * Surfaces world-generation provenance (fallback/flat) in the dev DebugHUD — worldsim-service WSS-004.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebugHUD from '../DebugHUD';

const baseProps = { chunkCount: 0, fps: 60, playerPos: null };

describe('DebugHUD world-generation provenance', () => {
  it('shows the primary source label and no warning for azgaar-derived worlds', () => {
    render(<DebugHUD {...baseProps} worldGen={{ source: 'azgaar-derived', at: 1 }} />);
    expect(screen.getByTestId('debug-world-gen')).toHaveTextContent('Azgaar-derived');
    expect(screen.queryByTestId('debug-world-gen-reason')).toBeNull();
  });

  it('shows the fallback reason when generation fell back to the legacy generator', () => {
    render(
      <DebugHUD
        {...baseProps}
        worldGen={{
          source: 'legacy-fallback',
          reason: 'TypeError: heights is undefined',
          at: 2,
        }}
      />,
    );
    expect(screen.getByTestId('debug-world-gen')).toHaveTextContent('LEGACY FALLBACK');
    expect(screen.getByTestId('debug-world-gen-reason')).toHaveTextContent(
      'TypeError: heights is undefined',
    );
  });

  it('warns for biome-derived worlds even without an explicit reason', () => {
    render(<DebugHUD {...baseProps} worldGen={{ source: 'biome-derived', at: 3 }} />);
    expect(screen.getByTestId('debug-world-gen')).toHaveTextContent('BIOME-DERIVED');
    expect(screen.getByTestId('debug-world-gen-reason')).toBeInTheDocument();
  });

  it('renders nothing extra when worldGen is absent', () => {
    render(<DebugHUD {...baseProps} />);
    expect(screen.queryByTestId('debug-world-gen')).toBeNull();
  });
});
