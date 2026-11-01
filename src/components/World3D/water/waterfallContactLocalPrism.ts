/**
 * Keeps a native contact-water prism small before its coordinates enter Float32.
 * WaterfallContactView uses this only to draw the existing committed Film/Flow
 * state. Closed-prism measurements qualify coordinate storage, not fluid motion,
 * terrain clearance, overlapping water or the eventual GPU rasterization.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 06:41:44
 * Dependents: components/World3D/water/waterfallContactView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type PrismVector = [number, number, number];
export interface ContactLocalPrism {
  origin: PrismVector;
  u: PrismVector;
  v: PrismVector;
  normal: PrismVector;
  thickness: number;
  /** Eight vertices: the front ring followed by the back ring. */
  localCorners: Float32Array;
  worldCorners: Float64Array;
}
export interface RelativePrismMeasurement extends PrismMeasurement { relativeCentroid: PrismVector }
export interface ClosedPrismMeasurement extends PrismMeasurement { signedVolume: number }
export interface PrismMeasurement { volume: number; centroid: PrismVector; firstMoment: PrismVector }
const sub = (a: PrismVector, b: PrismVector): PrismVector => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: PrismVector, b: PrismVector) => ((0 + a[0]*b[0]) + a[1]*b[1]) + a[2]*b[2];
const cross = (a: PrismVector, b: PrismVector): PrismVector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: PrismVector): PrismVector => {
  const length = Math.hypot(...a);
  if (!(length > 0) || !Number.isFinite(length)) throw Error('Degenerate contact prism frame');
  return a.map(x => x / length) as PrismVector;
};

/** The caller supplies the existing midsurface; no new footprint or mass is made.
 * With storage, corners borrow those arrays until the next construction. The
 * synchronous surface builder copies them into its packet before reuse. Other
 * callers keep independently owned arrays by omitting storage. */
export function createContactLocalPrism(points: PrismVector[], thickness: number, storage?: { localCorners: Float32Array; worldCorners: Float64Array }): ContactLocalPrism {
  if (points.length !== 4 || !(thickness > 0) || !Number.isFinite(thickness) || points.some(p => p.some(x => !Number.isFinite(x)))) throw Error('Invalid contact prism');
  const origin = [0, 1, 2].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / 4) as PrismVector;
  const u = unit(sub(points[1], points[0]));
  const normal = unit(cross(u, sub(points[2], points[0]))), v = unit(cross(normal, u));
  // This tolerance covers binary64 coordinate construction only; it does not
  // flatten a physically bent primitive into the planar representation.
  // Read the same coordinate magnitude without temporary flattened arrays.
  // This runs for every visible water prism; the planarity allowance is unchanged.
  let coordinateMagnitude = 1;
  for (const p of points) for (let axis = 0; axis < 3; axis++) coordinateMagnitude = Math.max(coordinateMagnitude, Math.abs(p[axis]));
  const arithmeticAllowance = 64 * Number.EPSILON * coordinateMagnitude;
  if (points.some(p => Math.abs(dot(sub(p, points[0]), normal)) > arithmeticAllowance)) throw Error('Nonplanar contact prism');
  if (storage && (storage.localCorners.length !== 24 || storage.worldCorners.length !== 24 || storage.localCorners.buffer === storage.worldCorners.buffer)) throw Error('Invalid contact prism storage');
  const localCorners = storage?.localCorners ?? new Float32Array(24), worldCorners = storage?.worldCorners ?? new Float64Array(24);
  // Each ring shares its in-plane coordinates. Write directly into the final
  // arrays instead of making two temporary vectors for every corner. Keep the
  // original multiply/divide and addition order, including Float32 rounding.
  for (let i = 0; i < 4; i++) {
    const p = points[i], d = sub(p, origin), du = dot(d, u), dv = dot(d, v);
    for (let ring = 0; ring < 2; ring++) {
      const offset = (ring === 0 ? 1 : -1) * thickness / 2, at = (ring * 4 + i) * 3;
      localCorners[at] = du; localCorners[at + 1] = dv; localCorners[at + 2] = offset;
      for (let axis = 0; axis < 3; axis++) worldCorners[at + axis] = p[axis] + normal[axis] * offset;
    }
  }
  return { origin, u, v, normal, thickness, localCorners, worldCorners };
}

export function contactPrismCoordinate(frame: ContactLocalPrism, point: PrismVector): PrismVector {
  const d = sub(point, frame.origin);
  return [dot(d, frame.u), dot(d, frame.v), dot(d, frame.normal)];
}

