import { describe, expect, it } from 'vitest';
import {
  METERS_PER_CELL,
  DEFAULT_SVG_HEIGHT,
  DEFAULT_SVG_WIDTH,
  getTerrainHeight,
  svgToWorldCoords,
  worldMetersToGridNormalized,
  worldToSvgCoords,
} from '../worldCoords';
import { WORLD3D_CONFIG, heightToMeters } from '../../systems/world3d/config';
import type { WorldData } from '../../services/worldSim/types';

/**
 * Protects bidirectional world↔SVG transforms used by atlas marker sync and click-to-travel,
 * and pins the world-meter frame + height mapping to the streamed-3D renderer's config.
 */
describe('worldCoords', () => {
  it('round-trips world meters through SVG coordinates at default viewport', () => {
    const wx = 1920;
    const wz = 1280;
    const svg = worldToSvgCoords(wx, wz);
    const back = svgToWorldCoords(svg.x, svg.y);
    expect(back.x).toBeCloseTo(wx, 5);
    expect(back.z).toBeCloseTo(wz, 5);
  });

  it('maps a world-meter position back to normalized atlas coords', () => {
    const cols = 60;
    const rows = 40;
    // A point 10.5/60 across and 5.5/40 down the world, in meters.
    const x = 10.5 * METERS_PER_CELL;
    const z = 5.5 * METERS_PER_CELL;

    const { normX, normY } = worldMetersToGridNormalized(x, z, cols, rows);
    expect(normX).toBeCloseTo(10.5 / cols, 5);
    expect(normY).toBeCloseTo(5.5 / rows, 5);
  });

  it('scales SVG projection with custom viewport size', () => {
    const wx = METERS_PER_CELL * 30; // half the 60-col world width
    const wz = METERS_PER_CELL * 20; // half the 40-row world height
    const svg = worldToSvgCoords(wx, wz, 4000, 2000);
    expect(svg.x).toBeCloseTo(2000, 5);
    expect(svg.y).toBeCloseTo(1000, 5);
    const back = svgToWorldCoords(svg.x, svg.y, 4000, 2000);
    expect(back.x).toBeCloseTo(wx, 5);
    expect(back.z).toBeCloseTo(wz, 5);
  });

  it('uses documented default SVG dimensions', () => {
    expect(DEFAULT_SVG_WIDTH).toBe(2000);
    expect(DEFAULT_SVG_HEIGHT).toBe(1333);
  });

  it('uses the streamed-3D renderer meters-per-cell, not the 128m chunk size', () => {
    expect(METERS_PER_CELL).toBe(WORLD3D_CONFIG.METERS_PER_CELL);
  });

  describe('getTerrainHeight', () => {
    const makeWorldData = (cols: number, rows: number, heights: number[]): WorldData =>
      ({ gridSize: { cols, rows }, heights } as unknown as WorldData);

    it('matches heightToMeters on a flat grid (renderer parity)', () => {
      const worldData = makeWorldData(4, 4, new Array(16).fill(50));
      const y = getTerrainHeight(METERS_PER_CELL * 1.5, METERS_PER_CELL * 1.5, worldData);
      expect(y).toBeCloseTo(heightToMeters(50), 5);
    });

    it('bilinearly interpolates heights between cells in the 0..100 domain', () => {
      // Row 0: heights 0, 100 — midpoint between the two cells should map 50.
      const worldData = makeWorldData(2, 2, [0, 100, 0, 100]);
      const y = getTerrainHeight(METERS_PER_CELL * 0.5, 0, worldData);
      expect(y).toBeCloseTo(heightToMeters(50), 5);
    });

    it('never exceeds the rendered terrain ceiling for max heights', () => {
      const worldData = makeWorldData(4, 4, new Array(16).fill(100));
      const y = getTerrainHeight(METERS_PER_CELL * 2, METERS_PER_CELL * 2, worldData);
      expect(y).toBeCloseTo(
        WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M * WORLD3D_CONFIG.VERTICAL_EXAGGERATION,
        5,
      );
    });
  });
});
