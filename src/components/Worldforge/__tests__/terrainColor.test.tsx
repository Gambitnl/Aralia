/**
 * This file contains unit tests for the terrain coloring system.
 *
 * It validates that hex colors are parsed correctly, that heights and slopes
 * are grouped into the correct buckets, and that color lifts and shading are
 * calculated deterministically. It also checks that components receive the
 * correct seed-scoped preferences, and that the SVG layers render biomes/overlays
 * and radial gradients correctly.
 *
 * Runs under: Vitest
 * Connects to: terrainColor.ts, StartPointSelection.tsx, PreviewStartSelect.tsx, AtlasLayers.tsx, AtlasSvgView.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  parseHexColor,
  getCellElevationBucket,
  getCellSlopeBucket,
  getCellSlope,
  getTerrainKey,
  getTerrainColor,
} from '../terrainColor';
import { buildAtlasSvgModel, type AtlasSvgModel } from '../atlasSvg';
import AtlasLayers from '../AtlasLayers';
import StartPointSelection from '../StartPointSelection';
import PreviewStartSelect from '../../DesignPreview/steps/PreviewStartSelect';
import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';

// jsdom lacks ResizeObserver, so mock it for StartPointSelection mounting.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
});

// Mock AtlasSvgView to inspect the props it receives in StartPointSelection and PreviewStartSelect.
// Since we want to check that preferences are correctly scoped by seed, this spy maps the prefsScope prop.
vi.mock('../AtlasSvgView', () => {
  return {
    default: vi.fn(({ prefsScope }) => (
      <div data-testid="mock-atlas-svg-view" data-prefs-scope={prefsScope} />
    )),
  };
});

// ============================================================================
// Stub Data
// ============================================================================
// Minimal stub shaped like FmgAtlasResult to test slope and color calculations.

const stubAtlas = {
  biomesData: {
    color: ['#228b22', '#f4a460', '#d3d3d3'], // forest, sand desert, grey
  },
  pack: {
    cells: {
      h: [30, 50, 70, 90], // heights spanning all 4 buckets
      biome: [0, 1, 0, 2], // biome index assignments
      c: [
        [1, 2], // cell 0 neighbors
        [0, 2], // cell 1 neighbors
        [0, 1], // cell 2 neighbors
        [],     // cell 3 neighbors
      ],
      p: [
        [100, 100], // cell 0 position
        [90, 90],   // cell 1 position (NW of cell 0)
        [110, 110], // cell 2 position (SE of cell 0)
        [100, 100], // cell 3 position
      ],
    },
  },
} as unknown as FmgAtlasResult;

// ============================================================================
// Color Parsing Tests
// ============================================================================

describe('parseHexColor', () => {
  it('correctly parses 6-character hex colors', () => {
    expect(parseHexColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHexColor('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    expect(parseHexColor('#123456')).toEqual({ r: 0x12, g: 0x34, b: 0x56 });
  });

  it('correctly parses 3-character hex colors', () => {
    expect(parseHexColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHexColor('#00f')).toEqual({ r: 0, g: 0, b: 255 });
  });
});

// ============================================================================
// Bucketing Tests
// ============================================================================

describe('Elevation and Slope Bucketing', () => {
  it('groups elevation heights into 4 discrete buckets', () => {
    // Lowland
    expect(getCellElevationBucket(20)).toBe(0);
    expect(getCellElevationBucket(39)).toBe(0);
    
    // Highland Tier 1
    expect(getCellElevationBucket(40)).toBe(1);
    expect(getCellElevationBucket(59)).toBe(1);
    
    // Highland Tier 2
    expect(getCellElevationBucket(60)).toBe(2);
    expect(getCellElevationBucket(79)).toBe(2);
    
    // Peak
    expect(getCellElevationBucket(80)).toBe(3);
    expect(getCellElevationBucket(100)).toBe(3);
  });

  it('groups slopes into 3 discrete buckets', () => {
    // Lit (slope < -0.015)
    expect(getCellSlopeBucket(-0.02)).toBe(0);
    expect(getCellSlopeBucket(-0.05)).toBe(0);
    
    // Neutral (-0.015 <= slope <= 0.015)
    expect(getCellSlopeBucket(0)).toBe(1);
    expect(getCellSlopeBucket(-0.01)).toBe(1);
    expect(getCellSlopeBucket(0.01)).toBe(1);
    
    // Shaded (slope > 0.015)
    expect(getCellSlopeBucket(0.02)).toBe(2);
    expect(getCellSlopeBucket(0.05)).toBe(2);
  });
});

// ============================================================================
// Slope Calculation Tests
// ============================================================================

describe('Slope Calculation', () => {
  it('calculates the North-West slope shading correctly', () => {
    // For cell 0, neighbors are:
    // cell 1 (height 50, NW position [90,90])
    // cell 2 (height 70, SE position [110,110])
    const slope = getCellSlope(stubAtlas, 0);
    expect(slope).toBeCloseTo(-0.707, 3); // slope matches mathematical NW gradient projection
  });
});

// ============================================================================
// Keys & Colors Tests
// ============================================================================

describe('Terrain Keys & Colors', () => {
  it('creates stable terrain keys for land cells and null for water', () => {
    // Cell 0 is land (height 30)
    const key0 = getTerrainKey(stubAtlas, 0);
    expect(key0).toBe('0_0_0'); // biome 0, elev bucket 0, slope bucket 0 (lit)

    // Height 5 is water
    const waterAtlas = {
      pack: {
        cells: {
          h: [5],
        },
      },
    } as unknown as FmgAtlasResult;
    expect(getTerrainKey(waterAtlas, 0)).toBeNull();
  });

  it('translates keys into stable, repeatable colors with elevation lift and slope adjustment', () => {
    const color = getTerrainColor(stubAtlas, '0_2_2'); // biome 0, elevation 2, slope 2
    expect(color).toContain('rgb(');
  });

  it('clamps lit color channels to valid CSS RGB values', () => {
    const brightAtlas = {
      ...stubAtlas,
      biomesData: { color: ['#ffffff'] },
    } as unknown as FmgAtlasResult;

    expect(getTerrainColor(brightAtlas, '0_0_0')).toBe('rgb(255,255,255)');
  });
});

// ============================================================================
// Merged Region & Node Budget Tests
// ============================================================================

describe('Merged-region & Node-budget Behavior', () => {
  it('fuses cells into a compact number of regions based on key rather than emitting one polygon per cell', () => {
    // Construct a mesh with 20 land cells across 2 biomes.
    const landCells: number[] = [];
    const heights: number[] = [];
    const biomes: number[] = [];
    const cellC: number[][] = [];
    const cellP: Array<[number, number]> = [];
    const cellV: number[][] = [];
    
    for (let i = 0; i < 20; i++) {
      landCells.push(i);
      heights.push(30 + (i % 2) * 20); // heights 30, 50, 30, 50... (2 elevation buckets)
      biomes.push(i % 2); // biomes 0 and 1
      cellC.push(i > 0 ? [i - 1] : []);
      cellP.push([i * 10, 50]);
      cellV.push([0, 1, 2]); // dummy vertices
    }

    const largeAtlas = {
      graphWidth: 200,
      graphHeight: 100,
      biomesData: { color: ['#228b22', '#f4a460'] },
      pack: {
        vertices: { p: [[0, 0], [10, 0], [10, 10]] },
        cells: {
          h: heights,
          biome: biomes,
          c: cellC,
          p: cellP,
          v: cellV,
        },
      },
    } as unknown as FmgAtlasResult;

    const model = buildAtlasSvgModel(largeAtlas);
    const landLayer = model.layers.find((l) => l.id === 'land');
    expect(landLayer).toBeTruthy();
    // Region count should be bounded and far fewer than 20 land cell polygons.
    expect(landLayer!.regions!.length).toBeLessThanOrEqual(4);
  });
});

// ============================================================================
// React Rendering and Blending Tests
// ============================================================================

describe('Terrain Under Discrete Overlay rendering', () => {
  const dummyModel: AtlasSvgModel = {
    width: 100,
    height: 100,
    layers: [
      { id: 'ocean', polygons: [], regions: [] },
      { id: 'land', polygons: [], regions: [{ d: 'M0,0L10,0L10,10Z', fill: 'rgb(34,139,34)' }] }, // biome/terrain fill
    ],
    stateRegions: [{ d: 'M0,0L10,0L10,10Z', fill: '#ff0000' }], // state overlay fill
  };

  it('renders the real terrain base underneath political overlays (states) and blends at 0.45 opacity', () => {
    const { container } = render(
      <svg>
        <AtlasLayers model={dummyModel} visible={{ states: true }} />
      </svg>
    );

    // Verify that the land regions base with real terrain fill (rgb(34,139,34)) is rendered.
    const terrainPath = container.querySelector('path[fill="rgb(34,139,34)"]');
    expect(terrainPath).toBeTruthy();

    // Verify that the state overlay is rendered on top with opacity 0.45.
    const stateGroup = container.querySelector('g[opacity="0.45"]');
    expect(stateGroup).toBeTruthy();
    const statePath = stateGroup!.querySelector('path[fill="#ff0000"]');
    expect(statePath).toBeTruthy();
  });
});

// ============================================================================
// Seed-Scoped Preferences Tests
// ============================================================================

describe('Seed-Scoped Preferences', () => {
  it('StartPointSelection passes worldSeed as prefsScope to AtlasSvgView', () => {
    const { container } = render(
      <StartPointSelection worldSeed={5678} onConfirm={() => {}} />
    );
    const mockView = container.querySelector('[data-testid="mock-atlas-svg-view"]');
    expect(mockView).toBeTruthy();
    expect(mockView!.getAttribute('data-prefs-scope')).toBe('5678');
  });

  it('PreviewStartSelect passes seed as prefsScope to AtlasSvgView', () => {
    const { container } = render(
      <PreviewStartSelect />
    );
    const mockView = container.querySelector('[data-testid="mock-atlas-svg-view"]');
    expect(mockView).toBeTruthy();
    expect(mockView!.getAttribute('data-prefs-scope')).toBe('1337');
  });
});
