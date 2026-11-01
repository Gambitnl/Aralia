/**
 * Draws solver-owned airborne spill water using the existing coherent-liquid optics.
 * Each moving section retains its measured volume. The prisms are a bounded
 * display approximation: they do not solve pressure, merging, or breakup in air.
 * This opt-in view never substitutes particles or a new shader for the river.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: components/World3D/water/riverReachScene.ts, components/World3D/water/riverSpillInstances.ts, components/World3D/water/riverTerrainCourseView.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { Fn, abs, attribute, cameraPosition, clamp, dot, exp, float, max, mix, normalWorld, normalize, positionWorld, pow, reflect, screenCoordinate, smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { getRiverNoiseTexture, type RiverWaterUniforms } from './riverWaterMaterial';
import { breakupLengthM, brokenJetCloud, coherentSpreadRate, jetWhiteness } from '@/systems/world3d/waterfall/waterfallTypes';
import { LandingSprayView, type SprayLanding } from './riverLandingSpray';
import { materialSheetMaterial } from './riverWaterfallView';
import { SPILL_BOX_FACES as faces, updateSpillInstances } from './riverSpillInstances';
import type { RiverSolverGrid } from '@/systems/world3d/river/riverSolver';
import { spillLipSpan, type RiverSpillFace } from '@/systems/world3d/river/riverSpillTransfer';
import type { WaterSheetArrays } from '@/systems/world3d/river/riverWaterSheet';
import { riverIndexX } from '@/systems/world3d/river/riverRectGrid';

type Vec3 = [number, number, number];
export interface SpillDisplayPacket {
  id: number; faceId: string; birth: number; volume: number; width: number;
  faceAxis: 'x' | 'z'; releaseDuration: number;
  /** World direction of the emitting face for a rotated terrain grid. */
  releaseAcross?: Vec3;
  releasePosition: Vec3; releaseVelocity: Vec3;
  position: Vec3; velocity: Vec3; arrivalTime?: number;
  /** Donor depth at release, m (solver packets carry it; the falling sheet's break-up length reads it). */
  depth?: number;
  /** The age at break-up, s, and gravity plus drag, m/s^2 (solver packets, 2026-11-01). */
  breakAge?: number; acceleration?: Vec3;
}
export interface SpillDisplaySnapshot {
  time: number; packets: readonly SpillDisplayPacket[];
  arrived?: readonly SpillDisplayPacket[];
}

/** A height field must not draw an attached curtain across a face whose water
 * is now owned in air. Only actual detached faces are cut; a submerged lip
 * keeps its normal connected surface. This changes drawing, never water mass. */
export function trimSpillSurface(sheet: WaterSheetArrays, grid: RiverSolverGrid,
  exposedFaces: readonly RiverSpillFace[]): WaterSheetArrays {
  if (!exposedFaces.length) return sheet;
  // Each sheet refresh checks three edges per triangle. Keep the same exact
  // cell-pair ownership without allocating a string for every check. Both
  // directions are stored so winding does not affect which triangle is cut.
  const cuts = new Map<number, Set<number>>();
  for(const f of exposedFaces)for(const [a,b] of [[f.from,f.to],[f.to,f.from]]){
    let neighbors=cuts.get(a);if(!neighbors){neighbors=new Set();cuts.set(a,neighbors);}neighbors.add(b);
  }
  const isCut=(a:number,b:number)=>cuts.get(a)?.has(b)??false;
  const cells = new Int32Array(sheet.pos.length / 3);
  for (let k = 0; k < cells.length; k++) {
    const i = grid.xEdges?riverIndexX(grid,sheet.pos[k*3]):Math.round((sheet.pos[k * 3] - grid.x0) / grid.dx - .5);
    const j = Math.round((sheet.pos[k * 3 + 2] - grid.z0) / grid.dx - .5);
    cells[k] = j * grid.nx + i;
  }
  const kept: number[] = [];
  for (let k = 0; k < sheet.index.length; k += 3) {
    const a = sheet.index[k], b = sheet.index[k + 1], c = sheet.index[k + 2];
    if (isCut(cells[a], cells[b]) || isCut(cells[b], cells[c]) || isCut(cells[c], cells[a])) continue;
    kept.push(a, b, c);
  }
  return kept.length === sheet.index.length ? sheet : { ...sheet, index: Uint32Array.from(kept) };
}

