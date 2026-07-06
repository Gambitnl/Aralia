/**
 * These tests protect the floating party-chat launcher.
 *
 * The launcher is always available over the 2D play screen, so it must stay out
 * of the action column and narrative log text on phones while still being large
 * enough to tap.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UI_ID } from '../../../styles/uiIds';
import { CollapsibleBanterPanel } from '../CollapsibleBanterPanel';

const baseProps = {
  isActive: false,
  isWaiting: false,
  secondsRemaining: 0,
  history: [],
  archivedBanters: [],
  companions: {},
  onInterrupt: vi.fn(),
  onEndBanter: vi.fn(),
};

describe('CollapsibleBanterPanel', () => {
  it('hides the collapsed ambient launcher while modal windows own focus', () => {
    render(<CollapsibleBanterPanel {...baseProps} suppressCollapsedTab />);

    expect(screen.queryByTestId(UI_ID.BANTER_PANEL_COLLAPSED)).not.toBeInTheDocument();
  });

  it('keeps the collapsed tab on the phone edge away from action buttons and log prose', () => {
    render(<CollapsibleBanterPanel {...baseProps} />);

    expect(screen.getByTestId(UI_ID.BANTER_PANEL_COLLAPSED)).toHaveClass(
      'z-10',
      'max-[480px]:bottom-2',
      'max-[480px]:right-2',
      'max-[480px]:top-auto',
    );
    expect(screen.getByRole('button', { name: 'Open party chat' })).toHaveClass(
      'max-[480px]:h-11',
      'max-[480px]:w-11',
      'max-[480px]:p-0',
    );
  });

  it('keeps expanded banter header actions and tabs touch-sized', () => {
    render(<CollapsibleBanterPanel {...baseProps} onToggleBanterPause={vi.fn()} isBanterPaused />);

    fireEvent.click(screen.getByRole('button', { name: 'Open party chat' }));

    expect(screen.getByRole('button', { name: /Banter Off/i })).toHaveClass('min-h-11');
    expect(screen.getByTitle('Pop out').parentElement).toHaveClass('[&>button]:min-h-11', '[&>button]:min-w-11');
    expect(screen.getByRole('button', { name: /Live Chat/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Memories' })).toHaveClass('min-h-11');
  });
});
