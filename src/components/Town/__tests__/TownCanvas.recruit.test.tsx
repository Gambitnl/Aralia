import React from 'react';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TownCanvas from '../TownCanvas';
import VillageScene from '../VillageScene';
import { BuildingType, TileType } from '../../../types/realmsmith';

/**
 * W3-tavern-hire — "Hire <name>" affordance for tavern/inn buildings.
 *
 * Verifies both town producer surfaces dispatch the shared recruit intent:
 *   { type: 'OPEN_DYNAMIC_MERCHANT', payload: { merchantType, buildingId, hire:true } }
 * which handleMerchantInteraction routes through offerTavernHire (W1 dep).
 *
 * Distinct file from the existing TownCanvas pan/village tests so it owns the
 * recruit-specific fixtures without colliding.
 */

const mockUseTownController = vi.fn();

vi.mock('../../../hooks/useTownController', () => ({
  useTownController: (...args: unknown[]) => mockUseTownController(...args),
}));

// AssetPainter touches a real 2D context; keep it inert so the paint effect is a
// no-op in jsdom (we only care about the Hire affordance, not pixels).
vi.mock('../../../services/RealmSmithAssetPainter', () => ({
  AssetPainter: class {
    drawMap() { /* no-op */ }
  },
}));

// Ambient life isn't relevant here.
vi.mock('../../../hooks/useAmbientLife', () => ({
  useAmbientLife: () => [],
}));

// ---- VillageScene: controlled deterministic layout -------------------------
// The real villageGenerator uses Vite-only `import.meta.glob`, so we mock it with
// a fixed layout: a shop_tavern building footprint at (2,2), grass elsewhere.
const VILLAGE_W = 6;
const VILLAGE_H = 6;

function makeVillageTiles(): string[][] {
  const tiles: string[][] = [];
  for (let y = 0; y < VILLAGE_H; y++) {
    tiles[y] = [];
    for (let x = 0; x < VILLAGE_W; x++) tiles[y][x] = 'grass';
  }
  tiles[2][2] = 'shop_tavern';
  return tiles;
}

const tavernBuilding = {
  id: 'shop_tavern-0',
  type: 'shop_tavern',
  footprint: { x: 2, y: 2, width: 1, height: 1 },
  fill: '#222',
  accent: '#333',
};

const mockVillageLayout: Record<string, unknown> = {
  width: VILLAGE_W,
  height: VILLAGE_H,
  tiles: makeVillageTiles(),
  buildings: [tavernBuilding],
  personality: { wealth: 'modest', culture: 'rustic', biomeStyle: 'forest', population: 120 },
  integrationProfile: {
    id: 'generic',
    aiPrompt: '',
    tagline: 'A quiet village.',
    culturalSignature: 'sig',
    encounterHooks: [],
  },
};

vi.mock('../../../services/villageGenerator', () => ({
  generateVillageLayout: vi.fn(() => mockVillageLayout),
  findBuildingAt: vi.fn((_layout: unknown, x: number, y: number) =>
    x === 2 && y === 2 ? tavernBuilding : undefined
  ),
  describeBuilding: vi.fn(() => 'A cozy tavern.'),
}));

type AnyTile = {
  x: number;
  y: number;
  type: TileType;
  variation: number;
  elevation: number;
  buildingId?: string;
};

/**
 * Build a tiny town map (indexed tiles[x][y]) with one TAVERN building tile and a
 * walkable player tile directly to its west, so getAdjacentBuildings surfaces it.
 */
function makeMapDataWithTavern() {
  const width = 4;
  const height = 4;
  const tiles: AnyTile[][] = [];
  for (let x = 0; x < width; x++) {
    tiles[x] = [];
    for (let y = 0; y < height; y++) {
      tiles[x][y] = {
        x,
        y,
        type: TileType.GRASS,
        variation: 0,
        elevation: 0,
      };
    }
  }

  // Tavern occupies tile (2,2); player will stand at (1,2) — adjacent (east).
  tiles[2][2].buildingId = 'tavern-1';
  tiles[2][2].type = TileType.BUILDING_FLOOR;

  const buildings = [
    {
      id: 'tavern-1',
      type: BuildingType.TAVERN,
      x: 2,
      y: 2,
      width: 1,
      height: 1,
      doorX: 0,
      doorY: 0,
      color: '#000',
      roofColor: '#111',
      roofStyle: 'gable',
      wallTexture: 'wood',
    },
    {
      id: 'smith-1',
      type: BuildingType.BLACKSMITH,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      doorX: 0,
      doorY: 0,
      color: '#000',
      roofColor: '#111',
      roofStyle: 'gable',
      wallTexture: 'wood',
    },
  ];
  tiles[0][0].buildingId = 'smith-1';
  tiles[0][0].type = TileType.BUILDING_FLOOR;

  return { width, height, tiles, buildings, seed: 1, biome: 'plains' };
}