/** Physical section dimensions come from V = width * length * thickness. */
export function buildSpillDisplayGeometry(packets: readonly SpillDisplayPacket[], reuse?: THREE.BufferGeometry, preserveReleaseShear=true): THREE.BufferGeometry {
  // Each accepted packet has exactly twelve triangles. Write the same closed
  // prisms directly into upload-ready storage instead of growing boxed arrays,
  // creating tiny temporary arrays for every vertex, then copying them again.
  // This changes allocation cost only: all packets, faces and optical fields
  // remain present, with the same volume-derived dimensions and winding.
  // The live view retains capacity across births and landings. Growth replaces
  // the buffers; a smaller inventory only shortens the draw range. Unused slots
  // never draw, so no packet is discarded and landed water cannot linger.
  // Callers without a retained geometry still receive exact-sized plain arrays.
  const required=packets.length*36;
  const retained=reuse?.userData.spillCapacity as number|undefined;
  const geometry=reuse&&retained!==undefined&&retained>=required?reuse:new THREE.BufferGeometry();
  const capacity=geometry===reuse?retained!:reuse?36*2**Math.ceil(Math.log2(Math.max(1,packets.length))):required;
  if(reuse)geometry.userData.spillCapacity=capacity;
  const storage=(name:string,size:number):Float32Array=>{
    const previous=geometry.getAttribute(name);
    return previous?.array instanceof Float32Array&&previous.array.length===capacity*size?previous.array:new Float32Array(capacity*size);
  };
  const positions=storage('position',3),normals=storage('normal',3),planes=storage('materialPlane',3);
  const coordinates=storage('materialCoordinate',2),thicknesses=storage('materialThickness',1),widths=storage('materialWidth',1);
  const gradients=storage('materialDepthGradient',3),acrosses=storage('materialAcross',3);
  let vertex=0;
  const tangent=new THREE.Vector3(),faceAcross=new THREE.Vector3(),across=new THREE.Vector3(),plane=new THREE.Vector3();
  const center=new THREE.Vector3(),n=new THREE.Vector3(),edge=new THREE.Vector3(),outward=new THREE.Vector3();
  const corners=Array.from({length:8},()=>new THREE.Vector3());
  const put3=(data:Float32Array,p:THREE.Vector3)=>{const k=vertex*3;data[k]=p.x;data[k+1]=p.y;data[k+2]=p.z;};
  for (const p of packets) {
    if (!(p.volume > 0) || !(p.width > 0) || !(p.releaseDuration > 0)) continue;
    tangent.set(...p.velocity);
    const speed = tangent.length();
    if (speed < 1e-6) continue;
    tangent.divideScalar(speed);
    if(p.releaseAcross)faceAcross.set(...p.releaseAcross);else if(p.faceAxis==='x')faceAcross.set(0,0,1);else faceAcross.set(-1,0,0);
    across.copy(faceAcross).addScaledVector(tangent, -faceAcross.dot(tangent));
    const projectedWidth = p.width * across.length();
    if (projectedWidth < 1e-6) continue;
    across.normalize();
    plane.crossVectors(tangent, across).normalize();
    const length = speed * p.releaseDuration;
    const thickness = p.volume / (projectedWidth * length);
    center.set(...p.position);
    for (let k = 0; k < 8; k++) corners[k].copy(center)
      .addScaledVector(preserveReleaseShear?faceAcross:across, (k & 1 ? 1 : -1) * (preserveReleaseShear?p.width:projectedWidth) * .5)
      .addScaledVector(plane, (k & 2 ? 1 : -1) * thickness * .5)
      .addScaledVector(tangent, (k & 4 ? 1 : -1) * length * .5);
    for (const face of faces) {
      n.subVectors(corners[face[1]], corners[face[0]])
        .cross(edge.subVectors(corners[face[2]], corners[face[0]])).normalize();
      // Outward normals make each section's represented volume inspectable.
      outward.copy(corners[face[0]]).sub(center);
      const order = n.dot(outward) >= 0 ? face : [face[0], face[3], face[2], face[1]];
      if (n.dot(outward) < 0) n.negate();
      for (const k of [order[0], order[1], order[2], order[0], order[2], order[3]]) {
        put3(positions,corners[k]);put3(normals,n);put3(planes,plane);put3(gradients,plane);put3(acrosses,across);
        coordinates[vertex*2]=(k & 1 ? 1 : -1)*projectedWidth*.5;
        coordinates[vertex*2+1]=(k & 2 ? 1 : -1)*thickness*.5;
        thicknesses[vertex]=thickness;widths[vertex]=projectedWidth;vertex++;
      }
    }
  }
  const add = (name: string, data: Float32Array, size: number, unchanged=false) => {
    const previous=geometry.getAttribute(name);
    if(previous instanceof THREE.BufferAttribute&&previous.array===data){
      previous.clearUpdateRanges();
      if(vertex&&!unchanged){previous.addUpdateRange(0,vertex*size);previous.needsUpdate=true;}
    }else geometry.setAttribute(name,new THREE.BufferAttribute(reuse?data:data.subarray(0,vertex*size),size).setUsage(reuse?THREE.DynamicDrawUsage:THREE.StaticDrawUsage));
  };
  add('position', positions, 3); add('normal', normals, 3);
  add('materialPlane', planes, 3); add('materialDepthGradient', gradients, 3);
  add('materialAcross', acrosses, 3); add('materialCoordinate', coordinates, 2);
  add('materialThickness', thicknesses, 1); add('materialWidth', widths, 1);
  add('materialThicknessGradient', storage('materialThicknessGradient',3), 3,true);
  geometry.setDrawRange(0,vertex);
  if(!reuse)geometry.computeBoundingSphere();
  else{
    // Bounds describe only live vertices, not stale capacity slots. This is
    // the same box-center/max-radius construction as Three's fresh geometry.
    const box=new THREE.Box3(),point=new THREE.Vector3();
    for(let k=0;k<vertex;k++)box.expandByPoint(point.fromArray(positions,k*3));
    const sphere=geometry.boundingSphere??new THREE.Sphere();box.getCenter(sphere.center);
    let radiusSquared=0;for(let k=0;k<vertex;k++)radiusSquared=Math.max(radiusSquared,point.fromArray(positions,k*3).distanceToSquared(sphere.center));
    sphere.radius=Math.sqrt(radiusSquared);geometry.boundingSphere=sphere;
  }
  return geometry;
}

