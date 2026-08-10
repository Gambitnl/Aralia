/**
 * This file tests the Ollama dependency pane that appears when the local AI
 * service is unavailable.
 *
 * The pane is shown over the main menu and gameplay screens, so these tests
 * protect the parts of the layout that must stay reachable in short browser
 * windows: the scrollable explanation body and the action footer.
 *
 * Called by: Vitest when UI component tests run.
 * Depends on: OllamaDependencyModal for the rendered pane and Testing Library
 * for player-facing queries.
 */

// ============================================================================
// Imports
// ============================================================================
// This section imports the test runner, Testing Library, and the pane under test.
// The assertions query visible button text because that matches how players find
// the footer controls when the warning opens.
// ============================================================================

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaDependencyModal } from './OllamaDependencyModal';
import { setGroqKeyStorage, setGroqProxyUrl } from '../../services/ai/aiProviderSettings';

// ============================================================================
// Layout Regression Coverage
// ============================================================================
// These tests preserve the compact-window behavior found during rendered
// playtesting. The body may scroll, but the footer itself must remain in the
// pane's visible frame instead of being pushed below the viewport.
// ============================================================================

describe('OllamaDependencyModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the action footer outside the scroll body so Continue remains reachable', () => {
    // Render the pane in its normal open state, matching the startup warning
    // that appears before a player can dismiss the Ollama dependency notice.
    render(
      <OllamaDependencyModal
        isOpen
        onClose={vi.fn()}
        onDontShowAgain={vi.fn()}
      />,
    );

    // The expanded pane body needs to be a shrinking flex column. Without this
    // container shape, the text region can grow taller than the visible pane
    // and force the footer below the bottom edge on short screens.
    const body = document.getElementById('ollama-pane-body');
    expect(body).toBeTruthy();
    expect(body).toHaveClass('min-h-0');
    expect(body).toHaveClass('flex-1');
    expect(body).toHaveClass('flex');
    expect(body).toHaveClass('flex-col');

    // The explanatory content scrolls independently inside that flex body, so
    // the footer can stay fixed at the bottom of the pane.
    const scrollArea = screen.getByTestId('ollama-pane-scroll');
    expect(scrollArea).toHaveClass('min-h-0');
    expect(scrollArea).toHaveClass('flex-1');
    expect(scrollArea).toHaveClass('overflow-y-auto');

    // The Continue button's immediate footer wrapper must be a non-scrolling
    // pane footer. This keeps the dismissal controls visible while the text
    // above it scrolls independently.
    const footer = screen.getByTestId('ollama-pane-footer');
    expect(footer).toHaveClass('shrink-0');
    expect(footer).toHaveClass('border-t');
  });

  it('starts collapsed on cramped viewports so the non-modal pane does not cover menu controls', () => {
    // The startup warning is intentionally non-modal. At 320x640, its expanded
    // body sits over main-menu buttons, so compact screens should start with
    // only the docked title bar and recovery controls visible.
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });

    render(
      <OllamaDependencyModal
        isOpen
        onClose={vi.fn()}
        onDontShowAgain={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Expand pane' })).toBeInTheDocument();
    expect(screen.queryByTestId('ollama-pane-scroll')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ollama-pane-footer')).not.toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
  });

  it('checks the selected Groq proxy health route and confirms its credential is loaded', async () => {
    // Proxy mode hides browser-key fields and checks the server that owns the
    // credential. The standalone `/v1` API exposes health at the host root.
    setGroqKeyStorage('proxy');
    setGroqProxyUrl('http://localhost:8787/v1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, keyLoaded: true }),
    } as Response);

    render(
      <OllamaDependencyModal
        isOpen
        isDevModeEnabled
        onClose={vi.fn()}
        onDontShowAgain={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check proxy' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8787/health',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'Proxy is running and its Groq credential is loaded.',
      );
    });
  });

  it('starts the bundled local proxy and waits until it is healthy', async () => {
    // The first health read proves the port is stopped. Aralia then asks its own
    // Vite server to launch the fixed proxy and confirms the child became ready.
    setGroqKeyStorage('proxy');
    setGroqProxyUrl('http://localhost:8787/v1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('connection refused'))
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, keyLoaded: true }),
      } as Response);

    render(
      <OllamaDependencyModal
        isOpen
        isDevModeEnabled
        onClose={vi.fn()}
        onDontShowAgain={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start proxy' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'http://localhost:8787/health',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        '/__groq/start',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proxyUrl: 'http://localhost:8787/v1' }),
        }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        3,
        'http://localhost:8787/health',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'Proxy is running and its Groq credential is loaded.',
      );
    });
  });

  it('reports a Groq proxy that the browser cannot reach', async () => {
    // Network rejection covers a stopped port as well as a proxy that cannot
    // be reached from this browser because its CORS policy blocks Aralia.
    setGroqKeyStorage('proxy');
    setGroqProxyUrl('/__groq/v1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    render(
      <OllamaDependencyModal
        isOpen
        isDevModeEnabled
        onClose={vi.fn()}
        onDontShowAgain={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check proxy' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/__groq/health',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'Proxy is not reachable from Aralia at this URL.',
      );
    });
  });
});
