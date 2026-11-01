/** Smaller running messages must preserve visible water and full control recovery. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { WaterfallContactView } from '../waterfallContactView';
import type { RiverWaterUniforms } from '../riverWaterMaterial';
import { WaterfallTerrainInspection } from '@/systems/world3d/river/waterfallTerrainInspection';
import { waterfallPresentationSnapshot, packWaterfallPresentation, unpackWaterfallPresentation } from '@/systems/world3d/river/waterfallPresentationSnapshot';

vi.mock('../riverWaterfallCliff', () => ({ createWaterfallRockMaterial: () => new THREE.MeshBasicMaterial() }));
const views: WaterfallContactView[] = [];
function view(builder = false) {
  const v = new WaterfallContactView({ x: 0, z: 0, tx: 1, tz: 0 }, {} as RiverWaterUniforms, builder);
  v.setRepresentation('local'); v.setUnresolvedThicknessPolicy('report'); views.push(v); return v;
}
function run() {
  const r = new WaterfallTerrainInspection();
  r.execute({ type: 'select', id: 'seven-sisters' });
  r.execute({ type: 'running', running: true }); return r;
}
afterEach(() => { views.splice(0).forEach(v => v.dispose()); vi.restoreAllMocks(); });
describe('waterfall presentation messages', () => {
  it('transfers every display value exactly without detaching physical state', () => {
    const full = run().execute({ type: 'step', ticks: 4 }).snapshots[0].snapshot;
    const base = full.parcels[0];
    full.parcels.push({ ...base, id: Number.MAX_SAFE_INTEGER, volume: Number.MIN_VALUE,
      position: [-0, 1e-120, 123456789.12345679], velocity: [Number.MIN_VALUE, -1234.567, -0],
      motionRevision: -0, support: { surfaceId: 'test ledge', geometryIdentity: 'same exact chart', coordinate: [.1, -.2], velocity: [3, -4], referenceTime: 123.456 } });
    const before = structuredClone(full), expected = waterfallPresentationSnapshot(full);
    const packed = packWaterfallPresentation(full);
    const received = structuredClone(packed, { transfer: [packed.packedParcels.buffer] });
    expect(packed.packedParcels.byteLength).toBe(0);
    const decoded = unpackWaterfallPresentation(received);
    expect(decoded).toEqual(expected);
    expect(Object.is(decoded.parcels.at(-1)!.position[0], -0)).toBe(true);
    expect(Object.is(decoded.parcels.at(-1)!.motionRevision, -0)).toBe(true);
    expect(full).toEqual(before);
    decoded.parcels[0].position[0] += 1;
    decoded.parcels.at(-1)!.support!.coordinate[0] += 1;
    expect(full).toEqual(before);
    const empty = { ...full, parcels: [] };
    expect(unpackWaterfallPresentation(packWaterfallPresentation(empty))).toEqual(waterfallPresentationSnapshot(empty));
  });
  it('rejects malformed packed lengths and support ownership', () => {
    const full = run().execute({ type: 'step', ticks: 1 }).snapshots[0].snapshot;
    const packed = packWaterfallPresentation(full);
    expect(() => unpackWaterfallPresentation({ ...packed, packedParcels: new Float64Array(3) })).toThrow('parcel transport');
    const support = { surfaceId: 'ledge', geometryIdentity: 'chart', coordinate: [0, 0] as [number, number], velocity: [0, 0] as [number, number], referenceTime: 0 };
    expect(() => unpackWaterfallPresentation({ ...packed, parcelSupports: [[-1, support]] })).toThrow('support transport');
    expect(() => unpackWaterfallPresentation({ ...packed, parcelSupports: [[0, support], [0, support]] })).toThrow('support transport');
  });
  it('moves drops with exact composed matrices while retaining their received shape', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const first = run().execute({ type: 'step', ticks: 1 }).snapshots[0].snapshot;
    first.parcels = Array.from({ length: 24 }, (_, i) => ({ ...first.parcels[0], id: i,
      sourceRelease: undefined, sheetRelease: undefined, contactCount: 1,
      volume: .001 + i * .003, position: [i, 30 + i, -i],
      velocity: i === 0 ? [0, 0, 0] : [i * .7, -i * 2, i * .13] }));
    const v = view(); v.update(first);
    const mesh = v.water.children.find(o => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    const diameter = mesh.geometry.getAttribute('liquidDiameter') as THREE.InstancedBufferAttribute;
    const unitVolume = (v as unknown as { unitVolume: number }).unitVolume;
    const expected = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
    const next = structuredClone(first); next.receipt.time += .1;
    next.parcels.reverse();
    next.parcels.forEach((p, i) => { p.position = [p.position[0] + 2, p.position[1] - 3, p.position[2] + 4]; p.volume *= 2; p.velocity = [i, -i, i * 2]; });
    // A new contact snaps instead of crossing a rock along an interpolated arc.
    next.parcels[3].contactCount++;
    for (const constantGravity of [false, true]) {
      now += 1000; v.clearSnapshot(); v.update(first);
      if (constantGravity) next.receipt.airborneTrajectory = 'constant-gravity';
      now += 400; v.update(next);
      const version = diameter.version, shapes = diameter.array.slice();
      for (const fraction of [0, .01, .17, .5, .99, 1]) {
        v.present(now + 400 * fraction);
        next.parcels.forEach((p, i) => {
          const prior = first.parcels.find(old => old.id === p.id)!;
          const velocity = new THREE.Vector3().fromArray(p.velocity), speed = velocity.length();
          const stretch = Math.max(1, Math.min(5, 1 + speed * .08));
          const radius = Math.cbrt(p.volume / unitVolume), minor = radius / Math.sqrt(stretch);
          expected.position.fromArray(p.position);
          if (prior.contactCount === p.contactCount) {
            if (constantGravity && fraction < 1) {
              const elapsed = (next.receipt.time - first.receipt.time) * fraction;
              expected.position.set(prior.position[0] + prior.velocity[0] * elapsed,
                prior.position[1] + prior.velocity[1] * elapsed - 4.905 * elapsed * elapsed,
                prior.position[2] + prior.velocity[2] * elapsed);
            } else if (!constantGravity) expected.position.fromArray(prior.position).lerp(new THREE.Vector3().fromArray(p.position), fraction);
          }
          expected.quaternion.setFromUnitVectors(up, speed > 1e-8 ? velocity.normalize() : up);
          expected.scale.set(minor, radius * stretch, minor); expected.updateMatrix();
          expect(mesh.instanceMatrix.array.slice(i * 16, (i + 1) * 16)).toEqual(new Float32Array(expected.matrix.elements));
          expect(diameter.array[i]).toBe(Math.fround(minor * 2));
        });
        expect(diameter.version).toBe(version);
        expect(diameter.array).toEqual(shapes);
      }
    }
    // Rewind resets both the membership and the cached shape.
    now += 1000; v.update(first);
    expect(diameter.array[0]).toBe(Math.fround(Math.cbrt(first.parcels[0].volume / unitVolume) * 2));
  });
  it('reuses camera-relative origins only while camera, model and geometry agree', () => {
    const full = run().execute({ type: 'step', ticks: 4 }).snapshots[0].snapshot;
    const v = view(); v.update(full);
    const internals = v as unknown as { surface: THREE.Mesh; updatePrimitiveOrigins(camera: THREE.Camera, call: number): void };
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 0, 10); camera.updateMatrixWorld(true);
    internals.surface.updateMatrixWorld(true);
    const origins = internals.surface.geometry.getAttribute('prismOriginView') as THREE.BufferAttribute;
    internals.updatePrimitiveOrigins(camera, 1);
    const usedComponents = internals.surface.geometry.drawRange.count * origins.itemSize;
    expect(usedComponents).toBeGreaterThan(0);
    const version = origins.version, atStart = origins.array.slice(0, usedComponents);
    internals.updatePrimitiveOrigins(camera, 2);
    expect(origins.version).toBe(version);
    expect(origins.array.slice(0, usedComponents)).toEqual(atStart);
    camera.position.x += 1; camera.updateMatrixWorld(true);
    internals.updatePrimitiveOrigins(camera, 3);
    expect(origins.version).toBe(version + 1);
    expect(origins.array[0]).not.toBe(atStart[0]);
    internals.surface.position.x += 2; internals.surface.updateMatrixWorld(true);
    internals.updatePrimitiveOrigins(camera, 4);
    expect(origins.version).toBe(version + 2);
    v.setRepresentation('world'); v.setRepresentation('local');
    internals.updatePrimitiveOrigins(camera, 5);
    expect(origins.version).toBe(version + 3);
  });
  it('keeps completed motion on the GPU until a new display input arrives', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const first = run().execute({ type: 'step', ticks: 1 }).snapshots[0].snapshot;
    // One contacted parcel exercises the actual glyph path without waiting
    // through a complete fall. Its displacement supplies a visible midpoint.
    first.parcels = [{ ...first.parcels[0], sourceRelease: undefined, sheetRelease: undefined,
      contactCount: 1, position: [0, 30, 0], velocity: [2, -3, 0] }];
    const v = view(); v.update(first);
    const mesh = v.water.children.find(o => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(mesh.instanceMatrix.usage).toBe(THREE.StaticDrawUsage);
    const original = mesh.instanceMatrix.array.slice();
    const version = mesh.instanceMatrix.version;
    v.present(1100); v.present(1300);
    expect(mesh.instanceMatrix.version).toBe(version);
    expect(mesh.instanceMatrix.array).toEqual(original);

    now = 1400;
    const next = structuredClone(first); next.receipt.time += 1 / 120;
    next.parcels[0].position = [2, 27, 0];
    v.update(next); v.present(1600);
    const midpoint = mesh.instanceMatrix.array.slice();
    expect(midpoint[12]).toBe(1);
    const midVersion = mesh.instanceMatrix.version;
    v.present(1600);
    expect(mesh.instanceMatrix.version).toBe(midVersion);
    v.present(1800);
    expect(mesh.instanceMatrix.array[12]).toBe(2);
    const endVersion = mesh.instanceMatrix.version;
    v.present(2200);
    expect(mesh.instanceMatrix.version).toBe(endVersion);
    // A representation rebuild and a rewind must not inherit the early return.
    v.setRepresentation('world', 2200);
    expect(mesh.instanceMatrix.version).toBeGreaterThan(endVersion);
    now = 2400; v.update(first);
    expect(mesh.instanceMatrix.array[12]).toBe(0);
    v.clearSnapshot(); now = 2500; v.update(first);
    expect(mesh.instanceMatrix.array[12]).toBe(0);
  });
  it('preserves every display parcel and accounting without changing solver state', () => {
    const full = run().execute({ type: 'step', ticks: 4 }).snapshots[0].snapshot;
    const before = structuredClone(full), reduced = waterfallPresentationSnapshot(full);
    expect(reduced.receipt).toEqual(full.receipt);
    expect(reduced.film).toEqual(full.film);
    expect(reduced.surfaces).toEqual(full.surfaces);
    expect(reduced.parcels.length).toBeGreaterThan(0);
    reduced.parcels.forEach((p, i) => {
      const original = full.parcels[i];
      expect(p.position).toEqual(original.position); expect(p.velocity).toEqual(original.velocity);
      expect(p.volume).toBe(original.volume); expect(p.support).toEqual(original.support);
      expect(p.uncontactedSheet).toBe(Boolean((original.sheetRelease ?? original.sourceRelease) && original.contactCount === 0));
      expect(p).not.toHaveProperty('sourceRelease'); expect(p).not.toHaveProperty('sheetRelease');
    });
    expect(full).toEqual(before);
  });
  it('installs identical geometry and volume across successive physical updates', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const r = run(), direct = view(), receiver = view(), builder = view(true);
    for (let i = 0; i < 3; i++) {
      const full = r.execute({ type: 'step', ticks: 4 }).snapshots[0].snapshot;
      const packet = structuredClone(builder.prepareSurfacePacket(full));
      direct.update(full, packet);
      const packed = packWaterfallPresentation(full);
      receiver.update(unpackWaterfallPresentation(structuredClone(packed, { transfer: [packed.packedParcels.buffer] })), packet);
      direct.present(1100); receiver.present(1100);
      const mesh = (v: WaterfallContactView) => (v as unknown as { surface: THREE.Mesh }).surface;
      for (const [name, a] of Object.entries(mesh(direct).geometry.attributes)) {
        const count = packet.vertexCount * a.itemSize;
        expect(Array.from(mesh(receiver).geometry.getAttribute(name).array.slice(0, count))).toEqual(Array.from(a.array.slice(0, count)));
      }
      expect(receiver.receipt()).toEqual(direct.receipt());
    }
  });
  it('requires an exact-clock prepared surface before changing the display', () => {
    const full = run().execute({ type: 'step', ticks: 4 }).snapshots[0].snapshot;
    const receiver = view(), builder = view(true), reduced = waterfallPresentationSnapshot(full);
    expect(() => receiver.update(reduced)).toThrow('matching prepared surface');
    const packet = builder.prepareSurfacePacket(full); packet.time += 1;
    expect(() => receiver.update(reduced, packet)).toThrow('matching prepared surface');
    expect(receiver.receipt().surfaceVertices).toBe(0);
  });
  it('restores full geometry sources on a same-clock pause without restarting interpolation', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const r = run(), full = r.execute({ type: 'step', ticks: 4 }).snapshots[0].snapshot;
    const receiver = view(), builder = view(true);
    receiver.update(waterfallPresentationSnapshot(full), builder.prepareSurfacePacket(full));
    const timeBefore = (receiver as unknown as { receivedAt: number }).receivedAt;
    vi.spyOn(performance, 'now').mockReturnValue(2000);
    const paused = r.execute({ type: 'running', running: false }).snapshots[0].snapshot;
    receiver.update(paused);
    expect(paused.receipt.time).toBe(full.receipt.time);
    expect((receiver as unknown as { receivedAt: number }).receivedAt).toBe(timeBefore);
    expect(() => receiver.setRepresentation('world')).not.toThrow();
    expect(() => receiver.setRepresentation('local')).not.toThrow();
    expect(receiver.receipt().surfaceVertices).toBeGreaterThan(0);
  });
});
