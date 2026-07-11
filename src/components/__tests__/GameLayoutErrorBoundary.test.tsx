import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../ui/ErrorBoundary';

/**
 * This regression proves the real boundary used around GameLayout turns a
 * render failure into the player-facing fallback instead of losing the page.
 *
 * The previous version imported the entire App behind dozens of global mocks.
 * This repository runs test files in a shared module environment, so those
 * mocks could replace lazy components in unrelated suites and make results
 * depend on file order. App-level isolation remains a separate infrastructure
 * decision; this focused test preserves the user-visible error contract.
 */

const BrokenGameLayout = () => {
  throw new Error('Test crash in GameLayout');
};

describe('GameLayout error fallback', () => {
  it('shows the actionable main-game fallback when the play surface crashes', () => {
    // React reports expected boundary catches to stderr. Silence only this
    // deliberate crash so genuine console failures elsewhere remain visible.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackMessage="An error occurred in the main game view.">
        <BrokenGameLayout />
      </ErrorBoundary>
    );

    expect(screen.getByText(/An error occurred in the main game view/i)).toBeInTheDocument();
    expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
