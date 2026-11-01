/** Running display messages omit solver-only release bookkeeping. These records
 * can draw an already-qualified surface and frame/mark owned water, but cannot
 * rebuild geometry or restore physics. Controls and failures keep full snapshots. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/10/2026, 03:01:38
 * Dependents: components/World3D/water/waterfallContactView.ts, components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/waterfallTerrainComparisons.ts, systems/world3d/river/waterfallTerrainComparisons.worker.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactParcel, ContactSnapshot } from './waterfallContactFlow';

export type WaterfallPresentationParcel = Pick<ContactParcel,
  'id' | 'position' | 'velocity' | 'volume' | 'contactCount' | 'motionRevision' | 'support'> & {
  uncontactedSheet: boolean;
  sourceRelease?: never;
  sheetRelease?: never;
};
export type WaterfallPresentationSnapshot = Pick<ContactSnapshot, 'receipt' | 'surfaces' | 'film'> & {
  presentationOnly: true;
  parcels: WaterfallPresentationParcel[];
};
export type WaterfallDisplaySnapshot = ContactSnapshot | WaterfallPresentationSnapshot;
export function isWaterfallPresentation(snapshot: WaterfallDisplaySnapshot): snapshot is WaterfallPresentationSnapshot {
  return 'presentationOnly' in snapshot && snapshot.presentationOnly === true;
}
/** Read-only projection. postMessage supplies the independent receiving copy;
 * never use this record as a solver checkpoint or a geometry-builder input. */
export function waterfallPresentationSnapshot(snapshot: ContactSnapshot): WaterfallPresentationSnapshot {
  return { presentationOnly: true, receipt: snapshot.receipt, surfaces: snapshot.surfaces, film: snapshot.film,
    parcels: snapshot.parcels.map(p => ({ id: p.id, position: p.position, velocity: p.velocity, volume: p.volume,
      contactCount: p.contactCount, motionRevision: p.motionRevision, support: p.support,
      uncontactedSheet: Boolean((p.sheetRelease ?? p.sourceRelease) && p.contactCount === 0) })) };
}

// Transfer one contiguous binary64 record instead of asking the browser to
// clone thousands of objects and small position/velocity arrays. This is only
// the transport format: the receiver restores the same display records before
// interpolation. No rounding, parcel pruning or solver-state change occurs.
const PARCEL_STRIDE = 11;
export type WaterfallPackedPresentationSnapshot = Omit<WaterfallPresentationSnapshot, 'parcels'> & {
  parcelStride: 11;
  packedParcels: Float64Array;
  parcelSupports: Array<[number, NonNullable<ContactParcel['support']>]>;
};
export function packWaterfallPresentation(snapshot: ContactSnapshot | WaterfallPresentationSnapshot): WaterfallPackedPresentationSnapshot {
  const packedParcels = new Float64Array(snapshot.parcels.length * PARCEL_STRIDE);
  const parcelSupports: WaterfallPackedPresentationSnapshot['parcelSupports'] = [];
  snapshot.parcels.forEach((p, i) => {
    const offset = i * PARCEL_STRIDE;
    const sheet = 'uncontactedSheet' in p ? p.uncontactedSheet : Boolean((p.sheetRelease ?? p.sourceRelease) && p.contactCount === 0);
    packedParcels[offset] = p.id;
    for (let axis = 0; axis < 3; axis++) {
      packedParcels[offset + 1 + axis] = p.position[axis];
      packedParcels[offset + 4 + axis] = p.velocity[axis];
    }
    packedParcels[offset + 7] = p.volume;
    packedParcels[offset + 8] = p.contactCount;
    packedParcels[offset + 9] = p.motionRevision ?? 0;
    packedParcels[offset + 10] = (p.motionRevision !== undefined ? 1 : 0) | (sheet ? 2 : 0);
    if (p.support) parcelSupports.push([i, p.support]);
  });
  return { presentationOnly: true, receipt: snapshot.receipt, surfaces: snapshot.surfaces, film: snapshot.film,
    parcelStride: PARCEL_STRIDE, packedParcels, parcelSupports };
}
export function isPackedWaterfallPresentation(snapshot: WaterfallDisplaySnapshot | WaterfallPackedPresentationSnapshot): snapshot is WaterfallPackedPresentationSnapshot {
  return 'packedParcels' in snapshot;
}
export function unpackWaterfallPresentation(snapshot: WaterfallPackedPresentationSnapshot): WaterfallPresentationSnapshot {
  const data = snapshot.packedParcels;
  // Worker/VM boundaries can give typed arrays a different realm's prototype.
  // Check the actual buffer view and element kind rather than instanceof.
  if (snapshot.parcelStride !== PARCEL_STRIDE || !ArrayBuffer.isView(data) || Object.prototype.toString.call(data) !== '[object Float64Array]' || data.length % PARCEL_STRIDE !== 0) throw Error('Invalid waterfall parcel transport');
  const parcels: WaterfallPresentationParcel[] = new Array(data.length / PARCEL_STRIDE);
  for (let i = 0; i < parcels.length; i++) {
    const offset = i * PARCEL_STRIDE, flags = data[offset + 10];
    parcels[i] = { id: data[offset], position: [data[offset + 1], data[offset + 2], data[offset + 3]],
      velocity: [data[offset + 4], data[offset + 5], data[offset + 6]], volume: data[offset + 7],
      contactCount: data[offset + 8], motionRevision: flags & 1 ? data[offset + 9] : undefined,
      support: undefined, uncontactedSheet: Boolean(flags & 2) };
  }
  for (const [index, support] of snapshot.parcelSupports) {
    if (!Number.isInteger(index) || index < 0 || index >= parcels.length || parcels[index].support) throw Error('Invalid waterfall support transport');
    parcels[index].support = support;
  }
  return { presentationOnly: true, receipt: snapshot.receipt, surfaces: snapshot.surfaces, film: snapshot.film, parcels };
}
