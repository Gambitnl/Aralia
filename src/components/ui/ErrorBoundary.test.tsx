/**
 * @file ErrorBoundary.test.tsx
 * Focused coverage for the fallback panel shown when a child tree crashes.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { Z_INDEX } from '../../styles/zIndex';

class CrashingChild extends React.Component {
  render() {
    throw new Error('Test crash');
  }
}

describe('ErrorBoundary', () => {
  it('renders the fallback on the error overlay layer', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary fallbackMessage="Broken area">
        <CrashingChild />
      </ErrorBoundary>
    );

    const heading = screen.getByRole('heading', { name: /Oops! Something went wrong/i });
    expect(heading.closest('div')).toHaveStyle({ zIndex: String(Z_INDEX.ERROR_OVERLAY) });
    expect(screen.getByText('Broken area')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
