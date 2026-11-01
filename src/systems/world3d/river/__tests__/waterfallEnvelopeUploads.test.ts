/** Resident envelope data must refresh after hydraulic/shape changes, while
 * animated positions keep moving without resending identical optical fields. */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { RiverWaterfallView } from '@/components/World3D/water/riverWaterfallView';
import { RiverSurfaceMirror } from '@/components/World3D/water/riverSurfaceMirror';
import { RIVER_SHAPE_DEFAULT } from '../riverReach';

// Landscape generation is independent of the water buffer being exercised.
// Keep the real water/atlas update, but avoid building thousands of rock props.
vi.mock('@/components/World3D/water/riverWaterfallCliff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/World3D/water/riverWaterfallCliff')>();
  return { ...actual, buildWaterfallCliff: () => new THREE.Group(), disposeWaterfallCliff: () => {} };
});

function fixture() {
  const mirror = Object.create(RiverSurfaceMirror.prototype) as RiverSurfaceMirror;
  mirror.sheetAt = () => 8;
  const view = new RiverWaterfallView(20260928, RIVER_SHAPE_DEFAULT, mirror);
  const body = () => (view as unknown as { strands: THREE.Mesh }).strands.geometry;
  const envelope = () => (body().getAttribute('liquidDepth') as THREE.InterleavedBufferAttribute).data;
  return { view, body, envelope, camera: new THREE.PerspectiveCamera() };
}

describe('waterfall envelope upload ownership', () => {
  it('keeps optical rows resident while visible positions and UVs animate', () => {
    const f = fixture();
    try {
      f.view.update(0, f.camera);
      const envelope = f.envelope(), version = envelope.version, saved = envelope.array.slice();
      const positions = f.body().getAttribute('position') as THREE.BufferAttribute, before = positions.array.slice();
      const positionVersion = positions.version;
      f.view.update(.27, f.camera);
      expect(f.envelope()).toBe(envelope);
      expect(envelope.version).toBe(version);
      expect(envelope.array.every((value, i) => Object.is(value, saved[i]))).toBe(true);
      expect(positions.version).toBeGreaterThan(positionVersion);
      expect(positions.array.some((value, i) => !Object.is(value, before[i]))).toBe(true);
    } finally { f.view.dispose(); }
  });

  it('refreshes changed rows once after a shape change, then retains them', () => {
    const f = fixture();
    try {
      f.view.update(0, f.camera);
      const envelope = f.envelope(), version = envelope.version, saved = envelope.array.slice();
      f.view.setShape({ ...RIVER_SHAPE_DEFAULT, widthScale: .6, depthScale: .5, dischargeM3S: 12 });
      f.view.update(1, f.camera);
      expect(envelope.version).toBe(version + 1);
      expect(envelope.array.some((value, i) => !Object.is(value, saved[i]))).toBe(true);
      f.view.update(1.1, f.camera);
      expect(envelope.version).toBe(version + 1);
      // All 48 vertices in each row carry identical envelope data.
      let uniform = true;
      for (let row = 0; row < 129; row++) for (let vertex = 1; vertex < 48; vertex++) {
        const base = row * 48 * 14, offset = base + vertex * 14;
        for (let component = 0; component < 14; component++) {
          if (!Object.is(envelope.array[offset + component], envelope.array[base + component])) uniform = false;
        }
      }
      expect(uniform).toBe(true);
    } finally { f.view.dispose(); }
  });
});