const PRISM_TRIANGLES = [0,1,2,0,2,3,7,6,5,7,5,4,1,0,4,1,4,5,2,1,5,2,5,6,3,2,6,3,6,7,0,3,7,0,7,4];

/** Closed triangles include virtual rims even when shared rims are not drawn. */
export function measureClosedContactCorners(corners: ArrayLike<number>): ClosedPrismMeasurement {
  if (corners.length !== 24) throw Error('Contact prism requires eight corners');
  // Keep the same twelve oriented triangles and accumulation order, but avoid
  // allocating vectors, faces and triangle arrays for every measured prism.
  // All volume/centroid qualification still runs on every uploaded primitive.
  let signedVolume = 0; const moment: PrismVector = [0, 0, 0];
  for (let t = 0; t < PRISM_TRIANGLES.length; t += 3) {
    const a = PRISM_TRIANGLES[t]*3, b = PRISM_TRIANGLES[t+1]*3, c = PRISM_TRIANGLES[t+2]*3;
    const ax=corners[a], ay=corners[a+1], az=corners[a+2];
    const bx=corners[b], by=corners[b+1], bz=corners[b+2];
    const cx=corners[c], cy=corners[c+1], cz=corners[c+2];
    const volume = (((0 + ax*(by*cz-bz*cy)) + ay*(bz*cx-bx*cz)) + az*(bx*cy-by*cx))/6;
    signedVolume += volume;
    moment[0] += volume*(ax+bx+cx)/4;
    moment[1] += volume*(ay+by+cy)/4;
    moment[2] += volume*(az+bz+cz)/4;
  }
  if (!Number.isFinite(signedVolume) || signedVolume === 0) return { signedVolume, volume: Math.abs(signedVolume), centroid: [NaN, NaN, NaN], firstMoment: [NaN, NaN, NaN] };
  const centroid = moment.map(x => x / signedVolume) as PrismVector, volume = Math.abs(signedVolume);
  return { signedVolume, volume, centroid, firstMoment: centroid.map(x => x * volume) as PrismVector };
}

/**
 * Reference the original footprint and explicit thickness before any extrusion.
 * Adding a tiny height to a large world coordinate can erase it even in Float64.
 * Area-weighted triangle centers also avoid assuming a quad is a parallelogram.
 * The optional offset describes film above its base, independently of rounded
 * midsurface points. This measures parameterized geometry, not GPU arithmetic.
 */
export function measureFootprintContactPrism(points: PrismVector[], thickness: number, origin: PrismVector = points[0], centroidOffset: PrismVector = [0, 0, 0], director?: PrismVector): RelativePrismMeasurement {
  if (points.length !== 4 || !(thickness > 0) || !Number.isFinite(thickness) || [...points, origin, centroidOffset].some(p => !p || p.some(x => !Number.isFinite(x)))) throw Error('Invalid contact reference');
  const anchor = points[0], relative = points.map(p => sub(p, anchor));
  const normal = unit(cross(relative[1], relative[2]));
  const allowance = 64 * Number.EPSILON * Math.max(1, ...points.flat().map(Math.abs));
  if (relative.some(p => Math.abs(dot(p, normal)) > allowance)) throw Error('Nonplanar contact reference');
  // The native primitive contract is a convex, consistently wound quad.
  // Refuse a folded or self-crossed footprint rather than summing its lobes.
  for (let i = 0; i < 4; i++) {
    const edge = sub(relative[(i + 1) % 4], relative[i]);
    const next = sub(relative[(i + 2) % 4], relative[(i + 1) % 4]);
    if (!(dot(cross(edge, next), normal) > 0)) throw Error('Invalid contact reference winding');
  }
  let area = 0; const areaMoment: PrismVector = [0, 0, 0];
  for (const [b, c] of [[relative[1], relative[2]], [relative[2], relative[3]]]) {
    const areaVector = cross(b, c), triangleArea = dot(areaVector, normal) / 2;
    if (!(triangleArea > 0) || !Number.isFinite(triangleArea) || !(dot(areaVector, normal) > 0)) throw Error('Degenerate contact reference footprint');
    area += triangleArea;
    for (let axis = 0; axis < 3; axis++) areaMoment[axis] += triangleArea * (b[axis] + c[axis]) / 3;
  }
  // Film retains its stored extrusion director, including its length and
  // sign relative to footprint winding. A reversed footprint changes that
  // sign, not the positive physical volume; a tangent director is invalid.
  const extrusionDirector = director ?? normal;
  if (extrusionDirector.some(x => !Number.isFinite(x))) throw Error('Invalid contact reference director');
  const projection = dot(normal, extrusionDirector);
  if (!Number.isFinite(projection) || projection === 0) throw Error('Degenerate contact reference director');
  const volume = area * thickness * Math.abs(projection);
  const relativeCentroid = areaMoment.map((x, axis) => (anchor[axis] - origin[axis]) + x / area + centroidOffset[axis]) as PrismVector;
  const centroid = relativeCentroid.map((x, axis) => origin[axis] + x) as PrismVector;
  const firstMoment = centroid.map(x => x * volume) as PrismVector;
  if (!(volume > 0) || !Number.isFinite(volume) || [...relativeCentroid, ...centroid, ...firstMoment].some(x => !Number.isFinite(x))) throw Error('Unrepresentable contact reference');
  return { volume, centroid, firstMoment, relativeCentroid };
}

