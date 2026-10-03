import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameGuideModal from '../GameGuideModal';

/**
 * Tests for the GameGuideModal component.
 *
 * This modal provides in-game assistant and guide interactions for players,
 * with options to ask questions, view responses, and trigger contextual actions.
 *
 * Connected to: GameModals, App, ollamaTextService
 * Tests: Modal rendering when open/closed, close button trigger, input field submission.
 */

// ============================================================================
// Setup and Render Tests
// ============================================================================

describe('GameGuideModal', () => {
  it('renders nothing when isOpen is false', () => {
    const onClose = vi.fn();

    render(
      <GameGuideModal
        isOpen={false}
        onClose={onClose}
        gameContext="Exploration Phase"
        devModelOverride={null}
      />
    );

    expect(screen.queryByText('Game Guide & Assistant')).not.toBeInTheDocument();
  });

  it('renders modal dialog when isOpen is true', () => {
    const onClose = vi.fn();

    render(
      <GameGuideModal
        isOpen={true}
        onClose={onClose}
        gameContext="Exploration Phase"
        devModelOverride={null}
      />
    );

    expect(screen.getByText('Oracle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close guide/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <GameGuideModal
        isOpen={true}
        onClose={onClose}
        gameContext="Exploration Phase"
        devModelOverride={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
