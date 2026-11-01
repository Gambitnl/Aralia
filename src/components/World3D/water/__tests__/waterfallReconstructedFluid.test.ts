/** Native buffer-layout regression for the optional surface candidate.
 * This reproduces the installed renderer's shared-data buffer accounting
 * without a GPU. Native pipeline compilation remains a separate check.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { WaterfallReconstructedFluid } from '../waterfallReconstructedFluid';
import type { RiverWaterUniforms } from '../riverWaterMaterial';
import type { FluidParticle } from '../waterfallFluidEmission';

// Constructor/layout checks deliberately never evaluate shader callbacks.
// Their light/texture uniforms therefore need no fake renderer or scene data.
const create = () => new WaterfallReconstructedFluid({} as RiverWaterUniforms);
type Layout = { geometry: THREE.InstancedBufferGeometry; depthMesh: THREE.InstancedMesh;
  thicknessMesh: THREE.InstancedMesh; sprayMesh: THREE.InstancedMesh };

describe('reconstructed fluid native vertex buffers', () => {
  it('fits the guaranteed eight-buffer limit even if every geometry field is referenced', () => {
    const fluid = create(), layout = fluid as unknown as Layout;
    try {
      for (const mesh of [layout.depthMesh, layout.thicknessMesh, layout.sprayMesh]) {
        const buffers = new Set(Object.values(mesh.geometry.attributes).map(attribute =>
          attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data : attribute));
        buffers.add(mesh.instanceMatrix);
        expect(buffers.size).toBeLessThanOrEqual(8);
      }
      const fields = Object.entries(layout.geometry.attributes).filter(([name]) => name.startsWith('fluid'));
      expect(fields).toHaveLength(7);
      expect(new Set(fields.map(([, attr]) => (attr as THREE.InterleavedBufferAttribute).data)).size).toBe(1);
    } finally { fluid.dispose(); }
  });
  it('preserves individual particle values and draw counts in the packed records', () => {
    const fluid = create(), layout = fluid as unknown as Layout;
    const particle: FluidParticle = { id: 'first', birth: 19, age: 1, volume: .01,
      center: [2, 70, 3], tangent: [1, 0, 0], radii: [.1, .2, .3], liquidFraction: .4, foam: .5 };
    try {
      fluid.update([particle, { ...particle, id: 'second', center: [4, 60, 5], age: 2, foam: .7 },
        { ...particle, id: 'spray', spray: true }], { x: 10, z: 20, tx: 1, tz: 0 });
      const attr = (name: string) => layout.geometry.getAttribute(name) as THREE.InterleavedBufferAttribute;
      expect([attr('fluidCenter').getX(0), attr('fluidCenter').getY(0), attr('fluidCenter').getZ(0)]).toEqual([12, 70, 17]);
      expect([attr('fluidCenter').getX(1), attr('fluidCenter').getY(1), attr('fluidCenter').getZ(1)]).toEqual([14, 60, 15]);
      expect(attr('fluidRadii').getZ(0)).toBeCloseTo(.3);
      expect(attr('fluidOptics').getX(0)).toBeCloseTo(.4);
      expect(attr('fluidOptics').getY(1)).toBeCloseTo(.7);
      expect(attr('fluidAge').getX(0)).toBe(1); expect(attr('fluidAge').getX(1)).toBe(2);
      expect(layout.geometry.instanceCount).toBe(2);
      expect((layout.sprayMesh.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);
    } finally { fluid.dispose(); }
  });
});
