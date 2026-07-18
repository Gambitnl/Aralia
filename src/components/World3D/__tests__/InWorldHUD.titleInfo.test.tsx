/**
 * @file InWorldHUD.titleInfo.test.tsx
 * The "3D World View" title is a plain label with dev mode off, and a
 * Controls-style disclosure button hosting the DebugHUD readout with dev mode
 * on (no permanently floating debug overlay either way).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// ViewModeToggle reaches for GameContext, which is irrelevant to this test.
vi.mock('../ViewModeToggle', () => ({ default: () => null }));

import InWorldHUD from '../InWorldHUD';

const baseProps = {
  onOpenMap: () => {},
  onExitToMenu: () => {},
  chunkCount: 81,
  fps: 26,
  streamerStats: { chunksLoaded: 81, chunksUnloaded: 0, pendingRequests: 0 },
};

describe('InWorldHUD title info disclosure', () => {
  it('renders a plain label (no button, no debug readout) when dev mode is off', () => {
    render(<InWorldHUD {...baseProps} isDevModeEnabled={false} />);
    expect(screen.getByText('3D World View')).toBeInTheDocument();
    expect(screen.queryByTestId('hud-world-view-info')).toBeNull();
    expect(screen.queryByTestId('hud-world-view-info-panel')).toBeNull();
  });

  it('renders a disclosure button whose panel hosts the DebugHUD when dev mode is on', () => {
    render(<InWorldHUD {...baseProps} isDevModeEnabled={true} />);
    const button = screen.getByTestId('hud-world-view-info');
    // Closed by default: no floating debug overlay.
    expect(screen.queryByTestId('hud-world-view-info-panel')).toBeNull();

    fireEvent.click(button);
    const panel = screen.getByTestId('hud-world-view-info-panel');
    expect(panel).toBeInTheDocument();
    // DebugHUD readout is inside the panel (chunk count comes from props).
    expect(panel.textContent).toContain('81');

    fireEvent.click(button);
    expect(screen.queryByTestId('hud-world-view-info-panel')).toBeNull();
  });

  it('shows the retained Atlas place name, source identity, and visual relationships in PLAYING', () => {
    render(
      <InWorldHUD
        {...baseProps}
        isDevModeEnabled={false}
        isGroundMode
        groundFocus={{
          kind: 'town',
          id: 31,
          label: 'Alderwatch',
          xFt: 1200,
          yFt: 2400,
        }}
        groundTownIdentity={{
          kind: 'town',
          sourceKind: 'atlas-burg',
          sourceId: 31,
          name: 'Alderwatch',
          settlementType: 'port',
          biomeId: 6,
          hasRoadAccess: true,
          hasRiverAccess: true,
          isCoastal: true,
        }}
      />,
    );

    const place = screen.getByTestId('hud-ground-place');
    expect(place).toHaveTextContent('Alderwatch');
    expect(place).toHaveTextContent('Ground / port / road-linked / river-linked / coastal');
    expect(place).toHaveTextContent('biome #6 / atlas-burg #31');
  });
});