/**
 * THE FALLING SHEET (2026-10-22, GG-428). The prisms above draw each parcel as
 * a separate box of clear liquid: on the live seven-falls course they read as
 * gray slabs and black-and-white bars, not as water. This draws the same
 * parcels as the water they are: one connected sheet for each lip face.
 *  - A face's parcels, in birth order, are the stations of one ribbon from the
 *    lip to the landing. A new parcel adds the lip itself as the first
 *    station; a parcel that landed in the last 0.3 s adds its landing point.
 *  - Each station's thickness is the face's unit discharge over its speed
 *    (q / |v|, continuity), and its width lies along the lip: horizontal and
 *    square to the launch flow (2026-11-01). Until 2026-11-01 it spread by
 *    JET_SPREAD (3.8 % per side, the Ervine and Falvey law at Tu = 10 %);
 *    it now spreads as THE DROP CLOUD below says.
 *  - Each station's white share follows the jet's break-up length
 *    (breakupLengthM, Ervine, Falvey and Withers): clear at the lip, white
 *    past L_b. The values come from the parcels; no color is chosen per fall.
 *  - THE DROP CLOUD (2026-11-01, GG-572). Before L_b the sheet spreads by
 *    its own turbulence only (coherentSpreadRate, 0.46 % per side at the
 *    lip's Tu). Past L_b it is drops in the air it drags (brokenJetCloud):
 *    the air's eddies spread them by sigma along the lip, so the sheet's
 *    edge turns into a Gaussian fringe of drops. Each ribbon has four edges
 *    (outer, inner, inner, outer, 2 sigma apart at each side) and carries the
 *    water column of its own flow at each edge, so overlapped ribbons add up
 *    to the lip's true flow. The cloud's opacity is its optical depth,
 *    tau = (3/2) Q_ext L / D (dropCloudOpticalDepth), not a look number.
 * Volume and momentum stay with the solver-owned parcels; this is drawing only.
 */
