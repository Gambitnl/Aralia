/**
 * This file protects the startup Ollama dependency pane.
 *
 * The pane appears before players reach the main game when local AI is missing,
 * so its close, collapse, and continue controls need to remain reachable on
 * cramped screens.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OllamaDependencyModal } from '../OllamaDependencyModal';

// ============================================================================
// Startup Pane Controls
// ============================================================================
// A 320px playtest exposed desktop-sized icon controls in the pane header and
// footer actions just below the mobile touch-target floor. These class contracts
// keep the player-facing escape paths usable before the game menu is available.
// ============================================================================
describe('OllamaDependencyModal', () => {
  it('keeps pane controls large enough to tap on cramped screens', () => {
    render(
      <OllamaDependencyModal isOpen={true} onClose={vi.fn()} onDontShowAgain={vi.fn()} />
    );

    expect(screen.getByRole('heading', { name: 'Ollama Dependency' })).toHaveClass(
      'basis-full',
      'sm:basis-auto',
    );
    expect(screen.getByRole('button', { name: 'Collapse pane' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Close pane' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Learn More' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('min-h-11');
  });
});
