import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DragonbornAncestrySelection from '../DragonbornAncestrySelection';

/**
 * Tests for the Dragonborn Ancestry Selection component.
 *
 * When a player creates a Dragonborn hero, this screen lets them choose which dragon
 * bloodline flows through their veins (such as Red, Blue, Gold, or Silver). This choice
 * decides what kind of breath weapon they breathe and which damage type they resist.
 *
 * Connected to: CharacterCreator (during the Dragonborn sub-step of character creation)
 * Tests: Chromatic and Metallic dragon options, damage type indicators, selection state, and callbacks.
 */

describe('DragonbornAncestrySelection', () => {
  // ============================================================================
  // Setup and Render Tests
  // ============================================================================

  it('renders chromatic and metallic dragons and requires selection before proceeding', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DragonbornAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    // Verify title and instructions are displayed for the player
    expect(screen.getByText('Choose Your Draconic Ancestry')).toBeInTheDocument();
    expect(screen.getByText(/Your ancestry determines your damage resistance/i)).toBeInTheDocument();

    // Verify chromatic and metallic headers exist
    expect(screen.getByText(/Chromatic Dragons/i)).toBeInTheDocument();
    expect(screen.getByText(/Metallic Dragons/i)).toBeInTheDocument();

    // The confirm button should be disabled until an ancestry is picked
    const confirmButton = screen.getByRole('button', { name: /Confirm selected draconic ancestry/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Interaction and Selection Tests
  // ============================================================================

  it('selects Red Dragon ancestry and submits upon confirmation', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DragonbornAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    // Find the Red Dragon option card and click it
    const redDragonCard = screen.getByRole('button', { name: /Select Red dragon ancestry/i });
    fireEvent.click(redDragonCard);

    // Verify the card is marked as selected (aria-pressed = true)
    expect(redDragonCard).toHaveAttribute('aria-pressed', 'true');

    // The confirm button should now be enabled
    const confirmButton = screen.getByRole('button', { name: /Confirm selected draconic ancestry/i });
    expect(confirmButton).toBeEnabled();

    // Click confirm and verify callback receives 'Red'
    fireEvent.click(confirmButton);
    expect(onAncestrySelect).toHaveBeenCalledTimes(1);
    expect(onAncestrySelect).toHaveBeenCalledWith('Red');
  });

  it('selects Gold Dragon ancestry and allows switching between options', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DragonbornAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    // First click Blue dragon
    const blueCard = screen.getByRole('button', { name: /Select Blue dragon ancestry/i });
    fireEvent.click(blueCard);
    expect(blueCard).toHaveAttribute('aria-pressed', 'true');

    // Then switch to Gold dragon
    const goldCard = screen.getByRole('button', { name: /Select Gold dragon ancestry/i });
    fireEvent.click(goldCard);

    // Blue should no longer be pressed, and Gold should be pressed
    expect(blueCard).toHaveAttribute('aria-pressed', 'false');
    expect(goldCard).toHaveAttribute('aria-pressed', 'true');

    // Confirm and verify Gold is passed
    const confirmButton = screen.getByRole('button', { name: /Confirm selected draconic ancestry/i });
    fireEvent.click(confirmButton);
    expect(onAncestrySelect).toHaveBeenCalledWith('Gold');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('triggers onBack when the Back button is clicked', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DragonbornAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    const backButton = screen.getByRole('button', { name: /Go back to race selection/i });
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAncestrySelect).not.toHaveBeenCalled();
  });
});
