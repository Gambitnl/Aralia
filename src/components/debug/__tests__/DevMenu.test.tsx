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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DevMenu from '../DevMenu';
import { GamePhase } from '../../../types';
import {
  STANDARD_UNLOCK_FLAGS,
  createEmptyUnlockRegistry,
  setUnlockFlag,
} from '../../../systems/dialogue/unlockRegistry';

const mockDispatch = vi.fn();

// Mutable so a test can hand the modal a real GameState slice (the unlock-flag
// panel reads `state.worldFacts`). Defaults to the empty object the pre-existing
// Dev Mode tests relied on.
let mockState: Record<string, unknown> = {};

// The DevMenu reaches into game context for a dispatch helper used by a temple test button.
// These tests do not exercise that path, so a small stable mock keeps the modal renderable.
vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: mockDispatch,
    state: mockState,
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

  it('shows economy modal toggles', () => {
    render(<DevMenu {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Ledger Book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Courier Pouch' })).toBeInTheDocument();
  });

  it('forwards economy modal actions', () => {
    const onDevAction = vi.fn();
    render(<DevMenu {...baseProps} onDevAction={onDevAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ledger Book' }));
    expect(onDevAction).toHaveBeenCalledWith('toggle_economy_ledger');

    fireEvent.click(screen.getByRole('button', { name: 'Courier Pouch' }));
    expect(onDevAction).toHaveBeenCalledWith('toggle_courier_pouch');
  });

  it('opens the Investment Board by dispatching the modal toggle and closing the menu', () => {
    const onClose = vi.fn();

    mockDispatch.mockClear();
    render(<DevMenu {...baseProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Investment Board' }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_INVESTMENT_BOARD' });
    expect(onClose).toHaveBeenCalled();
  });
  // ------------------------------------------------------------------
  // Unlock-flag registry panel (DIAL-004)
  // ------------------------------------------------------------------
  describe('unlock flags panel', () => {
    afterEach(() => {
      mockState = {};
    });

    it('lists every standard flag plus any graph-set flag, and toggles through the real actions', () => {
      // A registry with one standard flag set (carrying a payload) and one
      // ad-hoc flag an authored dialogue graph set via `set_flag`.
      let registry = setUnlockFlag(createEmptyUnlockRegistry(), STANDARD_UNLOCK_FLAGS.GAINED_FACTION_TRUST, {
        value: 'sworn',
        sourceNpcId: 'npc_quartermaster',
        setAt: 1000,
      });
      registry = setUnlockFlag(registry, 'ferryman_owes_favor', { setAt: 2000 });
      mockState = { worldFacts: registry };

      mockDispatch.mockClear();
      render(<DevMenu {...baseProps} />);

      expect(screen.getByText('Unlock Flags')).toBeInTheDocument();

      // All four standard flags are shown whether set or not, so an unset flag
      // is visibly "not yet unlocked" rather than simply missing.
      for (const flag of Object.values(STANDARD_UNLOCK_FLAGS)) {
        expect(screen.getByTestId(`unlock-flag-${flag}`)).toBeInTheDocument();
      }
      // ...and the extra runtime flag is listed too.
      expect(screen.getByTestId('unlock-flag-ferryman_owes_favor')).toBeInTheDocument();

      const trustRow = screen.getByTestId(`unlock-flag-${STANDARD_UNLOCK_FLAGS.GAINED_FACTION_TRUST}`);
      expect(trustRow).toHaveTextContent('SET');
      expect(trustRow).toHaveTextContent('= sworn');
      expect(trustRow).toHaveTextContent('via npc_quartermaster');

      const passwordRow = screen.getByTestId(`unlock-flag-${STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD}`);
      expect(passwordRow).toHaveTextContent('unset');

      // Toggling goes through the real reducer actions, not a state poke.
      fireEvent.click(within(passwordRow).getByRole('button', { name: 'Set' }));
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_UNLOCK_FLAG',
        payload: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD, sourceTopicId: 'dev_menu' },
      });

      fireEvent.click(within(trustRow).getByRole('button', { name: 'Clear' }));
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'CLEAR_UNLOCK_FLAG',
        payload: { flag: STANDARD_UNLOCK_FLAGS.GAINED_FACTION_TRUST },
      });
    });

    it('renders the panel for a legacy save that has no registry at all', () => {
      mockState = {};
      render(<DevMenu {...baseProps} />);

      expect(screen.getByText('Unlock Flags')).toBeInTheDocument();
      expect(
        screen.getByTestId(`unlock-flag-${STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET}`),
      ).toHaveTextContent('unset');
    });
  });
});
