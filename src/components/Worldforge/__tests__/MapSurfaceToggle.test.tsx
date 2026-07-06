/**
 * These tests protect the small surface switch that lets a player choose
 * between the regular 2D map and the Worldforge cartographer.
 *
 * The toggle is mounted over the main play screen, so its labels stay compact
 * on phones while its accessible names and tap targets remain usable.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapSurface } from '../../../types';
import MapSurfaceToggle from '../MapSurfaceToggle';

const setSurface = vi.fn();
let surface: MapSurface = 'classic';

vi.mock('../../../hooks/useWorldViewMode', () => ({
  useMapSurface: () => ({ surface, setSurface }),
}));

describe('MapSurfaceToggle', () => {
  it('uses compact phone labels while preserving full accessible names', () => {
    render(<MapSurfaceToggle />);

    expect(screen.getByText('2D')).toHaveClass('sm:hidden');
    expect(screen.getByText('Forge')).toHaveClass('sm:hidden');
    expect(screen.getByText('Classic')).toHaveClass('hidden', 'sm:inline');
    expect(screen.getByText('Worldforge')).toHaveClass('hidden', 'sm:inline');
    expect(screen.getByRole('button', { name: 'Switch to Classic map surface' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Switch to Worldforge map surface' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps both phone toggle buttons large enough to tap during play', () => {
    render(<MapSurfaceToggle />);

    const classicButton = screen.getByRole('button', { name: 'Switch to Classic map surface' });
    const worldforgeButton = screen.getByRole('button', { name: 'Switch to Worldforge map surface' });

    // The visible text stays short, but the button box still needs the same
    // practical target size as the other always-visible play controls.
    expect(classicButton).toHaveClass('min-h-11', 'min-w-11');
    expect(worldforgeButton).toHaveClass('min-h-11', 'min-w-11');
  });
});
