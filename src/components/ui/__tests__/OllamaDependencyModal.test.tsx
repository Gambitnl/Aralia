/**
 * This file protects the startup Ollama dependency pane.
 *
 * The pane appears before players reach the main game when local AI is missing,
 * so its close, collapse, and continue controls need to remain reachable on
 * cramped screens.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaDependencyModal } from '../OllamaDependencyModal';
import {
  setAiTextProvider,
  setGroqApiKey,
  setGroqKeyStorage,
} from '../../../services/ai/aiProviderSettings';

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

// ============================================================================
// Active-provider banner + collapsible Ollama explainer
// ============================================================================
// The pane must reflect which provider is ACTUALLY active instead of always
// reading "Ollama required", and the long Ollama setup text is grouped in one
// collapsible block that folds away when Groq is on (it is then just noise).
// These are the two named deliverables of the Groq-inference-toggle work, so
// they get pinned here.
// ============================================================================
describe('OllamaDependencyModal — provider banner + explainer', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows the Ollama-active banner and opens the explainer by default when Ollama is the provider', () => {
    setAiTextProvider('ollama');
    render(
      <OllamaDependencyModal isOpen={true} onClose={vi.fn()} onDontShowAgain={vi.fn()} />
    );

    const banner = screen.getByTestId('active-provider-banner');
    expect(banner).toHaveTextContent('Ollama (local model)');
    // Ollama active → the setup explainer defaults OPEN (the player likely needs it).
    expect(screen.getByRole('button', { name: /About Ollama/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/Without Ollama, these DON'T work/i)).toBeInTheDocument();
  });

  it('shows the Groq-active banner and collapses the explainer by default when Groq is the provider', () => {
    setGroqKeyStorage('local');
    setGroqApiKey('gsk_testkey');
    setAiTextProvider('groq');
    render(
      <OllamaDependencyModal isOpen={true} onClose={vi.fn()} onDontShowAgain={vi.fn()} />
    );

    const banner = screen.getByTestId('active-provider-banner');
    expect(banner).toHaveTextContent('Groq cloud');
    expect(banner).toHaveTextContent("Ollama isn't needed");
    // Groq active → the Ollama explainer is noise, so it defaults CLOSED.
    const toggle = screen.getByRole('button', { name: /About Ollama/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Without Ollama, these DON'T work/i)).not.toBeInTheDocument();
  });

  it('toggles the Ollama explainer open and closed on click', () => {
    setGroqKeyStorage('local');
    setGroqApiKey('gsk_testkey');
    setAiTextProvider('groq');
    render(
      <OllamaDependencyModal isOpen={true} onClose={vi.fn()} onDontShowAgain={vi.fn()} />
    );

    const toggle = screen.getByRole('button', { name: /About Ollama/i });
    // Starts collapsed (Groq active); a click opens it, another closes it.
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Without Ollama, these DON'T work/i)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Without Ollama, these DON'T work/i)).not.toBeInTheDocument();
  });
});
