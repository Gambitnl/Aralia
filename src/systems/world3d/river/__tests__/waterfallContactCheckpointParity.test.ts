/** Faster coordinate copies must keep complete independent rollback/display
 * records, including unusual diagnostic metadata and reference relationships. */
import { describe, expect, it } from 'vitest';
import { WaterfallContactFlow, type ContactParcel, type ContactReleaseLocal, type ContactSupport } from '../waterfallContactFlow';
import { waterfallContactGeometryIdentity } from '../waterfallContactGeometry';

function fixture() {
  const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 120 });
  flow.advanceTo(1 / 120, () => ({ q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 }));
  const internals = flow as unknown as { parcels: ContactParcel[]; saveRollbackState(): { snapshot: { parcels: ContactParcel[] } } };
  const surface = flow.snapshot().surfaces[0];
  const release: ContactReleaseLocal = { surfaceId: surface.id, geometryIdentity: waterfallContactGeometryIdentity(surface),
    face: 0, edge: `${surface.id}:0`, anchor: [.2, -.0], normal: [...surface.normal], clearance: .001,
    displacement: [-0, .001, 0], referenceTime: flow.time };
  const support: ContactSupport = { surfaceId: surface.id, geometryIdentity: waterfallContactGeometryIdentity(surface),
    coordinate: [.2, -.0], velocity: [.01, .02], referenceTime: flow.time };
  internals.parcels[0].releaseLocal = release;
  internals.parcels[0].support = support;
  return { flow, internals, release, support };
}

describe('contact coordinate copy fidelity', () => {
  it('copies canonical records exactly for both rollback and public inspection', () => {
    const { flow, internals, release, support } = fixture();
    for (const record of [internals.saveRollbackState(), flow.snapshot()]) {
      const parcel = 'snapshot' in record ? record.snapshot.parcels[0] : record.parcels[0];
      expect(parcel.releaseLocal).toStrictEqual(structuredClone(release));
      expect(parcel.support).toStrictEqual(structuredClone(support));
      expect(Object.is(parcel.releaseLocal!.displacement[0], -0)).toBe(true);
      parcel.releaseLocal!.normal[0] = 999; parcel.releaseLocal!.anchor[0] = 999;
      parcel.releaseLocal!.displacement[1] = 999;
      parcel.support!.coordinate[0] = 999; parcel.support!.velocity[0] = 999;
      expect(release.normal[0]).not.toBe(999); expect(release.anchor[0]).toBe(.2);
      expect(release.displacement[1]).toBe(.001); expect(support.coordinate[0]).toBe(.2); expect(support.velocity[0]).toBe(.01);
    }
  });
  it('keeps reference aliases when coordinate fields share the same array', () => {
    const { flow, internals, release, support } = fixture();
    release.displacement = release.normal; support.velocity = support.coordinate;
    for (const p of [internals.saveRollbackState().snapshot.parcels[0], flow.snapshot().parcels[0]]) {
      expect(p.releaseLocal!.displacement).toBe(p.releaseLocal!.normal);
      expect(p.releaseLocal!.normal).not.toBe(release.normal);
      expect(p.support!.velocity).toBe(p.support!.coordinate);
      expect(p.support!.coordinate).not.toBe(support.coordinate);
    }
  });
  it('retains extended cyclic diagnostics, sparse coordinates and nonfinite numbers', () => {
    const { flow, internals, release, support } = fixture();
    Object.assign(release, { diagnostic: { values: [undefined, NaN, Infinity], owner: release } });
    Reflect.deleteProperty(support.coordinate, 1);
    for (const p of [internals.saveRollbackState().snapshot.parcels[0], flow.snapshot().parcels[0]]) {
      expect(p.releaseLocal).toStrictEqual(structuredClone(release));
      expect(p.support).toStrictEqual(structuredClone(support));
      expect(Object.hasOwn(p.support!.coordinate, 1)).toBe(false);
    }
  });
  it('retains native clone semantics for added vector properties and symbol metadata', () => {
    const { internals, release, support } = fixture();
    Object.assign(release.normal, { diagnostic: { depth: 2 } });
    Object.assign(support, { [Symbol('observer')]: 7 });
    const p = internals.saveRollbackState().snapshot.parcels[0];
    expect(p.releaseLocal).toStrictEqual(structuredClone(release));
    expect(p.support).toStrictEqual(structuredClone(support));
    expect(Object.getOwnPropertySymbols(p.support!)).toHaveLength(0);
  });
});

describe('rollback parcel record layout', () => {
  it('keeps immutable birth records shared internally and public records editable', () => {
    const { flow, internals } = fixture();
    const original = internals.parcels[0];
    original.sheetRelease = structuredClone(original.sourceRelease!);
    original.motionRevision = 4;
    original.sourceSupport = undefined;
    const copy = internals.saveRollbackState().snapshot.parcels[0];
    expect(copy.motionRevision).toBe(4);
    expect(Object.hasOwn(copy, 'sourceSupport')).toBe(true);
    expect(copy.sourceSupport).toBeUndefined();
    expect(copy.sourceSection).toBe(original.sourceSection);
    expect(copy.sourceRelease).toBe(original.sourceRelease);
    expect(copy.sheetRelease).toBe(original.sheetRelease);
    for (const release of [copy.sourceRelease!, copy.sheetRelease!]) {
      expect(Object.isFrozen(release)).toBe(true);
      for (const vector of [release.start, release.end, release.velocity]) expect(Object.isFrozen(vector)).toBe(true);
    }
    expect(Object.isFrozen(copy.sourceSection)).toBe(true);
    copy.position[0] += 20; copy.velocity[0] += 20;
    expect(copy.position).not.toEqual(original.position);
    expect(copy.velocity).not.toEqual(original.velocity);
    const publicCopy = flow.snapshot().parcels[0];
    publicCopy.sourceSection!.width += 20;
    publicCopy.sourceRelease!.start[0] += 20;
    expect(publicCopy.sourceSection).not.toEqual(original.sourceSection);
    expect(publicCopy.sourceRelease).not.toEqual(original.sourceRelease);
  });
  it('preserves extended metadata and symbol properties with the old shallow semantics', () => {
    const { internals } = fixture(), parcel = internals.parcels[0];
    const marker = Symbol('observer'), metadata = { count: 7 };
    Object.assign(parcel, { futureMetadata: metadata, [marker]: metadata });
    const copy = internals.saveRollbackState().snapshot.parcels[0];
    expect(Reflect.get(copy, 'futureMetadata')).toBe(metadata);
    expect(Reflect.get(copy, marker)).toBe(metadata);
    expect(copy.position).not.toBe(parcel.position);
    expect(copy.sourceRelease).toBe(parcel.sourceRelease);
  });
  it('preserves absent optional fields and older incomplete diagnostic records', () => {
    const { internals } = fixture(), parcel = internals.parcels[0];
    Reflect.deleteProperty(parcel, 'motionRevision');
    Reflect.deleteProperty(parcel, 'sourceSupport');
    const normal = internals.saveRollbackState().snapshot.parcels[0];
    expect(Object.hasOwn(normal, 'motionRevision')).toBe(false);
    expect(Object.hasOwn(normal, 'sourceSupport')).toBe(false);
    Reflect.deleteProperty(parcel, 'contactCount');
    const incomplete = internals.saveRollbackState().snapshot.parcels[0];
    expect(Object.hasOwn(incomplete, 'contactCount')).toBe(false);
    expect(incomplete.position).toEqual(parcel.position);
  });
});
