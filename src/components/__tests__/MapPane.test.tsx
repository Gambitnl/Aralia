import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapData } from '@/types/world';
import type { Ship } from '@/types/naval';
import MapPane from '../MapPane';

// These tests protect the first legacy-world-map deprecation slice.
// The gameplay state still uses MapData tiles for travel/discovery, but the
// player-facing MapPane should no longer expose the old square grid renderer.

describe('MapPane', () => {
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
