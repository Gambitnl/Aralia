import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';

// Mock the game context so the overlay reads a fixed seed + clock without a provider.
const mockState = { worldSeed: 42, gameTime: new Date(Date.UTC(351, 0, 1, 12, 0, 0)) };
vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({ state: mockState, dispatch: vi.fn() }),
}));

import AgentSimDevOverlay from '../AgentSimDevOverlay';

describe('AgentSimDevOverlay', () => {
  it('starts collapsed (a toggle button, no snapshot yet)', () => {
    const { container, getByText } = render(<AgentSimDevOverlay />);
    expect(getByText(/Agent sim/i)).toBeTruthy();
    expect(container.querySelector('[data-testid="town-agent-snapshot"]')).toBeNull();
    // Protect the primary World3D transition controls from the dev launcher.
    expect(screen.getByTestId('agent-sim-dev-overlay')).toHaveStyle({ right: '220px' });
  });

  it('expands to a live town snapshot at the current game hour', () => {
    const { getByText, container } = render(<AgentSimDevOverlay />);
    fireEvent.click(getByText(/Agent sim/i));
    const snap = container.querySelector('[data-testid="town-agent-snapshot"]');
    expect(snap).toBeTruthy();
    // gameTime is 12:00 → schedule hour 12.
    expect(snap!.getAttribute('data-hour')).toBe('12');
    // A populated demo town renders occupants.
    expect(container.querySelectorAll('circle[data-activity]').length).toBeGreaterThan(0);
  });

  it('reflects the game clock: midnight shows everyone asleep', () => {
    mockState.gameTime = new Date(Date.UTC(351, 0, 1, 3, 0, 0));
    const { getByText, container } = render(<AgentSimDevOverlay />);
    fireEvent.click(getByText(/Agent sim/i));
    expect(container.querySelector('[data-testid="town-agent-snapshot"]')!.getAttribute('data-hour')).toBe('3');
    const acts = [...container.querySelectorAll('circle[data-activity]')].map((d) => d.getAttribute('data-activity'));
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.every((a) => a === 'sleeping')).toBe(true);
    mockState.gameTime = new Date(Date.UTC(351, 0, 1, 12, 0, 0)); // restore
  });
});
