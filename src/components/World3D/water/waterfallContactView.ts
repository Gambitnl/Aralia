/**
 * Draws water stored on the first ledge and the finite sheets it releases.
 * The worker owns each cell and outgoing packet. Film height follows storage;
 * released sheet thickness follows owned volume divided by its moving area.
 * Source strips use their released cross section; later-contact ellipsoids remain coarse sample glyphs, not a
 * resolved breakup model. Refraction uses the native screen space approximation.
 * The default world-corner drawing is preserved. An opt-in local prism batch
 * compares coordinate storage on the same state, without changing the optics.
 * Called by RiverWaterfallView; it creates neither a renderer nor pool mass.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/10/2026, 22:05:50
 * Dependents: components/World3D/water/riverWaterfallView.ts, components/World3D/water/waterfallTerrainComparisonView.ts, components/World3D/water/waterfallThinLiveView.ts, systems/world3d/river/waterfallTerrainComparisons.worker.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { WaterfallGlyphMaterial } from './waterfallInstanceNode';
import { isWaterfallPresentation, type WaterfallDisplaySnapshot } from '@/systems/world3d/river/waterfallPresentationSnapshot';
import { Fn, If, Discard, uniform, abs, attribute, cameraPosition, cameraWorldMatrix, clamp, dot, exp, float, mat3, max, mix, modelViewMatrix, normalWorld, normalize, positionView, positionWorld, pow, reflect, screenCoordinate, vec2, vec3, vec4 } from 'three/tsl';
import { WATERFALL_CONTACT_SURFACES, waterfallSupportedPosition, type WaterfallContactSnapshot, type ContactSurface } from '@/systems/world3d/river/waterfallContactFlow';
import type { RiverWaterUniforms } from './riverWaterMaterial';
import { createWaterfallRockMaterial } from './riverWaterfallCliff';
import { createContactLocalPrism, measureFootprintContactPrism, measureOriginalContactPrism, measureUploadedContactPrismRelative, measureWorldContactPrism, type ContactLocalPrism, type PrismVector } from './waterfallContactLocalPrism';

export type WaterContactRepresentation = 'world' | 'local';

const CAPACITY = 20000;
const FACE_TRIANGLE_CORNERS = [0, 2, 1, 0, 3, 2] as const;
const SURFACE_VERTEX_CAPACITY = CAPACITY * 36 + 40000;
interface PrimitiveReferenceFailure {
  primitiveId: string; kind: string; snapshotTime: number | null; thickness: number; ownedVolume: number; director: PrismVector | null;
  footprint: PrismVector[]; centroidOffset: PrismVector; origin: PrismVector | null;
  localCorners: number[]; basis: PrismVector[]; binary64WorldCorners: number[];
  localVolume: number | null; referenceVolume: number | null; localRelativeCentroid: PrismVector | null; referenceRelativeCentroid: PrismVector | null;
  reason: string;
}
const newPrismMetrics = (legacyComparison = true) => ({ legacyComparison: legacyComparison ? 'measured' as const : 'not-collected' as const, count: 0, filmPrimitiveCount: 0, sheetPrimitiveCount: 0, sourceSheetPrimitiveCount: 0, ownedVolume: 0, referenceVolume: 0, localVolume: 0, worldVolume: legacyComparison ? 0 : NaN, maximumRelativeVolumeError: 0, maximumLocalReferenceVolumeError: 0, maximumWorldRelativeVolumeError: legacyComparison ? 0 : NaN, maximumReferenceOwnedVolumeError: 0, maximumCentroidError: 0, binary64WorldVolume: legacyComparison ? 0 : NaN, invalidBinary64WorldPrisms: legacyComparison ? 0 : NaN, maximumBinary64WorldRelativeVolumeError: legacyComparison ? 0 : NaN, maximumBinary64WorldCentroidError: legacyComparison ? 0 : NaN, firstPrimitiveFailure: null as PrimitiveReferenceFailure | null, referenceFirstMoment: [0, 0, 0], localFirstMoment: [0, 0, 0], invalidLocalPrisms: 0, invalidReferencePrisms: 0, originalUnresolvedVolume: 0, originalUnresolvedCount: 0 });

/** One batched draw retains small coordinates until the camera-relative sum.
 * Default instancing would add its large translation before model-view. */
class ContactLocalMaterial extends THREE.NodeMaterial {
  override setupPositionView() {
    const p = attribute('position', 'vec3');
    const local = attribute('prismU', 'vec3').mul(p.x).add(attribute('prismV', 'vec3').mul(p.y)).add(attribute('prismN', 'vec3').mul(p.z));
    return attribute('prismOriginView', 'vec3').add(mat3(modelViewMatrix).mul(local));
  }
}

export function liquidMaterial(U: RiverWaterUniforms, local = false, filmStudy?: ReturnType<typeof uniform<number>>): THREE.NodeMaterial {
  const material = local ? new ContactLocalMaterial() : new THREE.NodeMaterial();
  material.fragmentNode = Fn(() => {
    // The opt-in coating study replaces attached tops in the opaque scene.
    // Default zero preserves this shader. Bare/zero controls isolate all Film
    // faces while detached source and release sheets retain native optics.
    if (filmStudy) {
      const face = attribute('attachedFilmFace', 'float');
      If(face.greaterThan(0).and(filmStudy.greaterThan(1).or(face.lessThan(1.5).and(filmStudy.greaterThan(0)))), () => { Discard(); });
    }
    // Geometry normals supply every broken interface. No painted whitewater,
    // age tint, noise density or opacity multiplier stands in for liquid mass.
    const N = normalize(normalWorld);
    // Keep the optical law in world directions. The candidate's view direction
    // comes from its actual projected position, never fake local world corners.
    const V = local ? normalize(mat3(cameraWorldMatrix).mul(positionView.negate())) : normalize(cameraPosition.sub(positionWorld));
    const facing = max(abs(dot(N, V)), 0.04);
    const fresnel = float(0.02).add(pow(float(1).sub(facing), 5).mul(0.98));
    const R = reflect(V.negate(), N);
    const sky = mix(U.uSkyHorizon, U.uSkyZenith, pow(max(R.y, 0), 0.5)).mul(U.uSkyGain);
    const suv = screenCoordinate.xy.div(U.uResolution);
    const refracted = U.uSceneColor.sample(clamp(suv.add(vec2(N.x, N.z).mul(0.003)), vec2(0.001), vec2(0.999))).rgb;
    // The represented minor diameter bounds the local absorption path.
    // Full ellipsoid ray intersections are deferred; this is finite geometry
    // with a local chord approximation, rather than density reconstruction.
    const path = attribute('liquidDiameter', 'float').div(facing);
    const transmission = exp(U.uAbsorbClear.negate().mul(path));
    const body = refracted.mul(transmission).add(U.uScatterClear.mul(sky).mul(vec3(1).sub(transmission)));
    const sun = pow(max(dot(reflect(U.uSunDir.negate(), N), V), 0), 110).mul(U.uSunColor);
    return vec4(mix(body, sky, fresnel).add(sun), 1);
  })();
  material.name = 'accounted waterfall parcel interfaces';
  material.side = THREE.FrontSide;
  return material;
}

