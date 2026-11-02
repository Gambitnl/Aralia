/**
 * The table lamp mesh (GG-594 part 3) must sit where InteriorLights puts its
 * light: the body stands on the table top (y = 0), and the flame is widest at
 * LAMP_FLAME_ABOVE_M, the height of the lamp's point light.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  LAMP_FLAME_ABOVE_M,
  LAMP_FURNITURE,
  tableLampBodyGeometry,
  tableLampFlameGeometry,
  tableLampFlameMaterial,
} from '../tableLamp';

const box = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

describe('table lamp mesh', () => {
  it('stands on the table top and puts the flame on the nozzle', () => {
    const body = box(tableLampBodyGeometry());
    const flame = box(tableLampFlameGeometry());
    expect(body.min.y).toBeCloseTo(0, 6);
    // The flame starts where the body ends.
    expect(flame.min.y).toBeCloseTo(body.max.y, 6);
    expect(flame.min.y).toBeLessThan(LAMP_FLAME_ABOVE_M);
    expect(flame.max.y).toBeGreaterThan(LAMP_FLAME_ABOVE_M);
  });

  it('is widest at the light height, so the light sits in the flame', () => {
    const pos = tableLampFlameGeometry().getAttribute('position');
    let widestY = 0, widest = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (r > widest) { widest = r; widestY = pos.getY(i); }
    }
    expect(widestY).toBeCloseTo(LAMP_FLAME_ABOVE_M, 6); // float32 positions
  });

  it('shares one geometry and one flame material across lamps', () => {
    expect(tableLampBodyGeometry()).toBe(tableLampBodyGeometry());
    expect(tableLampFlameGeometry()).toBe(tableLampFlameGeometry());
    expect(tableLampFlameMaterial()).toBe(tableLampFlameMaterial());
    expect(tableLampFlameMaterial().toneMapped).toBe(false);
  });

  it('stands on tables, desks, counters and workbenches only', () => {
    for (const kind of ['table', 'desk', 'writing-desk', 'counter', 'workbench']) expect(LAMP_FURNITURE.has(kind)).toBe(true);
    for (const kind of ['bed', 'chair', 'shelf', 'barrel', 'hearth']) expect(LAMP_FURNITURE.has(kind)).toBe(false);
  });
});
