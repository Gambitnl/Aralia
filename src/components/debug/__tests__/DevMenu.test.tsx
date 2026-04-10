/**
 * @file DevMenu.test.tsx
 * These tests cover the shared developer menu modal after the 2026-03-24
 * unification change.
 *
 * The important behavior here is not the full debug toolbox. It is the fact that
 * the modal now surfaces the real Dev Mode flag and can flip it directly, which
 * keeps the main-menu entry and the gameplay entry on the same conceptual path.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DevMenu from '../DevMenu';
import { GamePhase } from '../../../types';

// The DevMenu reaches into game context for a dispatch helper used by a temple test button.
// These tests do not exercise that path, so a small stable mock keeps the modal renderable.
vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: vi.fn(),
    state: {},
  }),
}));

// The model selector needs a short deterministic list to render.
vi.mock('../../../config/geminiConfig', () => ({
  GEMINI_TEXT_MODEL_FALLBACK_CHAIN: ['gemini-test-model'],
}));

// The embedded state viewer is not relevant to the Dev Mode unification behavior.
vi.mock('../StateViewer', () => ({
  default: () => <div>State Viewer</div>,
}));

describe('DevMenu', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onDevAction: vi.fn(),
    hasNewRateLimitError: false,
    currentModelOverride: null,
    onModelChange: vi.fn(),
    isDevModeEnabled: false,
    onSetDevModeEnabled: vi.fn(),
    gamePhase: GamePhase.PLAYING,
  };

  it('shows the enable toggle when Dev Mode is currently off', () => {
    render(<DevMenu {...baseProps} />);

    expect(screen.getByText('Dev Mode State')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable Dev Mode' })).toBeInTheDocument();
  });

  it('shows the disable toggle when Dev Mode is currently on', () => {
    render(<DevMenu {...baseProps} isDevModeEnabled={true} />);

    expect(screen.getByRole('button', { name: 'Disable Dev Mode' })).toBeInTheDocument();
  });

  it('forwards the next Dev Mode state when the shared toggle is clicked', () => {
    const onSetDevModeEnabled = vi.fn();

    render(<DevMenu {...baseProps} onSetDevModeEnabled={onSetDevModeEnabled} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enable Dev Mode' }));

    expect(onSetDevModeEnabled).toHaveBeenCalledWith(true);
  });

  it('shows Quick Start only when the shared menu is opened from the main menu', () => {
    const { rerender } = render(<DevMenu {...baseProps} gamePhase={GamePhase.MAIN_MENU} />);

    expect(screen.getByRole('button', { name: 'Quick Start (Dev)' })).toBeInTheDocument();

    rerender(<DevMenu {...baseProps} gamePhase={GamePhase.PLAYING} />);

    expect(screen.queryByRole('button', { name: 'Quick Start (Dev)' })).not.toBeInTheDocument();
  });
});
