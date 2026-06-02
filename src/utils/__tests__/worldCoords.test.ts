import { describe, expect, it } from 'vitest';
import {
  CHUNK_SIZE,
  DEFAULT_SVG_HEIGHT,
  DEFAULT_SVG_WIDTH,
  gridCellCenterToWorldMeters,
  svgToWorldCoords,
  worldMetersToGridNormalized,
  worldToSvgCoords,
} from '../worldCoords';

/**
 * Protects bidirectional world↔SVG transforms used by atlas marker sync and click-to-travel.
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

  it('maps grid cell center to world meters and back to normalized coords', () => {
    const cols = 60;
    const rows = 40;
    const { x, z } = gridCellCenterToWorldMeters(10, 5, cols, rows);
    expect(x).toBeCloseTo((10.5 / cols) * cols * CHUNK_SIZE, 5);
    expect(z).toBeCloseTo((5.5 / rows) * rows * CHUNK_SIZE, 5);

    const { normX, normY } = worldMetersToGridNormalized(x, z, cols, rows);
    expect(normX).toBeCloseTo(10.5 / cols, 5);
    expect(normY).toBeCloseTo(5.5 / rows, 5);
  });

  it('scales SVG projection with custom viewport size', () => {
    const svg = worldToSvgCoords(3840, 2560, 4000, 2000);
    expect(svg.x).toBeCloseTo(2000, 5);
    expect(svg.y).toBeCloseTo(1000, 5);
    const back = svgToWorldCoords(svg.x, svg.y, 4000, 2000);
    expect(back.x).toBeCloseTo(3840, 5);
    expect(back.z).toBeCloseTo(2560, 5);
  });

  it('uses documented default SVG dimensions', () => {
    expect(DEFAULT_SVG_WIDTH).toBe(2000);
    expect(DEFAULT_SVG_HEIGHT).toBe(1333);
  });
});
