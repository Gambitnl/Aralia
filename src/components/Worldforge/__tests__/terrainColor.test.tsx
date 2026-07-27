/**
 * This file contains unit tests for the terrain coloring system.
 *
 * It validates that hex colors are parsed correctly, that heights and slopes
 * are grouped into the correct buckets, and that color lifts and shading are
 * calculated deterministically. Renderer composition and preference scoping
 * stay in their owning component test files so this pure math suite remains
 * quick and cannot trigger a full procedural world build.
 *
 * Runs under: Vitest
 * Connects to: terrainColor.ts
 */

import { describe, it, expect } from 'vitest';
import {
  parseHexColor,
  getCellElevationBucket,
  getCellSlopeBucket,
  getCellSlope,
  getTerrainKey,
  getTerrainColor,
} from '../terrainColor';
import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';

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
    expect(color).toBe('rgb(51,135,51)');
    expect(getTerrainColor(stubAtlas, '0_2_2')).toBe(color);
  });

  it('clamps dark and lit color channels to valid CSS RGB values', () => {
    const extremeAtlas = {
      ...stubAtlas,
      biomesData: { color: ['#000000', '#ffffff'] },
    } as unknown as FmgAtlasResult;

    expect(getTerrainColor(extremeAtlas, '0_0_2')).toBe('rgb(0,0,0)');
    expect(getTerrainColor(extremeAtlas, '1_0_0')).toBe('rgb(255,255,255)');
  });
});