function mockController(mapData: unknown) {
  mockUseTownController.mockReturnValue({
    state: {
      seed: 1,
      biome: 'plains',
      density: 0.5,
      connections: {},
      mapData,
      loading: false,
      localPlayerPosition: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
      isNight: false,
      showGrid: false,
      hoveredBuilding: null,
      hoverPos: null,
    },
    actions: {
      setSeed: vi.fn(),
      setBiome: vi.fn(),
      setDensity: vi.fn(),
      setConnections: vi.fn(),
      generateMap: vi.fn(),
      setZoom: vi.fn(),
      setPan: vi.fn(),
      setIsNight: vi.fn(),
      setShowGrid: vi.fn(),
      setHoveredBuilding: vi.fn(),
      setHoverPos: vi.fn(),
      resetView: vi.fn(),
      setLocalPlayerPosition: vi.fn(),
    },
  });
}

describe('TownCanvas — tavern hire affordance', () => {
  beforeAll(() => {
    (HTMLElement.prototype as unknown as { setPointerCapture?: () => void }).setPointerCapture = () => { };
    (HTMLElement.prototype as unknown as { releasePointerCapture?: () => void }).releasePointerCapture = () => { };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a Hire button when standing next to a tavern', () => {
    mockController(makeMapDataWithTavern());
    const onAction = vi.fn();

    const { getByRole } = render(
      <TownCanvas
        worldSeed={1}
        worldX={0}
        worldY={0}
        biome="plains"
        onAction={onAction}
        playerPosition={{ x: 1, y: 2 }}
      />
    );

    // The keeper hire affordance is a button whose accessible name targets the tavern.
    const hireBtn = getByRole('button', { name: /hire the tavern keeper/i });
    expect(hireBtn).toBeTruthy();
  });

  it('dispatches OPEN_DYNAMIC_MERCHANT with hire:true for the tavern', () => {
    mockController(makeMapDataWithTavern());
    const onAction = vi.fn();

    const { getByRole } = render(
      <TownCanvas
        worldSeed={1}
        worldX={0}
        worldY={0}
        biome="plains"
        onAction={onAction}
        playerPosition={{ x: 1, y: 2 }}
      />
    );

    fireEvent.click(getByRole('button', { name: /hire the tavern keeper/i }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_DYNAMIC_MERCHANT',
        payload: expect.objectContaining({
          merchantType: BuildingType.TAVERN,
          buildingId: 'tavern-1',
          hire: true,
        }),
      })
    );
  });

  it('does NOT render a Hire button when no tavern/inn is adjacent', () => {
    const map = makeMapDataWithTavern();
    const onAction = vi.fn();
    mockController(map);

    const { queryByRole } = render(
      <TownCanvas
        worldSeed={1}
        worldX={0}
        worldY={0}
        biome="plains"
        onAction={onAction}
        playerPosition={{ x: 0, y: 1 }} // adjacent only to the blacksmith at (0,0), not the tavern at (2,2)
      />
    );

    expect(queryByRole('button', { name: /hire the .* keeper/i })).toBeNull();
  });
});

describe('VillageScene — tavern hire affordance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVillageLayout.tiles = makeVillageTiles();
  });

  const villageProps = {
    worldSeed: 777,
    worldX: 3,
    worldY: 4,
    biomeId: 'temperate_forest',
  };

  function clickTile(canvas: HTMLCanvasElement, tx: number, ty: number) {
    canvas.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 1000,
      bottom: 1000,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    })) as unknown as () => DOMRect;
    // TILE_SIZE = 16; click the center of tile (tx, ty).
    fireEvent.click(canvas, { clientX: tx * 16 + 8, clientY: ty * 16 + 8 });
  }

  it('shows a Hire button only after clicking a tavern tile, and dispatches hire:true', () => {
    const onAction = vi.fn();
    const { container, queryByRole } = render(
      <VillageScene {...villageProps} onAction={onAction} />
    );
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // No tavern clicked yet -> no hire button.
    expect(queryByRole('button', { name: /hire the .* keeper/i })).toBeNull();

    // The mocked layout places a shop_tavern building at (2,2).
    clickTile(canvas, 2, 2);

    const hireBtn = queryByRole('button', { name: /hire the .* keeper/i });
    expect(hireBtn).toBeTruthy();

    fireEvent.click(hireBtn as HTMLElement);

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_DYNAMIC_MERCHANT',
        payload: expect.objectContaining({ merchantType: 'Tavern', hire: true }),
      })
    );
  });

  it('clears the Hire affordance when a non-tavern tile is clicked', () => {
    const onAction = vi.fn();
    const { container, queryByRole } = render(
      <VillageScene {...villageProps} onAction={onAction} />
    );
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    clickTile(canvas, 2, 2); // tavern -> hire appears
    expect(queryByRole('button', { name: /hire the .* keeper/i })).toBeTruthy();

    clickTile(canvas, 0, 0); // grass -> hire clears
    expect(queryByRole('button', { name: /hire the .* keeper/i })).toBeNull();
  });
});
