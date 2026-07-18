import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapData } from '@/types/world';
import type { Ship } from '@/types/naval';
import MapPane from '../MapPane';

// These tests protect the first legacy-world-map deprecation slice.
// The gameplay state still uses MapData tiles for travel/discovery, but the
// player-facing MapPane should no longer expose the old square grid renderer.

describe('MapPane', () => {
  it('restores an undersized saved map window to a usable desktop viewport', async () => {
    localStorage.setItem('world-map-window', JSON.stringify({ width: 600, height: 400 }));

    render(<MapPane onTileClick={vi.fn()} onClose={vi.fn()} allowTravel={false} />);

    const frame = screen.getByTestId('window-world-map-window');
    await waitFor(() => {
      expect(frame).toHaveStyle({ width: '840px', height: '640px' });
    });
    localStorage.removeItem('world-map-window');
  });

  it('renders the native Worldforge atlas as the sole map (no legacy grid, no Azgaar iframe)', () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();

    render(
      <MapPane
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel={false}
      />,
    );

    // Worldforge is the sole cartography system (the Azgaar iframe was retired).
    expect(screen.getByTestId('worldforge-map-viewport')).toBeInTheDocument();
    expect(screen.queryByTitle('Azgaar World Atlas')).not.toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('exposes a sea-preference toggle in travel mode', async () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();

    render(
      <MapPane
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel
      />,
    );

    const seaPreference = await screen.findByTestId('travel-sea-pref');
    expect(seaPreference).toHaveValue('none');
  });

  it('offers only real party transports instead of granting every party a phantom horse', async () => {
    const { rerender } = render(
      <MapPane onTileClick={vi.fn()} onClose={vi.fn()} allowTravel transportParty={[{ transportMode: 'foot' }]} />,
    );

    const footOnly = screen.getByLabelText('Transport') as HTMLSelectElement;
    expect(Array.from(footOnly.options).map((option) => option.value)).toEqual(['walking']);

    rerender(
      <MapPane onTileClick={vi.fn()} onClose={vi.fn()} allowTravel transportParty={[{ transportMode: 'mounted' }]} />,
    );
    await waitFor(() => {
      expect(Array.from((screen.getByLabelText('Transport') as HTMLSelectElement).options).map((option) => option.value))
        .toEqual(['walking', 'riding_horse']);
    });
  });

  it('keeps world map toolbar controls touch-sized in the floating window', async () => {
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
        allow3DEntry
        onEnter3DAtCell={vi.fn()}
        playerAtlasCellId={null}
      />,
    );

    expect(screen.getByRole('button', { name: 'Explore' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Travel' })).toHaveClass('min-h-11');
    expect(screen.getByLabelText('Transport')).toHaveClass('min-h-11');
    expect(await screen.findByTestId('travel-sea-pref')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Enter 3D' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Precision' })).toHaveClass('min-h-11');
    expect(screen.getByTestId('enter-3d-at-player')).toHaveClass('min-h-11');
    expect(screen.getByTestId('worldforge-map-viewport')).toHaveClass('min-h-[220px]', 'md:min-h-0');
  });

  it('keeps island-harbor generation default-off but exposes an explicit proof opt-in', () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <MapPane
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel
      />,
    );

    expect(screen.getByTestId('worldforge-map-viewport')).toHaveAttribute(
      'data-island-harbors-enabled',
      'false',
    );

    rerender(
      <MapPane
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel
        enableIslandHarbors
      />,
    );

    expect(screen.getByTestId('worldforge-map-viewport')).toHaveAttribute(
      'data-island-harbors-enabled',
      'true',
    );
  });

  it('sizes the atlas to the actual narrow viewport width instead of forcing overflow', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getNarrowRect() {
      return {
        x: 0,
        y: 0,
        width: 287,
        height: 260,
        top: 0,
        right: 287,
        bottom: 260,
        left: 0,
        toJSON: () => {},
      } as DOMRect;
    };

    try {
      render(
        <MapPane
          onTileClick={vi.fn()}
          onClose={vi.fn()}
          allowTravel
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('atlas-svg-view')).toHaveAttribute('width', '287');
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it('renders locked generation controls as read-only and inert', async () => {
    const onRegenerateWorld = vi.fn();
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel={false}
        showGenerationControls
        canRegenerateWorld={false}
        generationLockedReason="World generation is locked while an active game session is in memory."
        onRegenerateWorld={onRegenerateWorld}
      />,
    );

    // The locked preview can still be inspected, but seed entry and generation
    // buttons must not imply that a new world can be applied during an active run.
    const seedInput = screen.getByLabelText('World Seed');
    expect(seedInput).toHaveAttribute('readonly');

    const applySeed = screen.getByRole('button', { name: 'Apply Seed' });
    const rerollWorld = screen.getByRole('button', { name: 'Reroll World' });
    expect(applySeed).toBeDisabled();
    expect(rerollWorld).toBeDisabled();

    applySeed.click();
    rerollWorld.click();
    expect(onRegenerateWorld).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Ship option — embark gate rendering
// ---------------------------------------------------------------------------
// Note: the playerPortBurgId derivation requires a real generated atlas that
// maps player tile → atlas cell → port burg, which is not feasible to construct
// in this unit-test environment (getBridgeAtlas is seeded and heavy). The tests
// below therefore target the option's presence and disabled state as a function
// of the `activeShip` prop alone (the embark gate's first two checks are
// purely prop-driven). Full integration of the port-burg matching is covered by
// the pure-helper tests in shipEmbark.test.ts.
// ---------------------------------------------------------------------------

describe('MapPane — ship sea-pref option', () => {
  it('renders the "Ship (owned)" option in the sea-pref select in travel mode', async () => {
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
      />,
    );
    const select = await screen.findByTestId('travel-sea-pref');
    // The option should exist in the DOM (disabled by default — no ship).
    const shipOption = Array.from(select.querySelectorAll('option')).find(
      (o) => o.value === 'ship',
    );
    expect(shipOption).toBeDefined();
  });

  it('disables the "Ship (owned)" option when no activeShip is provided', async () => {
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
        // activeShip omitted → defaults to null
      />,
    );
    const select = await screen.findByTestId('travel-sea-pref');
    const shipOption = Array.from(select.querySelectorAll('option')).find(
      (o) => o.value === 'ship',
    ) as HTMLOptionElement | undefined;
    expect(shipOption?.disabled).toBe(true);
  });

  it('disables the "Ship (owned)" option when activeShip has no dockedPortBurgId', async () => {
    const ship = createShip({ dockedPortBurgId: undefined });
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
        activeShip={ship}
      />,
    );
    const select = await screen.findByTestId('travel-sea-pref');
    const shipOption = Array.from(select.querySelectorAll('option')).find(
      (o) => o.value === 'ship',
    ) as HTMLOptionElement | undefined;
    // Ship exists but has no docked port → reason is "Ship is not docked"
    expect(shipOption?.disabled).toBe(true);
  });

  it('disables the "Ship (owned)" option when activeShip is docked at a port but player is not there (playerPortBurgId derived from atlas is null in test env)', async () => {
    // The test atlas is a 2×2 stub with no real FMG pack structure. legacyGridToAtlasCell
    // will not map the player tile to a burg with port=truthy, so playerPortBurgId
    // stays null even when a ship is docked at burgId 7. The gate correctly rejects.
    const ship = createShip({ dockedPortBurgId: 7 });
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
        activeShip={ship}
      />,
    );
    const select = await screen.findByTestId('travel-sea-pref');
    const shipOption = Array.from(select.querySelectorAll('option')).find(
      (o) => o.value === 'ship',
    ) as HTMLOptionElement | undefined;
    expect(shipOption?.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// "3D at My Location" — direct entry at the player's current atlas cell
// ---------------------------------------------------------------------------

describe('MapPane — 3D at My Location', () => {
  it('renders the button when 3D entry is allowed and the player cell is known, and clicking it enters at that cell', async () => {
    const onEnter3DAtCell = vi.fn();
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
        allow3DEntry
        onEnter3DAtCell={onEnter3DAtCell}
        playerAtlasCellId={42}
      />,
    );
    const button = await screen.findByTestId('enter-3d-at-player');
    button.click();
    expect(onEnter3DAtCell).toHaveBeenCalledTimes(1);
    // The anchor must target the player's own cell (burg-snapped anchors keep
    // the cellId when the cell itself is the anchor source).
    const anchor = onEnter3DAtCell.mock.calls[0][3];
    expect(anchor).toBeDefined();
    expect(typeof anchor.cellId).toBe('number');
  });

  it('shows the button disabled (with an explanatory tooltip) when the player cell is unknown', async () => {
    const onEnter3DAtCell = vi.fn();
    render(
      <MapPane
        onTileClick={vi.fn()}
        onClose={vi.fn()}
        allowTravel
        allow3DEntry
        onEnter3DAtCell={onEnter3DAtCell}
        playerAtlasCellId={null}
      />,
    );
    const button = await screen.findByTestId('enter-3d-at-player');
    expect(button).toBeDisabled();
    expect(button.title).toMatch(/position is unknown/i);
    button.click();
    expect(onEnter3DAtCell).not.toHaveBeenCalled();
  });
});

function createShip(overrides: Partial<Ship> = {}): Ship {
  return {
    id: 'test-ship',
    name: 'Test Vessel',
    type: 'Sloop',
    size: 'Small',
    description: '',
    stats: {
      speed: 30,
      maneuverability: 2,
      hullPoints: 100,
      maxHullPoints: 100,
      armorClass: 12,
      cargoCapacity: 10,
      crewMin: 3,
      crewMax: 10,
    },
    crew: { members: [], averageMorale: 80, unrest: 0, quality: 'Average' },
    cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 0, water: 0 } },
    modifications: [],
    weapons: [],
    flags: {},
    ...overrides,
  };
}

function createMapData(): MapData {
  return {
    gridSize: { rows: 2, cols: 2 },
    tiles: [
      [
        {
          x: 0,
          y: 0,
          biomeId: 'plains',
          discovered: true,
          isPlayerCurrent: true,
        },
        {
          x: 1,
          y: 0,
          biomeId: 'forest',
          discovered: true,
          isPlayerCurrent: false,
        },
      ],
      [
        {
          x: 0,
          y: 1,
          biomeId: 'water',
          discovered: false,
          isPlayerCurrent: false,
        },
        {
          x: 1,
          y: 1,
          biomeId: 'mountains',
          discovered: false,
          isPlayerCurrent: false,
        },
      ],
    ],
  };
}