export interface SpillNappeStation {
  position: Vec3; velocity: Vec3; birth: number; across: Vec3; width: number; q: number; v0: number; d0: number; along: number;
  /** The face's true share of the lip, m; the drawn span is `width`. */
  lipWidth: number;
  /** Past break-up: the drops' rms spread, m, the drop that carries the water, m, and the share of the core gone, 0..1. */
  sigma: number; dropM: number; broken: number;
}
/** Stations closer in birth than this join; a larger gap is a break in the stream, s. */
export const NAPPE_JOIN_S = 0.3;
export function spillNappeStations(visible: readonly SpillDisplayPacket[], landed: readonly SpillDisplayPacket[], time: number): SpillNappeStation[][] {
  const byFace = new Map<string, { flying: SpillDisplayPacket[]; landed: SpillDisplayPacket[] }>();
  const slot = (id: string) => { let s = byFace.get(id); if (!s) byFace.set(id, s = { flying: [], landed: [] }); return s; };
  for (const p of visible) slot(p.faceId).flying.push(p);
  for (const p of landed) slot(p.faceId).landed.push(p);
  const station = (p: SpillDisplayPacket, position: Vec3, velocity: Vec3, birth: number, along: number, age: number): SpillNappeStation => {
    const face: Vec3 = p.releaseAcross ?? (p.faceAxis === 'x' ? [0, 0, 1] : [-1, 0, 0]);
    // THE SHEET LIES ALONG THE LIP (2026-11-01). A diagonal lip is a stair of
    // x and z grid faces; each face once spread its ribbon along its own grid
    // axis. Once the water turned down, the ribbons pointed at two grid axes
    // 90 degrees apart, and at Steinsdalsfossen 27 of 39 stood edge-on to the
    // front view, so the jet spread went into depth and the curtain kept
    // straight sides. The lip's real direction is horizontal and square to
    // the launch flow (spillLipSpan, shared with the solver's drag). Each
    // face's span is projected onto it, so the stair's faces add up to the
    // lip's true length, and q (thickness) rises to match.
    // The drawn span stays the full face width: the stair's faces sit at
    // different depths along the flow, so exact tiling showed the rock
    // through V-shaped gaps from an oblique view (pool lip, 2026-11-01
    // shots). The overlap is drawing only; q uses the lip's true width.
    const { across, lipWidth } = spillLipSpan(p.width, face, p.releaseVelocity);
    const q = p.volume / (lipWidth * p.releaseDuration);
    const v0 = Math.hypot(...p.releaseVelocity), d0 = Math.max(.005, p.depth ?? .05);
    const breakM = breakupLengthM(Math.max(.05, v0), d0);
    // Past break-up the solver's own break-up age dates the cloud; a parcel
    // with no drag (none recorded) gets the air's spread with no coupling.
    const cloud = along > breakM ? brokenJetCloud(along - breakM, age - (p.breakAge ?? age), Math.hypot(...velocity), q) : null;
    return {
      position, velocity, birth, along, width: p.width, q, v0, d0, across, lipWidth,
      sigma: cloud?.sigmaM ?? 0, dropM: cloud?.dropM ?? .0054, broken: Math.min(1, along / Math.max(1e-3, breakM)),
    };
  };
  const chains: SpillNappeStation[][] = [];
  for (const { flying, landed: down } of byFace.values()) {
    if (!flying.length) continue;
    flying.sort((a, b) => b.birth - a.birth);
    const list: SpillNappeStation[] = [];
    const newest = flying[0];
    // Water still leaves the lip: the sheet starts at the lip itself.
    if (time - newest.birth <= NAPPE_JOIN_S) list.push(station(newest, [...newest.releasePosition], [...newest.releaseVelocity], time, 0, 0));
    for (const p of flying) list.push(station(p, p.position, p.velocity, p.birth,
      Math.hypot(p.position[0] - p.releasePosition[0], p.position[1] - p.releasePosition[1], p.position[2] - p.releasePosition[2]), time - p.birth));
    // The youngest landed parcel older than the oldest flying one ends the sheet on the ground.
    const oldest = flying[flying.length - 1];
    const tail = down.filter(p => p.birth < oldest.birth).sort((a, b) => b.birth - a.birth)[0];
    if (tail) list.push(station(tail, tail.position, tail.velocity, tail.birth,
      Math.hypot(tail.position[0] - tail.releasePosition[0], tail.position[1] - tail.releasePosition[1], tail.position[2] - tail.releasePosition[2]),
      (tail.arrivalTime ?? time) - tail.birth));
    let chain: SpillNappeStation[] = [list[0]];
    for (let k = 1; k < list.length; k++) {
      if (list[k - 1].birth - list[k].birth > NAPPE_JOIN_S) { if (chain.length > 1) chains.push(chain); chain = []; }
      chain.push(list[k]);
    }
    if (chain.length > 1) chains.push(chain);
  }
  return chains;
}

/** The standard normal distribution function (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + .3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-z * z);
  return .5 * (1 + (x < 0 ? -erf : erf));
}
/** The ribbon's edges across the sheet, as multiples of the station's sides: outer, inner, inner, outer. */
export const NAPPE_EDGES = 4;
/**
 * The across offsets of a station's four edges, m, and the water column (m of
 * water per m^2, face on) at each (THE DROP CLOUD). The coherent half span
 * W/2 spreads by coherentSpreadRate up to L_b; the drops then spread by
 * sigma, so the column is the face's flow over its drawn span convolved with
 * a Gaussian: L(y) = Q / (|v| W) [Phi((y + W/2) / sigma) - Phi((y - W/2) / sigma)].
 * The edges sit 2 sigma outside and inside the span (the inner pair meets at
 * the center when sigma > W / 4).
 */