export { liquidMaterial as createWaterfallFiniteLiquidMaterial };

/** Exact signed tetrahedron volume of the actual faceted unit parcel mesh. */
function meshVolume(geometry: THREE.BufferGeometry): number {
  const p = geometry.getAttribute('position'); const index = geometry.index!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
    volume += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(volume);
}

/** A qualified surface for one exact committed snapshot. No solver state is
 * changed here. Only used array prefixes cross the worker boundary. */
export interface ContactSurfacePacket {
  time: number; vertexCount: number; arrays: Record<string, Float32Array>;
  ranges: {origin: PrismVector; start: number; count: number}[];
  metrics: ReturnType<typeof newPrismMetrics>;
  originalNoDraw: {primitiveId: string; volume: number}[];
  unresolved: {count: number; volume: number; records: Array<{primitiveId: string; thickness: number; volume: number; time: number|null; reason: 'UNRESOLVED_RENDER_THICKNESS'}>};
  filmVolume: number; sheetVolume: number; sourceVolume: number; unresolvedVolume: number; constructionMs: number;
}

export class WaterfallContactView {
  readonly rocks = new THREE.Group();
  readonly water = new THREE.Group();
  private readonly parcels: THREE.InstancedMesh;
  private readonly surface: THREE.Mesh;
  private readonly worldSurfaceMaterial: THREE.NodeMaterial;
  private readonly localSurfaceMaterial: THREE.NodeMaterial;
  private representation: WaterContactRepresentation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('waterContactRepresentation') === 'local' ? 'local' : 'world';
  private readonly prismOriginsView = new Float32Array(SURFACE_VERTEX_CAPACITY * 3);
  private readonly prismU = new Float32Array(SURFACE_VERTEX_CAPACITY * 3);
  private readonly prismV = new Float32Array(SURFACE_VERTEX_CAPACITY * 3);
  private readonly prismN = new Float32Array(SURFACE_VERTEX_CAPACITY * 3);
  private readonly localAttributes = {
    prismOriginView: new THREE.BufferAttribute(this.prismOriginsView, 3),
    prismU: new THREE.BufferAttribute(this.prismU, 3),
    prismV: new THREE.BufferAttribute(this.prismV, 3),
    prismN: new THREE.BufferAttribute(this.prismN, 3),
  };
  // Each prism is checked and copied into resident vertex buffers synchronously.
  // Reuse its temporary corner storage; packet arrays, origins and failure
  // witnesses retain their own data and survive later constructions.
  private readonly prismStorage = { localCorners: new Float32Array(24), worldCorners: new Float64Array(24) };
  private readonly prismMeasurementStorage = new Float64Array(24);
  private activePrism: ContactLocalPrism | null = null;
  private primitiveRanges: { origin: PrismVector; start: number; count: number }[] = [];
  private originalNoDrawRecords: { primitiveId: string; volume: number }[] = [];
  private legacyGeometryComparison = true;
  private primitiveMetrics = newPrismMetrics();
  /** Live workers need the active local geometry checks, but not a repeat of
   * the old world-coordinate failure comparison. Keep that audit available for
   * diagnostic views. Uncollected legacy fields are NaN with an explicit status,
   * never zero errors; JSON exports serialize those unavailable values as null. */
  setLegacyGeometryComparison(enabled: boolean): void {
    if (enabled === this.legacyGeometryComparison) return;
    this.legacyGeometryComparison = enabled;
    this.clearSnapshot();
  }
  private constructionMs = 0;
  private originUpdateMs = 0;
  private snapshotUploadBytes = 0;
  private lastPresentationTime: number | null = null;
  private lastOriginCall = -1;
  private lastOriginCamera: THREE.Camera | null = null;
  private readonly originModelView = new THREE.Matrix4();
  private readonly originViewPoint = new THREE.Vector3();
  private cameraOriginUploadBytes = 0;
  private readonly surfacePositions = new Float32Array(SURFACE_VERTEX_CAPACITY * 3);
  private readonly surfaceNormals = new Float32Array(SURFACE_VERTEX_CAPACITY * 3);
  private readonly surfaceThickness = new Float32Array(SURFACE_VERTEX_CAPACITY);
  private readonly filmStudyEnabled = typeof window === 'undefined' || new URLSearchParams(window.location.search).has('filmStudy');
  private readonly filmFaces = new Float32Array(this.filmStudyEnabled ? SURFACE_VERTEX_CAPACITY : 0);
  private filmFace = 0;
  private readonly filmStudy = uniform(0);
  setAttachedFilmStudy(mode: 'native' | 'coupled' | 'zero' | 'bare'): void {
    if (!this.filmStudyEnabled && mode !== 'native') throw Error('Attached-film study was not enabled');
    this.filmStudy.value = mode === 'native' ? 0 : mode === 'coupled' ? 1 : 2;
  }
  private surfaceVertexCount = 0;
  private filmDrawnVolume = 0;
  private sheetDrawnVolume = 0;
  private sourceSheetDrawnVolume = 0;
  private unresolvedSurfaceVolume = 0;
  private surfaceSnapshot: WaterfallDisplaySnapshot | null = null;
  private readonly diameter = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1);
  private readonly unitVolume: number;
  private readonly transform = new THREE.Object3D();
  private readonly velocity = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private representedVolume = 0;
  private reportUnresolvedThickness = false;
  private localUnresolved = this.emptyUnresolved();
  private emptyUnresolved() {
    return { count: 0, volume: 0, records: [] as Array<{ primitiveId: string; thickness: number; volume: number; time: number | null; reason: 'UNRESOLVED_RENDER_THICKNESS' }> };
  }
  /** Opt-in inspection only. Strict native callers keep their existing failure. */
  setUnresolvedThicknessPolicy(policy: 'strict' | 'report'): void {
    this.reportUnresolvedThickness = policy === 'report';
    this.clearSnapshot();
  }
  private snapshotReceipt: WaterfallContactSnapshot['receipt'] | null = null;
  private surfaceKey = '';
  private currentSnapshot: WaterfallDisplaySnapshot | null = null;
  private previousParcels = new Map<number, WaterfallDisplaySnapshot['parcels'][number]>();
  private receivedAt = 0;
  private presentationIntervalMs = 0;
  private previousSimulationTime = 0;
  // Retain only the completed display inputs. A new snapshot, a rebuilt surface,
  // or a different interpolation time must still update every visible parcel.
  private presentedSnapshot: WaterfallDisplaySnapshot | null = null;
  private presentedFraction = -1;
  private uploadedOriginMatrix = new THREE.Matrix4();
  private uploadedOriginRanges: typeof this.primitiveRanges | null = null;

  constructor(crest: { x: number; z: number; tx: number; tz: number }, U: RiverWaterUniforms, private geometryOnly = false) {
    // Both the solver and these visible rock faces read the same exact quads.
    // Solid thickness sits below the contact plane and cannot move that plane.
    if (!geometryOnly) this.buildRocks(WATERFALL_CONTACT_SURFACES);
    const base = new THREE.SphereGeometry(1, 10, 6);
    this.unitVolume = meshVolume(base);
    // The river's forward/across basis below is a reflection (determinant -1).
    // This WebGPU backend keeps CCW front faces, so reverse the closed mesh's
    // winding once. Positions, normals and represented volume stay unchanged.
    const indices = base.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const second = indices.getX(i + 1);
      indices.setX(i + 1, indices.getX(i + 2)); indices.setX(i + 2, second);
    }
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    for (const [name, attr] of Object.entries(base.attributes)) geometry.setAttribute(name, attr);
    geometry.setAttribute('liquidDiameter', this.diameter);
    geometry.instanceCount = 0;
    const glyphMaterial = new WaterfallGlyphMaterial().copy(liquidMaterial(U));
    this.parcels = new THREE.InstancedMesh(geometry, glyphMaterial, CAPACITY);
    // WebGPU sizes the instance matrix binding when the shader first builds.
    // Keep that capacity fixed, including the initial dry frame; only the draw
    // count changes as accounted water enters and leaves the flight domain.
    this.parcels.frustumCulled = false;
    // Version changes below already identify each new set of matrices. In this
    // WebGPU backend DynamicDrawUsage resends them on every draw, including
    // reflection/depth passes after the first pass consumed the partial range.
    this.parcels.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.water.add(this.parcels);
    const surfaceGeometry = new THREE.BufferGeometry();
    // Snapshot-driven uploads must use version changes: this Three WebGPU version
    // sends DynamicDrawUsage attributes every draw, even when the water is paused.
    surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(this.surfacePositions, 3));
    surfaceGeometry.setAttribute('normal', new THREE.BufferAttribute(this.surfaceNormals, 3));
    surfaceGeometry.setAttribute('liquidDiameter', new THREE.BufferAttribute(this.surfaceThickness, 1));
    if (this.filmStudyEnabled) surfaceGeometry.setAttribute('attachedFilmFace', new THREE.BufferAttribute(this.filmFaces, 1));
    surfaceGeometry.setDrawRange(0, 0);
    // Both materials keep the same attribute identities. Three gathers only
    // shader-used attributes, so the world branch does not upload local fields.
    for (const [name, attr] of Object.entries(this.localAttributes)) surfaceGeometry.setAttribute(name, attr);
    this.worldSurfaceMaterial = liquidMaterial(U, false, this.filmStudyEnabled ? this.filmStudy : undefined);
    this.localSurfaceMaterial = liquidMaterial(U, true, this.filmStudyEnabled ? this.filmStudy : undefined);
    this.surface = new THREE.Mesh(surfaceGeometry, this.representation === 'local' ? this.localSurfaceMaterial : this.worldSurfaceMaterial);
    this.surface.onBeforeRender = (renderer, _scene, camera) => this.updatePrimitiveOrigins(camera, renderer.info.render.calls);
    this.surface.frustumCulled = false;
    this.water.add(this.surface);
    // Local x follows the crest tangent, local z points across the opening.
    const basis = new THREE.Matrix4().set(crest.tx, 0, crest.tz, crest.x, 0, 1, 0, 0, crest.tz, 0, -crest.tx, crest.z, 0, 0, 0, 1);
    for (const group of [this.rocks, this.water]) { group.matrixAutoUpdate = false; group.matrix.copy(basis); }
    this.setVisible(false);
  }

  /** Compare either drawing of the same committed state; no solver is advanced. */
  setRepresentation(representation: WaterContactRepresentation, presentationTime = this.lastPresentationTime ?? performance.now()): void {
    if (representation !== 'world' && representation !== 'local') throw Error('Unknown contact water representation');
    if (representation === this.representation) return;
    this.representation = representation;
    // Three caches attributes per render object. Switching changes material
    // and coordinate contents, while keeping every attribute identity stable.
    this.surface.material = representation === 'local' ? this.localSurfaceMaterial : this.worldSurfaceMaterial;
    this.surfaceSnapshot = null;
    // Reuse the previous presentation time so switching does not advance even
    // the existing parcel interpolation during a same-snapshot comparison.
    this.present(presentationTime);
  }

  /** Optional diagnostics retain every record rejected by the original storage. */
  getOriginalNoDrawRecords() { return this.originalNoDrawRecords.map(record => ({ ...record })); }

  private updatePrimitiveOrigins(camera: THREE.Camera, renderCall: number): void {
    const started = performance.now();
    this.cameraOriginUploadBytes = 0;
    this.originUpdateMs = 0;
    if (this.representation !== 'local' || this.surfaceVertexCount === 0) return;
    // Three's ArrayCamera subviews share an attribute-upload cache within one
    // render call. Ordinary main/reflection calls work; subviews are unqualified.
    if (camera instanceof THREE.ArrayCamera || (renderCall === this.lastOriginCall && camera !== this.lastOriginCamera)) throw Error('Contact local representation does not support multiple camera subviews in one render call');
    this.lastOriginCall = renderCall; this.lastOriginCamera = camera;
    // CPU matrix multiplication removes large translation before Float32.
    // Camera movement changes only these origins, not geometry or water state.
    this.originModelView.multiplyMatrices(camera.matrixWorldInverse, this.surface.matrixWorld);
    // A stationary camera sees exactly the same origins until a new physical
    // packet arrives. Keep the resident buffer then; changed camera/model
    // matrices or rebuilt primitive ranges still force the full exact update.
    if (this.uploadedOriginRanges === this.primitiveRanges && this.uploadedOriginMatrix.equals(this.originModelView)) return;
    for (const range of this.primitiveRanges) {
      this.originViewPoint.fromArray(range.origin).applyMatrix4(this.originModelView);
      for (let vertex = range.start; vertex < range.start + range.count; vertex++) {
        const at=vertex*3;
        this.prismOriginsView[at]=this.originViewPoint.x; this.prismOriginsView[at+1]=this.originViewPoint.y; this.prismOriginsView[at+2]=this.originViewPoint.z;
      }
    }
    const attr = this.surface.geometry.getAttribute('prismOriginView') as THREE.BufferAttribute;
    attr.clearUpdateRanges(); attr.addUpdateRange(0, this.surfaceVertexCount * 3); attr.needsUpdate = true;
    this.cameraOriginUploadBytes = this.surfaceVertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
    this.originUpdateMs = performance.now() - started;
    this.uploadedOriginMatrix.copy(this.originModelView); this.uploadedOriginRanges = this.primitiveRanges;
  }

  private beginPrimitive(points: THREE.Vector3[], thickness: number, volume: number, originallyUnresolved: boolean, originalCorners: THREE.Vector3[], primitiveId: string, kind: 'film' | 'sheet' | 'source', referencePoints = points, centroidOffset: PrismVector = [0, 0, 0], director?: PrismVector): boolean {
    const footprint = referencePoints.map(p => p.toArray() as PrismVector), metrics = this.primitiveMetrics;
    this.activePrism = null;
    // Capture available raw operands even when frame/reference validation or
    // the actual uploaded packet throws before normal metrics can be formed.
    const retainThrownFailure = (error: unknown) => {
      if (!metrics.firstPrimitiveFailure) metrics.firstPrimitiveFailure = {
        primitiveId, kind, snapshotTime: this.snapshotReceipt?.time ?? null, thickness, ownedVolume: volume,
        footprint, director: director ? [...director] : this.activePrism ? [...this.activePrism.normal] : null,
        centroidOffset: [...centroidOffset], origin: this.activePrism ? [...this.activePrism.origin] : null,
        localCorners: this.activePrism ? Array.from(this.activePrism.localCorners) : [],
        basis: this.activePrism ? [this.activePrism.u, this.activePrism.v, this.activePrism.normal].map(p => [...p] as PrismVector) : [],
        binary64WorldCorners: originalCorners.flatMap(p => p.toArray()), localVolume: null, referenceVolume: null,
        localRelativeCentroid: null, referenceRelativeCentroid: null, reason: error instanceof Error ? error.message : String(error),
      };
    };
    try { this.activePrism = createContactLocalPrism(points.map(p => p.toArray() as PrismVector), thickness, this.prismStorage); }
    catch (error) { retainThrownFailure(error); throw error; }
    // Compare the exact old constructed corners, including records it refused
    // to draw. Reconstructing those corners could change a rounding tie.
    const originalWorld = this.activePrism.worldCorners;
    for (let i = 0; i < originalCorners.length; i++) {
      const p = originalCorners[i], at = i * 3;
      originalWorld[at] = p.x; originalWorld[at + 1] = p.y; originalWorld[at + 2] = p.z;
    }
    let local: ReturnType<typeof measureUploadedContactPrismRelative>, reference: ReturnType<typeof measureFootprintContactPrism>;
    try {
      reference = measureFootprintContactPrism(footprint, thickness, this.activePrism.origin, centroidOffset, director);
    } catch (error) { metrics.invalidReferencePrisms++; retainThrownFailure(error); throw error; }
    // Numerical tails can retain water much thinner than Float32 can upload.
    // Keep that water in the solver and report it as undrawn; never turn it into
    // a zero-thickness reflective pane or enlarge it to make it representable.
    // Subnormals may be flushed to zero by the GPU, so test the half-thickness
    // coordinate against the smallest normal Float32, not an artistic cutoff.
    if (this.reportUnresolvedThickness && Math.abs(Math.fround(thickness / 2)) < 2 ** -126) {
      let volumeMatches = Math.abs(reference.volume - volume) / volume <= .01;
      if (!volumeMatches && volume > 0 && volume < 2 ** -1022 && reference.volume < 2 ** -1022 && thickness < 2 ** -1022) {
        // At the smallest binary64 values, rounding a thickness and multiplying
        // it back by area can change volume by one whole storage quantum. A
        // percentage cannot resolve that difference. Bound those two rounding
        // operations in quantum units; do not enlarge, erase or relabel water.
        // The ordinary 1% geometry check and all footprint checks remain intact.
        const area = measureFootprintContactPrism(footprint, 1, this.activePrism.origin, centroidOffset, director).volume;
        const differenceInQuanta = Math.abs(reference.volume / Number.MIN_VALUE - volume / Number.MIN_VALUE);
        volumeMatches = differenceInQuanta <= area / 2 + .5;
      }
      if (!(volume > 0) || !Number.isFinite(volume) || !volumeMatches) throw Error('Invalid unresolved contact volume');
      this.unresolvedSurfaceVolume += volume;
      this.localUnresolved.count++; this.localUnresolved.volume += volume;
      this.localUnresolved.records.push({ primitiveId, thickness, volume, time: this.snapshotReceipt?.time ?? null, reason: 'UNRESOLVED_RENDER_THICKNESS' });
      this.activePrism = null;
      return false;
    }
    try { local = measureUploadedContactPrismRelative(this.activePrism); }
    catch (error) { metrics.invalidLocalPrisms++; retainThrownFailure(error); throw error; }
    // These two measurements compare rejected storage representations. They
    // cannot validate the active local geometry; its independent reference and
    // uploaded volume/centroid checks above always run, including in workers.
    const world = this.legacyGeometryComparison ? measureWorldContactPrism(this.activePrism, this.prismMeasurementStorage) : null;
    const original = this.legacyGeometryComparison ? measureOriginalContactPrism(this.activePrism, this.prismMeasurementStorage) : null;
    const localOwnedError = Math.abs(local.volume - volume) / volume;
    const referenceOwnedError = Math.abs(reference.volume - volume) / volume;
    const localReferenceError = Math.abs(local.volume - reference.volume) / reference.volume;
    // Compare small offsets in a shared frame; adding world translation first
    // could conceal a centroid error below the coordinate spacing.
    const centroidError = Math.hypot(...local.relativeCentroid.map((x, i) => x - reference.relativeCentroid[i]));
    const localValid = local.volume > 0 && [...local.centroid, ...local.firstMoment, ...local.relativeCentroid].every(Number.isFinite);
    const referenceValid = reference.volume > 0 && [...reference.centroid, ...reference.firstMoment, ...reference.relativeCentroid].every(Number.isFinite);
    if (!metrics.firstPrimitiveFailure && (!localValid || !referenceValid || !Number.isFinite(localOwnedError) || localOwnedError > .01 || referenceOwnedError > .01 || localReferenceError > .01 || !Number.isFinite(centroidError) || centroidError > 1e-6)) {
      // Only the first offender is retained, with the actual bounded 4/8-corner
      // operands. This receipt survives a failed upload for numerical diagnosis.
      metrics.firstPrimitiveFailure = { primitiveId, kind, snapshotTime: this.snapshotReceipt?.time ?? null, director: [...(director ?? this.activePrism.normal)], thickness, ownedVolume: volume, footprint, centroidOffset: [...centroidOffset], origin: [...this.activePrism.origin], localCorners: Array.from(this.activePrism.localCorners), basis: [this.activePrism.u, this.activePrism.v, this.activePrism.normal].map(p => [...p] as PrismVector), binary64WorldCorners: Array.from(this.activePrism.worldCorners), localVolume: local.volume, referenceVolume: reference.volume, localRelativeCentroid: local.relativeCentroid, referenceRelativeCentroid: reference.relativeCentroid, reason: !localValid ? 'local-underflow-or-nonfinite' : !referenceValid ? 'invalid-reference' : 'volume-or-centroid-error' };
    }
    metrics.maximumReferenceOwnedVolumeError = Math.max(metrics.maximumReferenceOwnedVolumeError, referenceOwnedError);
    metrics.count++; metrics.ownedVolume += volume; metrics.localVolume += local.volume; if (world) metrics.worldVolume += world.volume;
    if (kind === 'film') metrics.filmPrimitiveCount++;
    else { metrics.sheetPrimitiveCount++; if (kind === 'source') metrics.sourceSheetPrimitiveCount++; }
    metrics.maximumRelativeVolumeError = Math.max(metrics.maximumRelativeVolumeError, Math.abs(local.volume - volume) / volume);
    if (world) metrics.maximumWorldRelativeVolumeError = Math.max(metrics.maximumWorldRelativeVolumeError, Math.abs(world.volume - volume) / volume);
    if (localValid) {
      for (let axis = 0; axis < 3; axis++) metrics.localFirstMoment[axis] += local.firstMoment[axis];
    } else {
      metrics.invalidLocalPrisms++;
      if (this.representation === 'local') throw Error('Contact local prism is not representable');
    }
    if (referenceValid) {
      metrics.referenceVolume += reference.volume;
      metrics.maximumLocalReferenceVolumeError = Math.max(metrics.maximumLocalReferenceVolumeError, localReferenceError);
      for (let axis = 0; axis < 3; axis++) metrics.referenceFirstMoment[axis] += reference.firstMoment[axis];
      if (localValid) metrics.maximumCentroidError = Math.max(metrics.maximumCentroidError, centroidError);
    } else metrics.invalidReferencePrisms++;
    // Keep actual old binary64 extrusion failure separate from the footprint
    // reference; neither this nor the Float32 comparator certifies local storage.
    if (original) {
      metrics.binary64WorldVolume += original.volume;
      metrics.maximumBinary64WorldRelativeVolumeError = Math.max(metrics.maximumBinary64WorldRelativeVolumeError, Math.abs(original.volume - reference.volume) / reference.volume);
      if (original.volume > 0 && [...original.centroid, ...original.firstMoment].every(Number.isFinite)) {
        metrics.maximumBinary64WorldCentroidError = Math.max(metrics.maximumBinary64WorldCentroidError, Math.hypot(...original.centroid.map((x, i) => x - reference.centroid[i])));
      } else metrics.invalidBinary64WorldPrisms++;
    }
    if (originallyUnresolved) { metrics.originalUnresolvedCount++; metrics.originalUnresolvedVolume += volume; this.originalNoDrawRecords.push({ primitiveId, volume }); }
    this.primitiveRanges.push({ origin: this.activePrism.origin, start: this.surfaceVertexCount, count: 0 });
    return true;
  }

  private buildRocks(surfaces: ContactSurface[]): void {
    const key = JSON.stringify(surfaces);
    if (key === this.surfaceKey) return;
    this.surfaceKey = key;
    for (const object of [...this.rocks.children]) {
      const mesh = object as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.removeFromParent();
    }
    for (const surface of surfaces) {
      const top = surface.vertices;
      const vertices = [...top, ...top.map(([x, y, z]) => [x, y - 2.5, z])];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
      geometry.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, createWaterfallRockMaterial()); mesh.name = `contact rock ${surface.id}`;
      this.rocks.add(mesh);
    }
  }

  setVisible(visible: boolean): void { this.rocks.visible = visible; this.water.visible = visible; }

  clearSnapshot(): void {
    this.localUnresolved = this.emptyUnresolved();
    this.currentSnapshot = null; this.snapshotReceipt = null;
    this.presentedSnapshot = null; this.presentedFraction = -1;
    this.uploadedOriginRanges = null;
    this.previousParcels.clear(); (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount = 0; this.representedVolume = 0;
    this.surface.geometry.setDrawRange(0, 0); this.filmDrawnVolume = 0; this.sheetDrawnVolume = 0; this.sourceSheetDrawnVolume = 0; this.unresolvedSurfaceVolume = 0; this.surfaceSnapshot = null;
    this.surfaceVertexCount = 0; this.primitiveRanges = []; this.originalNoDrawRecords = []; this.activePrism = null; this.primitiveMetrics = newPrismMetrics(this.legacyGeometryComparison);
    this.constructionMs = 0; this.originUpdateMs = 0; this.snapshotUploadBytes = 0; this.cameraOriginUploadBytes = 0; this.lastPresentationTime = null;
  }

  update(snapshot: WaterfallDisplaySnapshot, prepared?: ContactSurfacePacket): void {
    // Reduced messages are usable only with the surface qualified for this exact
    // physical clock. Never silently build water from missing solver metadata.
    if (isWaterfallPresentation(snapshot) && (!prepared || this.representation !== 'local' || prepared.time !== snapshot.receipt.time)) throw Error('Presentation snapshot requires matching prepared surface');
    const now = performance.now();
    if (this.currentSnapshot && snapshot.receipt.time > this.currentSnapshot.receipt.time) {
      this.previousSimulationTime = this.currentSnapshot.receipt.time;
      this.previousParcels = new Map(this.currentSnapshot.parcels.map(parcel => [parcel.id, parcel]));
      // The observed arrival interval accommodates simulation speed changes.
      // Presentation catches up only as far as the received physical state.
      this.presentationIntervalMs = Math.min(1000, Math.max(1, now - this.receivedAt));
    } else if (!this.currentSnapshot || snapshot.receipt.time < this.currentSnapshot.receipt.time) {
      this.previousParcels.clear(); this.presentationIntervalMs = 0;
    } else {
      // Identical paused observations do not restart interpolation or drift.
      // A control acknowledgement restores the full geometry source at the same
      // clock, so paused optical comparisons can rebuild without advancing water.
      if (isWaterfallPresentation(this.currentSnapshot) && !isWaterfallPresentation(snapshot)) {
        const previous = this.currentSnapshot;
        this.currentSnapshot = snapshot;
        this.snapshotReceipt = snapshot.receipt;
        if (this.surfaceSnapshot === previous) this.surfaceSnapshot = snapshot;
        this.present(now);
      }
      return;
    }
    this.receivedAt = now; this.currentSnapshot = snapshot;
    if (!this.geometryOnly) this.buildRocks(snapshot.surfaces);
    this.snapshotReceipt = snapshot.receipt; this.representedVolume = 0;
    // Capacity is a contract with the core. Dropping active parcels would hide
    // volume, so an oversized snapshot fails visibly instead of truncating.
    if (snapshot.parcels.length > CAPACITY) throw Error('Waterfall contact snapshot exceeds geometry capacity');
    (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount = snapshot.parcels.length;
    this.representedVolume = snapshot.parcels.reduce((sum, parcel) => sum + parcel.volume, 0);
    if (prepared) this.installSurfacePacket(snapshot, prepared);
    this.present(now);
  }

  /** Run the identical builder/qualification in the existing solver worker.
   * The scratch view allocates geometry only: no renderer, canvas or textures. */
  prepareSurfacePacket(snapshot: WaterfallContactSnapshot): ContactSurfacePacket {
    this.update(snapshot);
    const names=['position','normal','liquidDiameter','prismU','prismV','prismN','attachedFilmFace'];
    const arrays: Record<string,Float32Array>={};
    for(const name of names){const a=this.surface.geometry.getAttribute(name);if(a)arrays[name]=(a.array as Float32Array).slice(0,this.surfaceVertexCount*a.itemSize);}
    return {time:snapshot.receipt.time,vertexCount:this.surfaceVertexCount,arrays,ranges:this.primitiveRanges,
      metrics:this.primitiveMetrics,originalNoDraw:this.originalNoDrawRecords,unresolved:this.localUnresolved,
      filmVolume:this.filmDrawnVolume,sheetVolume:this.sheetDrawnVolume,sourceVolume:this.sourceSheetDrawnVolume,
      unresolvedVolume:this.unresolvedSurfaceVolume,constructionMs:this.constructionMs};
  }

  private installSurfacePacket(snapshot: WaterfallDisplaySnapshot, packet: ContactSurfacePacket): void {
    if(this.representation!=='local'||packet.time!==snapshot.receipt.time||!Number.isInteger(packet.vertexCount)||packet.vertexCount<0||packet.vertexCount>SURFACE_VERTEX_CAPACITY)throw Error('Contact surface packet does not match committed state');
    const names=['position','normal','liquidDiameter','prismU','prismV','prismN',...(this.filmStudyEnabled?['attachedFilmFace']:[])];
    // Validate the complete packet before mutating any visible buffer.
    for(const name of names){const a=this.surface.geometry.getAttribute(name),values=packet.arrays[name];if(!ArrayBuffer.isView(values)||Object.prototype.toString.call(values)!=='[object Float32Array]'||values.length!==packet.vertexCount*a.itemSize)throw Error('Invalid contact surface packet '+name);}
    this.snapshotUploadBytes=0;
    for(const name of names){const a=this.surface.geometry.getAttribute(name) as THREE.BufferAttribute,values=packet.arrays[name];(a.array as Float32Array).set(values);a.clearUpdateRanges();if(values.length){a.addUpdateRange(0,values.length);a.needsUpdate=true;}this.snapshotUploadBytes+=values.byteLength;}
    this.surfaceVertexCount=packet.vertexCount;this.surface.geometry.setDrawRange(0,packet.vertexCount);
    this.primitiveRanges=packet.ranges;this.primitiveMetrics=packet.metrics;this.originalNoDrawRecords=packet.originalNoDraw;
    this.localUnresolved=packet.unresolved;this.filmDrawnVolume=packet.filmVolume;this.sheetDrawnVolume=packet.sheetVolume;
    this.sourceSheetDrawnVolume=packet.sourceVolume;this.unresolvedSurfaceVolume=packet.unresolvedVolume;
    this.constructionMs=packet.constructionMs;this.surfaceSnapshot=snapshot;
  }

  /** One buffered presentation interval smooths ordinary airborne motion.
   * Births and landings use the received membership immediately. A contact
   * snaps to its solved position so a straight interpolation cannot cross rock.
   * The physical receipt and volume remain the current worker state throughout. */
  present(now = performance.now()): void {
    const constructionStarted = performance.now();
    this.lastPresentationTime = now;
    const snapshot = this.currentSnapshot;
    if (!snapshot) return;
    const fraction = this.presentationIntervalMs > 0 ? Math.min(1, Math.max(0, (now - this.receivedAt) / this.presentationIntervalMs)) : 1;
    const buildSurface = this.surfaceSnapshot !== snapshot;
    // Once the buffered motion reaches its received endpoint, repeating these
    // transforms only allocates and uploads identical data. Camera-relative
    // surface origins are still refreshed independently in onBeforeRender.
    if (!buildSurface && this.presentedSnapshot === snapshot && this.presentedFraction === fraction) return;
    if (buildSurface && isWaterfallPresentation(snapshot)) throw Error('Presentation snapshot cannot rebuild geometry');
    if (buildSurface) {
      this.localUnresolved = this.emptyUnresolved();
      this.surfaceVertexCount = 0; this.filmDrawnVolume = 0; this.sheetDrawnVolume = 0; this.sourceSheetDrawnVolume = 0; this.unresolvedSurfaceVolume = 0;
      this.primitiveRanges = []; this.originalNoDrawRecords = []; this.activePrism = null;
      this.primitiveMetrics = newPrismMetrics(this.legacyGeometryComparison);
    }
    const sourceFaces = new Map<number, boolean[]>();
    if (buildSurface) {
      // Source strips carry adjacency through their actual inlet support. A
      // shared boundary is liquid inside the curtain, not a sparkling air face.
      // Changed launch conditions and genuine gaps keep their exposed edges.
      const source = snapshot.parcels.filter(p => p.sourceRelease && p.contactCount === 0);
      const key = (time: number, edge: string) => `${Math.round(time * 1e8)}:${edge}`;
      const starts = new Map(source.map(p => [key(p.sourceRelease!.intervalStart, p.sourceRelease!.edge), p]));
      const ends = new Map(source.map(p => [key(p.sourceRelease!.intervalEnd, p.sourceRelease!.edge), p]));
      const equal = (a: number[], b: number[]) => a.every((value, i) => Math.abs(value - b[i]) < 1e-9);
      for (const p of source) {
        const r = p.sourceRelease!, bin = Number(r.edge.split(':')[1]);
        const neighbors = [ends.get(key(r.intervalStart, r.edge)), starts.get(key(r.intervalStart, `source:${bin + 1}`)), starts.get(key(r.intervalEnd, r.edge)), starts.get(key(r.intervalStart, `source:${bin - 1}`))];
        sourceFaces.set(p.id, neighbors.map((neighbor, side) => {
          const other = neighbor?.sourceRelease;
          if (!other || !equal(r.velocity, other.velocity)) return true;
          if (side === 0 || side === 2) return !(equal(r.start, other.start) && equal(r.end, other.end));
          return Math.abs(r.intervalEnd - other.intervalEnd) > 1e-8 || !(side === 1 ? equal(r.end, other.start) : equal(r.start, other.end));
        }));
      }
    }
    const film = snapshot.film;
    if (buildSurface && film) {
      const contact = snapshot.surfaces.find(s => s.id === film.surfaceId)!;
      const n = new THREE.Vector3().fromArray(contact.normal);
      const cells = new Map(film.cells.map(cell => [cell.id, cell]));
      for (const cell of film.cells) {
        if (!(cell.volume > 0)) continue;
        const base = cell.corners.map(p => new THREE.Vector3().fromArray(p));
        const top = base.map(p => p.clone().addScaledVector(n, cell.height));
        // If Float32 vertex storage collapses an interface corner onto the rock,
        // drawing a full Fresnel pane invents a visible body of zero thickness.
        // Keep the worker's water and report this representation limit explicitly.
        const originallyUnresolved = top.some((p, i) => this.sameVertex(p, base[i]));
        if (!this.beginPrimitive(base.map(p => p.clone().addScaledVector(n, cell.height / 2)), cell.height, cell.volume, originallyUnresolved, [...top, ...base], `film:${film.surfaceId}:${cell.id}`, 'film', base, n.toArray().map(x => x * cell.height / 2) as PrismVector, n.toArray() as PrismVector)) continue;
        if (originallyUnresolved && this.representation === 'world') { this.unresolvedSurfaceVolume += cell.volume; continue; }
        const frame = this.activePrism!;
        const normalSign = n.dot(new THREE.Vector3().fromArray(frame.normal)) >= 0 ? 1 : -1;
        const atHeight = (index: number, height: number): PrismVector => {
          // Retain film height itself; no large-coordinate subtraction supplies
          // the thin direction in the candidate's drawing or measurement.
          return [frame.localCorners[index * 3], frame.localCorners[index * 3 + 1], normalSign * (height - cell.height / 2)];
        };
        this.filmFace = 1;
        this.face([top[0], top[3], top[2], top[1]], cell.height, n, [0, 3, 2, 1].map(index => atHeight(index, cell.height)));
        this.filmFace = 2;
        // Internal cell boundaries are liquid, not extra optical interfaces.
        // Draw only the height above a lower neighbor or a dry outer edge.
        const i = cell.id % film.nx, j = Math.floor(cell.id / film.nx);
        const neighbors = [j > 0 ? cell.id - film.nx : -1, i + 1 < film.nx ? cell.id + 1 : -1, j + 1 < film.nz ? cell.id + film.nx : -1, i > 0 ? cell.id - 1 : -1];
        for (let edge = 0; edge < 4; edge++) {
          const neighborHeight = cells.get(neighbors[edge])?.height ?? 0;
          if (neighborHeight >= cell.height) continue;
          const next = (edge + 1) % 4;
          this.face([top[edge], top[next], base[next].clone().addScaledVector(n, neighborHeight), base[edge].clone().addScaledVector(n, neighborHeight)], cell.height, undefined, [atHeight(edge, cell.height), atHeight(next, cell.height), atHeight(next, neighborHeight), atHeight(edge, neighborHeight)]);
        }
        this.filmDrawnVolume += cell.volume;
      }
      this.activePrism = null;
      this.filmFace = 0;
    }
    // The received velocity and volume define each drop's orientation and size.
    // Between physical snapshots only its position is interpolated. Keep the
    // already uploaded shape while moving it; every new snapshot rebuilds the
    // shape, including births, contact changes, reordering and rewinds.
    const refreshGlyphShape = this.presentedSnapshot !== snapshot;
    const matrices = this.parcels.instanceMatrix.array;
    let glyphCount = 0;
    snapshot.parcels.forEach((parcel) => {
      const release = parcel.sheetRelease ?? parcel.sourceRelease;
      if (release && parcel.contactCount === 0 || 'uncontactedSheet' in parcel && parcel.uncontactedSheet) {
        if (!buildSurface) return;
        if (!release) throw Error('Missing source geometry record');
        // Connected support comes from one actual wet edge interval. A dry
        // interval emits nothing, and source shutdown retains earlier sheets.
        const at = (p: number[], born: number) => {
          const age = Math.max(0, snapshot.receipt.time - born);
          return new THREE.Vector3().fromArray(p).addScaledVector(new THREE.Vector3().fromArray(release.velocity), age).add(new THREE.Vector3(0, -4.905 * age * age, 0));
        };
        const points = [at(release.start, release.intervalStart), at(release.end, release.intervalStart), at(release.end, release.intervalEnd), at(release.start, release.intervalEnd)];
        // Keep the finite patch centered on the worker's committed trajectory;
        // an analytic gravity offset must not diverge from its time integrator.
        const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(.25);
        const translation = new THREE.Vector3().fromArray(parcel.position).sub(center);
        const drawn = this.sheet(points.map(p => p.add(translation)), parcel.volume, sourceFaces.get(parcel.id), `parcel:${parcel.id}`, Boolean(parcel.sourceRelease));
        if (drawn && parcel.sourceRelease) this.sourceSheetDrawnVolume += parcel.volume;
        return;
      }
      const i = glyphCount++;
      this.transform.position.fromArray(parcel.position);
      const previous = this.previousParcels.get(parcel.id);
      const uninterrupted = previous && previous.contactCount === parcel.contactCount && (previous.motionRevision ?? 0) === (parcel.motionRevision ?? 0);
      if (uninterrupted && previous.support && parcel.support && previous.support.geometryIdentity === parcel.support.geometryIdentity && fraction < 1) {
        // Persistent lower support follows the solver's tangent chart. Entry
        // and finite-edge release snap to committed state; no airborne arc
        // or flattened visual film is invented between different modes.
        const surface = snapshot.surfaces.find(s => s.id === parcel.support!.surfaceId);
        if (surface) this.transform.position.fromArray(waterfallSupportedPosition(previous.support, surface, (snapshot.receipt.time - this.previousSimulationTime) * fraction));
      } else if (uninterrupted && !previous.support && !parcel.support && fraction < 1 && snapshot.receipt.airborneTrajectory === 'constant-gravity') {
        // A received uninterrupted flight uses the solver's parabola. Births
        // and contact changes still snap; the committed endpoint stays exact.
        const time = (snapshot.receipt.time - this.previousSimulationTime) * fraction;
        this.transform.position.set(previous.position[0] + previous.velocity[0] * time,
          previous.position[1] + previous.velocity[1] * time - 4.905 * time * time,
          previous.position[2] + previous.velocity[2] * time);
      } else if (uninterrupted && !previous.support && !parcel.support && snapshot.receipt.airborneTrajectory !== 'constant-gravity') {
        this.transform.position.set(
          previous.position[0] + (parcel.position[0] - previous.position[0]) * fraction,
          previous.position[1] + (parcel.position[1] - previous.position[1]) * fraction,
          previous.position[2] + (parcel.position[2] - previous.position[2]) * fraction,
        );
      }
      if (refreshGlyphShape) {
        const speed = this.velocity.fromArray(parcel.velocity).length();
        const stretch = Math.max(1, Math.min(5, 1 + speed * 0.08));
        const radius = Math.cbrt(parcel.volume / this.unitVolume);
        const minor = radius / Math.sqrt(stretch);
        this.transform.quaternion.setFromUnitVectors(this.up, speed > 1e-8 ? this.velocity.normalize() : this.up);
        this.transform.scale.set(minor, radius * stretch, minor);
        this.transform.updateMatrix(); this.parcels.setMatrixAt(i, this.transform.matrix);
        this.diameter.setX(i, minor * 2);
      } else {
        // Matrix composition writes these same three Float32 translations.
        // Retain its other thirteen components exactly, without recomputing
        // thousands of unchanged rotations or resending unchanged diameters.
        const offset = i * 16;
        matrices[offset + 12] = this.transform.position.x;
        matrices[offset + 13] = this.transform.position.y;
        matrices[offset + 14] = this.transform.position.z;
      }
    });
    (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount = glyphCount;
    if (buildSurface) {
      this.surfaceSnapshot = snapshot;
      this.surface.geometry.setDrawRange(0, this.surfaceVertexCount);
      // Upload only the used prefix when a new physical snapshot arrives.
      // Reserving capacity must not resend a mostly empty buffer every frame.
      const names = this.representation === 'local' ? ['position', 'normal', 'liquidDiameter', 'prismU', 'prismV', 'prismN'] : ['position', 'normal', 'liquidDiameter'];
      if (this.filmStudyEnabled) names.push('attachedFilmFace');
      this.snapshotUploadBytes = 0;
      for (const name of names) {
        const attr = this.surface.geometry.getAttribute(name) as THREE.BufferAttribute;
        attr.clearUpdateRanges();
        if (this.surfaceVertexCount > 0) { attr.addUpdateRange(0, this.surfaceVertexCount * attr.itemSize); attr.needsUpdate = true; this.snapshotUploadBytes += this.surfaceVertexCount * attr.itemSize * Float32Array.BYTES_PER_ELEMENT; }
      }
      this.constructionMs = performance.now() - constructionStarted;
    }
    this.parcels.instanceMatrix.clearUpdateRanges();
    if (glyphCount > 0) {
      this.parcels.instanceMatrix.addUpdateRange(0, glyphCount * 16);
      this.parcels.instanceMatrix.needsUpdate = true;
      if (refreshGlyphShape) {
        this.diameter.clearUpdateRanges();
        this.diameter.addUpdateRange(0, glyphCount);
        this.diameter.needsUpdate = true;
      }
    }
    this.presentedSnapshot = snapshot; this.presentedFraction = fraction;
  }

  /** Emit one real free face. The local basis reverses handedness, so triangle
   * order is reversed here while the physical outward normal is preserved. */
  private face(points: THREE.Vector3[], thickness: number, normal?: THREE.Vector3, localCoordinates?: PrismVector[]): void {
    let n = normal ?? points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
    if (!normal && this.representation === 'local' && localCoordinates && this.activePrism) {
      const a = new THREE.Vector3().fromArray(localCoordinates[1]).sub(new THREE.Vector3().fromArray(localCoordinates[0]));
      const b = new THREE.Vector3().fromArray(localCoordinates[2]).sub(new THREE.Vector3().fromArray(localCoordinates[0]));
      const direction = a.cross(b).normalize(), frame = this.activePrism;
      n = new THREE.Vector3().fromArray(frame.u).multiplyScalar(direction.x).addScaledVector(new THREE.Vector3().fromArray(frame.v), direction.y).addScaledVector(new THREE.Vector3().fromArray(frame.normal), direction.z).normalize();
    }
    if (this.surfaceVertexCount + 6 > SURFACE_VERTEX_CAPACITY) throw Error('Contact water surface capacity exceeded');
    // A face has one normal, basis and owning range. Read them once, then write
    // their components directly. Profiling found Vector3.toArray and repeated
    // per-vertex dispatch costly here; the uploaded Float32 values and all prism
    // volume/centroid checks stay unchanged.
    const local = this.representation === 'local', frame = this.activePrism;
    if (local && (!frame || !localCoordinates)) throw Error('Contact local face requires explicit coordinates from its owning prism');
    const range = this.primitiveRanges[this.primitiveRanges.length - 1];
    if (range) range.count += 6;
    const nx = n.x, ny = n.y, nz = n.z;
    for (const index of FACE_TRIANGLE_CORNERS) {
      const vertex = this.surfaceVertexCount++;
      const at = vertex * 3;
      if (local) {
        const p=localCoordinates![index], f=frame!;
        this.surfacePositions[at]=p[0]; this.surfacePositions[at+1]=p[1]; this.surfacePositions[at+2]=p[2];
        this.prismU[at]=f.u[0]; this.prismU[at+1]=f.u[1]; this.prismU[at+2]=f.u[2];
        this.prismV[at]=f.v[0]; this.prismV[at+1]=f.v[1]; this.prismV[at+2]=f.v[2];
        this.prismN[at]=f.normal[0]; this.prismN[at+1]=f.normal[1]; this.prismN[at+2]=f.normal[2];
      } else {
        const p = points[index];
        this.surfacePositions[at] = p.x; this.surfacePositions[at + 1] = p.y; this.surfacePositions[at + 2] = p.z;
      }
      this.surfaceNormals[at] = nx; this.surfaceNormals[at + 1] = ny; this.surfaceNormals[at + 2] = nz;
      this.surfaceThickness[vertex] = thickness;
      if (this.filmStudyEnabled) this.filmFaces[vertex] = this.filmFace;
    }
  }

  private sameVertex(a: THREE.Vector3, b: THREE.Vector3): boolean {
    return Math.fround(a.x) === Math.fround(b.x) && Math.fround(a.y) === Math.fround(b.y) && Math.fround(a.z) === Math.fround(b.z);
  }

  /** A planar finite sheet uses its owned volume divided by actual area.
   * This does not enlarge water to fill gaps or turn numerical samples into
   * disconnected drops. Edge flux, birth interval and velocity supply geometry. */
  private sheet(points: THREE.Vector3[], volume: number, exposedEdges: boolean[] | undefined, primitiveId: string, source: boolean): boolean {
    const cross = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
    const area = cross.length();
    if (!(area > 0) || !Number.isFinite(area)) throw Error('Degenerate finite release sheet');
    const thickness = volume / area, n = cross.normalize(), offset = n.clone().multiplyScalar(thickness * .5);
    const front = points.map(p => p.clone().add(offset));
    const back = points.map(p => p.clone().sub(offset));
    const originallyUnresolved = front.some((p, i) => this.sameVertex(p, back[i]));
    if (!this.beginPrimitive(points, thickness, volume, originallyUnresolved, [...front, ...back], primitiveId, source ? 'source' : 'sheet')) return false;
    if (originallyUnresolved && this.representation === 'world') { this.unresolvedSurfaceVolume += volume; this.activePrism = null; return false; }
    const localCorner = (index: number): PrismVector => [this.activePrism!.localCorners[index*3], this.activePrism!.localCorners[index*3+1], this.activePrism!.localCorners[index*3+2]];
    this.face(front, thickness, n, [0, 1, 2, 3].map(localCorner));
    this.face([back[3], back[2], back[1], back[0]], thickness, n.clone().negate(), [7, 6, 5, 4].map(localCorner));
    for (let i = 0; i < 4; i++) {
      if (exposedEdges?.[i] === false) continue;
      const j = (i + 1) % 4;
      this.face([front[j], front[i], back[i], back[j]], thickness, undefined, [j, i, i + 4, j + 4].map(localCorner));
    }
    this.sheetDrawnVolume += volume;
    this.activePrism = null;
    return true;
  }

  receipt() {
    return {
      ...this.snapshotReceipt,
      visibleParcels: (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount,
      representedVolume: this.representedVolume + (this.currentSnapshot?.receipt.filmVolume ?? 0) - this.unresolvedSurfaceVolume,
      unresolvedSurfaceVolume: this.unresolvedSurfaceVolume,
      unresolvedLocalStorage: structuredClone(this.localUnresolved),
      filmDrawnVolume: this.filmDrawnVolume, sheetDrawnVolume: this.sheetDrawnVolume, sourceSheetDrawnVolume: this.sourceSheetDrawnVolume,
      surfaceVertices: this.surfaceVertexCount, capacity: CAPACITY, contactRepresentation: this.representation,
      prismRepresentation: {
        ...this.primitiveMetrics,
        coordinateFrame: 'Crest forward, height, across; before view transforms',
        referenceGeometry: 'Original footprint triangle area/area centroid times explicit thickness; film offset from original base; binary64 extruded world corners are diagnostic only',
        qualification: 'Closed local storage with rounded corners/basis and binary64 origin; excludes camera/clip/raster rounding, overlap and terrain',
        constructionMs: this.constructionMs, snapshotUploadBytes: this.snapshotUploadBytes,
        originUpdateMs: this.originUpdateMs, cameraOriginUploadBytes: this.cameraOriginUploadBytes,
      },
      representation: 'Finite source curtain, first-ledge film and edge-flux sheets; later-contact parcels remain coarse samples; world branch skips reported Float32-unresolved surfaces; local branch is strict unless inspection explicitly reports subnormal thickness as unresolved; unchanged local absorption chord approximation',
    };
  }
  dispose(): void {
    const inactiveMaterial = this.representation === 'local' ? this.worldSurfaceMaterial : this.localSurfaceMaterial;
    for (const group of [this.rocks, this.water]) group.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); }
    });
    inactiveMaterial.dispose();
    this.rocks.removeFromParent(); this.water.removeFromParent();
  }
}
