/** A closed source removes new water, while emitted rows keep falling.
 * These CPU checks do not establish rendered shader or optical acceptance. */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { RiverWaterfallView, waterfallLiquidEdge, waterfallLiquidPoint, waterfallLiquidSection } from '../riverWaterfallView';
import { RiverSurfaceMirror } from '../riverSurfaceMirror';
import { RIVER_SHAPE_DEFAULT } from '@/systems/world3d/river/riverReach';
import { riverSourceAt, type RiverSourceStatus } from '@/systems/world3d/river/riverSourceHistory';

describe('waterfall dry admission sections', () => {
  it('keeps fringe samples identical to full rings across dry, wet and flood sections', () => {
    for (const q of [0, .01, 1.5, 12, 120]) for (const width of [2, 10, 24]) {
      for (const age of [0, .001, .1, 1, 3.8]) for (const time of [0, 7.31, 120]) {
        const speed = q / (width * .7);
        for (const transientArea of [undefined, 0, .003, 2]) {
          const full = waterfallLiquidSection(q, width, speed, age, time, transientArea);
          for (const side of [-1, 1] as const) {
            const sampled = waterfallLiquidEdge(q, width, speed, age, time, side, transientArea);
            const edge = full.ring[side < 0 ? 24 : 0];
            expect(sampled.edge).toEqual(edge);
            expect(sampled.thickness).toBe(full.thickness);
            expect(sampled.coherence).toBe(full.coherence);
            expect(waterfallLiquidPoint(sampled, q, width, speed, .7, 70, age, time, ...sampled.edge))
              .toEqual(waterfallLiquidPoint(full, q, width, speed, .7, 70, age, time, ...edge));
          }
        }
      }
    }
  });
  it('has no liquid, entrained air or coherent reflection at every dry age', () => {
    for (const age of [0, .01, .2, 1, 3.8]) {
      const section = waterfallLiquidSection(0, 10, 0, age, 20);
      for (const value of [section.area, section.envelopeArea, section.fraction,
        section.width, section.thickness, section.coherence]) expect(value).toBe(0);
      expect(section.ring).toHaveLength(48);
      expect(section.ring.flat().every(value => value === 0)).toBe(true);
      expect(section.canonicalRing).toEqual(section.ring);
      const point = waterfallLiquidPoint(section, 0, 10, 0, .7, 70, age, 20);
      expect(Object.values(point).every(Number.isFinite)).toBe(true);
    }
  });

  it('collapses absent admission even if a stale transient area is supplied', () => {
    expect(waterfallLiquidSection(0, 10, 0, 1, 20, 2).envelopeArea).toBe(0);
    expect(waterfallLiquidSection(12, 10, 12 / 7, 1, 20, 0).fraction).toBe(0);
  });

  it('retains wet history after closure and allows a new wet front after reopening', () => {
    const source: RiverSourceStatus = { paused: false, flightDelayS: 4,
      changes: [{ timeS: 0, q: 12 }, { timeS: 10, q: 0 }, { timeS: 12, q: 12 }] };
    for (const [time, ages] of [[11, [0, .5, 2, 3.8]], [12.5, [0, 1, 2, 3.8]]] as const) {
      for (const age of ages) {
        const q = riverSourceAt(source, null, time - age);
        const section = waterfallLiquidSection(q, 10, q / 7, age, time);
        if (q === 0) expect(section.envelopeArea).toBe(0);
        else {
          expect(section.area).toBeGreaterThan(0);
          expect(section.envelopeArea * section.fraction).toBeCloseTo(section.area, 12);
          expect(section.ring.flat().every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it('keeps every real mesh attribute finite with a dry lip and wet airborne tail', () => {
    // Only receiving-level sampling is needed for this geometry check.
    const mirror = Object.create(RiverSurfaceMirror.prototype) as RiverSurfaceMirror;
    const sample = vi.spyOn(mirror, 'sheetAt').mockReturnValue(8);
    const view = new RiverWaterfallView(20260928, { ...RIVER_SHAPE_DEFAULT, dischargeM3S: 12 }, mirror);
    const hidden = (view as unknown as { parcels: THREE.InstancedMesh }).parcels;
    const hiddenWrites = vi.spyOn(hidden, 'setMatrixAt');
    try {
      view.setFlood(null, 11, { paused: true, flightDelayS: 4,
        changes: [{ timeS: 0, q: 12 }, { timeS: 10, q: 0 }] });
      view.update(11, new THREE.PerspectiveCamera());
      const body = view.group.children.find(child => child instanceof THREE.Mesh
        && child.geometry.hasAttribute('envelopeThick')) as THREE.Mesh | undefined;
      expect(body?.visible).toBe(true);
      // A wet tail must still be rendered, without rebuilding invisible glyphs.
      expect(hidden.visible).toBe(false);
      expect(hiddenWrites).not.toHaveBeenCalled();
      const geometry = body!.geometry;
      for (const name of ['position', 'normal', 'liquidDepth', 'liquidFraction', 'coherence',
        'envelopeCenter', 'envelopeAcross', 'envelopeThick', 'envelopeRadius']) {
        expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite), name).toBe(true);
      }
      const fraction = geometry.getAttribute('liquidFraction');
      expect(fraction.getX(0)).toBe(0);
      expect(fraction.getX(fraction.count - 1)).toBeGreaterThan(0);
      expect(geometry.getAttribute('coherence').getX(0)).toBe(0);
    } finally { view.dispose(); sample.mockRestore(); }
  }, 60000);
});