export function spillNappeEdges(s: SpillNappeStation): { offsets: number[]; columns: number[] } {
  const breakM = breakupLengthM(Math.max(.05, s.v0), s.d0);
  const half = s.width * .5 + coherentSpreadRate() * Math.min(s.along, breakM);
  const sigma = Math.max(1e-4, s.sigma), speed = Math.max(1e-3, Math.hypot(...s.velocity));
  const column0 = (s.q * s.lipWidth) / (speed * 2 * half);
  const outer = half + 2 * sigma, inner = Math.max(0, half - 2 * sigma);
  const offsets = [-outer, -inner, inner, outer];
  return { offsets, columns: offsets.map(y => Math.max(1e-6, column0 * (normalCdf((y + half) / sigma) - normalCdf((y - half) / sigma)))) };
}

/** Four vertices per station (THE DROP CLOUD's edges), six triangles per gap. */
export function buildSpillNappeGeometry(chains: readonly SpillNappeStation[][], reuse?: THREE.BufferGeometry): THREE.BufferGeometry {
  let vertices = 0, triangles = 0;
  for (const c of chains) { vertices += NAPPE_EDGES * c.length; triangles += 2 * (NAPPE_EDGES - 1) * (c.length - 1); }
  // GROWTH MAKES A NEW GEOMETRY (2026-10-24). Three's WebGPU renderer keeps
  // the GPU buffers of a geometry it has drawn; new, larger arrays on the same
  // geometry left new indices reading old vertex data, and the warm start (172
  // lips at once) drew long thin lines across the views. The caller swaps in
  // the returned geometry and disposes the old one, as the prisms already do.
  const capacity = (reuse?.userData.nappeCapacity as number | undefined) ?? 0;
  const grow = !reuse || vertices > capacity || !reuse.getAttribute('position');
  const geometry = grow ? new THREE.BufferGeometry() : reuse;
  const size = grow ? Math.max(64, 2 ** Math.ceil(Math.log2(vertices))) : capacity;
  const array = (name: string, n: number) => {
    const a = geometry.getAttribute(name);
    return !grow && a?.array instanceof Float32Array ? a.array as Float32Array : new Float32Array(size * n);
  };
  const pos = array('position', 3), nrm = array('normal', 3), opt = array('nappeOptics', 4), cld = array('nappeCloud', 2);
  const prevIndex = geometry.getIndex();
  // Six triangles per gap of four vertices: 4.5 indices per vertex at most.
  const index = !grow && prevIndex?.array instanceof Uint32Array ? prevIndex.array : new Uint32Array(Math.max(18, Math.ceil(size * 4.5)));
  const t = new THREE.Vector3(), a = new THREE.Vector3(), n = new THREE.Vector3();
  let v = 0, i = 0;
  for (const chain of chains) {
    const first = v;
    for (const s of chain) {
      t.set(...s.velocity); const speed = Math.max(1e-3, t.length()); t.divideScalar(speed);
      // The lip's direction, made square to the flight.
      a.set(...s.across); a.addScaledVector(t, -a.dot(t));
      if (a.lengthSq() < 1e-10) a.set(...s.across);
      a.normalize();
      n.crossVectors(t, a).normalize();
      const white = jetWhiteness(s.along, breakupLengthM(Math.max(.05, s.v0), s.d0));
      const { offsets, columns } = spillNappeEdges(s);
      for (let e = 0; e < NAPPE_EDGES; e++) {
        const off = offsets[e];
        pos[v * 3] = s.position[0] + a.x * off; pos[v * 3 + 1] = s.position[1] + a.y * off; pos[v * 3 + 2] = s.position[2] + a.z * off;
        nrm[v * 3] = n.x; nrm[v * 3 + 1] = n.y; nrm[v * 3 + 2] = n.z;
        // x: across the sheet, m; y: birth, s (the water's own clock, so the
        // streak pattern falls with the water); z: the water column, m;
        // w: white share.
        opt[v * 4] = off; opt[v * 4 + 1] = s.birth; opt[v * 4 + 2] = columns[e]; opt[v * 4 + 3] = white;
        // The drop that carries the water, m, and the share of the core gone.
        cld[v * 2] = s.dropM; cld[v * 2 + 1] = s.broken;
        v++;
      }
    }
    for (let k = 0; k < chain.length - 1; k++) for (let e = 0; e < NAPPE_EDGES - 1; e++) {
      const p = first + NAPPE_EDGES * k + e, q = p + NAPPE_EDGES;
      index[i++] = p; index[i++] = q; index[i++] = p + 1;
      index[i++] = p + 1; index[i++] = q; index[i++] = q + 1;
    }
  }
  if (grow) {
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('nappeOptics', new THREE.BufferAttribute(opt, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('nappeCloud', new THREE.BufferAttribute(cld, 2).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(index, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.userData.nappeCapacity = size;
  } else {
    for (const name of ['position', 'normal', 'nappeOptics', 'nappeCloud']) geometry.getAttribute(name).needsUpdate = true;
    geometry.getIndex()!.needsUpdate = true;
  }
  geometry.setDrawRange(0, i);
  // The live view turns culling off; this keeps a direct caller's bounds honest.
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The falling sheet's optics. Clear coherent water (the river's own
 * absorption, refraction and Fresnel sky) turns into white water by the
 * station's white share. The white part uses the lighting of the headwaters
 * fall's accepted airborne material (sky ambient plus sun, the same tint),
 * through the sheet in both directions, as a thin falling sheet lets light
 * through. Its streaks are the shared river noise read in the water's own
 * across-meters and birth clock, so they fall with the water. Air gaps open
 * where the noise is low, more so as the sheet whitens and breaks up.
 * Past break-up (THE DROP CLOUD, 2026-11-01) the opacity is the drop cloud's:
 * 1 - exp(-tau) with tau = (3/2) Q_ext L / (D cos), L the water column and
 * D the drop (dropCloudOpticalDepth). The shared noise only modulates tau
 * about its mean (0.35 to 1.65 times, mean 1), as the ocean plume's eddies
 * modulate its mean density.
 */
export function spillNappeMaterial(U: RiverWaterUniforms): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial();
  const noise = texture(getRiverNoiseTexture());
  material.fragmentNode = Fn(() => {
    const optics = attribute('nappeOptics', 'vec4');
    const across = optics.x, birth = optics.y, thickness = optics.z, white = clamp(optics.w, 0, 1);
    const cloud = attribute('nappeCloud', 'vec2');
    const dropM = max(cloud.x, 1e-4), broken = clamp(cloud.y, 0, 1);
    const V = normalize(cameraPosition.sub(positionWorld));
    // NaN GUARDS (2026-10-22): a face-on sheet gave |N·V| a hair over 1, and
    // pow() of the negative 1 − facing is NaN on the GPU. One NaN pixel made
    // the page's auto exposure NaN and blacked out the whole frame. The
    // normal is also kept off zero before normalize().
    const n0 = normalize(normalWorld.add(vec3(0, 1e-6, 0)));
    const N = mix(n0.negate(), n0, float(dot(n0, V).greaterThanEqual(0)));
    const facing = clamp(abs(dot(N, V)), .05, 1);
    const f0 = Math.pow((1.333 - 1) / (1.333 + 1), 2);
    const F = float(f0).add(pow(clamp(float(1).sub(facing), 0, 1), 5).mul(1 - f0));
    const R = reflect(V.negate(), N);
    const sky = mix(U.uSkyHorizon, U.uSkyZenith, pow(max(R.y, 0), .5)).mul(U.uSkyGain);
    const screen = screenCoordinate.xy.div(U.uResolution);
    const refracted = U.uSceneColor.sample(clamp(screen.add(vec2(N.x, N.z).mul(.002)), vec2(.001), vec2(.999))).rgb;
    const body = refracted.mul(exp(max(U.uAbsorbClear, vec3(0)).mul(thickness.div(facing)).negate())).mul(float(1).sub(F)).add(sky.mul(F));
    // Two scales of streaks: strands about 0.4 m across, and their
    // fine texture; both stretched along the fall by the birth clock.
    const coarse = noise.sample(vec2(across.mul(.42), birth.mul(.35))).r;
    const fine = noise.sample(vec2(across.mul(1.9).add(.37), birth.mul(1.3))).r;
    const density = clamp(coarse.mul(.65).add(fine.mul(.35)), 0, 1);
    const light = mix(U.uSkyHorizon, U.uSkyZenith, .5).mul(U.uSkyGain).mul(.12)
      .add(U.uSunColor.mul(abs(dot(N, U.uSunDir))).mul(.55));
    const foam = light.mul(vec3(.80, .84, .83)).mul(mix(float(.72), float(1.05), density));
    const color = mix(body, foam, white);
    // Coherent water is a closed sheet; aerated water breaks into strands.
    const strands = smoothstep(mix(float(.0), float(.42), white), mix(float(.25), float(.62), white), density);
    // The drop cloud's optical depth: 1.5 Q_ext = 3 (dropCloudOpticalDepth).
    const tau = thickness.mul(3).div(dropM.mul(facing)).mul(mix(float(.35), float(1.65), density));
    const cloudCover = float(1).sub(exp(tau.negate()));
    return vec4(color, mix(mix(float(1), strands, white), cloudCover, broken));
  })();
  material.side = THREE.DoubleSide; material.transparent = true; material.depthWrite = false;
  material.name = 'river spill falling sheet';
  return material;
}

export class RiverSpillView {
  readonly mesh: THREE.Mesh;
  private previous: SpillDisplaySnapshot | null = null;
  private current: SpillDisplaySnapshot | null = null;
  private receivedAt = 0;
  private wallSpan = .25;
  private drawnTime = -Infinity;
  private instanceMode=true;
  private releaseShear=true;
  private instances:THREE.InstancedMesh|null=null;
  private instanceMaterial:THREE.Material|null=null;
  /** The falling sheet (default since 2026-10-22, GG-428); off = the prisms. */
  private sheetMode=true;
  private sheet:THREE.Mesh|null=null;
  /** Splash and mist where the airborne water lands (riverLandingSpray.ts). */
  private spray:LandingSprayView|null=null;
  /** The last drawn falling-sheet chains, for the page's spillReport(). */
  private lastChains:SpillNappeStation[][]=[];
  private lastTime=0;
  /** Diagnostics: the drawn sheet's longest segments, with their stations. Drawing is unchanged. */
  report(top=6):{time:number;chains:number;stations:number;longest:Array<{len:number;a:SpillNappeStation;b:SpillNappeStation}>}{
    const segs:Array<{len:number;a:SpillNappeStation;b:SpillNappeStation}>=[];
    for(const c of this.lastChains)for(let k=1;k<c.length;k++){const a=c[k-1],b=c[k];segs.push({len:Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1],a.position[2]-b.position[2]),a,b});}
    segs.sort((x,y)=>y.len-x.len);
    return {time:this.lastTime,chains:this.lastChains.length,stations:this.lastChains.reduce((s,c)=>s+c.length,0),longest:segs.slice(0,top)};
  }
  constructor(private readonly uniforms: RiverWaterUniforms) {
    // A very low fade plane leaves contact timing entirely with the solver.
    const material = materialSheetMaterial(uniforms, uniform(-1e6), uniform(1), uniform(new THREE.Vector3(0, 0, 1)), true);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.name = 'Experimental conserved airborne spill';
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 10;
  }
  /** Instancing preserves the native prisms and optics while reducing uploads.
   * The capacity mesh remains available for comparison; switching never emits,
   * removes or advances water. Impact and realistic aeration remain unfinished. */
  useInstances(on:boolean):void {this.instanceMode=on;this.drawnTime=-Infinity;this.update();}
  /** The connected falling sheet (default), or off for the earlier prisms
   * (instanced or expanded, by useInstances). Drawing only; no water moves. */
  useSheet(on:boolean):void {this.sheetMode=on;this.drawnTime=-Infinity;this.update();}
  /** Preserves the emitting face
   * span rather than opening artificial gaps under uniform sideways flow.
   * It does not reconstruct a smooth cliff from a stair-stepped solver bed. */
  useReleaseShear(on:boolean):void {this.releaseShear=on;this.drawnTime=-Infinity;this.update();}
  setSnapshot(snapshot: SpillDisplaySnapshot | null): void {
    if (!snapshot) { this.previous = this.current = null; this.mesh.visible = false; return; }
    const now = performance.now() / 1000;
    this.wallSpan = this.receivedAt ? Math.max(.016, now - this.receivedAt) : .25;
    this.previous = this.current && snapshot.time >= this.current.time ? this.current : snapshot;
    this.current = snapshot; this.receivedAt = now; this.drawnTime = -Infinity;
  }
  update(camera: THREE.Camera | null = null): void {
    if (!this.current || !this.previous) return;
    const fraction = Math.min(1, (performance.now() / 1000 - this.receivedAt) / this.wallSpan);
    const time = this.previous.time + (this.current.time - this.previous.time) * fraction;
    // Freeze when the solver pauses, and bound geometry work to display changes.
    if (Math.abs(time - this.drawnTime) < .025) return;
    this.drawnTime = time;
    const records = new Map<number, SpillDisplayPacket>();
    const currentIds = new Set(this.current.packets.map(p => p.id));
    for (const p of [...this.previous.packets, ...this.current.packets, ...(this.current.arrived ?? [])]) records.set(p.id, p);
    const visible: SpillDisplayPacket[] = [];
    for (const p of records.values()) {
      if (time < p.birth || (p.arrivalTime !== undefined && time >= p.arrivalTime)) continue;
      // The recent worker history supplies births and contacts. Interpolation
      // holds each parcel's own acceleration between snapshots (gravity, plus
      // the air's drag past break-up, 2026-11-01), never source Q.
      const referenceTime = p.arrivalTime ?? (currentIds.has(p.id) ? this.current.time : this.previous.time);
      const age = time - referenceTime;
      const g: Vec3 = p.acceleration ?? [0, -9.81, 0];
      const position: Vec3 = [p.position[0] + p.velocity[0] * age + .5 * g[0] * age * age, p.position[1] + p.velocity[1] * age + .5 * g[1] * age * age, p.position[2] + p.velocity[2] * age + .5 * g[2] * age * age];
      const velocity: Vec3 = [p.velocity[0] + g[0] * age, p.velocity[1] + g[1] * age, p.velocity[2] + g[2] * age];
      visible.push({ ...p, position, velocity });
    }
    (this.mesh.material as THREE.Material).visible=!this.sheetMode&&!this.instanceMode;
    if(this.sheetMode){
      if(this.instances)this.instances.visible=false;
      // Landed parcels end their sheet on the ground for a short while.
      const landed: SpillDisplayPacket[] = [];
      for (const p of records.values()) if (p.arrivalTime !== undefined && time >= p.arrivalTime && time - p.arrivalTime < NAPPE_JOIN_S) landed.push(p);
      if(!this.sheet){
        this.sheet=new THREE.Mesh(new THREE.BufferGeometry(),spillNappeMaterial(this.uniforms));
        this.sheet.name='Airborne spill falling sheet';this.sheet.frustumCulled=false;this.sheet.renderOrder=10;this.mesh.add(this.sheet);
      }
      this.lastChains=spillNappeStations(visible,landed,time);this.lastTime=time;
      const sheetGeometry=buildSpillNappeGeometry(this.lastChains,this.sheet.geometry);
      if(sheetGeometry!==this.sheet.geometry){this.sheet.geometry.dispose();this.sheet.geometry=sheetGeometry;}
      this.sheet.visible=visible.length>0;
    }else if(this.instanceMode){
      if(this.sheet)this.sheet.visible=false;
      // The native instance shader uses the actual sheared face normal;
      // Three's general instance-normal shortcut assumes orthogonal columns.
      this.instanceMaterial??=materialSheetMaterial(this.uniforms,uniform(-1e6),uniform(1),uniform(new THREE.Vector3(0,0,1)),true,true);
      const next=updateSpillInstances(visible,this.instanceMaterial,this.instances??undefined,this.releaseShear);
      if(next!==this.instances){this.instances?.removeFromParent();this.instances?.geometry.dispose();this.instances?.dispose();this.instances=next;this.mesh.add(next);}
      next.visible=visible.length>0;
    }else{
      if(this.instances)this.instances.visible=false;
      if(this.sheet)this.sheet.visible=false;
      const geometry = buildSpillDisplayGeometry(visible,this.mesh.geometry,this.releaseShear);
      if(geometry!==this.mesh.geometry){this.mesh.geometry.dispose();this.mesh.geometry=geometry;}
    }
    // THE LANDING SPRAY: each parcel that has landed adds splash and mist
    // for its own landing energy (one puff per 25 kJ, the headwaters law).
    const landings: SprayLanding[] = [];
    for (const p of records.values()) if (p.arrivalTime !== undefined && p.arrivalTime <= time)
      landings.push({ id: p.id, at: p.position, velocity: p.velocity, volumeM3: p.volume, dropM: p.releasePosition[1] - p.position[1], time: p.arrivalTime });
    if (!this.spray) { this.spray = new LandingSprayView(this.uniforms); this.mesh.add(this.spray.mesh); }
    this.spray.field.add(landings, time);
    const puffs = this.spray.draw(time, camera);
    this.mesh.visible = visible.length > 0 || puffs > 0;
  }
  dispose(): void {this.spray?.dispose();this.sheet?.geometry.dispose();(this.sheet?.material as THREE.Material|undefined)?.dispose();this.instances?.geometry.dispose();this.instances?.dispose();this.instanceMaterial?.dispose();this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
