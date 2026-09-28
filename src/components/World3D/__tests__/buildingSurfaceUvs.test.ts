import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyRoofSurfaceUvs, applyWallSurfaceUvs } from '../buildingSurfaceUvs';

describe('physical building surface coordinates', () => {
  it('uses the same wall courses in the foot-based lab and meter-based town', () => {
    const ft = new THREE.BoxGeometry(10, 10, 1);
    const meters = new THREE.BoxGeometry(3.048, 3.048, 0.3048);
    applyWallSurfaceUvs(ft, { x: 5, y: 5, z: 0 }, 0.3048);
    applyWallSurfaceUvs(meters, { x: 1.524, y: 1.524, z: 0 });
    const a = ft.getAttribute('uv'), b = meters.getAttribute('uv');
    for (let i = 0; i < a.count; i++) {
      expect(a.getX(i)).toBeCloseTo(b.getX(i));
      expect(a.getY(i)).toBeCloseTo(b.getY(i));
    }
    ft.dispose(); meters.dispose();
  });

  it('keeps roof tile size unchanged on a steep slope', () => {
    const g = new THREE.BufferGeometry();
    const s = Math.SQRT1_2;
    // Two points three meters apart down a45-degree slope; third along eave.
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -3 * s, 3 * s, 3, 0, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, s, s, 0, s, s, 0, s, s], 3));
    applyRoofSurfaceUvs(g);
    const uv = g.getAttribute('uv');
    expect(uv.getY(1) - uv.getY(0)).toBeCloseTo(1);
    expect(uv.getX(2) - uv.getX(0)).toBeCloseTo(1);
    expect(uv.getX(1)).toBeCloseTo(uv.getX(0));
    g.dispose();
  });
});
