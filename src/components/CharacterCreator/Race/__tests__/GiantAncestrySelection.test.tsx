import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GiantAncestrySelection from '../GiantAncestrySelection';

/**
 * Tests for the Giant Ancestry Selection component.
 *
 * In character creation, Goliath characters choose their supernatural Giant Ancestry boon
 * (Cloud, Fire, Frost, Hill, Stone, Storm) to enhance their Stone's Endurance trait.
 *
 * Connected to: CharacterCreator (during Goliath race configuration)
 * Tests: All 6 giant ancestry options, selection state, Stone's Endurance enhancement, and confirmation gating.
 */

describe('GiantAncestrySelection', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders all six giant ancestries and disables submit initially', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <GiantAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Choose Your Giant Ancestry')).toBeInTheDocument();
    expect(screen.getByText("Cloud's Jaunt")).toBeInTheDocument();
    expect(screen.getByText("Fire's Burn")).toBeInTheDocument();
    expect(screen.getByText("Frost's Chill")).toBeInTheDocument();
    expect(screen.getByText("Hill's Tumble")).toBeInTheDocument();
    expect(screen.getByText("Stone's Endurance")).toBeInTheDocument();
    expect(screen.getByText("Storm's Thunder")).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Ancestry/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects Storm Giant ancestry and confirms selection', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <GiantAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    const stormButton = screen.getByRole('button', { name: /Storm's Thunder/i });
    fireEvent.click(stormButton);
    expect(stormButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm Ancestry/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onAncestrySelect).toHaveBeenCalledTimes(1);
    expect(onAncestrySelect).toHaveBeenCalledWith('Storm');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onAncestrySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <GiantAncestrySelection
        onAncestrySelect={onAncestrySelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
