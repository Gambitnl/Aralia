import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Ship } from '@/types/naval';
import {DiscoveryType} from '@/types/state';
import {createMockGameState} from '@/utils/core/factories';
import MapPane from '../MapPane';
import { requestMapDrillToPlayerTown } from '../Worldforge/mapFocusSignal';

// These tests protect the legacy-world-map deprecation slice.
// Grid retirement (agora-608b): MapPane is fully cell-native — it takes no
// `mapData` prop and renders the Worldforge atlas, so the old `createMapData()`
// MapTile[][] fixture was dead weight and is gone. Travel/discovery state is
// cell-native (`playerCell`, explored cell ids), not a tile grid.

describe('MapPane', () => {
  it('focuses a town learned from a retained library account without travel, entry or save mutation', async () => {
    const seed=1793432134128,path='wf:2430771696/burg:502/dungeon:sewer';
    const state=createMockGameState({worldSeed:seed,discoveryLog:[{
      id:`library-account:v1:${seed}:40:56:works:${path}:635fced6`,timestamp:1,gameTime:'0351-01-01T09:48:45.000Z',
      type:DiscoveryType.LORE_DISCOVERY,title:'Library account: Menina: municipal waterworks',content:'The register lists Menina waterworks.',isRead:false,
      source:{type:'LOCATION',id:`world:${seed}:burg:40:library:56`,name:'Grangengen library'},
      flags:[{key:'knowledgeKind',value:'library-account'},{key:'sourceWorldSeed',value:seed},{key:'sourceLibraryBurgId',value:40},{key:'sourceLibraryPlotId',value:56},{key:'sourceStateId',value:5},{key:'recordKey',value:`works:${path}`},{key:'sourceRef',value:'municipal-register:502'},{key:'accountTargetBurgId',value:502},{key:'accountSitePath',value:path}],
    }]});
    const before=JSON.stringify(state),travel=vi.fn(),enter=vi.fn();
    const view=render(<MapPane worldSeed={seed} playerAtlasCellId={1633} groundState={state} onTileClick={travel} onClose={vi.fn()} allowTravel allow3DEntry onEnter3DAtCell={enter}/>);
    fireEvent.click(await screen.findByRole('button',{name:/View town: Menina/}));
    expect((await screen.findAllByText('Menina',{exact:true})).length).toBeGreaterThan(0);
    expect(travel).not.toHaveBeenCalled();expect(enter).not.toHaveBeenCalled();expect(JSON.stringify(state)).toBe(before);
    view.rerender(<MapPane worldSeed={seed+2**32} playerAtlasCellId={1633} groundState={state} onTileClick={travel} onClose={vi.fn()} allowTravel/>);
    expect(screen.queryByRole('button',{name:/View town: Menina/})).toBeNull();
  },60000);
  it('distinguishes same-named inns without renaming them or committing travel', async () => {
    requestMapDrillToPlayerTown(253);
    const travel = vi.fn(), keeperAction = vi.fn();
    render(<MapPane worldSeed={1793176397587} playerAtlasCellId={1885} gameTime={new Date('0351-01-03T19:12:45Z')}
      onTileClick={travel} onClose={vi.fn()} allowTravel onTownKeeperAction={keeperAction}
      getTownBusinessName={(_burg, plot) => [1, 23].includes(plot) ? 'The Gilded Consortium' : [13, 127].includes(plot) ? 'The Gilded Remedy' : undefined} />);
    const selector = await screen.findByLabelText('Inspect a building') as HTMLSelectElement;
    const label = (id: string) => Array.from(selector.options).find(option => option.value === id)?.text;
    expect(label('1')).toBe('The Gilded Consortium · inn · building 2');
    expect(label('23')).toBe('The Gilded Consortium · inn · building 24');
    expect(label('13')).toBe('The Gilded Remedy · inn · building 14');
    expect(label('127')).toBe('The Gilded Remedy · inn · building 128');
    fireEvent.click(screen.getByRole('button', {name: 'Find inns and taverns'}));
    expect(label('1')).toBe('The Gilded Consortium · inn · building 2');
    expect(label('23')).toBe('The Gilded Consortium · inn · building 24');
    fireEvent.change(selector, {target: {value: '23'}});
    expect(await screen.findByTestId('town-building-inspector')).toHaveTextContent('Marek Hartley');
    expect(travel).not.toHaveBeenCalled();
    expect(keeperAction).not.toHaveBeenCalled();
  }, 60000);
  it('finds actual fitted inns even when their business names describe another service', async () => {
    requestMapDrillToPlayerTown(675);
    const keeperAction = vi.fn(), travel = vi.fn();
    render(<MapPane worldSeed={1793146029630} playerAtlasCellId={4337} gameTime={new Date('0351-01-03T15:54:03Z')}
      onTileClick={travel} onClose={vi.fn()} allowTravel onTownKeeperAction={keeperAction}
      getTownBusinessName={(_burg, plot) => plot === 157 ? 'The Shadowed Enchantments' : undefined} />);
    const selector = await screen.findByLabelText('Inspect a building') as HTMLSelectElement;
    expect(Array.from(selector.options).find(option => option.value === '157')?.text).toBe('The Shadowed Enchantments · inn');
    fireEvent.click(screen.getByRole('button', {name: 'Find inns and taverns'}));
    const values = Array.from(selector.options).map(option => option.value);
    expect(values).toEqual(expect.arrayContaining(['33', '76', '157']));
    expect(values).not.toContain('79');
    expect(values).not.toContain('35');
    fireEvent.change(selector, {target: {value: '157'}});
    expect(await screen.findByTestId('town-building-inspector')).toHaveTextContent('inn · Menaikon');
    expect(screen.getByRole('button', {name: 'Ask about guest beds'})).toBeEnabled();
    expect(keeperAction).not.toHaveBeenCalled();
    expect(travel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Show all buildings'}));
    expect(Array.from(selector.options).map(option => option.value)).toContain('79');
    expect(screen.queryByTestId('town-building-inspector')).not.toBeInTheDocument();
  }, 60000);
  it('opens local building details and keeper actions, but hides private inspection for a distant town', async () => {
    requestMapDrillToPlayerTown(10);
    const keeperAction = vi.fn();
    // Bryn at plot 50 is on duty at noon. Lys at plot 0 is retired, so the
    // attendance gate correctly refuses his former generic keeper shortcut.
    const props = { worldSeed: 1793146029630, gameTime: new Date('0351-01-01T12:00:00Z'), onTileClick: vi.fn(), onClose: vi.fn(), allowTravel: true, onTownKeeperAction: keeperAction };
    const view = render(<MapPane {...props} playerAtlasCellId={4565} />);
    const selector = await screen.findByLabelText('Inspect a building');
    fireEvent.change(selector, { target: { value: '50' } });
    expect(await screen.findByTestId('town-building-inspector')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to keeper' }));
    expect(keeperAction).toHaveBeenCalledWith(10, 50, 'talk');
    view.rerender(<MapPane {...props} playerAtlasCellId={4566} />);
    expect(screen.queryByLabelText('Inspect a building')).not.toBeInTheDocument();
    expect(screen.queryByTestId('town-building-inspector')).not.toBeInTheDocument();
  }, 60000);

  it('opens the selected town plan for Sypege instead of stopping at the world atlas', async () => {
    requestMapDrillToPlayerTown(10);
    render(<MapPane worldSeed={1793146029630} playerAtlasCellId={4565} onTileClick={vi.fn()} onClose={vi.fn()} allowTravel />);
    expect(await screen.findByTestId('town-plan-view')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Submap tier path' })).toHaveTextContent('Sypege');
  }, 60000);

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
    expect(onEnter3DAtCell.mock.calls[0][4]).toBe(true);
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

it('shows a rejected ground-entry reason inside the open map', async () => {
  const onClose=vi.fn(), reason='Your accepted position is unchanged. Review a Local journey in the Atlas.';
  render(<MapPane onTileClick={vi.fn()} onClose={onClose} allowTravel allow3DEntry playerAtlasCellId={42} onEnter3DAtCell={()=>reason} />);
  const button=await screen.findByTestId('enter-3d-at-player');fireEvent.click(button);
  expect(await screen.findByText(reason)).toBeVisible();expect(onClose).not.toHaveBeenCalled();
});