/** Measure uploaded fields relative to their origin, without a large-coordinate sum. */
export function measureUploadedContactPrismRelative(frame: ContactLocalPrism): RelativePrismMeasurement {
  // Integrate local triangles before applying the rounded basis determinant.
  // Constructing rotated corners would erase tiny offsets again, even in
  // binary64. This qualifies affine storage, not shader or raster arithmetic.
  const measurement = measureClosedContactCorners(frame.localCorners);
  const [u, v, normal] = [frame.u, frame.v, frame.normal].map(vector => vector.map(Math.fround) as PrismVector);
  const determinant = dot(u, cross(v, normal));
  // The generated front ring has positive signed volume and a right-handed
  // placement basis. Absolute values would hide a reversed packet or basis.
  // Float32 half-thickness underflow is a genuine failed representation.
  if (!(measurement.signedVolume > 0) || !Number.isFinite(measurement.signedVolume) || !(determinant > 0) || !Number.isFinite(determinant)) throw Error('Invalid contact local upload orientation or underflow');
  const volume = measurement.signedVolume * determinant;
  const relativeCentroid = frame.origin.map((_, axis) => u[axis] * measurement.centroid[0] + v[axis] * measurement.centroid[1] + normal[axis] * measurement.centroid[2]) as PrismVector;
  const centroid = relativeCentroid.map((x, axis) => frame.origin[axis] + x) as PrismVector;
  return { volume, centroid, firstMoment: centroid.map(x => x * volume) as PrismVector, relativeCentroid };
}

/** Measure the uploaded fields, including their rounded basis, independently. */
export function measureUploadedContactPrism(frame: ContactLocalPrism): PrismMeasurement {
  return measureUploadedContactPrismRelative(frame);
}

/** The old storage comparator rounds full corners before removing translation. */
export function measureWorldContactPrism(frame: ContactLocalPrism, corners: Float64Array = new Float64Array(24)): PrismMeasurement {
  validateMeasurementStorage(frame, corners);
  for (let i = 0; i < 8; i++) for (let axis = 0; axis < 3; axis++) {
    corners[i * 3 + axis] = Math.fround(frame.worldCorners[i * 3 + axis]) - frame.origin[axis];
  }
  const measurement = measureClosedContactCorners(corners);
  const centroid = measurement.centroid.map((x, axis) => x + frame.origin[axis]) as PrismVector;
  return { volume: measurement.volume, centroid, firstMoment: centroid.map(x => x * measurement.volume) as PrismVector };
}

/** Binary64 extruded-world-corner diagnostic; tiny offsets may already be lost. */
export function measureOriginalContactPrism(frame: ContactLocalPrism, corners: Float64Array = new Float64Array(24)): PrismMeasurement {
  validateMeasurementStorage(frame, corners);
  if (frame.worldCorners.length !== 24) throw Error('Contact prism requires eight corners');
  // TypedArray.from materializes an iterable and calls back for every element.
  // These fixed eight corners need only the same subtraction into their buffer.
  for (let i = 0; i < 24; i++) corners[i] = frame.worldCorners[i] - frame.origin[i % 3];
  const measurement = measureClosedContactCorners(corners);
  const centroid = measurement.centroid.map((x, axis) => x + frame.origin[axis]) as PrismVector;
  return { volume: measurement.volume, centroid, firstMoment: centroid.map(x => x * measurement.volume) as PrismVector };
}

// Comparisons may reuse a scratch array, but cannot overwrite the geometry
// being checked. Returned measurements contain independent scalar/vector data.
function validateMeasurementStorage(frame: ContactLocalPrism, corners: Float64Array): void {
  if (corners.length !== 24 || corners.buffer === frame.localCorners.buffer || corners.buffer === frame.worldCorners.buffer) throw Error('Invalid contact prism measurement storage');
}
