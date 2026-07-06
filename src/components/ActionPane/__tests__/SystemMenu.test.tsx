/**
 * These tests protect the always-visible system menu trigger.
 *
 * The trigger opens the player's journals, saves, and exit actions from the 2D
 * play screen. It needs to remain large enough to tap even when the play column
 * is cramped on a phone-sized viewport.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemMenu } from '../SystemMenu';

const defaultProps = {
  onAction: vi.fn(),
  disabled: false,
  unreadDiscoveryCount: 0,
  hasNewRateLimitError: false,
  isDevModeEnabled: false,
  autoSaveEnabled: true,
};

describe('SystemMenu', () => {
  it('keeps the menu trigger large enough to tap from the play screen', () => {
    render(<SystemMenu {...defaultProps} />);

    expect(screen.getByRole('button', { name: /^Menu$/i })).toHaveClass('min-h-11');
  });

  it('keeps the opened menu compact and independently scrollable', () => {
    render(<SystemMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /^Menu$/i }));

    const firstMenuItem = screen.getByRole('menuitem', { name: 'Discoveries' });

    expect(screen.getByRole('menu')).toHaveClass('gap-1', 'overflow-y-auto');
    expect(firstMenuItem).toHaveClass(
      '!h-11',
      '!py-2',
      '!text-base',
    );
    expect(firstMenuItem).toHaveStyle({ minHeight: '44px' });
  });
});
