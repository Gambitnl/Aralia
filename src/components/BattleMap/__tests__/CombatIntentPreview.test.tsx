/**
 * This file proves that the combat targeting HUD names the armed action,
 * explains the current target choice, exposes a visible cancel command, and
 * handles Escape without stealing that key from focused text editors.
 *
 * Covers: CombatIntentPreview.tsx
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Ability } from '../../../types/combat';
import { CombatIntentPreview } from '../CombatIntentPreview';

// ============================================================================
// Targeting HUD Fixture
// ============================================================================
// A small real Ability shape keeps the test focused on presentation and cancel
// behavior without mocking the visual lookup or combat type contract.
// ============================================================================

const fireBolt: Ability = {
  id: 'fire-bolt',
  name: 'Fire Bolt',
  description: 'Hurl a mote of fire at a creature within range.',
  type: 'spell',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 24,
  effects: [],
};

describe('CombatIntentPreview', () => {
  it('shows intent details and cancels from the visible command', () => {
    const onCancel = vi.fn();
    render(
      <CombatIntentPreview
        ability={fireBolt}
        casterName="Elara"
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId('combat-targeting-hud')).toHaveAccessibleName('Fire Bolt targeting');
    expect(screen.getByText('Choose an enemy')).toBeInTheDocument();
    expect(screen.getByText('24 tiles (120 ft)')).toBeInTheDocument();
    expect(screen.getByText('Elara')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Fire Bolt targeting' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels with Escape but leaves focused editor input alone', () => {
    const onCancel = vi.fn();
    render(
      <>
        <input aria-label="Spell wording" />
        <CombatIntentPreview ability={fireBolt} onCancel={onCancel} />
      </>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    const editor = screen.getByRole('textbox', { name: 'Spell wording' });
    editor.focus();
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
