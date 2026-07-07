/**
 * Staged 3D world entry — the loading screen shown while the world assembles off
 * the main thread. It replaces the old error-looking "World data is not ready"
 * placeholder with honest, advancing stage text over a progress bar.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorldGenLoadingScreen from '../WorldGenLoadingScreen';

describe('WorldGenLoadingScreen', () => {
  it('shows the land stage first', () => {
    render(<WorldGenLoadingScreen stage="land" />);
    expect(screen.getByText('Shaping the land…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('33');
  });

  it('advances to the town stage', () => {
    render(<WorldGenLoadingScreen stage="town" />);
    expect(screen.getByText('Raising the town…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('66');
  });

  it('advances to the details stage', () => {
    render(<WorldGenLoadingScreen stage="details" />);
    expect(screen.getByText('Scattering details…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('90');
  });

  it('announces politely for assistive tech', () => {
    render(<WorldGenLoadingScreen stage="land" />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});
