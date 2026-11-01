/**
 * Airborne water over the mountain lip. Parcels leave at Q / cross-section
 * area and accelerate under gravity, rather than following a ground mesh.
 * The pool solver receives that discharge once at the trajectory's landing
 * patch. Vertical impact energy becomes visual spray; it is not a 3D fluid
 * simulation or an extra volume source. Its downstream envelope contains
 * calibrated entrained air, with liquid fraction preserving Q/local speed.
 * Bounded optical samples transport sun and sky through dispersed water,
 * with shared liquid attenuation and a constant-density geometry diagnostic.
 * The declared droplet interface size is an approximation, not a measurement.
 * Low flow gathers. The continuous approach
 * uses the receiving river's complete water shader and optical settings.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 03:55:46
 * Dependents: components/World3D/water/riverReachScene.ts, components/World3D/water/riverSpillView.ts
 * Imports: 27 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { riverSourceMapProjection } from './riverSourceMapProjection';
import { updateWaterGeometryNormals } from './riverGeometryNormals';
import { WaterfallThinLiveView } from './waterfallThinLiveView';
import { WaterfallContactView } from './waterfallContactView';
import type { WaterfallContactSnapshot } from '@/systems/world3d/river/waterfallContactFlow';
import { WaterfallReconstructedFluid } from './waterfallReconstructedFluid';
import { buildFluidParticles, FluidSourceHistory, type FluidBirth } from './waterfallFluidEmission';
import { BILLOW_TRANSPORT } from './riverBillowTransport';
import { BILLOW_VOLUME, BillowDensityField, buildBillowLobes, billowMaterialSection } from './waterfallBillowVolume';
import { AERATED_SHEET, aeratedTransfer, aeratedDebit, aeratedLocalSection } from './waterfallAeratedSheet';
import { MATERIAL_SHEET, materialSheetSection, materialSheetIndices, materialSheetBandVolume, materialSheetCellVolume, materialSheetTrajectory } from './waterfallMaterialSheet';
import { SEGMENT_EVENT_THIN_TAU } from './riverSegmentSingleScatter';
import { WATERFALL_SECONDARY, secondarySectionMap, secondarySectionRing } from './waterfallSecondaryDeformation';
// The laws a free jet and its plume follow (2026-10-11, the seven Norway falls):
// Ervine and Falvey's spread of a turbulent jet, and the mist budget and plume
// height set by the impact power. See waterfallTypes.ts.
import { JET_SPREAD, mistHeightM, mistRatePerS } from '@/systems/world3d/waterfall/waterfallTypes';
import * as THREE from 'three/webgpu';
import { Fn, If, Loop, Break, Discard, abs, atan, attribute, cos, floor, cameraPosition, cameraViewMatrix, perspectiveDepthToViewZ, ivec2, log, clamp, cross, dot, exp, float, max, min, mix, mat4, int, normalWorld, normalize, positionWorld, pow, property, reflect, screenCoordinate, sin, smoothstep, sqrt, texture, texture3D, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { defaultRiverCourse, mulberry32, type RiverShape } from '@/systems/world3d/river/riverReach';
import { frozenWaterfallMismatch, validateFrozenWaterfallSource, type FrozenWaterfallSource, type FrozenWaterfallSolarState } from '@/systems/world3d/river/waterfallFrozenSource';
import { riverSourceAt, type RiverSourceStatus } from '@/systems/world3d/river/riverSourceHistory';
import { riverFloodSourceAt, type RiverFloodPulseDescriptor } from '@/systems/world3d/river/riverFloodSurge';
import { waterfallFloodActive, waterfallFloodSection } from '@/systems/world3d/river/waterfallFloodVisual';
import { WATERFALL_ATLAS, WaterfallDensityAtlas, type WaterfallDensityProfile } from '@/systems/world3d/river/waterfallDensityAtlas';
import { WATERFALL, waterfallFlight, waterfallHydraulics, waterfallLanding, waterfallSourceRockHeight } from '@/systems/world3d/river/riverHeadwaters';
import { buildWaterfallCliff, disposeWaterfallCliff, createWaterfallRockMaterial, waterfallSourceShelfHeight } from './riverWaterfallCliff';
import { BOUNDARY_LIGHT, BOUNDARY_DIRECTIONS, type BoundarySurfaceSampler } from './riverBoundaryLight';
import { RiverBoundaryWorkerCache } from './riverBoundaryWorkerCache';
export { setRiverBoundaryWorkerFactory } from './riverBoundaryWorkerCache';
import { waterfallBoundaryReadback, waterfallRockDiagnostics } from './riverWaterfallCliff';
import type { RiverSurfaceMirror } from './riverSurfaceMirror';
import { createRiverFlowTextures, createRiverWaterMaterial, getRiverFoamTexture, getRiverNoiseTexture, type RiverWaterUniforms } from './riverWaterMaterial';
import type { WaterfallLandingState } from '@/systems/world3d/river/riverFlowField';
import type { RiverFlowMap } from '@/systems/world3d/river/riverFlowField';
// Extracted optical functions (agora-e9e1 split)
import { waterfallInterfaceNormal, waterfallOpticalSegment, waterfallTwoStream, waterfallSkyIrradiance, waterfallSkyBasis, getWaterfallSkyIrradianceTexture, getWaterfallSkyTextures, WATERFALL_INTERFACE } from './riverWaterfallOptics';
import type { WaterfallNormalVector, WaterfallSkyCell } from './riverWaterfallTypes';

/** Scanned rock belongs only to the new mountain and source ground.
 * Keep this export stable for the source-ground material integration. */
export function createRiverCliffMaterial(): THREE.MeshStandardNodeMaterial {
  return createWaterfallRockMaterial();
}

/** The same scene refraction, snowmelt absorption, sky colors and Fresnel as
 * the river. Airborne water has a finite thickness rather than a riverbed
 * depth, and reflects the sky in its own normal rather than a horizontal mirror. */
function airborneMaterial(U: RiverWaterUniforms, top: ReturnType<typeof uniform>, pool: ReturnType<typeof uniform>, flux: ReturnType<typeof uniform>, exit: ReturnType<typeof uniform>, opening: ReturnType<typeof uniform>, droplets = false): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial();
  const noise = texture(getRiverNoiseTexture());
  material.fragmentNode = Fn(() => {
    // Advected fine folds roughen the accelerating film. Their amplitude grows
    // through the fall; the crest keeps the river's clear reflection.
    const fall = clamp(top.sub(positionWorld.y).div(max(1, top.sub(pool))), 0, 1);
    const detail = noise.sample(uv().mul(vec2(6, 2)).add(vec2(U.uTime.mul(0.04), U.uTime.mul(-0.15)))).rgb.sub(0.5);
    const N = normalize(normalWorld.add(detail.mul(fall.mul(0.14).add(0.025)))); const V = normalize(cameraPosition.sub(positionWorld));
    const facing = max(abs(dot(N, V)), 0.02);
    const fresnel = float(0.02).add(pow(float(1).sub(facing), 5).mul(0.98));
    const R = reflect(V.negate(), N);
    const sky = mix(U.uSkyHorizon, U.uSkyZenith, pow(max(R.y, 0), 0.5)).mul(U.uSkyGain);
    const suv = screenCoordinate.xy.div(U.uResolution);
    const refracted = U.uSceneColor.sample(clamp(suv.add(vec2(N.x, N.z).mul(0.002)), vec2(0.001), vec2(0.999))).rgb;
    let chord: THREE.Node = float(0.035); let fraction: THREE.Node = float(1); let coherent: THREE.Node = float(1); let bubbles: THREE.Node = float(0); let interiorLight: THREE.Node = float(1);
    if (!droplets) {
      const acrossAxis = normalize(attribute('envelopeAcross', 'vec3'));
      const thickAxis = normalize(attribute('envelopeThick', 'vec3'));
      const tangent = normalize(cross(acrossAxis, thickAxis));
      const radius = max(attribute('envelopeRadius', 'vec2'), vec2(0.0001));
      const offset = positionWorld.sub(attribute('envelopeCenter', 'vec3'));
      const ray = V.negate();
      // Intersect a finite local ellipsoid, rather than dividing sheet depth
      // by its face angle. Its 2.4 m axial radius represents a mixing region;
      // the transverse bounds come from the actual three-dimensional ring.
      const origin = vec3(dot(offset, acrossAxis).div(radius.x), dot(offset, thickAxis).div(radius.y), dot(offset, tangent).div(2.4));
      const direction = vec3(dot(ray, acrossAxis).div(radius.x), dot(ray, thickAxis).div(radius.y), dot(ray, tangent).div(2.4));
      const A = max(dot(direction, direction), 0.00001); const B = dot(origin, direction);
      const C = dot(origin, origin).sub(1);
      chord = max(0, B.negate().add(sqrt(max(0, B.mul(B).sub(A.mul(C))))).div(A));
      fraction = attribute('liquidFraction', 'float'); coherent = attribute('coherence', 'float');
      // Three interior samples vary unresolved bubble scattering in occupied
      // space. They do not alter the section's accounted liquid fraction.
      // Density advects with emission time and physical transverse meters.
      const scatterAt = (distance: THREE.Node) => {
        const point = offset.add(ray.mul(distance));
        return noise.sample(vec2(dot(point, acrossAxis).mul(0.23).add(dot(point, thickAxis).mul(0.19)),
          uv().y.mul(0.19).add(dot(point, tangent).mul(0.20)))).r;
      };
      const density = scatterAt(chord.mul(0.16)).mul(0.5).add(scatterAt(chord.mul(0.5)).mul(0.3)).add(scatterAt(chord.mul(0.84)).mul(0.2));
      const clump = sin(uv().y.mul(11.2).add(uv().x.mul(1.1))).mul(0.11)
        .add(sin(uv().y.mul(17.3).sub(uv().x.mul(1.7))).mul(0.06));
      bubbles = smoothstep(0.42, 0.66, density.add(clump)).add(0.015);
      // Shadowed interior paths retain gray structure instead of turning
      // skyGain into a uniformly clipped white column. The same finite
      // volume is intersected toward the real scene sun.
      const lightDirection = vec3(dot(U.uSunDir, acrossAxis).div(radius.x), dot(U.uSunDir, thickAxis).div(radius.y), dot(U.uSunDir, tangent).div(2.4));
      const lightA = max(dot(lightDirection, lightDirection), 0.00001);
      const lightB = dot(origin, lightDirection);
      const sunPath = max(0, lightB.negate().add(sqrt(max(0, lightB.mul(lightB).sub(lightA.mul(C))))).div(lightA));
      interiorLight = exp(sunPath.mul(fraction).mul(bubbles).mul(-28));
    }
    const opticalDepth = droplets ? chord : mix(chord.mul(fraction), attribute('liquidDepth', 'float').div(facing), coherent);
    const trans = exp(U.uAbsorbClear.negate().mul(opticalDepth));
    const body = refracted.mul(trans).add(U.uScatterClear.mul(sky).mul(vec3(1).sub(trans)));
    // Effective scattering is a calibrated entrainment approximation. Air
    // broadens occupied volume, but absorption still reads actual liquid
    // path length. Downstream river absorption/Fresnel equations are intact.
    const scattering = chord.mul(fraction).mul(float(1).sub(coherent)).mul(bubbles).mul(28);
    const air = float(1).sub(exp(scattering.negate()));
    const sunFacing = max(dot(N, U.uSunDir), 0);
    const volumeLight = mix(U.uSkyHorizon, U.uSkyZenith, 0.5).mul(U.uSkyGain).mul(0.12)
      .add(U.uSunColor.mul(sunFacing).mul(interiorLight).mul(0.55));
    const color = mix(mix(body, sky, fresnel), volumeLight.mul(vec3(0.80, 0.84, 0.83)), air);
    // Small broken parcels scatter light along their curved edges. This
    // keeps low-flow drips legible without painting an opaque waterfall.
    const scattered = droplets ? mix(color, sky, 0.035) : color;
    // Geometry owns the silhouette and open space. Optical transparency
    // belongs to finite water thickness, rather than holes cut in a sheet.
    const opacity = droplets ? float(1) : mix(max(fresnel.mul(0.22), air), float(1), coherent);
    return vec4(scattered, opacity.mul(smoothstep(pool.sub(0.4), pool.add(0.25), positionWorld.y)));
  })();
  material.side = droplets ? THREE.DoubleSide : THREE.FrontSide; material.transparent = true; material.depthWrite = false; material.name = 'river airborne water';
  return material;
}


/** Dispersed interfaces are a declared approximation in meters. The 1-5 mm
 * bracket is for sensitivity checks, not a measured Yosemite distribution.
 * Coherent crest water is excluded from this droplet cross-section model. */
/** Coherent-only surface proof. FrontSide draws the entry interface once;
 * its local represented thickness accounts for both liquid boundaries, so a
 * second transparent back-interface layer cannot double-count absorption.
 * DEBT: Refraction remains the native screen-space approximation. The local
 * parallel-film chord neglects nonlocal folds and grazing finite-sheet exits.
 * Aeration, breaking droplets and secondary whitewater are not modeled yet. */
/** Local meshed-fog lighting: full extinction controls the rounded fringe;
 * unit-albedo Lambert reflection uses the shared sun/upper-sky radiance.
 * DEBT: This surface closure lacks nonlocal multiple-scattering and cliff
 * visibility. Actual outward geometry owns the large billows and recesses. */
/** Shared compact support drives camera extinction, internal light shadows
 * and its resolved gradient. This is a local diffuse whitewater closure,
 * replacing the previous lighting source rather than adding a white gain.
 * DEBT: It is not an RTE solution; terrain light visibility, nonlocal diffuse
 * transport and fine unresolved drops remain outside this bounded proof. */
function billowVolumeMaterial(U:RiverWaterUniforms,pool:ReturnType<typeof uniform>,state:ReturnType<typeof createBillowState>,aeratedDiagnostic:ReturnType<typeof uniform>,optics:WaterfallVolumeUniforms):THREE.NodeMaterial{
 const material=new THREE.NodeMaterial();const skyIrradiance=texture(getWaterfallSkyIrradianceTexture());
 const field=Fn(([p]:[THREE.Node])=>{
  const inside=p.greaterThanEqual(state.min).all().and(p.lessThanEqual(state.max).all()).and(p.y.greaterThanEqual(pool));
  const value=vec2(0).toVar();If(inside,()=>{value.assign(state.density.sample(p.sub(state.min).div(state.max.sub(state.min))).rg);});return value;
 }).setLayout({name:'waterfallBillowDensity',type:'vec2',inputs:[{name:'point',type:'vec3'}]});
 const safeDirection=(d:THREE.Node)=>mix(vec3(-1),vec3(1),vec3(d.greaterThanEqual(vec3(0)))).mul(max(abs(d),vec3(.000001)));
 // The airborne medium ends at the pool. Clip both camera and light paths
 // there once, so rounded positions cannot repeatedly cross the same plane.
 // Texture coordinates retain the full density grid and its liquid budgets.
 const traversalMin=vec3(state.min.x,max(state.min.y,pool),state.min.z);
 const exit=Fn(([p,d]:[THREE.Node,THREE.Node])=>{
  const a=traversalMin.sub(p).div(safeDirection(d)),b=state.max.sub(p).div(safeDirection(d));const high=max(a,b);return max(0,min(high.x,min(high.y,high.z)));
 }).setLayout({name:'waterfallBillowExit',type:'float',inputs:[{name:'point',type:'vec3'},{name:'direction',type:'vec3'}]});
 const density=(p:THREE.Node)=>{const raw=field(p);return mix(raw.x,mix(float(0),float(.01),float(raw.x.greaterThan(0))),float(aeratedDiagnostic.equal(3)));};
 // Texture interpolation knots are texel centers. Border half-cells clamp
 // to edge values; the pool plane is also a density discontinuity.
 const nextPiece=Fn(([p,d,remaining,maximum]:[THREE.Node,THREE.Node,THREE.Node,THREE.Node])=>{
  const q=p.sub(state.min).div(state.spacing).sub(.5).toVar();
  const positive=floor(q.add(.00001)).add(1),negative=floor(q.negate().add(.00001)).negate().sub(1);
  const index=mix(negative,positive,vec3(d.greaterThanEqual(vec3(0))));
  const crossings=state.min.add(index.add(.5).mul(state.spacing)).sub(p).div(safeDirection(d));
  // Choose valid crossings without blending a huge sentinel with a small
  // distance. GPU interpolation can cancel that distance to zero and trap
  // the ray at the same point until its traversal budget is exhausted.
  const times=vec3(1e20).toVar();
  for(const axis of ['x','y','z'] as const)If(abs(d[axis]).greaterThan(.00000001),()=>{times[axis].assign(max(crossings[axis],.000001));});
  const length=min(remaining,min(maximum,min(times.x,min(times.y,times.z)))).toVar();
  return length;
 }).setLayout({name:'waterfallBillowNextPiece',type:'float',inputs:[{name:'point',type:'vec3'},{name:'direction',type:'vec3'},{name:'remaining',type:'float'},{name:'maximum',type:'float'}]});
 const polynomial=Fn(([p,d,length]:[THREE.Node,THREE.Node,THREE.Node])=>{
  // One-sided pool pieces sample the underlying texture, then use their
  // midpoint to select the pool side. A single positive endpoint at the pool
  // must not create fictitious density throughout the dry-side interval.
  const raw=(point:THREE.Node)=>state.density.sample(clamp(point.sub(state.min).div(state.max.sub(state.min)),vec3(0),vec3(1))).rg;
  const a=raw(p).toVar(),b=raw(p.add(d.mul(length.div(3)))).toVar(),c=raw(p.add(d.mul(length.mul(2/3)))).toVar(),e=raw(p.add(d.mul(length))).toVar();
  const coefficients=(r0:THREE.Node,r1:THREE.Node,r2:THREE.Node,r3:THREE.Node)=>{
   const d1=r1.sub(r0),d2=r2.sub(r1.mul(2)).add(r0),d3=r3.sub(r2.mul(3)).add(r1.mul(3)).sub(r0);
   return vec4(r0,d1.mul(3).sub(d2.mul(1.5)).add(d3),d2.sub(d3).mul(4.5),d3.mul(4.5)).mul(length);
  };
  const rho=(r:THREE.Node)=>mix(r,mix(float(0),float(.01),float(r.greaterThan(0))),float(aeratedDiagnostic.equal(3)));
  const result=mat4(vec4(0),vec4(0),vec4(0),vec4(0)).toVar();If(p.y.add(d.y.mul(length.mul(.5))).greaterThanEqual(pool),()=>{result.assign(mat4(coefficients(rho(a.x),rho(b.x),rho(c.x),rho(e.x)),coefficients(a.y,b.y,c.y,e.y),vec4(0),vec4(0)));});return result;
 }).setLayout({name:'waterfallBillowPolynomial',type:'mat4',inputs:[{name:'point',type:'vec3'},{name:'direction',type:'vec3'},{name:'length',type:'float'}]});
 const cumulative=Fn(([c,t]:[THREE.Node,THREE.Node])=>dot(c,vec4(t,t.mul(t).mul(.5),t.mul(t).mul(t).div(3),pow(t,4).mul(.25))))
  .setLayout({name:'waterfallBillowCumulative',type:'float',inputs:[{name:'coefficients',type:'vec4'},{name:'fraction',type:'float'}]});
 const inverse=Fn(([c,target,k]:[THREE.Node,THREE.Node,THREE.Node])=>{
  const low=float(0).toVar(),high=float(1).toVar(),t=float(.5).toVar();
  Loop({start:0,end:BILLOW_TRANSPORT.inverseIterations,type:'int',condition:'<'},()=>{
   const value=cumulative(c,t).toVar(),localDensity=dot(c,vec4(1,t,t.mul(t),t.mul(t).mul(t))).toVar();If(abs(value.sub(target)).mul(k).lessThanEqual(BILLOW_TRANSPORT.opticalTolerance).and(localDensity.greaterThan(0)),()=>{Break();});If(abs(value.sub(target)).mul(k).greaterThan(BILLOW_TRANSPORT.opticalTolerance).or(localDensity.lessThanEqual(0)),()=>{
    If(value.lessThan(target),()=>{low.assign(t);}).Else(()=>{high.assign(t);});t.assign(low.add(high).mul(.5));
   });
  });return vec2(t,float(abs(cumulative(c,t).sub(target)).mul(k).greaterThan(BILLOW_TRANSPORT.opticalTolerance).or(dot(c,vec4(1,t,t.mul(t),t.mul(t).mul(t))).lessThanEqual(0))));
 }).setLayout({name:'waterfallBillowInverse',type:'vec2',inputs:[{name:'coefficients',type:'vec4'},{name:'liquidDepthTarget',type:'float'},{name:'extinction',type:'float'}]});
 const light=Fn(([p,d,absorption,scattering]:[THREE.Node,THREE.Node,THREE.Node,THREE.Node])=>{
  const length=exit(p,d).toVar(),maximum=length.div(state.lightSamples).toVar(),cursor=float(0).toVar(),pieces=float(0).toVar(),liquid=float(0).toVar(),T=vec3(1).toVar(),k=absorption.add(scattering).toVar();
  Loop({start:0,end:BILLOW_TRANSPORT.maximumIntervals,type:'int',condition:'<'},()=>{
   If(cursor.greaterThanEqual(length).or(max(T.x,max(T.y,T.z)).lessThanEqual(BILLOW_TRANSPORT.negligibleTransmission)),()=>{Break();});
   If(cursor.lessThan(length).and(max(T.x,max(T.y,T.z)).greaterThan(BILLOW_TRANSPORT.negligibleTransmission)),()=>{
    const point=p.add(d.mul(cursor)).toVar(),ds=nextPiece(point,d,length.sub(cursor),maximum).toVar(),c=polynomial(point,d,ds).toVar();
    pieces.addAssign(1);liquid.addAssign(max(cumulative(c[0],float(1)),0));T.assign(exp(k.mul(liquid).negate()));cursor.addAssign(ds);
   });
  });const capped=cursor.lessThan(length.sub(.00001)).and(max(T.x,max(T.y,T.z)).greaterThan(BILLOW_TRANSPORT.negligibleTransmission));return vec4(T,pieces.add(float(capped).mul(512)));
 }).setLayout({name:'waterfallBillowLight',type:'vec4',inputs:[{name:'point',type:'vec3'},{name:'direction',type:'vec3'},{name:'absorption',type:'vec3'},{name:'scattering',type:'float'}]});
 const localDirection=(d:THREE.Node)=>vec3(dot(d,state.forward),d.y,dot(d,state.across));
 const source=Fn(([p,absorption,scattering]:[THREE.Node,THREE.Node,THREE.Node])=>{
  const dx=vec3(state.spacing.x,0,0),dy=vec3(0,state.spacing.y,0),dz=vec3(0,0,state.spacing.z);
  const gradient=vec3(field(p.add(dx)).x.sub(field(p.sub(dx)).x).div(state.spacing.x.mul(2)),field(p.add(dy)).x.sub(field(p.sub(dy)).x).div(state.spacing.y.mul(2)),field(p.add(dz)).x.sub(field(p.sub(dz)).x).div(state.spacing.z.mul(2))).toVar();
  const magnitude=sqrt(dot(gradient,gradient)).toVar(),rho=field(p).x.toVar();
  const scale=rho.div(max(state.spacing.x,max(state.spacing.y,state.spacing.z))).mul(.05).toVar();
  const confidence=dot(gradient,gradient).div(max(dot(gradient,gradient).add(scale.mul(scale)),.000000000001)).toVar();
  // A zero gradient has an isotropic closure, not a camera-facing fake normal.
  const localNormal=gradient.negate().div(max(magnitude,.00000001));
  const N=state.forward.mul(localNormal.x).add(vec3(0,1,0).mul(localNormal.y)).add(state.across.mul(localNormal.z)).toVar();
  const budgetFailure=float(0).toVar(),lightQueries=float(0).toVar(),sunTransmission=vec3(1).toVar();If(state.diagnostic.notEqual(3).and(state.diagnostic.notEqual(4)),()=>{const result=light(p,localDirection(U.uSunDir),absorption,scattering).toVar();sunTransmission.assign(result.xyz);budgetFailure.assign(max(budgetFailure,floor(result.w.div(512))));lightQueries.addAssign(result.w.sub(floor(result.w.div(512)).mul(512)).mul(4));});
  If(state.diagnostic.equal(4),()=>{sunTransmission.assign(vec3(1));});
  const sunCos=mix(float(.25),max(dot(N,U.uSunDir),0),confidence);
  const sun=U.uSunColor.mul(sunTransmission).mul(sunCos).div(Math.PI).toVar();
  const sky=vec3(0).toVar(),skyTransmission=vec3(0).toVar(),weightSum=float(0).toVar();
  // Positive angular weights distribute the exact uniform upper-sky cosine
  // integral. Attenuated directions are never renormalized back to unblocked.
  for(const x of [-1,1])for(const z of [-1,1]){
   const d=vec3(x/Math.sqrt(3),1/Math.sqrt(3),z/Math.sqrt(3));
   const w=mix(float(1),max(dot(N,d),0),confidence).toVar();
   const T=vec3(1).toVar();If(state.diagnostic.notEqual(3).and(state.diagnostic.notEqual(4)),()=>{const result=light(p,localDirection(d),absorption,scattering).toVar();T.assign(result.xyz);budgetFailure.assign(max(budgetFailure,floor(result.w.div(512))));lightQueries.addAssign(result.w.sub(floor(result.w.div(512)).mul(512)).mul(4));});If(state.diagnostic.equal(4),()=>{T.assign(vec3(1));});
   skyTransmission.addAssign(T.mul(w));weightSum.addAssign(w);
  }
  const table=skyIrradiance.sample(vec2(clamp(N.y.add(1).mul(.5),0,1),.5)).rg;
  const boundary=U.uSkyHorizon.mul(table.x).add(U.uSkyZenith.sub(U.uSkyHorizon).mul(table.y));
  const isotropic=U.uSkyHorizon.mul(.5).add(U.uSkyZenith.sub(U.uSkyHorizon).div(3));
  skyTransmission.divAssign(max(weightSum,.000001));
  sky.assign(mix(isotropic,boundary,confidence).mul(U.uSkyGain).mul(skyTransmission));
  return mat4(vec4(sky.add(sun),confidence),vec4(sunTransmission,1),vec4(skyTransmission,1),vec4(budgetFailure,lightQueries,0,0));
 }).setLayout({name:'waterfallBillowSource',type:'mat4',inputs:[{name:'point',type:'vec3'},{name:'absorption',type:'vec3'},{name:'scattering',type:'float'}]});
 material.fragmentNode=Fn(()=>{
  If(pool.greaterThanEqual(state.max.y),()=>{Discard();});
  const worldRay=normalize(positionWorld.sub(cameraPosition)),ray=localDirection(worldRay).toVar();
  const offset=cameraPosition.sub(state.origin),origin=vec3(dot(offset,state.forward),cameraPosition.y,dot(offset,state.across)).toVar();
  const a=traversalMin.sub(origin).div(safeDirection(ray)),b=state.max.sub(origin).div(safeDirection(ray)),low=min(a,b),high=max(a,b);
  const near=max(0,max(low.x,max(low.y,low.z))).toVar();
  // Opaque native depth bounds the medium; the transparent proxy itself never
  // writes depth, and every occupied interval before that depth is marched.
  const depth=U.uSceneDepth.sample(ivec2(screenCoordinate.xy)).setSampler(false);
  const viewZ=perspectiveDepthToViewZ(depth,U.uNear,U.uFar),rayView=cameraViewMatrix.mul(vec4(worldRay,0)).z;
  const opaqueDistance=viewZ.div(min(rayView,-.000001));
  const far=min(opaqueDistance,min(high.x,min(high.y,high.z))).toVar();If(far.lessThanEqual(near),()=>{Discard();});
  const maximum=far.sub(near).div(state.cameraSamples).toVar(),cursor=near.toVar(),transmission=vec3(1).toVar(),radiance=vec3(0).toVar(),tau=vec3(0).toVar();
  const absorption=max(U.uAbsorbClear,vec3(0)).mul(optics.absorptionScale).toVar();
  const scattering=float(3*WATERFALL_OPTICS.efficiency/4).div(max(optics.interfaceRadius,.000001)).mul(optics.scatteringScale).toVar(),k=absorption.add(scattering).toVar(),reference=max(k.x,max(k.y,k.z)).toVar();
  const liquid=float(0).toVar(),transfer=float(0).toVar(),budgetFailure=float(0).toVar(),cameraPieces=float(0).toVar(),sourceCalls=float(0).toVar(),lightQueries=float(0).toVar();
  const diagnosticWeight=float(0).toVar(),sunMeasure=float(0).toVar(),skyMeasure=float(0).toVar(),confidenceMeasure=float(0).toVar();
  const fullPath=aeratedDiagnostic.equal(1).or(aeratedDiagnostic.equal(2)).or(state.diagnostic.equal(1));
  Loop({start:0,end:BILLOW_TRANSPORT.maximumIntervals,type:'int',condition:'<'},()=>{
   If(cursor.greaterThanEqual(far).or(fullPath.not().and(max(transmission.x,max(transmission.y,transmission.z)).lessThanEqual(BILLOW_TRANSPORT.negligibleTransmission))),()=>{Break();});
   If(cursor.lessThan(far).and(fullPath.or(max(transmission.x,max(transmission.y,transmission.z)).greaterThan(BILLOW_TRANSPORT.negligibleTransmission))),()=>{
    const point=origin.add(ray.mul(cursor)).toVar(),ds=nextPiece(point,ray,far.sub(cursor),maximum).toVar(),c=polynomial(point,ray,ds).toVar();
    cameraPieces.addAssign(1);const depth=max(cumulative(c[0],float(1)),0).toVar();liquid.addAssign(depth);transfer.addAssign(max(cumulative(c[1],float(1)),0));tau.addAssign(k.mul(depth));
    const optical=reference.mul(depth).toVar(),A=float(1).sub(exp(optical.negate())).toVar();
    If(optical.lessThan(.001),()=>{A.assign(optical.mul(float(1).sub(optical.mul(.5)).add(optical.mul(optical).div(6))));});
    If(aeratedDiagnostic.equal(0).or(aeratedDiagnostic.greaterThanEqual(3)).and(state.diagnostic.notEqual(1)).and(scattering.greaterThan(0)).and(A.mul(max(transmission.x,max(transmission.y,transmission.z))).greaterThan(.000001)),()=>{
     // Gauss nodes sample the cumulative collision probability. They use the
     // actual heterogeneous integral; no homogeneous source point can leave
     // the represented support. Full RGB importance weights include sigmaS
     // exactly once and do not add this source to an all-order slab source.
     Loop({start:0,end:state.eventSamples,type:'int',condition:'<'},({i})=>{
      const u=float(0).toVar(),quadrature=float(0).toVar();
      If(state.eventSamples.equal(2),()=>{u.assign(mix(.21132486540518713,.7886751345948129,float(i.greaterThan(0))));quadrature.assign(.5);}).Else(()=>{
       for(const [j,abscissa,weight]of [[0,.06943184420297371,.1739274225687269],[1,.33000947820757187,.3260725774312731],[2,.6699905217924281,.3260725774312731],[3,.9305681557970262,.1739274225687269]])If(i.equal(j),()=>{u.assign(abscissa);quadrature.assign(weight);});
      });
      const target=log(float(1).sub(u.mul(A))).negate().div(max(reference,.000000001)).toVar();If(optical.lessThan(.0001),()=>{target.assign(u.mul(depth));});
      const resolved=inverse(c[0],target,reference).toVar(),event=point.add(ray.mul(ds.mul(resolved.x))).toVar();budgetFailure.assign(max(budgetFailure,resolved.y));
      const weight=transmission.mul(A).mul(scattering.div(max(reference,.000000001))).mul(exp(vec3(reference).sub(k).mul(target))).mul(quadrature).toVar();
      const illumination=source(event,absorption,scattering).toVar();sourceCalls.addAssign(1);lightQueries.addAssign(illumination[3].y);budgetFailure.assign(max(budgetFailure,illumination[3].x));radiance.addAssign(weight.mul(illumination[0].xyz));
      const w=weight.x.add(weight.y).add(weight.z).div(3).toVar();diagnosticWeight.addAssign(w);sunMeasure.addAssign(w.mul(illumination[1].x.add(illumination[1].y).add(illumination[1].z).div(3)));skyMeasure.addAssign(w.mul(illumination[2].x.add(illumination[2].y).add(illumination[2].z).div(3)));confidenceMeasure.addAssign(w.mul(illumination[0].w));
     });
    });transmission.mulAssign(exp(k.mul(depth).negate()));cursor.addAssign(ds);
   });
  });
  If(cursor.lessThan(far.sub(.00001)).and(fullPath.or(max(transmission.x,max(transmission.y,transmission.z)).greaterThan(BILLOW_TRANSPORT.negligibleTransmission))),()=>{budgetFailure.assign(1);});
  const alpha=float(1).sub(transmission.x.add(transmission.y).add(transmission.z).div(3)).toVar();
  const output=vec4(radiance.div(max(alpha,.000001)),alpha).toVar();
  If(aeratedDiagnostic.equal(1),()=>{output.assign(vec4(vec3(transfer.div(max(liquid,.000000001))),float(liquid.greaterThan(0))));});
  If(aeratedDiagnostic.equal(2),()=>{output.assign(vec4(vec3(liquid.div(max(far.sub(near),.000001))),float(liquid.greaterThan(0))));});
  If(state.diagnostic.equal(1),()=>{output.assign(vec4(tau.div(tau.add(1)),float(liquid.greaterThan(0))));});
  If(state.diagnostic.equal(2),()=>{output.assign(vec4(sunMeasure.div(max(diagnosticWeight,.000001)),skyMeasure.div(max(diagnosticWeight,.000001)),confidenceMeasure.div(max(diagnosticWeight,.000001)),alpha));});
  If(state.diagnostic.equal(3),()=>{output.assign(vec4(vec3(confidenceMeasure.div(max(diagnosticWeight,.000001))),alpha));});If(state.diagnostic.equal(5),()=>{output.assign(vec4(cameraPieces.div(64),sourceCalls.div(16),lightQueries.div(1024),1));});If(budgetFailure.greaterThan(0),()=>{output.assign(vec4(1,0,1,1));});return output;
 })();material.side=THREE.FrontSide;material.transparent=true;material.depthWrite=false;material.name='diagnostic matched billow volume';return material;
}
function createBillowState(){const textureValue=new THREE.Data3DTexture(new Uint16Array(4),1,1,1);textureValue.type=THREE.HalfFloatType;textureValue.format=THREE.RGBAFormat;textureValue.minFilter=THREE.LinearFilter;textureValue.magFilter=THREE.LinearFilter;textureValue.generateMipmaps=false;textureValue.needsUpdate=true;return {texture:textureValue,density:texture3D(textureValue),min:uniform(new THREE.Vector3()),max:uniform(new THREE.Vector3(1,1,1)),spacing:uniform(new THREE.Vector3(1,1,1)),origin:uniform(new THREE.Vector3()),forward:uniform(new THREE.Vector3(1,0,0)),across:uniform(new THREE.Vector3(0,0,1)),cameraSamples:uniform(24,'int'),lightSamples:uniform(16,'int'),eventSamples:uniform(2,'int'),diagnostic:uniform(0)};}

function aeratedSheetMaterial(U:RiverWaterUniforms,pool:ReturnType<typeof uniform>,diagnostic:ReturnType<typeof uniform>):THREE.NodeMaterial{
 const material=new THREE.NodeMaterial();const noise=texture(getRiverNoiseTexture());
 material.fragmentNode=Fn(()=>{
  const label=attribute('aeratedLabel','vec2');
  const detail=noise.sample(label.mul(vec2(.7,3.2))).rgb.sub(.5);
  const N=normalize(normalWorld.add(detail.mul(.16))),V=normalize(cameraPosition.sub(positionWorld));
  const localPhi=attribute('aeratedFraction','float');
  const phi=mix(localPhi,float(.01),float(diagnostic.equal(3)));
  const sigmaS=phi.mul(500),sigmaA=max(U.uAbsorbClear,vec3(0)).mul(phi),sigmaT=sigmaA.add(sigmaS);
  const chord=attribute('aeratedRadius','float').mul(2).mul(max(dot(N,V),0));
  const T=exp(sigmaT.mul(chord).negate()),albedo=vec3(sigmaS).div(max(sigmaT,vec3(.000001)));
  const sky=mix(U.uSkyHorizon,U.uSkyZenith,.5).mul(U.uSkyGain).mul(clamp(N.y.add(1).mul(.5),0,1));
  const sun=U.uSunColor.mul(max(dot(N,U.uSunDir),0)).div(Math.PI);
  const R=vec3(1).sub(T).mul(albedo);
  const alpha=max(R.x,max(R.y,R.z));
  // Raw attribution has no alpha/discard threshold; the normal proof keeps
  // its existing extinction, shade and pool fade exactly.
  If(diagnostic.equal(0).or(diagnostic.greaterThanEqual(3)),()=>{If(alpha.lessThan(.00001),()=>{Discard();});});
  const output=vec4(sky.add(sun).mul(R).div(max(alpha,.000001)),alpha.mul(smoothstep(pool.sub(.4),pool.add(.25),positionWorld.y))).toVar();
  If(diagnostic.equal(1),()=>{output.assign(vec4(vec3(attribute('aeratedTransfer','float')),1));});
  If(diagnostic.equal(2),()=>{output.assign(vec4(vec3(localPhi),1));});
  return output;
 })();material.side=THREE.FrontSide;material.transparent=true;material.depthWrite=true;material.name='diagnostic connected aerated material';return material;
}

/** The experimental spill reuses these native liquid optics with per-section axes. */
export function materialSheetMaterial(U:RiverWaterUniforms,pool:ReturnType<typeof uniform>,width:ReturnType<typeof uniform>,across:ReturnType<typeof uniform>,perSectionAcross=false,unitSectionCoordinates=false):THREE.NodeMaterial{
  const material=new THREE.NodeMaterial();
  material.fragmentNode=Fn(()=>{
    const B=normalize(attribute('materialPlane','vec3'));
    let N=normalize(normalWorld);
    if(unitSectionCoordinates){
      // The sheared unit prism needs the dual basis, not Three's instance
      // shortcut for perpendicular columns. These axes are world-space,
      // as are the existing optical gradients and emitted packet positions.
      const P=normalize(attribute('materialAcross','vec3')),T=normalize(cross(P,B));
      const raw=attribute('normal','vec3'),shear=attribute('materialShear','float');
      const axial=normalize(T.sub(P.mul(shear)));
      N=normalize(P.mul(raw.x).add(B.mul(raw.y)).add(axial.mul(raw.z)));
    }
    const V=normalize(cameraPosition.sub(positionWorld)),facing=max(abs(dot(N,V)),.03);
    const rawCoordinate=attribute('materialCoordinate','vec2'),thickness=attribute('materialThickness','float'),sectionWidth=attribute('materialWidth','float');
    // Unit-box instances carry section dimensions once per packet; the
    // expanded native sheet already supplies these physical coordinates.
    const coordinate=unitSectionCoordinates?rawCoordinate.mul(vec2(sectionWidth,thickness)):rawCoordinate;
    const sectionAcross=perSectionAcross?attribute('materialAcross','vec3'):across;
    const rayB=dot(V.negate(),attribute('materialDepthGradient','vec3')),rayA=dot(V.negate(),sectionAcross);
    const signedSafe=(direction:THREE.Node)=>mix(-1,1,float(direction.greaterThanEqual(0))).mul(max(abs(direction),.000001));
    const thicknessRay=dot(V.negate(),attribute('materialThicknessGradient','vec3'));
    const upperRate=rayB.sub(thicknessRay.mul(.5)),lowerRate=rayB.add(thicknessRay.mul(.5));
    const upperExit=mix(float(1e8),thickness.mul(.5).sub(coordinate.y).div(max(upperRate,.00000001)),float(upperRate.greaterThan(.00000001)));
    const lowerExit=mix(float(1e8),thickness.mul(-.5).sub(coordinate.y).div(min(lowerRate,-.00000001)),float(lowerRate.lessThan(-.00000001)));
    const depthExit=min(upperExit,lowerExit);
    const acrossExit=mix(sectionWidth.mul(-.5),sectionWidth.mul(.5),float(rayA.greaterThanEqual(0))).sub(coordinate.x).div(signedSafe(rayA));
    // Local finite section-prism exit also handles side faces with N·B=0.
    // DEBT: This local chord neglects changes of the folded centerline along
    // the ray and the axial end caps; it is not exact mesh ray intersection.
    const path=max(0,min(depthExit,acrossExit));
    const f0=Math.pow((1.333-1)/(1.333+1),2);
    const F=float(f0).add(pow(float(1).sub(facing),5).mul(1-f0));
    const R=reflect(V.negate(),N);
    const sky=mix(U.uSkyHorizon,U.uSkyZenith,pow(max(R.y,0),.5)).mul(U.uSkyGain);
    const screen=screenCoordinate.xy.div(U.uResolution);
    const refracted=U.uSceneColor.sample(clamp(screen.add(vec2(N.x,N.z).mul(.002)),vec2(.001),vec2(.999))).rgb;
    const T=exp(max(U.uAbsorbClear,vec3(0)).mul(path).negate());
    // Pure liquid has boundary reflection and absorption, not droplet-volume
    // scattering or a white source proportional to developed liquid.
    const color=refracted.mul(T).mul(float(1).sub(F)).add(sky.mul(F));
    return vec4(color,smoothstep(pool.sub(.4),pool.add(.25),positionWorld.y));
  })();
  material.side=THREE.FrontSide;material.transparent=true;material.depthWrite=true;material.name='diagnostic coherent emitted material sheet';return material;
}

const WATERFALL_OPTICS = { radiusM: 0.003, minRadiusM: 0.001, maxRadiusM: 0.005, efficiency: 2, g: 0.75, skyRows: 65 } as const;


// Optical functions extracted to riverWaterfallOptics.ts (agora-e9e1 split)
// Includes: waterfallInterfaceNormal, waterfallOpticalSegment, waterfallTwoStream,
// waterfallSkyIrradiance, waterfallSkyBasis, getWaterfallSkyIrradianceTexture

/** The visible mesh supplies the entry surface only. Every optical sample
 * is tested against the same swept section used to build that mesh. The ray
 * ends at its world bounds; empty space contributes no absorption or light.
 * This avoids a separate local ellipsoid, sheet-angle thickness, or an
 * arbitrary axial mixing region. Camera samples, four sunlight samples
 * and six sky samples bound cost. Connected advected ribbons redistribute
 * each section's liquid inside the same prescribed falling envelope. */
/** Both the visible body and disposable Cartesian probe use these exact
 * section/atlas expressions. Local shader variables belong to each function
 * invocation; a proof export never substitutes a CPU density approximation. */
// These scalar and vector types are already fixed by the density equations.
// Explicit shader locals stop the r172 builder from recursively inferring the
// same long expression types at every use. Values and operation order stay
// unchanged; this only bounds shader construction work on the CPU.
function waterfallLocal(value: THREE.Node, type: 'float' | 'vec3' | 'mat4'): THREE.Node {
  const local = property(type); local.assign(value); return local;
}
function createWaterfallDensityFunctions(U: RiverWaterUniforms, state: WaterfallVolumeUniforms) {
  const noise = texture3D(getWaterfallDensityTexture());
  const historicalRates = texture(state.sourceRates);
  const atlasFirst = texture3D(state.atlasFirst); const atlasSecond = texture3D(state.atlasSecond);
  // Compile the emission envelope once. A plain JavaScript helper expanded
  // its branch and cubic derivatives in every Newton step and field function.
  // This bounds that suspected compile-cost source; native first-frame proof
  // is still needed to establish whether it resolves the observed stall.
  const floodLaunchFn = Fn(([age]: [THREE.Node]) => {
    const q = waterfallLocal(state.flux.mul(state.width), 'float');
    const speed = waterfallLocal(state.speed, 'float'); const ageDerivative = waterfallLocal(float(0), 'float');
    If(state.floodEnabled.greaterThan(0), () => {
      const emission = waterfallLocal(state.floodTime.sub(age.mul(state.floodAgeScale)), 'float');
      const elapsed = waterfallLocal(emission.sub(state.floodStart), 'float');
      const rise = waterfallLocal(state.floodDuration.mul(.2), 'float'); const fall = waterfallLocal(state.floodDuration.mul(.4), 'float');
      const r = waterfallLocal(clamp(elapsed.div(rise),0,1), 'float');
      const f = waterfallLocal(clamp(elapsed.sub(state.floodDuration.mul(.6)).div(fall),0,1), 'float');
      const c = waterfallLocal(clamp(emission.sub(state.floodCancel).div(state.floodCancelDuration),0,1), 'float');
      const cubic = (x: THREE.Node) => x.mul(x).mul(float(3).sub(x.mul(2)));
      const canceled = waterfallLocal(float(emission.greaterThanEqual(state.floodCancel)), 'float');
      const extra = waterfallLocal(mix(state.floodExtra.mul(cubic(r).sub(cubic(f))),state.floodCancelExtra.mul(float(1).sub(cubic(c))),canceled), 'float');
      const derivative = waterfallLocal(mix(state.floodExtra.mul(r.mul(float(1).sub(r)).mul(6).div(rise).sub(f.mul(float(1).sub(f)).mul(6).div(fall))),
        state.floodCancelExtra.mul(c).mul(float(1).sub(c)).mul(-6).div(state.floodCancelDuration),canceled), 'float');
      q.assign(state.floodBase.add(extra)); speed.assign(q.div(state.width.mul(state.depth)));
      ageDerivative.assign(derivative.mul(state.floodAgeScale).negate().div(state.width.mul(state.depth)));
    });
    If(state.sourceHistoryEnabled.greaterThan(0), () => {
      const rate = historicalRates.sample(vec2(age.div(WATERFALL_ATLAS.maxAge).mul(1023 / 1024).add(.5 / 1024), .5));
      q.assign(rate.x); speed.assign(q.div(state.width.mul(state.depth))); ageDerivative.assign(rate.y);
    });
    return vec3(q,speed,ageDerivative);
  }).setLayout({ name: 'waterfallFloodLaunch', type: 'vec3', inputs: [{ name: 'age', type: 'float' }] });
  const floodAt = (age: THREE.Node) => {
    // One local call result serves all three components; it is evaluated
    // afresh after each Newton age update, without duplicating the sampler.
    const sample = waterfallLocal(floodLaunchFn(age), 'vec3');
    return { q: sample.x, speed: sample.y, derivative: sample.z };
  };
  // Recover the section perpendicular to the falling velocity. Three
  // Newton steps solve the physical section plane on the accepted curve.
  // The center-depth adjustment matches waterfallLiquidPoint at the lip.
  const fieldFn = Fn(([world]: [THREE.Node]) => {

    const relative = waterfallLocal(world.sub(state.crest), 'vec3');
    const forward = waterfallLocal(dot(relative, state.forward), 'float');
    const across = waterfallLocal(dot(relative, state.across), 'float');
    const age = waterfallLocal(clamp(sqrt(max(0, state.top.sub(world.y).mul(2 / WATERFALL.gravity))), 0, state.flight), 'float');
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const launch = floodAt(age);
      const lip = waterfallLocal(exp(age.mul(age).mul(-6)), 'float');
      const centerY = waterfallLocal(state.top.sub(state.depth.mul(0.5).mul(lip)).sub(age.mul(age).mul(0.5 * WATERFALL.gravity)), 'float');
      const dy = waterfallLocal(state.depth.mul(6).mul(age).mul(lip).sub(age.mul(WATERFALL.gravity)), 'float');
      // The ring plane follows physical velocity, even while its center
      // settles from the opening midpoint into the ballistic trajectory.
      const gradient = waterfallLocal(launch.speed.mul(launch.speed.mul(age).sub(forward)).add(age.mul(WATERFALL.gravity).mul(world.y.sub(centerY))), 'float');
      const curvature = waterfallLocal(max(0.00001, launch.speed.mul(launch.speed).add(launch.derivative.mul(launch.speed.mul(age).mul(2).sub(forward))).add(world.y.sub(centerY).mul(WATERFALL.gravity)).sub(age.mul(WATERFALL.gravity).mul(dy))), 'float');
      age.assign(clamp(age.sub(gradient.div(curvature)), 0, state.flight));
    }
    const launch = floodAt(age); const q = launch.q;
    // Air and clear-crest reflection require water admitted at this age.
    // Older wet rows remain present after a gate closes at the current lip.
    const admitted = waterfallLocal(float(q.greaterThan(0)), 'float');
    const strength = sqrt(clamp(q.div(max(state.width.mul(.8),.00001)),0,1));
    const speed = waterfallLocal(sqrt(launch.speed.mul(launch.speed).add(age.mul(age).mul(WATERFALL.gravity * WATERFALL.gravity))), 'float');
    const developed = waterfallLocal(float(1).sub(exp(age.mul(age).mul(strength.mul(1.2).sub(2.5)))), 'float');
    // Match the actual mesh's distance-based spread so optical occupancy
    // follows the same water envelope. This fixes their disagreement; the
    // body's ribbon structure and final appearance still need rendered proof.
    const fallenM = age.mul(age).mul(0.5 * WATERFALL.gravity);
    const width = waterfallLocal(state.width.mul(float(1).sub(developed)).add(state.width.mul(float(0.18).add(strength.mul(0.82))).add(fallenM.mul(2 * JET_SPREAD).mul(strength)).mul(developed)).mul(admitted), 'float');
    const centerDerivative = state.depth.mul(6).mul(age).mul(exp(age.mul(age).mul(-6))).sub(age.mul(WATERFALL.gravity));
    const jacobian = launch.speed.mul(launch.speed.add(age.mul(launch.derivative)))
      .sub(age.mul(WATERFALL.gravity).mul(centerDerivative)).div(max(speed,.00001));
    const nativeArea=q.div(max(speed,.00001));
    const transientArea=mix(nativeArea,q.mul(state.floodAgeScale).div(max(jacobian,.00001)),float(jacobian.greaterThan(.00001)));
    const area = waterfallLocal(mix(nativeArea,transientArea,state.floodEnabled), 'float');
    const rawThickness = waterfallLocal(area.div(max(width, 0.00001)).add(developed.mul(float(0.12).add(sqrt(max(0, q.div(max(state.width, 0.00001)))).mul(0.32))).mul(sqrt(age)))
      .add(developed.mul(state.width).mul(strength).mul(0.32).mul(float(1).sub(exp(age.mul(-0.8))))).mul(admitted), 'float');
    // The polygon's exact area is quadratic in the square-to-circle mix.
    // These coefficients are measured once from the same 48 ring vertices.
    const remainder = waterfallLocal(float(1).sub(developed), 'float');
    const factor = waterfallLocal(remainder.mul(remainder).mul(SECTION_AREA_COEFFICIENTS[0])
      .add(developed.mul(remainder).mul(SECTION_AREA_COEFFICIENTS[1]))
      .add(developed.mul(developed).mul(SECTION_AREA_COEFFICIENTS[2])), 'float');
    const thickness = waterfallLocal(max(rawThickness, area.mul(4).div(max(width.mul(factor), 0.00001))), 'float');
    const centerY = waterfallLocal(state.top.sub(state.depth.mul(0.5).mul(exp(age.mul(age).mul(-6)))).sub(age.mul(age).mul(0.5 * WATERFALL.gravity)), 'float');
    const thick = waterfallLocal(forward.sub(launch.speed.mul(age)).mul(age.mul(WATERFALL.gravity)).add(world.y.sub(centerY).mul(launch.speed)).div(max(speed, 0.00001)), 'float');
    // An area-preserving transverse map moves the occupied boundary, not
    // just its optical texture. Emission labels advect with falling water;
    // their stochastic values stay fixed along a material trajectory.
    const travel = waterfallLocal(mix(U.uTime.sub(age),state.floodTime.sub(age.mul(state.floodAgeScale)),state.floodEnabled).mul(6), 'float');
    const morphAt = (x: THREE.Node, offset: number) => noise.sample(vec3(x.mul(7).add(offset), travel.mul(0.17).add(offset * 0.37), travel).div(WATERFALL_DENSITY_SIZE)).r;
    const stretch = waterfallLocal(float(1).add(developed.mul(morphAt(float(0), 17).sub(0.5)).mul(0.6)), 'float');
    const shiftAcross = waterfallLocal(developed.mul(width).mul(morphAt(float(0), 39).sub(0.5)).mul(0.24), 'float');
    // The native wet cliff is recessed to forward=-3.8m. Turbulent
    // depth displacement uses only available clearance, leaving 0.2m.
    // This bounds transverse deformation; it neither removes liquid nor
    // moves the accepted ballistic centerline away from an obstacle.
    const clearance = waterfallLocal(launch.speed.mul(age).add(3.6).div(max(age.mul(WATERFALL.gravity).div(max(speed, 0.00001)), 0.00001)), 'float');
    const depthBudget = waterfallLocal(clamp(clearance.sub(thickness.div(stretch.mul(2))).div(max(developed.mul(thickness).mul(2.25), 0.00001)), 0, 1), 'float');
    const shiftDepth = waterfallLocal(developed.mul(thickness).mul(morphAt(float(0), 61).sub(0.5)).mul(0.45).mul(depthBudget), 'float');
    const mappedAcross=waterfallLocal(across, 'float');const mappedThick=waterfallLocal(thick, 'float');
    // Proof-only secondary shear: recover old physical depth/across BEFORE
    // the existing inverse. Fixed edge/knot splits use these same four
    // depth bands, preserving polygon area without renormalizing density.
    If(state.secondaryDeformation.greaterThan(0),()=>{
      const growth=waterfallLocal(developed.mul(float(1).sub(exp(age.mul(age).negate()))), 'float');
      const emission=waterfallLocal(mix(U.uTime.sub(age),state.floodTime.sub(age.mul(state.floodAgeScale)),state.floodEnabled), 'float');
      const secondaryAt=(offset:number)=>noise.sample(vec3(age.mul(age).mul(.5*WATERFALL.gravity).div(WATERFALL_SECONDARY.axialCellM).add(offset),emission.mul(.75).add(offset*.37),age.mul(.55).add(emission.mul(.25))).div(WATERFALL_DENSITY_SIZE)).r;
      const scale=waterfallLocal(float(1).add(growth.mul(WATERFALL_SECONDARY.scale).mul(secondaryAt(107))), 'float');
      const oldThick=waterfallLocal(thick.mul(scale), 'float');const z=waterfallLocal(clamp(oldThick.div(max(thickness.mul(1.5),.00000001)),-1,1), 'float');
      const amplitude=waterfallLocal(width.mul(WATERFALL_SECONDARY.amplitude).mul(growth), 'float');
      const a=waterfallLocal(secondaryAt(113).sub(.5).mul(2).mul(amplitude), 'float');
      const b=waterfallLocal(secondaryAt(127).sub(.5).mul(2).mul(amplitude), 'float');
      const c=waterfallLocal(secondaryAt(139).sub(.5).mul(2).mul(amplitude), 'float');
      const offset=waterfallLocal(mix(float(0),a,clamp(z.add(1).mul(2),0,1)), 'float');
      offset.assign(mix(offset,b,clamp(z.add(.5).mul(2),0,1)));
      offset.assign(mix(offset,c,clamp(z.mul(2),0,1)));
      offset.assign(mix(offset,float(0),clamp(z.sub(.5).mul(2),0,1)));
      mappedThick.assign(oldThick);mappedAcross.assign(across.sub(offset).div(scale));
    });
    const canonicalAcross = waterfallLocal(mappedAcross.sub(shiftAcross).div(stretch), 'float');
    const px = waterfallLocal(canonicalAcross.div(max(width.mul(0.5), 0.00001)), 'float');
    // The shear is linear between the actual ring's x coordinates. Its
    // inverse therefore agrees with every straight polygon edge exactly.
    const lo = waterfallLocal(float(0), 'float'); const hi = waterfallLocal(float(FALL_RING / 2), 'float');
    const ringX = (index: THREE.Node) => {
      const angle = waterfallLocal(index.mul(2 * Math.PI / FALL_RING), 'float');
      return cos(angle).mul(float(1).sub(developed).div(max(abs(cos(angle)), abs(sin(angle)))).add(developed));
    };
    for (let search = 0; search < 5; search += 1) {
      const middle = waterfallLocal(floor(lo.add(hi).mul(0.5)), 'float');
      const left = waterfallLocal(float(px.lessThan(ringX(middle))), 'float');
      lo.assign(mix(lo, middle, left)); hi.assign(mix(middle, hi, left));
    }
    const x0 = waterfallLocal(ringX(lo), 'float'); const x1 = waterfallLocal(ringX(hi), 'float');
    const along = waterfallLocal(clamp(x0.sub(px).div(max(x0.sub(x1), 0.00001)), 0, 1), 'float');
    const shear = waterfallLocal(mix(morphAt(x0, 83), morphAt(x1, 83), along).sub(0.5).mul(developed).mul(thickness).mul(0.9).mul(depthBudget), 'float');
    const canonicalThick = waterfallLocal(mappedThick.sub(shiftDepth).sub(shear).mul(stretch), 'float');
    const py = waterfallLocal(canonicalThick.div(max(thickness.mul(0.5), 0.00001)), 'float');
    const radial = waterfallLocal(sqrt(px.mul(px).add(py.mul(py))), 'float');
    // Use the actual 48-sided polygon rather than an enclosing analytic
    // circle. Its radial edge is the intersection with the adjacent ring
    // vertices, so the optical outline agrees with the rendered mesh.
    // Three r172's two-argument atan preserves the old y/x angle without its deprecated alias warning.
    const angle = waterfallLocal(atan(py, px), 'float'); const sector = 2 * Math.PI / FALL_RING;
    const angle0 = waterfallLocal(floor(angle.div(sector)).mul(sector), 'float'); const angle1 = waterfallLocal(angle0.add(sector), 'float');
    const r0 = waterfallLocal(remainder.div(max(abs(cos(angle0)), abs(sin(angle0)))).add(developed), 'float');
    const r1 = waterfallLocal(remainder.div(max(abs(cos(angle1)), abs(sin(angle1)))).add(developed), 'float');
    const edgeX = waterfallLocal(r1.mul(cos(angle1)).sub(r0.mul(cos(angle0))), 'float');
    const edgeY = waterfallLocal(r1.mul(sin(angle1)).sub(r0.mul(sin(angle0))), 'float');
    const boundary = waterfallLocal(r0.mul(r1).mul(Math.sin(sector)).div(max(0.00001, cos(angle).mul(edgeY).sub(sin(angle).mul(edgeX)))), 'float');
    const fraction = waterfallLocal(clamp(area.mul(4).div(max(width.mul(thickness).mul(factor), 0.00001)), 0, 1), 'float');
    // Pure launch water fills its section. Only available entrained-air
    // space permits soft edges and clump concentration downstream.
    const edgeWidth = waterfallLocal(min(developed.mul(0.4), float(1).sub(fraction).mul(0.5)), 'float');
    const edgeMean = waterfallLocal(float(1).sub(edgeWidth).add(edgeWidth.mul(edgeWidth).mul(0.3)), 'float');
    const occupied = waterfallLocal(mix(float(radial.lessThanEqual(boundary)),
      float(1).sub(smoothstep(boundary.mul(float(1).sub(max(edgeWidth, 0.00001))), boundary, radial)), float(edgeWidth.greaterThan(0))), 'float');
    // End planes are perpendicular to the real launch and impact velocity.
    const tangent = waterfallLocal(forward.sub(launch.speed.mul(age)).mul(launch.speed).sub(world.y.sub(centerY).mul(age.mul(WATERFALL.gravity))).div(max(speed, 0.00001)), 'float');
    const end = waterfallLocal(smoothstep(-0.08, 0.02, age.add(tangent.div(max(speed, 0.00001))))
      .mul(float(1).sub(smoothstep(state.flight.sub(0.02), state.flight.add(0.08), age.add(tangent.div(max(speed, 0.00001)))))), 'float');
    return mat4(vec4(age,px,py,occupied.mul(admitted).mul(end).mul(mix(float(1),float(world.y.greaterThanEqual(state.pool)),state.floodEnabled))),
      vec4(fraction,developed,edgeMean,launch.speed),vec4(width,thickness,stretch,0),vec4(0));
  }).setLayout({ name: 'waterfallVolumeField', type: 'mat4', inputs: [{ name: 'world', type: 'vec3' }] });
  // Occupancy, density and the clear-crest sample share ONE compiled section
  // solver. Packing its results and existing local dimensions avoids duplicating the Newton,
  // flood and morphology graph, without adding atlas reads to exit bisections.
  // Matrix columns only pack those scalars; no matrix transform is applied.
  const fieldAt = (world: THREE.Node) => {
    const field = waterfallLocal(fieldFn(world), 'mat4');
    const coordinates = field.element(int(0)); const properties = field.element(int(1)); const dimensions=field.element(int(2));
    return { age: coordinates.x, px: coordinates.y, py: coordinates.z,
      occupied: coordinates.w, fraction: properties.x, developed: properties.y,
      edgeMean: properties.z, launchSpeed: properties.w, width: dimensions.x, thickness: dimensions.y, stretch: dimensions.z };
  };

  const densityAt = (field: ReturnType<typeof fieldAt>) => {
    // Two mass-normalized snapshots advect finite connected ribbons. Their
    // whole-section budget permits real air gaps and uneven columns; no
    // mirrored point pair dictates the central column's liquid thickness.
    const atlasPosition = vec3(field.px.mul(0.5).add(0.5), field.py.mul(0.5).add(0.5),
      field.age.div(WATERFALL_ATLAS.maxAge).mul(state.atlasAges.sub(1).div(state.atlasAges))
        .add(float(0.5).div(state.atlasAges)));
    const redistributed = mix(atlasFirst.sample(atlasPosition).r, atlasSecond.sample(atlasPosition).r, state.atlasBlend);
    const clumps = mix(redistributed, float(1), state.diagnostic);
    return field.fraction.mul(field.occupied).mul(clumps).div(field.edgeMean);
  };
  // Named shader functions bound generated source size. Without these,
  // repeated nested light paths expanded the section's expression tree at
  // every call site and stalled compilation before the first frame.
  const occupancyFn = Fn(([world]: [THREE.Node]) => fieldAt(world).occupied).setLayout({
    name: 'waterfallVolumeOccupancy', type: 'float', inputs: [{ name: 'world', type: 'vec3' }],
  });
  const densityFn = Fn(([world]: [THREE.Node]) => {
    const field = fieldAt(world); const density = waterfallLocal(densityAt(field), 'float');
    // Interface area controls scattering without changing accounted liquid.
    // Qsca=2 is a geometric-optics approximation for dispersed water in air.
    // The shared river attenuation remains per meter of actual liquid.
    const sigmaS = density.mul(field.developed).mul(3 * WATERFALL_OPTICS.efficiency / 4)
      .div(state.interfaceRadius).mul(state.scatteringScale);
    return vec2(density, sigmaS);
  }).setLayout({ name: 'waterfallVolumeDensity', type: 'vec2', inputs: [{ name: 'world', type: 'vec3' }] });
  return { fieldAt, densityFn, occupancyFn };
}

// Ordinary water and optional experiments share the same optical equations.
// A smaller program omits dormant experiments at graph construction time;
// selecting one lazily restores the complete program with the same uniforms.
function sweptVolumeMaterial(U: RiverWaterUniforms, state: WaterfallVolumeUniforms, eventOnly=false, includeExperiments=true): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial();
  const skyBasis = getWaterfallSkyTextures();
  const skyDirections = texture(skyBasis.directions); const skyMoments = texture(skyBasis.moments);
  const skyBoundary = texture(getWaterfallSkyIrradianceTexture());
  const frozenSource = texture3D(state.frozenSource);
  const boundaryH = texture3D(state.boundaryH); const boundaryZ = texture3D(state.boundaryZ); const boundarySun = texture3D(state.boundarySun);
  // The cache describes light at the actual envelope boundary, before water
  // transport. It never applies this fall's extinction a second time. Each
  // directional slab is sampled independently to avoid angular filter bleed.
  const cachedBoundary = Fn(([point, normal]: THREE.Node[]) => {
    const f = clamp(point.sub(state.boundaryMin).div(state.boundaryMax.sub(state.boundaryMin)), 0, 1).toVar();
    const result = vec3(0).toVar(); const sum = float(0).toVar();
    BOUNDARY_DIRECTIONS.forEach((direction, k) => {
      const d = vec3(direction.x, direction.y, direction.z);
      const coordinates = vec3(f.x.mul((BOUNDARY_LIGHT.x - 1) / BOUNDARY_LIGHT.x).add(.5 / BOUNDARY_LIGHT.x),
        f.y.mul((BOUNDARY_LIGHT.y - 1) / BOUNDARY_LIGHT.y).add(.5 / BOUNDARY_LIGHT.y),
        f.z.mul(BOUNDARY_LIGHT.z - 1).add(k * BOUNDARY_LIGHT.z + .5).div(BOUNDARY_LIGHT.z * BOUNDARY_LIGHT.directions));
      const h = boundaryH.sample(coordinates).toVar(); const z = boundaryZ.sample(coordinates).toVar(); const sun = boundarySun.sample(coordinates).toVar();
      const sky = U.uSkyHorizon.mul(h.rgb).add(U.uSkyZenith.mul(z.rgb)).mul(U.uSkyGain);
      const diagnosticSky = U.uSkyHorizon.mul(direction.y > 0 ? 1 - Math.sqrt(direction.y) : direction.y === 0 ? .5 : 0)
        .add(U.uSkyZenith.mul(direction.y > 0 ? Math.sqrt(direction.y) : 0)).mul(U.uSkyGain).mul(h.a);
      const incoming = mix(sky.add(U.uSunColor.mul(sun.rgb)), diagnosticSky, float(state.boundaryMode.equal(2)));
      const w = max(dot(normal, d), 0); sum.addAssign(w); result.addAssign(incoming.mul(w));
    });
    const visibility = boundarySun.sample(vec3(f.x.mul((BOUNDARY_LIGHT.x - 1) / BOUNDARY_LIGHT.x).add(.5 / BOUNDARY_LIGHT.x),
      f.y.mul((BOUNDARY_LIGHT.y - 1) / BOUNDARY_LIGHT.y).add(.5 / BOUNDARY_LIGHT.y),
      f.z.mul(BOUNDARY_LIGHT.z - 1).add(.5).div(BOUNDARY_LIGHT.z * BOUNDARY_LIGHT.directions))).a;
    return result.div(max(sum, .000001)).add(U.uSunColor.mul(max(dot(normal, U.uSunDir), 0)).mul(visibility).div(Math.PI));
  }).setLayout({ name: 'waterfallCliffBoundaryLight', type: 'vec3', inputs: [{ name: 'point', type: 'vec3' }, { name: 'normal', type: 'vec3' }] });
  material.fragmentNode = Fn(() => {
    const V = normalize(cameraPosition.sub(positionWorld));
    const ray = V.negate();
    const N = normalize(normalWorld);
    const facing = max(abs(dot(N, V)), 0.02);
    const fresnel = float(0.02).add(pow(float(1).sub(facing), 5).mul(0.98));
    const reflection = reflect(V.negate(), N);
    const sky = mix(U.uSkyHorizon, U.uSkyZenith, pow(max(reflection.y, 0), 0.5)).mul(U.uSkyGain);
    const screen = screenCoordinate.xy.div(U.uResolution);
    const background = U.uSceneColor.sample(clamp(screen.add(vec2(N.x, N.z).mul(0.002)), vec2(0.001), vec2(0.999))).rgb;
    const { fieldAt, densityFn, occupancyFn } = createWaterfallDensityFunctions(U, state);
    // The camera and sunlight both use geometry membership to solve exits.
    // The conservative box only brackets the first connected interval.
    // DEBT: A ray leaving and later reentering the curved fall needs another
    // interval. It cannot be represented by this single bounded exit solve.
    const exitAt = Fn(([origin, direction]: [THREE.Node, THREE.Node]) => {
      const safeRay = vec3(direction.x.add(0.000001), direction.y.add(0.000001), direction.z.add(0.000001)).toVar();
      const bounds0 = state.boundsMin.sub(origin).div(safeRay).toVar();
      const bounds1 = state.boundsMax.sub(origin).div(safeRay).toVar();
      const far = min(min(max(bounds0.x, bounds1.x), max(bounds0.y, bounds1.y)), max(bounds0.z, bounds1.z)).toVar();
      const lower = float(0).toVar(); const upper = max(0, far).toVar();
      Loop({ start: 0, end: state.exitBisections, type: 'int', condition: '<' }, () => {
        const middle = lower.add(upper).mul(0.5).toVar();
        const inside = float(occupancyFn(origin.add(direction.mul(middle))).greaterThan(0.0001)).toVar();
        lower.assign(mix(lower, middle, inside)); upper.assign(mix(middle, upper, inside));
      });
      return upper;
    }).setLayout({ name: 'waterfallVolumeExit', type: 'float', inputs: [{ name: 'origin', type: 'vec3' }, { name: 'direction', type: 'vec3' }] });
    // Pass the coefficient explicitly across the shader-function boundary.
    // Capturing the main shader's VarNode made Three r172 reuse its function-
    // local name in main, where that name belonged to camera transmission.
    // This parameter keeps absorption tied to its actual shared uniform and
    // makes the absorption-off diagnostic an honest isolation check.
    const pathTransmission = Fn(([origin, direction, samples, liquidAttenuation, offset]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {
      const distance = exitAt(origin, direction).toVar(); const ds = distance.div(samples).toVar();
      const depth = vec3(0).toVar();
      Loop({ start: 0, end: samples, type: 'float', condition: '<' }, ({ i }) => {
        const sample = densityFn(origin.add(direction.mul(float(i).add(offset).mul(ds)))).toVar();
        depth.addAssign(vec3(sample.y).add(liquidAttenuation.mul(sample.x)).mul(ds));
      });
      return exp(depth.negate());
    }).setLayout({ name: 'waterfallVolumeLightTransmission', type: 'vec3', inputs: [
      { name: 'origin', type: 'vec3' }, { name: 'direction', type: 'vec3' }, { name: 'samples', type: 'float' }, { name: 'liquidAttenuation', type: 'vec3' }, { name: 'offset', type: 'float' },
    ] });
    // The same conditional-event rule serves every segment. Named helpers
    // keep the graph bounded and pass main-function locals explicitly.
    const conditionalEventMean=Fn(([extinction,length]:[THREE.Node,THREE.Node])=>{
      const tau=extinction.mul(length).toVar(),tiny=min(tau,SEGMENT_EVENT_THIN_TAU).toVar();
      const thin=length.mul(float(.5).sub(tiny.div(12)).add(tiny.mul(tiny).mul(tiny).div(720))).toVar();
      const thick=float(1).div(max(extinction,.00000001)).sub(length.mul(exp(tau.negate())).div(max(float(1).sub(exp(tau.negate())),.00000001))).toVar();
      return clamp(mix(thick,thin,float(tau.lessThan(SEGMENT_EVENT_THIN_TAU))),0,length);
    }).setLayout({name:'waterfallSegmentEventMean',type:'float',inputs:[{name:'extinction',type:'float'},{name:'length',type:'float'}]});
    const segmentSolarAt=Fn(([point,view,liquidAttenuation,samples]:[THREE.Node,THREE.Node,THREE.Node,THREE.Node])=>{
      const trans=pathTransmission(point,U.uSunDir,samples,liquidAttenuation,.5).toVar();
      const cosine=dot(U.uSunDir.negate(),view).toVar(),g=WATERFALL_OPTICS.g;
      const phase=float(1-g*g).div(pow(float(1+g*g).sub(cosine.mul(2*g)),1.5).mul(4*Math.PI)).toVar();
      // Deliberately inherit the old single-scatter solar source: water-only
      // beam extinction, HG phase and irradiance. No slab/cosine/pi factor or
      // opaque-boundary visibility is added during this estimator isolation.
      return U.uSunColor.mul(trans).mul(phase);
    }).setLayout({name:'waterfallSegmentSolarSource',type:'vec3',inputs:[{name:'point',type:'vec3'},{name:'view',type:'vec3'},{name:'liquidAttenuation',type:'vec3'},{name:'samples',type:'float'}]});
    // Reuse the original phase-integrated three-direction sky basis at
    // each camera event. Its upper-hemisphere mass and zenith moments are
    // unchanged; this is source integration, not an added ambient gain.
    const segmentSkyAt=Fn(([point,view,liquidAttenuation]:[THREE.Node,THREE.Node,THREE.Node])=>{
      const skyLight=vec3(0).toVar();
      const horizontal=sqrt(view.x.mul(view.x).add(view.z.mul(view.z))).toVar();
      const axis=mix(vec3(1,0,0),vec3(view.x.negate(),0,view.z.negate()).div(max(horizontal,.000001)),float(horizontal.greaterThan(.000001))).toVar();
      const side=vec3(axis.z.negate(),0,axis.x).toVar();
      const tableX=view.y.add(1).mul(.5*(WATERFALL_OPTICS.skyRows-1)/WATERFALL_OPTICS.skyRows).add(.5/WATERFALL_OPTICS.skyRows).toVar();
      Loop({start:0,end:3,type:'int',condition:'<'},({i})=>{
        const tableUV=vec2(tableX,float(i).add(.5).div(3)).toVar();
        const cell=skyDirections.sample(tableUV).toVar();const zenithMix=skyMoments.sample(tableUV).r.toVar();
        const direction=normalize(axis.mul(cell.x).add(vec3(0,cell.y,0)).add(side.mul(cell.z))).toVar();
        const trans=pathTransmission(point,direction,state.segmentSkySamples,liquidAttenuation,state.segmentSkyOffset).toVar();
        const radiance=mix(U.uSkyHorizon,U.uSkyZenith,zenithMix).mul(U.uSkyGain).toVar();
        skyLight.addAssign(radiance.mul(trans).mul(cell.a));
      });
      return skyLight;
    }).setLayout({name:'waterfallSegmentSkySource',type:'vec3',inputs:[{name:'point',type:'vec3'},{name:'view',type:'vec3'},{name:'liquidAttenuation',type:'vec3'}]});
    const segmentSourceAt=Fn(([point,view,liquidAttenuation,samples]:[THREE.Node,THREE.Node,THREE.Node,THREE.Node])=>{
      const source=segmentSolarAt(point,view,liquidAttenuation,samples).toVar();
      If(state.segmentLightMode.greaterThan(1),()=>{source.addAssign(segmentSkyAt(point,view,liquidAttenuation));});
      return source;
    }).setLayout({name:'waterfallSegmentCombinedSource',type:'vec3',inputs:[{name:'point',type:'vec3'},{name:'view',type:'vec3'},{name:'liquidAttenuation',type:'vec3'},{name:'samples',type:'float'}]});
    // Measure the raw conditional event before either the envelope fallback
    // or midpoint control changes lighting. A positive midpoint can remove
    // scattering energy even when that event lies in an interior density gap.
    const eventDensityAt=Fn(([event,effective,midpointDensity,midpointSigma]:[THREE.Node,THREE.Node,THREE.Node,THREE.Node])=>{
      const raw=densityFn(event).toVar();const resolved=densityFn(effective).toVar();
      return vec4(raw.x.div(max(midpointDensity,.000000000001)),raw.y.div(max(midpointSigma,.000000000001)),resolved.x.div(max(midpointDensity,.000000000001)),float(raw.x.equal(0)));
    }).setLayout({name:'waterfallEventDensityMeasure',type:'vec4',inputs:[{name:'event',type:'vec3'},{name:'effective',type:'vec3'},{name:'midpointDensity',type:'float'},{name:'midpointSigma',type:'float'}]});
    const exitHigh = exitAt(positionWorld, ray).toVar();
    // The synthetic event probe uses its own camera and target without an
    // opaque scene pass. Its water-only path must not sample live-view depth.
    if (!eventOnly) If(state.cameraDepthClip.greaterThan(0), () => {
      // Stop the camera path at the opaque cliff or pool behind this water.
      // Depth stores camera-view Z; dividing by this ray's view Z converts
      // it to distance along off-axis rays before subtracting the entry.
      // Light paths still use their existing water-only exit solve.
      const sceneDepth = U.uSceneDepth.sample(ivec2(screenCoordinate.xy)).setSampler(false);
      const sceneViewZ = perspectiveDepthToViewZ(sceneDepth, U.uNear, U.uFar);
      const cameraRayViewZ = cameraViewMatrix.mul(vec4(ray, 0)).z;
      const opaqueCameraDistance = sceneViewZ.div(min(cameraRayViewZ, -0.000001));
      const entryCameraDistance = positionWorld.sub(cameraPosition).length();
      const opaqueRemaining = max(0, opaqueCameraDistance.sub(entryCameraDistance));
      exitHigh.assign(min(exitHigh, opaqueRemaining));
      If(exitHigh.lessThanEqual(0), () => { Discard(); });
    });
    const step = exitHigh.div(state.cameraSamples).toVar();
    const transmission = vec3(1).toVar(); const scatterWeight = vec3(0).toVar();
    const frozenScattered = vec3(0).toVar();
    const segmentSolarScattered=vec3(0).toVar();
    const eventNear=vec3(0).toVar(),eventWeight=vec3(0).toVar(),eventRatio=vec3(0).toVar(),eventFallback=vec3(0).toVar(),eventZero=vec3(0).toVar(),eventLow=vec3(0).toVar(),eventEffective=vec3(0).toVar(),eventSigmaRatio=vec3(0).toVar();
    const liquidPath = float(0).toVar(); const scatteringDepth = float(0).toVar();
    const selectedStart = positionWorld.toVar(); const selectedMidpoint = positionWorld.toVar();
    const selectedSigma = float(0).toVar(); const selectedWeight = float(0).toVar();
    const initial = fieldAt(positionWorld);
    const sharedAttenuation = max(U.uAbsorbClear, vec3(0)).mul(state.absorptionScale).toVar();
    Loop({ start: 0, end: state.cameraSamples, type: 'int', condition: '<' }, ({ i }) => {
      const segmentStart = positionWorld.add(ray.mul(float(i).mul(step))).toVar();
      const samplePosition = segmentStart.add(ray.mul(step.mul(0.5))).toVar();
      const sample = densityFn(samplePosition).toVar();
      const sigmaS = sample.y; const sigmaA = sharedAttenuation.mul(sample.x).toVar();
      const sigmaT = vec3(sigmaS).add(sigmaA).toVar();
      const attenuation = exp(sigmaT.mul(step).negate()).toVar();
      // RGB extinction accounts for both lost and redirected light. Albedo
      // ensures absorption never becomes an invented scattering source.
      const contribution = transmission.mul(vec3(1).sub(attenuation))
        .mul(vec3(sigmaS).div(max(sigmaT, vec3(0.00000001)))).toVar();
      scatterWeight.addAssign(contribution);
      if(includeExperiments)If(state.opticalDiagnostic.equal(7),()=>{
        for(const channel of ['r','g','b'] as const)If(contribution[channel].greaterThan(0),()=>{
          const event=segmentStart.add(ray.mul(conditionalEventMean(sigmaT[channel],step))).toVar();
          const inside=float(occupancyFn(event).greaterThan(.0001)).toVar();
          const effective=mix(mix(samplePosition,event,inside),samplePosition,state.segmentSourcePosition).toVar();
          const metrics=eventDensityAt(event,effective,sample.x,sigmaS).toVar(),w=contribution[channel];
          eventWeight[channel].addAssign(w);
          eventNear[channel].addAssign(w.mul(float(metrics.x.lessThanEqual(.01))));
          eventRatio[channel].addAssign(w.mul(clamp(metrics.x,0,1)));
          eventFallback[channel].addAssign(w.mul(float(1).sub(inside)));
          eventZero[channel].addAssign(w.mul(metrics.w));
          eventLow[channel].addAssign(w.mul(float(metrics.x.lessThanEqual(.1))));
          eventEffective[channel].addAssign(w.mul(float(metrics.z.lessThanEqual(.01))));
          eventSigmaRatio[channel].addAssign(w.mul(clamp(metrics.y,0,1)));
        });
      });
      // Only the proof mode pays for local sun/sky lighting. Each contribution
      // already includes view transmission, full extinction and albedo.
      // Sum its own source, never a hard winner or a second sigma_s factor.
      if(!eventOnly&&includeExperiments)If(state.segmentLightMode.greaterThan(0).and(state.frozenReady.lessThanEqual(0))
        .and(max(max(contribution.r,contribution.g),contribution.b).greaterThan(0)),()=>{
        const equal=sigmaT.r.equal(sigmaT.g).and(sigmaT.r.equal(sigmaT.b));
        If(equal,()=>{
          const mean=conditionalEventMean(sigmaT.r,step).toVar();
          const event=segmentStart.add(ray.mul(mean)).toVar();
          const point=mix(mix(samplePosition,event,float(occupancyFn(event).greaterThan(.0001))),samplePosition,state.segmentSourcePosition).toVar();
          const J=segmentSourceAt(point,V,sharedAttenuation,state.segmentSunSamples).toVar();
          segmentSolarScattered.addAssign(contribution.mul(J));
        }).Else(()=>{
          for(const channel of ['r','g','b'] as const)If(contribution[channel].greaterThan(0),()=>{
            const mean=conditionalEventMean(sigmaT[channel],step).toVar();
            const event=segmentStart.add(ray.mul(mean)).toVar();
            const point=mix(mix(samplePosition,event,float(occupancyFn(event).greaterThan(.0001))),samplePosition,state.segmentSourcePosition).toVar();
            const J=segmentSourceAt(point,V,sharedAttenuation,state.segmentSunSamples).toVar();
            segmentSolarScattered[channel].addAssign(contribution[channel].mul(J[channel]));
          });
        });
      });
      if(!eventOnly&&includeExperiments)If(state.frozenReady.greaterThan(0), () => {
        // Frozen RTE supplies combined solar + diffuse J in radiance units.
        // Continuous solar first scattering is already in J; no separate sun
        // source, pi division or second sigma_s factor belongs here.
        // Each existing RGB segment
        // weight already contains sigma_s/sigma_t and full beam extinction.
        // Sample its conditional first event per channel, not a global light
        // centroid or a source multiplied by sigma_s for a second time.
        for (const channel of ['r', 'g', 'b'] as const) {
          const extinction = sigmaT[channel]; const opticalDepth = extinction.mul(step).toVar();
          const tinyDepth = min(opticalDepth, .01).toVar();
          const thin = step.mul(float(.5).sub(tinyDepth.div(12)).add(tinyDepth.mul(tinyDepth).mul(tinyDepth).div(720))).toVar();
          const thick = float(1).div(max(extinction, .00000001)).sub(step.mul(exp(opticalDepth.negate())).div(max(float(1).sub(exp(opticalDepth.negate())), .00000001))).toVar();
          const mean = clamp(mix(thick, thin, float(opticalDepth.lessThan(.01))), 0, step).toVar();
          const event = segmentStart.add(ray.mul(mean)).toVar();
          const point = mix(samplePosition, event, float(occupancyFn(event).greaterThan(.0001))).toVar();
          const coordinates = clamp(point.sub(state.frozenMin).div(state.frozenMax.sub(state.frozenMin)), 0, 1);
          frozenScattered[channel].addAssign(contribution[channel].mul(frozenSource.sample(coordinates)[channel]));
        }
      });
      const weight = dot(contribution, vec3(1 / 3)).toVar();
      const select = float(weight.greaterThan(selectedWeight)).toVar();
      selectedStart.assign(mix(selectedStart, segmentStart, select));
      selectedMidpoint.assign(mix(selectedMidpoint, samplePosition, select));
      selectedSigma.assign(mix(selectedSigma, dot(sigmaT, vec3(1 / 3)), select));
      selectedWeight.assign(max(selectedWeight, weight));
      transmission.mulAssign(attenuation); liquidPath.addAssign(sample.x.mul(step)); scatteringDepth.addAssign(sigmaS.mul(step));
    });
    const totalEventWeight=max(dot(eventWeight,vec3(1)),.000000000001).toVar();
    const eventOutput=includeExperiments?vec3(dot(eventNear,vec3(1)),dot(eventRatio,vec3(1)),dot(eventWeight,vec3(1))).div(totalEventWeight).toVar():vec3(0);
    if(includeExperiments)If(state.eventProbeQuantity.equal(1),()=>{eventOutput.assign(eventNear);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(2),()=>{eventOutput.assign(eventWeight);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(3),()=>{eventOutput.assign(eventRatio);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(4),()=>{eventOutput.assign(eventFallback);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(5),()=>{eventOutput.assign(eventZero);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(6),()=>{eventOutput.assign(eventLow);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(7),()=>{eventOutput.assign(eventEffective);});
    if(includeExperiments)If(state.eventProbeQuantity.equal(8),()=>{eventOutput.assign(eventSigmaRatio);});
    if(eventOnly)return vec4(eventOutput,1);
    // Conditional first-event mean: thin segments tend to their midpoint;
    // opaque segments tend to one mean free path from their entry. The
    // exp(-tau) form remains finite when optical depth is very large.
    const tau = selectedSigma.mul(step).toVar(); const thinTau = min(tau, 0.01).toVar();
    const thinMean = step.mul(float(0.5).sub(thinTau.div(12)).add(thinTau.mul(thinTau).mul(thinTau).div(720))).toVar();
    const thickMean = float(1).div(max(selectedSigma, 0.00000001))
      .sub(step.mul(exp(tau.negate())).div(max(float(1).sub(exp(tau.negate())), 0.00000001))).toVar();
    const eventMean = clamp(mix(thickMean, thinMean, float(tau.lessThan(0.01))), 0, step).toVar();
    const eventPoint = selectedStart.add(ray.mul(eventMean)).toVar();
    // Pick an actual contributing segment, never the average of separated
    // patches. If its first-event estimate lies outside the occupied envelope,
    // use that segment's occupied midpoint. One membership check after the
    // camera loop keeps the density-query budget close to the previous model.
    const lightOrigin = mix(selectedMidpoint, eventPoint, float(occupancyFn(eventPoint).greaterThan(0.0001))).toVar();
    const absorb = exp(sharedAttenuation.negate().mul(liquidPath));
    const liquid = background.mul(absorb).add(U.uScatterClear.mul(sky).mul(vec3(1).sub(absorb)));
    // A collapsed dry launch has no reflective clear-water interface.
    const coherent = float(1).sub(initial.developed).mul(float(initial.fraction.greaterThan(0)));
    const clearSurface = mix(liquid, sky, fresnel);
    const volumeAlpha = float(1).sub(min(min(transmission.x, transmission.y), transmission.z)).toVar();
    // Optional resolved-interface orientation. All finite differences use the
    // authoritative world density. It is a local slab diagnostic, not a water
    // self-shadow solve or a global power-conserving transport replacement.
    const interfaceNormalFn=Fn(([point,oldNormal,view]:[THREE.Node,THREE.Node,THREE.Node])=>{
      const result=vec4(oldNormal,0).toVar();
      const field=fieldAt(point);
      const w=field.age.mul(WATERFALL.gravity).toVar();
      const velocity=sqrt(field.launchSpeed.mul(field.launchSpeed).add(w.mul(w))).toVar();
      const finite=(value:THREE.Node)=>abs(value).lessThan(3e38);
      const valid=field.width.greaterThan(0).and(field.thickness.greaterThan(0)).and(field.stretch.greaterThan(0)).and(velocity.greaterThan(0))
        .and(finite(field.width)).and(finite(field.thickness)).and(finite(field.stretch)).and(finite(velocity));
      If(valid,()=>{
        const A=state.across;
        const B=state.forward.mul(w).add(vec3(0,field.launchSpeed,0)).div(velocity).toVar();
        const T=state.forward.mul(field.launchSpeed).sub(vec3(0,w,0)).div(velocity).toVar();
        const precision=max(1,max(max(abs(point.x),abs(point.y)),abs(point.z))).mul(WATERFALL_INTERFACE.precisionFactor).toVar();
        const hA=max(field.width.mul(field.stretch).mul(.5/WATERFALL_ATLAS.x),precision).toVar();
        const hB=max(field.thickness.div(field.stretch).mul(.5/WATERFALL_ATLAS.y),precision).toVar();
        const hT=max(velocity.mul(.5*WATERFALL_ATLAS.maxAge).div(state.atlasAges.sub(1)),precision).toVar();
        const ap=densityFn(point.add(A.mul(hA))).x.toVar(),am=densityFn(point.sub(A.mul(hA))).x.toVar();
        const bp=densityFn(point.add(B.mul(hB))).x.toVar(),bm=densityFn(point.sub(B.mul(hB))).x.toVar();
        const tp=densityFn(point.add(T.mul(hT))).x.toVar(),tm=densityFn(point.sub(T.mul(hT))).x.toVar();
        const da=ap.sub(am).toVar(),db=bp.sub(bm).toVar(),dt=tp.sub(tm).toVar();
        const rhoMax=max(max(max(ap,am),max(bp,bm)),max(tp,tm)).toVar();
        const delta=max(max(abs(da),abs(db)),abs(dt)).toVar();
        const quantization=rhoMax.mul(WATERFALL_INTERFACE.halfRelative).add(WATERFALL_INTERFACE.halfAbsolute).mul(WATERFALL_INTERFACE.quantizationFactor).toVar();
        const G=A.mul(da.div(hA.mul(2))).add(B.mul(db.div(hB.mul(2)))).add(T.mul(dt.div(hT.mul(2)))).toVar();
        const length=sqrt(dot(G,G)).toVar();
        const samplesValid=finite(ap).and(finite(am)).and(finite(bp)).and(finite(bm)).and(finite(tp)).and(finite(tm))
          .and(finite(length)).and(length.greaterThan(0)).and(rhoMax.greaterThan(WATERFALL_INTERFACE.halfAbsolute)).and(delta.greaterThan(quantization));
        If(samplesValid,()=>{
          const outward=G.negate().div(max(length,1e-20)).toVar();
          const candidate=outward.mul(mix(-1,1,float(dot(outward,view).greaterThanEqual(0)))).toVar();
          const old=oldNormal.mul(mix(-1,1,float(dot(oldNormal,view).greaterThanEqual(0)))).toVar();
          const confidence=smoothstep(WATERFALL_INTERFACE.lowContrast,WATERFALL_INTERFACE.highContrast,delta.div(max(rhoMax,WATERFALL_INTERFACE.halfAbsolute))).toVar();
          If(confidence.greaterThan(0),()=>{const blended=mix(old,candidate,confidence).toVar();const blendLength=sqrt(dot(blended,blended)).toVar();If(finite(blendLength).and(blendLength.greaterThan(0)),()=>{result.assign(vec4(blended.div(blendLength),confidence));});});
        });
      });
      return result;
    }).setLayout({name:'waterfallDensityInterfaceNormal',type:'vec4',inputs:[{name:'point',type:'vec3'},{name:'oldNormal',type:'vec3'},{name:'view',type:'vec3'}]});
    // The phase uses incoming propagation toward the point and outgoing
    // propagation toward the camera. Its integral over the whole sphere is one.
    const phase = (direction: THREE.Node) => {
      const g = WATERFALL_OPTICS.g; const cosine = dot(direction.negate(), V).toVar();
      return float(1 - g * g).div(pow(float(1 + g * g).sub(cosine.mul(2 * g)), 1.5).mul(4 * Math.PI));
    };
    const illuminationAt = (origin: THREE.Node) => {
      const sun = pathTransmission(origin, U.uSunDir, 4, sharedAttenuation, .5).toVar();
      const skyLight = vec3(0).toVar(); const skyTransmission = vec3(0).toVar(); const skyMass = float(0).toVar();
      const horizontal = sqrt(V.x.mul(V.x).add(V.z.mul(V.z))).toVar();
      const axis = mix(vec3(1, 0, 0), vec3(V.x.negate(), 0, V.z.negate()).div(max(horizontal, 0.000001)), float(horizontal.greaterThan(0.000001))).toVar();
      const side = vec3(axis.z.negate(), 0, axis.x).toVar();
      const tableX = V.y.add(1).mul(0.5 * (WATERFALL_OPTICS.skyRows - 1) / WATERFALL_OPTICS.skyRows)
        .add(0.5 / WATERFALL_OPTICS.skyRows).toVar();
      Loop({ start: 0, end: 3, type: 'int', condition: '<' }, ({ i }) => {
        const tableUV = vec2(tableX, float(i).add(0.5).div(3)).toVar();
        const cell = skyDirections.sample(tableUV).toVar(); const zenithMix = skyMoments.sample(tableUV).r.toVar();
        const direction = normalize(axis.mul(cell.x).add(vec3(0, cell.y, 0)).add(side.mul(cell.z))).toVar();
        const trans = pathTransmission(origin, direction, 2, sharedAttenuation, .5).toVar();
        const radiance = mix(U.uSkyHorizon, U.uSkyZenith, zenithMix).mul(U.uSkyGain).toVar();
        skyLight.addAssign(radiance.mul(trans).mul(cell.a));
        skyTransmission.addAssign(trans.mul(cell.a)); skyMass.addAssign(cell.a);
      });
      const direct = U.uSunColor.mul(sun).mul(phase(U.uSunDir)).toVar();
      return { radiance: skyLight.add(direct), sun, sky: skyTransmission.div(max(skyMass, 0.00000001)) };
    };
    // DEBT: Single scattering with one selected lighting point remains bounded
    // independently of camera steps. Its radiance must be checked against more
    // lighting samples before accepting thick, highly shadowed morphology.
    // Multiple scattering is deliberately not replaced with an ambient boost.
    const light = illuminationAt(lightOrigin);
    const singleScattered = scatterWeight.mul(light.radiance).toVar();
    // Treat the sampled column as a homogeneous local slab with its actual
    // envelope normal facing the viewer. Normal-column optical depth is the
    // measured camera depth times its face cosine. This retains the density,
    // Q/local-speed mass, and full-extinction direct beam above.
    // DEBT: This plane-column approximation cannot resolve lateral escape
    // through the curved or clumped fall. Its directional collision partition
    // conserves a local light budget; it is not an exact 3D flux solution.
    const slabNormal = N.mul(mix(-1, 1, float(dot(N, V).greaterThanEqual(0)))).toVar();
    const slabFacing=facing.toVar();const interfaceConfidence=float(0).toVar();
    const frontPoint=positionWorld.toVar();
    if(includeExperiments)If(state.interfaceNormalMode.greaterThan(0),()=>{
      const resolved=interfaceNormalFn(lightOrigin,slabNormal,V).toVar();
      slabNormal.assign(resolved.xyz);interfaceConfidence.assign(resolved.w);
      // Confidence also blends the boundary location. A rejected gradient
      // keeps the old envelope point and column projection exactly; accepted
      // gradients use the existing first-event point, not a new ray estimator.
      slabFacing.assign(mix(facing,max(abs(dot(slabNormal,V)),.02),interfaceConfidence));
      frontPoint.assign(mix(positionWorld,lightOrigin,interfaceConfidence));
    });
    const tauS = scatteringDepth.mul(slabFacing).toVar();
    const tauA = sharedAttenuation.mul(liquidPath).mul(slabFacing).toVar();
    const b = tauS.mul(1 - WATERFALL_OPTICS.g).toVar(); const a = tauA.mul(2).add(vec3(b)).toVar();
    const k = sqrt(max(tauA.mul(tauA.add(vec3(b))), vec3(0))).mul(2).toVar();
    const e = exp(k.negate()).toVar(); const smallK = min(k, vec3(0.01)).toVar();
    const series = vec3(1).sub(smallK).add(smallK.mul(smallK).mul(2 / 3))
      .sub(smallK.mul(smallK).mul(smallK).div(3)).add(pow(smallK, 4).mul(2 / 15)).toVar();
    const sinhc = mix(vec3(1).sub(exp(k.mul(-2))).div(max(k.mul(2), vec3(0.00000001))), series,
      vec3(float(k.x.lessThan(0.01)), float(k.y.lessThan(0.01)), float(k.z.lessThan(0.01)))).toVar();
    const denominator = vec3(1).add(e.mul(e)).mul(0.5).add(a.mul(sinhc)).toVar();
    const slabR = vec3(b).mul(sinhc).div(denominator).toVar(); const slabT = e.div(denominator).toVar();
    const slabA = max(vec3(0), vec3(1).sub(slabR).sub(slabT)).toVar();
    const tauTotal = tauA.add(vec3(tauS)).toVar();
    const slabDirect = exp(tauTotal.mul(-2)).toVar();
    const slabTd = max(vec3(0), slabT.sub(slabDirect)).toVar();
    const collisionBudget = max(slabR.add(slabTd).add(slabA), vec3(0.00000001)).toVar();
    const omega = vec3(tauS).div(max(tauTotal, vec3(0.00000001))).toVar();
    const thin = vec3(float(tauTotal.x.lessThan(0.001)), float(tauTotal.y.lessThan(0.001)), float(tauTotal.z.lessThan(0.001))).toVar();
    const reflectConditional = mix(slabR.div(collisionBudget), omega.mul((1 - WATERFALL_OPTICS.g) * 0.5), thin).toVar();
    const transmitConditional = mix(slabTd.div(collisionBudget), omega.mul((1 + WATERFALL_OPTICS.g) * 0.5), thin).toVar();
    const skyTableX = slabNormal.y.add(1).mul(0.5 * (WATERFALL_OPTICS.skyRows - 1) / WATERFALL_OPTICS.skyRows)
      .add(0.5 / WATERFALL_OPTICS.skyRows).toVar();
    const boundary = skyBoundary.sample(vec2(skyTableX, 0.5)).toVar();
    const skyDifference = U.uSkyZenith.sub(U.uSkyHorizon).toVar();
    const sunCosine = dot(slabNormal, U.uSunDir).toVar();
    const frontBoundary = U.uSkyHorizon.mul(boundary.x).add(skyDifference.mul(boundary.y)).mul(U.uSkyGain)
      .add(U.uSunColor.mul(max(sunCosine, 0)).div(Math.PI)).toVar();
    const backBoundary = U.uSkyHorizon.mul(boundary.z).add(skyDifference.mul(boundary.w)).mul(U.uSkyGain)
      .add(U.uSunColor.mul(max(sunCosine.negate(), 0)).div(Math.PI)).toVar();
    If(state.boundaryReady.greaterThan(0).and(state.boundaryMode.greaterThan(0)), () => {
      frontBoundary.assign(cachedBoundary(frontPoint, slabNormal));
      backBoundary.assign(cachedBoundary(positionWorld.add(ray.mul(exitHigh)), slabNormal.negate()));
    });
    // The two-stream source includes all redirected orders and REPLACES the
    // single-scattered source. Conditional R/T/A sum to one after a collision;
    // multiplying by (1-full-beam-T) assigns only its removed energy. With
    // uniform illumination and no absorption, transmitted + redirected light
    // equals the incoming radiance even in a thick column: there is no glow.
    const diffuseScattered = vec3(1).sub(transmission)
      .mul(reflectConditional.mul(frontBoundary).add(transmitConditional.mul(backBoundary))).toVar();
    const scattered = mix(singleScattered, diffuseScattered, state.transportMode).toVar();
    if(includeExperiments)If(state.segmentLightMode.greaterThan(0),()=>{scattered.assign(segmentSolarScattered);});
    if(includeExperiments)If(state.frozenReady.greaterThan(0), () => { scattered.assign(frozenScattered); });
    const sunTransmission = light.sun; const skyTransmission = light.sky;
    // Use the most attenuated channel for alpha so every residual is nonnegative.
    // Standard alpha blending would otherwise lose colored absorption behind
    // dispersed water. This premultiplied residual plus the scene's remaining
    // (1-alpha) gives exactly background*T + scattering in every RGB channel.
    const premultiplied = background.mul(transmission.sub(vec3(float(1).sub(volumeAlpha)))).add(scattered).toVar();
    const alpha = mix(volumeAlpha, float(1), coherent).toVar();
    const color = mix(premultiplied, clearSurface, coherent).div(max(alpha, 0.00000001));
    // Optical proof modes expose transport results before artistic judgment.
    // Gray value is the named quantity in [0,1], without an invented color ramp.
    const diagnostic = state.opticalDiagnostic;
    const proof = mix(mix(mix(mix(color, vec3(volumeAlpha), float(diagnostic.equal(1))),
      vec3(sunTransmission), float(diagnostic.equal(2))), vec3(skyTransmission), float(diagnostic.equal(3))),
      vec3(clamp(liquidPath.div(max(exitHigh, 0.00001)), 0, 1)), float(diagnostic.equal(4)));
    const normalProof=mix(proof,slabNormal.mul(.5).add(.5),float(diagnostic.equal(5)));
    const interfaceProof=mix(normalProof,vec3(interfaceConfidence,float(interfaceConfidence.lessThanEqual(0)),0),float(diagnostic.equal(6)));
    const eventProof=includeExperiments?mix(interfaceProof,eventOutput,float(diagnostic.equal(7))):interfaceProof;
    const proofAlpha = mix(alpha, float(1), float(diagnostic.greaterThan(0)));
    return vec4(eventProof, proofAlpha.mul(smoothstep(state.pool.sub(0.4), state.pool.add(0.25), positionWorld.y)));
  })();
  material.side = THREE.FrontSide; material.transparent = true; material.depthWrite = false;
  material.name = 'bounded swept waterfall volume';
  return material;
}

// One closed cross-section carries the fall. Entrained air occupies space,
// while the liquid fraction accounts for exactly Q / local speed. The air
// expansion and optical mixing are calibrated approximations, not a solved
// three-dimensional fluid or additional water delivered to the pool.
const FALL_RING = 48;
// The section uses these same angular samples at every age. Their values do
// not depend on flow or time; retain their original binary64 calculations.
const SECTION_DIRECTIONS = Array.from({ length: FALL_RING }, (_, k) => {
  const angle = k * 2 * Math.PI / FALL_RING;
  return [Math.cos(angle), Math.sin(angle)] as const;
});
const FALL_ROWS = 129;
/** The mist's capacity: enough for the panel's biggest flood (120 m^3/s over 60 m by the budget law, capped). */
const MIST_CAP = 2400;
function createWaterfallBodyGeometry(rows:number,ring:number):THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
    const vertexCount = rows * ring;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertexCount * 2), 2));
    // WebGPU's baseline limit is eight vertex buffers. All envelope fields
    // share one buffer; with position, normal and UV this draw uses four.
    const envelope = new THREE.InterleavedBuffer(new Float32Array(vertexCount * 14), 14);
    const field = (name: string, size: number, offset: number) => geo.setAttribute(name, new THREE.InterleavedBufferAttribute(envelope, size, offset));
    field('liquidDepth', 1, 0); field('liquidFraction', 1, 1);
    field('envelopeCenter', 3, 2); field('envelopeAcross', 3, 5);
    field('envelopeThick', 3, 8); field('envelopeRadius', 2, 11); field('coherence', 1, 13);
    const indices: number[] = [];
    // Every side is water geometry, including the front, rear and narrow
    // edges. A side camera sees volume, rather than two transparent planes.
    for (let j = 0; j < rows - 1; j += 1) for (let k = 0; k < ring; k += 1) {
      const a = j * ring + k;
      const b = j * ring + (k + 1) % ring;
      indices.push(a, b, a + ring, b, b + ring, a + ring);
    }
    geo.setIndex(indices);
  return geo;
}

// Polygon area = a*b*(A*(1-d)^2 + B*d*(1-d) + C*d^2).
const SECTION_AREA_COEFFICIENTS = (() => {
  const area = (d: number) => {
    const points = Array.from({ length: FALL_RING }, (_, k) => {
      const angle = k * 2 * Math.PI / FALL_RING; const c = Math.cos(angle); const s = Math.sin(angle);
      const r = (1 - d) / Math.max(Math.abs(c), Math.abs(s)) + d;
      return [c * r, s * r];
    });
    return Math.abs(points.reduce((sum, p, k) => {
      const next = points[(k + 1) % FALL_RING]; return sum + p[0] * next[1] - next[0] * p[1];
    }, 0)) * 0.5;
  };
  const a = area(0); const c = area(1); return [a, 4 * area(0.5) - a - c, c];
})();
const WATERFALL_DENSITY_SIZE = 96;
let waterfallDensityTexture: THREE.Data3DTexture | null = null;
/** One small resident texture serves waterfall views, like the river's shared
 * texture cache. It is independent of the river's optical noise and contains
 * seeded random values rather than integer-wave patterns. R8 uses 0.84 MiB;
 * generation happens once, and trilinear filtering needs no per-frame upload. */
function getWaterfallDensityTexture(): THREE.Data3DTexture {
  if (waterfallDensityTexture) return waterfallDensityTexture;
  const random = mulberry32(0x4b17e2);
  const lattice = (size: number) => ({ size, values: Float32Array.from({ length: size ** 3 }, () => random()) });
  const coarse = lattice(12); const medium = lattice(24); const fine = lattice(48);
  const warpX = lattice(6); const warpY = lattice(6); const warpZ = lattice(6);
  const sample = (field: ReturnType<typeof lattice>, x: number, y: number, z: number) => {
    const n = field.size;
    x *= n / WATERFALL_DENSITY_SIZE; y *= n / WATERFALL_DENSITY_SIZE; z *= n / WATERFALL_DENSITY_SIZE;
    const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const tx = smooth(x - ix); const ty = smooth(y - iy); const tz = smooth(z - iz);
    const wrap = (i: number) => ((i % n) + n) % n;
    const x0 = wrap(ix); const x1 = wrap(ix + 1); const y0 = wrap(iy); const y1 = wrap(iy + 1); const z0 = wrap(iz); const z1 = wrap(iz + 1);
    const at = (a: number, b: number, c: number) => field.values[(c * n + b) * n + a];
    const row = (b: number, c: number) => at(x0, b, c) * (1 - tx) + at(x1, b, c) * tx;
    const layer = (c: number) => row(y0, c) * (1 - ty) + row(y1, c) * ty;
    return layer(z0) * (1 - tz) + layer(z1) * tz;
  };
  const n = WATERFALL_DENSITY_SIZE; const pixels = new Uint8Array(n ** 3);
  for (let z = 0; z < n; z += 1) for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
    const px = x + 0.5; const py = y + 0.5; const pz = z + 0.5;
    const wx = px + (sample(warpX, px, py, pz) - 0.5) * 8;
    const wy = py + (sample(warpY, px, py, pz) - 0.5) * 8;
    const wz = pz + (sample(warpZ, px, py, pz) - 0.5) * 8;
    const value = sample(coarse, wx, wy, wz) * 0.35 + sample(medium, wx, wy, wz) * 0.40 + sample(fine, wx, wy, wz) * 0.25;
    pixels[(z * n + y) * n + x] = Math.round(value * 255);
  }
  const result = new THREE.Data3DTexture(pixels, n, n, n);
  result.format = THREE.RedFormat; result.type = THREE.UnsignedByteType;
  result.minFilter = THREE.LinearFilter; result.magFilter = THREE.LinearFilter;
  result.wrapS = THREE.RepeatWrapping; result.wrapT = THREE.RepeatWrapping; result.wrapR = THREE.RepeatWrapping;
  result.unpackAlignment = 1; result.generateMipmaps = false; result.needsUpdate = true;
  result.name = 'waterfall stochastic density volume';
  waterfallDensityTexture = result;
  return result;
}
function waterfallScalarAt(u: number, v: number, w: number): number {
  const image = getWaterfallDensityTexture().image;
  const n = image.width; const data = image.data!;
  const x = u * n - 0.5, y = v * n - 0.5, z = w * n - 0.5;
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const tx = x - ix, ty = y - iy, tz = z - iz;
  const x0 = ((ix % n) + n) % n, x1 = (((ix + 1) % n) + n) % n;
  const y0 = ((iy % n) + n) % n, y1 = (((iy + 1) % n) + n) % n;
  const z0 = ((iz % n) + n) % n, z1 = (((iz + 1) % n) + n) % n;
  // Every body vertex samples this volume. Read its eight neighbors directly
  // instead of allocating nested sampling functions for each vertex. Keep
  // the old interpolation order and byte scaling exactly, including wrapping.
  const a = (z0 * n + y0) * n, b = (z0 * n + y1) * n;
  const c = (z1 * n + y0) * n, d = (z1 * n + y1) * n;
  const r0 = data[a + x0] / 255 * (1 - tx) + data[a + x1] / 255 * tx;
  const r1 = data[b + x0] / 255 * (1 - tx) + data[b + x1] / 255 * tx;
  const r2 = data[c + x0] / 255 * (1 - tx) + data[c + x1] / 255 * tx;
  const r3 = data[d + x0] / 255 * (1 - tx) + data[d + x1] / 255 * tx;
  return (r0 * (1 - ty) + r1 * ty) * (1 - tz) + (r2 * (1 - ty) + r3 * ty) * tz;
}
/** Prescribed entrainment deformation, rather than resolved turbulent flow.
 * Width stretch and reciprocal depth stretch have determinant one. The
 * nonlinear depth shear and translations also preserve every section's
 * liquid area. Intermediate displacement changes descending bundle widths,
 * while remaining far smaller than the former whole-column bulges. Motion
 * starts with zero derivative at the clear crest. */

export function waterfallSecondaryMap(width:number,thickness:number,developed:number,age:number,time:number,speed:number) {
  const emission=time-age;
  const at=(offset:number)=>waterfallScalarAt((age*age*.5*WATERFALL.gravity/WATERFALL_SECONDARY.axialCellM+offset)/WATERFALL_DENSITY_SIZE,
    (emission*.75+offset*.37)/WATERFALL_DENSITY_SIZE,(age*.55+emission*.25)/WATERFALL_DENSITY_SIZE);
  return secondarySectionMap(width,thickness,age,developed,[at(107),at(113),at(127),at(139)]);
}
function waterfallSectionMorph(x: number, width: number, thickness: number, developed: number, age: number, time: number, speed: number) {
  const travel = (time - age) * 6;
  const at = (across: number, offset: number) => waterfallScalarAt((across * 7 + offset) / WATERFALL_DENSITY_SIZE,
    (travel * 0.17 + offset * 0.37) / WATERFALL_DENSITY_SIZE, travel / WATERFALL_DENSITY_SIZE);
  const stretch = 1 + developed * (at(0, 17) - 0.5) * 0.6;
  const clearance = (speed * age + 3.6) / Math.max(age * WATERFALL.gravity / Math.hypot(speed, age * WATERFALL.gravity), 0.00001);
  const depthBudget = Math.max(0, Math.min(1, (clearance - thickness / (stretch * 2)) / Math.max(developed * thickness * 2.25, 0.00001)));
  return { stretch, depthBudget,
    shiftAcross: developed * width * (at(0, 39) - 0.5) * 0.24,
    shiftDepth: developed * thickness * (at(0, 61) - 0.5) * 0.45 * depthBudget,
    shear: (at(x, 83) - 0.5) * developed * thickness * 0.9 * depthBudget };
}
// Keep a bounded cache for physical checks and the active view. Each entry
// owns two small snapshots; normal frames only interpolate their time blend.
const waterfallAtlasCache = new Map<string, WaterfallDensityAtlas>();
function getWaterfallAtlas(q: number, width: number, speed: number, time: number, profile: WaterfallDensityProfile = 'legacy'): WaterfallDensityAtlas {
  const key = [q, width, speed, profile].join('/');
  let atlas = waterfallAtlasCache.get(key);
  if (!atlas) {
    atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(q, width, speed, age, 0), profile);
    waterfallAtlasCache.set(key, atlas);
    if (waterfallAtlasCache.size > 2) waterfallAtlasCache.delete(waterfallAtlasCache.keys().next().value!);
  }
  atlas.update(time); return atlas;
}
/** CPU counterpart of the half-float density snapshots sampled by the GPU.
 * Flight remains in the signature for existing physical-volume callers;
 * emitted ribbon structure no longer depends on an arbitrary impact speed. */
export function waterfallVolumeDensityFactor(across: number, thick: number, age: number, time: number, q: number, width: number, speed: number, _flight: number, profile: WaterfallDensityProfile = 'legacy'): number {
  const atlas = getWaterfallAtlas(q, width, speed, time, profile); const section = atlas.section(age);
  return atlas.sample(across * 2 / section.width, thick * 2 / section.thickness, age);
}
function createWaterfallAtlasTexture(): THREE.Data3DTexture {
  const data = new Uint16Array(WATERFALL_ATLAS.x * WATERFALL_ATLAS.y * WATERFALL_ATLAS.ages);
  data.fill(THREE.DataUtils.toHalfFloat(1));
  const result = new THREE.Data3DTexture(data, WATERFALL_ATLAS.x, WATERFALL_ATLAS.y, WATERFALL_ATLAS.ages);
  result.format = THREE.RedFormat; result.type = THREE.HalfFloatType;
  result.minFilter = THREE.LinearFilter; result.magFilter = THREE.LinearFilter;
  result.wrapS = THREE.ClampToEdgeWrapping; result.wrapT = THREE.ClampToEdgeWrapping; result.wrapR = THREE.ClampToEdgeWrapping;
  result.unpackAlignment = 1; result.generateMipmaps = false; result.needsUpdate = true;
  result.name = 'Mass-normalized falling liquid ribbons'; return result;
}
function createBoundaryTransferTexture(): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(new Uint16Array(BOUNDARY_LIGHT.x * BOUNDARY_LIGHT.y * BOUNDARY_LIGHT.z * BOUNDARY_LIGHT.directions * 4), BOUNDARY_LIGHT.x, BOUNDARY_LIGHT.y, BOUNDARY_LIGHT.z * BOUNDARY_LIGHT.directions);
  texture.type = THREE.HalfFloatType; texture.format = THREE.RGBAFormat; texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping; texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}
/** Portable half-float linear filtering for the optional frozen proof only. */
function createFrozenWaterfallTexture() {
  const texture = new THREE.Data3DTexture(new Uint16Array(4), 1, 1, 1);
  texture.type = THREE.HalfFloatType; texture.format = THREE.RGBAFormat; texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping; texture.generateMipmaps = false; texture.needsUpdate = true; return texture;
}
function waterfallHalfFingerprint(data: Uint16Array) {
  let first = 2166136261; let second = 5381;
  for (const value of data) { first = Math.imul(first ^ value, 16777619); second = Math.imul(second, 33) ^ value; }
  return (first >>> 0).toString(16) + '/' + (second >>> 0).toString(16) + '/' + data.length;
}
function createWaterfallSourceRates(): THREE.DataTexture {
  const value = new THREE.DataTexture(new Float32Array(1024 * 4), 1024, 1, THREE.RGBAFormat, THREE.FloatType);
  value.minFilter = value.magFilter = THREE.NearestFilter; value.generateMipmaps = false; value.needsUpdate = true;
  return value;
}
function createWaterfallVolumeUniforms() {
  return { frozenSource: createFrozenWaterfallTexture(), frozenReady: uniform(0), frozenMin: uniform(new THREE.Vector3()), frozenMax: uniform(new THREE.Vector3(1, 1, 1)), top: uniform(78), pool: uniform(8), flux: uniform(0.15), width: uniform(10), speed: uniform(0.21),
    sourceRates: createWaterfallSourceRates(), sourceHistoryEnabled: uniform(0), floodEnabled: uniform(0), floodTime: uniform(0), floodStart: uniform(0), floodDuration: uniform(90), floodBase: uniform(1.5), floodExtra: uniform(0), floodCancel: uniform(1e20), floodCancelExtra: uniform(0), floodCancelDuration: uniform(1), floodAgeScale: uniform(1), depth: uniform(0.7), flight: uniform(3.8), atlasFirst: createWaterfallAtlasTexture(), atlasSecond: createWaterfallAtlasTexture(), atlasBlend: uniform(0), atlasAges: uniform(Number(WATERFALL_ATLAS.ages)), diagnostic: uniform(0), opticalDiagnostic: uniform(0),
    cameraDepthClip: uniform(1),
    interfaceRadius: uniform(Number(WATERFALL_OPTICS.radiusM)), scatteringScale: uniform(1), absorptionScale: uniform(1), cameraSamples: uniform(12, 'int'), transportMode: uniform(1), segmentLightMode:uniform(0), segmentSunSamples:uniform(4), segmentSkySamples:uniform(2), segmentSkyOffset:uniform(.5), segmentSourcePosition:uniform(0), eventProbeQuantity:uniform(0), interfaceNormalMode: uniform(0), secondaryDeformation:uniform(0),
    boundaryH: createBoundaryTransferTexture(), boundaryZ: createBoundaryTransferTexture(), boundarySun: createBoundaryTransferTexture(),
    boundaryMin: uniform(new THREE.Vector3()), boundaryMax: uniform(new THREE.Vector3(1, 1, 1)), boundaryReady: uniform(0), boundaryMode: uniform(1), exitBisections: uniform(6, 'int'),
    crest: uniform(new THREE.Vector3()), forward: uniform(new THREE.Vector3(1, 0, 0)),
    across: uniform(new THREE.Vector3(0, 0, -1)), boundsMin: uniform(new THREE.Vector3()), boundsMax: uniform(new THREE.Vector3()) };
}
type WaterfallVolumeUniforms = ReturnType<typeof createWaterfallVolumeUniforms>;

/** Apply the same strip deformation to a full body ring or a sampled mist point.
 * Sampling four needed vertices avoids rebuilding 48 vertices for every puff;
 * the visible positions, sampling distribution and water accounting are unchanged. */
function deformWaterfallSectionPoint(point: [number, number], sectionWidth: number, depth: number,
  developed: number, morph: ReturnType<typeof waterfallSectionMorph>, travel: number): [number, number] {
  const x = point[0] / Math.max(sectionWidth * 0.5, 1e-8);
  const shear = (waterfallScalarAt((x * 7 + 83) / WATERFALL_DENSITY_SIZE,
    (travel * 0.17 + 83 * 0.37) / WATERFALL_DENSITY_SIZE, travel / WATERFALL_DENSITY_SIZE) - 0.5) * developed * depth * 0.9 * morph.depthBudget;
  point[0] = point[0] * morph.stretch + morph.shiftAcross;
  point[1] = point[1] / morph.stretch + morph.shiftDepth + shear;
  return point;
}

/** A mass-accounted air-water section perpendicular to the true trajectory.
 * The crest is the original clear rectangular opening. Downstream air
 * entrainment rounds and broadens its occupied volume; liquid volume
 * remains fraction × polygon area = Q / gravitationally accelerated speed. */
/** Full rings serve the visible body and area sampling. Fringe spray uses the
 * same section calculation but needs only one deformed edge. */
export function waterfallLiquidSection(q: number, width: number, speed: number, age: number, time: number, transientArea?: number) {
  return buildWaterfallLiquidSection(q, width, speed, age, time, transientArea);
}

/** Sample one fringe edge without deforming 47 points that are never drawn.
 * Canonical area, thickness correction and the selected point stay identical
 * to the full body ring, including dry rows and historical flood admission. */
export function waterfallLiquidEdge(q: number, width: number, speed: number, age: number, time: number, side: -1 | 1, transientArea?: number) {
  const index = side < 0 ? FALL_RING / 2 : 0;
  const section = buildWaterfallLiquidSection(q, width, speed, age, time, transientArea, index);
  return { edge: section.ring[index], center: section.center, fold: section.fold,
    thickness: section.thickness, coherence: section.coherence };
}

function buildWaterfallLiquidSection(q: number, width: number, speed: number, age: number, time: number, transientArea?: number, edgeIndex?: number): { ring: [number, number][]; canonicalRing: [number, number][]; area: number; envelopeArea: number; fraction: number; center: number; fold: number; width: number; thickness: number; coherence: number; samplingOrigin: [number, number] } {
  const velocity = Math.max(1e-8, Math.hypot(speed, WATERFALL.gravity * age));
  const area = transientArea ?? Math.max(0, q) / velocity;
  // Entrained air belongs to emitted water. A closed source row collapses
  // without removing older wet rows elsewhere along the airborne history.
  if (!(q > 0) || !(area > 0)) {
    const ring: [number, number][] = Array.from({ length: FALL_RING }, () => [0, 0]);
    return { ring, canonicalRing: ring.map(point => [...point] as [number, number]),
      area: 0, envelopeArea: 0, fraction: 0, center: 0, fold: 0, width: 0, thickness: 0, coherence: 0,
      samplingOrigin: [0, 0] };
  }
  const strength = Math.sqrt(Math.max(0, Math.min(1, q / Math.max(1e-8, width * 0.8))));
  const developed = 1 - Math.exp(-age * age * (2.5 - strength * 1.2));
  // The envelope follows the accepted launch and broadens with entrained air.
  // It no longer squeezes every transverse point in synchrony or twists the
  // entire fall. Traveling structure now lives inside its occupied volume.
  // THE JET SPREADS BY LAW (2026-10-11): a turbulent free jet's outer edge
  // moves out at about 3.8% of the distance fallen on each side (Ervine and
  // Falvey 1987), so a 46 m plunge is about 3.5 m wider at its foot than at
  // its lip. The old growth term (3.5% of the AGE, in seconds) gave a tenth
  // of that. The distance fallen is the ballistic drop at this age.
  const fallenM = 0.5 * WATERFALL.gravity * age * age;
  const sectionWidth = width * (1 - developed) + (width * (0.18 + 0.82 * strength) + 2 * JET_SPREAD * fallenM * strength) * developed;
  const liquidThickness = area / Math.max(1e-8, sectionWidth);
  // Calibrated turbulent expansion adds depth as well as width. It changes
  // entrained-air space; liquid fraction still accounts for Q/local speed.
  const airThickness = developed * (0.12 + 0.32 * Math.sqrt(Math.max(0, q / Math.max(width, 1e-8)))) * Math.sqrt(age)
    + developed * width * strength * 0.32 * (1 - Math.exp(-age * 0.8));
  const thickness = liquidThickness + airThickness;
  if (edgeIndex !== undefined) {
    // Keep the full polygon's original area sum and thickness correction,
    // but avoid allocating its unused points. Only the chosen fringe edge
    // needs deformation. This is the same shape, not fewer visible samples.
    let firstX = 0, firstY = 0, priorX = 0, priorY = 0, twiceArea = 0, halfDepth = 0;
    const point: [number, number] = [0, 0];
    for (let k = 0; k < FALL_RING; k++) {
      const [co, si] = SECTION_DIRECTIONS[k];
      const rounded = (1 - developed) / Math.max(Math.abs(co), Math.abs(si)) + developed;
      const x = co * rounded * sectionWidth * .5, y = si * rounded * thickness * .5;
      if (k === 0) { firstX = x; firstY = y; }
      else twiceArea += priorX * y - x * priorY;
      priorX = x; priorY = y; halfDepth = Math.max(halfDepth, Math.abs(y));
      if (k === edgeIndex) { point[0] = x; point[1] = y; }
    }
    twiceArea += priorX * firstY - firstX * priorY;
    let envelopeArea = Math.abs(twiceArea) * .5;
    if (envelopeArea < area) {
      const scale = area / Math.max(1e-12, envelopeArea);
      point[1] *= scale; halfDepth *= scale; envelopeArea = area;
    }
    const depth = halfDepth * 2;
    const morph = waterfallSectionMorph(0, sectionWidth, depth, developed, age, time, speed);
    deformWaterfallSectionPoint(point, sectionWidth, depth, developed, morph, (time - age) * 6);
    const ring: [number, number][] = []; ring[edgeIndex] = point;
    return { ring, canonicalRing: [], area, envelopeArea, fraction: area / Math.max(1e-12, envelopeArea),
      center: 0, fold: 0, width: sectionWidth, thickness: depth, coherence: 1 - developed,
      samplingOrigin: [morph.shiftAcross, morph.shiftDepth + morph.shear] };
  }
  const ring: [number, number][] = [];
  let twiceArea = 0;
  for (let k = 0; k < FALL_RING; k += 1) {
    const [co, si] = SECTION_DIRECTIONS[k];
    const rounded = (1 - developed) / Math.max(Math.abs(co), Math.abs(si)) + developed;
    ring.push([co * rounded * sectionWidth * 0.5, si * rounded * thickness * 0.5]);
  }
  for (let k = 0; k < FALL_RING; k += 1) {
    const a = ring[k]; const b = ring[(k + 1) % FALL_RING];
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  let envelopeArea = Math.abs(twiceArea) * 0.5;
  // Rounding slightly reduces available area just after launch. Only thicken
  // the envelope enough to keep liquid fraction <= 1; do not create mass.
  if (envelopeArea < area) {
    const scale = area / Math.max(1e-12, envelopeArea);
    for (const point of ring) point[1] *= scale;
    envelopeArea = area;
  }
  const depth = Math.max(...ring.map(point => Math.abs(point[1]))) * 2;
  const canonicalRing = ring.map(point => [...point] as [number, number]);
  const morph = waterfallSectionMorph(0, sectionWidth, depth, developed, age, time, speed);
  const travel = (time - age) * 6;
  for (const point of ring) deformWaterfallSectionPoint(point, sectionWidth, depth, developed, morph, travel);
  return { ring, canonicalRing, area, envelopeArea, fraction: area / Math.max(1e-12, envelopeArea),
    center: 0, fold: 0, width: sectionWidth, thickness: depth, coherence: 1 - developed,
    samplingOrigin: [morph.shiftAcross, morph.shiftDepth + morph.shear] };
}

/** Body, dispersed droplets and impact all use this position formula.
 * Cross-sections sit in the plane perpendicular to the physical velocity;
 * every disturbance starts with zero derivative at the launch lip. */
export function waterfallLiquidPoint(section: Pick<ReturnType<typeof waterfallLiquidSection>, 'center' | 'fold'>, q: number, width: number, speed: number, depth: number, top: number, age: number, time: number, across = 0, thick = 0): { forward: number; lateral: number; y: number } {
  const flight = waterfallFlight(age, speed);
  const inv = 1 / Math.max(1e-8, Math.hypot(speed, WATERFALL.gravity * age));
  return { forward: flight.forward + section.fold + WATERFALL.gravity * age * inv * thick,
    lateral: section.center + across,
    y: top - depth * 0.5 * Math.exp(-age * age * 6) - flight.drop + speed * inv * thick };
}

/** Uniform liquid fraction lets a triangle-area sample locate real water
 * inside the same section used by the visible envelope.
 * The symmetric radial center remains inside every rounded section. */
function waterfallEnvelopeSample(section: ReturnType<typeof waterfallLiquidSection>, random: number, radial: number,
  pointAt = (index: number): [number, number] => section.ring[index],
  samplingOrigin = section.samplingOrigin): [number, number] {
  let remaining = random * section.envelopeArea;
  const origin: [number, number] = [0, 0];
  for (let k = 0; k < FALL_RING; k += 1) {
    const a = section.canonicalRing[k]; const b = section.canonicalRing[(k + 1) % FALL_RING];
    const area = Math.abs((a[0] - origin[0]) * (b[1] - origin[1]) - (b[0] - origin[0]) * (a[1] - origin[1])) * 0.5;
    if (remaining <= area || k === FALL_RING - 1) {
      const along = Math.max(0, Math.min(1, remaining / Math.max(1e-12, area)));
      const radius = Math.sqrt(radial);
      const x = (a[0] * (1 - along) + b[0] * along) * radius;
      const y = (a[1] * (1 - along) + b[1] * along) * radius;
      // Sample the undeformed polygon uniformly, then apply its exact strip
      // map. Triangle fans about a translated center can cross concave edges.
      for (let index = 0; index < FALL_RING / 2; index += 1) {
        const top0 = section.canonicalRing[index]; const top1 = section.canonicalRing[index + 1];
        if (x <= top0[0] && x >= top1[0]) {
          const u = (top0[0] - x) / Math.max(1e-12, top0[0] - top1[0]);
          const top = top0[1] * (1 - u) + top1[1] * u;
          const p0 = pointAt(index); const p1 = pointAt(index + 1);
          const b0 = pointAt((FALL_RING - index) % FALL_RING); const b1 = pointAt((FALL_RING - index - 1) % FALL_RING);
          const high = p0[1] * (1 - u) + p1[1] * u; const low = b0[1] * (1 - u) + b1[1] * u;
          return [p0[0] * (1 - u) + p1[0] * u, low + (high - low) * (0.5 + y / Math.max(1e-12, top * 2))];
        }
      }
      return samplingOrigin;
    }
    remaining -= area;
  }
  return [0, 0];
}

export class RiverWaterfallView {
  readonly group = new THREE.Group();
  readonly waterGroup = new THREE.Group();
  private thinLive: WaterfallThinLiveView | null = null;
  private thinLiveEnabled = false;
  private thinLiveShape = '';
  /** Inspectable free-flight comparison only. It creates no second pool source. */
  setLiveMaterialComparison(enabled: boolean): void {
    this.thinLiveEnabled = enabled;
    this.thinLive?.dispose(); this.thinLive = null; this.thinLiveShape = '';
    this.strands.geometry.setDrawRange(0, Infinity);
  }
  getLiveMaterialComparison() { return this.thinLive?.receipt() ?? null; }
  private contactMode: 'original' | 'stepped' = 'original';
  private contactView: WaterfallContactView | null = null;
  private contactSnapshot: WaterfallContactSnapshot | null = null;
  /** The worker owns release history, gravity, contacts and pool arrivals.
   * Render frames merely display its last physical snapshot, including pauses. */
  setContactSnapshot(snapshot: WaterfallContactSnapshot | null): void {
    this.contactSnapshot = snapshot;
    if (!snapshot) this.contactView?.clearSnapshot();
    this.setContactMode(this.contactMode);
    if (snapshot && this.contactView) this.contactView.update(snapshot);
  }
  setContactMode(mode: 'original' | 'stepped'): void {
    if (mode !== 'original' && mode !== 'stepped') throw Error('Unknown contact waterfall mode');
    this.contactMode = mode;
    const active = mode === 'stepped' || Boolean(this.contactSnapshot);
    if (active && !this.contactView && this.boundaryShading) {
      this.contactView = new WaterfallContactView(this.crest, this.boundaryShading);
      this.group.add(this.contactView.rocks); this.waterGroup.add(this.contactView.water);
      if (this.contactSnapshot) this.contactView.update(this.contactSnapshot);
    }
    this.contactView?.setVisible(active);
  }
  getContactReceipt() { return { mode: this.contactMode === 'stepped' || this.contactSnapshot ? 'stepped' : 'original', requestedMode: this.contactMode, draining: this.contactMode === 'original' && Boolean(this.contactSnapshot), authoritativeSnapshot: Boolean(this.contactSnapshot), pool: this.contactSnapshot && 'pool' in this.contactSnapshot ? this.contactSnapshot.pool : null, ...(this.contactView?.receipt() ?? {}) }; }
  private landingState: WaterfallLandingState | null = null;
  private cliff: THREE.Group | null = null;
  private readonly parcels: THREE.InstancedMesh;
  private readonly spray: THREE.InstancedMesh;
  private readonly strands: THREE.Mesh;
  // Full stays the default: pruning dormant branches did not reduce startup.
  // Only these two programs are cached; diagnostics do not accumulate variants.
  private volumeProgramPolicy:'full'|'on-demand'='full';
  private readonly volumePrograms=new Map<boolean,THREE.NodeMaterial>();
  private selectVolumeProgram():void {
    if(!this.boundaryShading)return;
    const v=this.volume;
    const full=this.volumeProgramPolicy==='full'||v.segmentLightMode.value>0||v.frozenReady.value>0
      ||v.interfaceNormalMode.value>0||v.opticalDiagnostic.value===7;
    let material=this.volumePrograms.get(full);
    if(!material){material=sweptVolumeMaterial(this.boundaryShading,v,false,full);this.volumePrograms.set(full,material);}
    this.strands.material=material;
  }
  /** Proof control for compilation only. The ordinary equations, textures,
   * geometry, source history and exposure are unchanged. Optional modes always
   * use the complete program, even under the on-demand policy. */
  setVolumeProgramPolicy(policy:'full'|'on-demand'):void {
    if(policy!=='full'&&policy!=='on-demand')throw Error('Unknown waterfall program policy');
    this.volumeProgramPolicy=policy;this.selectVolumeProgram();
  }
  getVolumeProgramReceipt(){return {policy:this.volumeProgramPolicy,
    active:!this.boundaryShading?'uninitialized':this.strands.material===this.volumePrograms.get(false)?'ordinary':'full',
    cachedPrograms:this.volumePrograms.size,scope:'Shader graph selection only; no optical quality or GPU timing claim'};}
  private materialSurfaceMode:'legacy'|'coherent-sheet'|'aerated-sheet'|'billow-volume'|'reconstructed-fluid'='legacy';
  private reconstructedFluid:WaterfallReconstructedFluid|null=null;
  private readonly fluidHistory=new FluidSourceHistory();
  private fluidDiagnostic:'shaded'|'raw-depth'|'smoothed-depth'|'thickness'|'age'='shaded';
  private fluidReceipt={emittedVolume:0,airborneVolume:0,landedVolume:0,budgetError:0,sourceTime:0,historyS:0,ready:false,reason:'Not selected',synthesisMs:0};
  private aeratedMesh:THREE.Mesh|null=null;
  private billowMesh:THREE.Mesh|null=null;
  private billowState=createBillowState();
  private billowField:BillowDensityField|null=null;
  private billowGridKey='';
  private billowFrameKey='';
  private billowUpload:Uint16Array|null=null;
  private billowReceipt={ready:false,reason:'Not built',fieldTime:0,updateMs:0,uploadMs:0,expectedVolume:0,depositedVolume:0,residualVolume:0,maximumFraction:0,expandedLobes:0,lobes:0,eventCount:0,maximumNodePartitionError:0,eventPartitionResidual:0,eventCapacityExceeded:false,sourceBudgetVolume:0 as number|null,quantizedVolume:0,quantizedVolumeError:0};
  private aeratedDiagnostic=uniform(0);
  private aeratedReceipt={updateMs:0,rows:0,ring:0,maximumLiquidFraction:0,secondaryLiquidVolume:0,sectionBudgetError:0};
  private materialSheetMesh:THREE.Mesh|null=null;
  private materialSurfaceReceipt={mode:'legacy',updateMs:0,rows:0,columns:0,meshVolume:0,emittedVolume:0,relativeVolumeError:0,maximumBandVolumeError:0,negativeBands:0,maximumRowStepM:0,maximumSectionAreaError:0,clippedVertices:0,drySectionAreaResidue:0,dryBandVolumeResidue:0,geometryMs:0,auditMs:0,invalidCoordinates:0,negativeCells:0,fallback:'',signedMeshVolume:0};
  private readonly approach: THREE.Mesh;
  private readonly course = defaultRiverCourse();
  private readonly crest = this.course.at(WATERFALL.crestS);
  private readonly matrix = new THREE.Matrix4();
  private readonly rotation = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly seeds: number[] = [];
  private shape: RiverShape;
  private sourceDischarge: number | null = null;
  private sourceHistory: RiverSourceStatus | undefined;
  private emissionPulse: RiverFloodPulseDescriptor | null = null;
  private floodPulse: RiverFloodPulseDescriptor | null = null;
  private floodSimulationTime = 0;
  private transientAtlas: WaterfallDensityAtlas | null = null;
  private transientAtlasKey = '';
  private floodBoundaryBounds: THREE.Box3 | null = null;
  private floodBoundaryKey = '';
  private transientFlight = 4;
  private floodInvalidSections = 0;
  private floodMinimumJacobian = Infinity;
  getFloodVisualReceipt() {
    return { active: waterfallFloodActive(this.floodPulse,this.floodSimulationTime), simulationTimeS:this.floodSimulationTime,
      invalidSections:this.floodInvalidSections, minimumCenterJacobian:this.floodMinimumJacobian,
      atlasUpdateMs:this.transientAtlas?.lastUpdateMs ?? 0, atlasBytes:this.transientAtlas?.textureBytes ?? 0,
      approximation:'Captured emission age stretched to current pool; center-plane mass compensation; rotating thick sections are not exact 3D fluid volume' };
  }
  /** Scene supplies authoritative simulation time. Render time never advances
   * the flood while paused. Ordinary water retains its original atlas/cache. */
  setFlood(pulse: RiverFloodPulseDescriptor | null, simulationTimeS: number, source?: RiverSourceStatus): void {
    this.sourceHistory = source; this.emissionPulse = pulse;
    // A gate change uses the existing transient emission atlas even after the
    // flood ends. Its historical rates retain water already in flight.
    this.floodPulse = source && source.changes.length > 1 ? {
      startS: source.changes[0].timeS - 1, durationS: 1e12, baseM3S: Math.max(...source.changes.map(change => change.q)),
      extraPeakM3S: pulse?.extraPeakM3S ?? 0, flightDelayS: source.flightDelayS,
      cancelS: null, cancelExtraM3S: 0, cancelDurationS: 1,
    } : pulse;
    this.floodSimulationTime = simulationTimeS;
  }
  private historicalSection(pulse: RiverFloodPulseDescriptor, time: number, age: number, flight: number, width: number, depth: number) {
    const section = waterfallFloodSection(this.emissionPulse ?? pulse, time, age, flight, width, depth);
    if (!this.sourceHistory || this.sourceHistory.changes.length <= 1) return section;
    const historyScale = this.sourceHistory.flightDelayS / Math.max(flight, 1e-8);
    const emissionS = time - age * historyScale;
    const q = riverSourceAt(this.sourceHistory, this.emissionPulse, emissionS);
    const speed = q / (width * depth);
    const speedAgeDerivative = q > 0 ? section.speedAgeDerivative : 0;
    const centerYDerivative = depth * 6 * age * Math.exp(-6 * age * age) - 9.81 * age;
    const planeJacobian = (speed * (speed + age * speedAgeDerivative) - 9.81 * age * centerYDerivative) / Math.max(Math.hypot(speed, 9.81 * age), 1e-8);
    return { ...section, q, speed, speedAgeDerivative, emissionS, historyScale, planeJacobian,
      area: q === 0 ? 0 : planeJacobian > 1e-5 ? q * historyScale / planeJacobian : q / Math.max(Math.hypot(speed, 9.81 * age), 1e-8), valid: q === 0 || planeJacobian > 1e-5 };
  }
  private atlasVersion = -1;
  private densityProfile: WaterfallDensityProfile = 'legacy';
  private formationFrozenTime:number|null=null;
  private activeAtlas: WaterfallDensityAtlas | null = null;
  private frozenSource: FrozenWaterfallSource | null = null;
  private frozenReason = 'No frozen optical source';
  private readonly opticalCamera = new THREE.Vector3(Infinity, Infinity, Infinity);
  private opticalTime = NaN;
  private frozenAtlasStamp = { key: '', value: '' };
  private frozenBoundaryStamp = { key: '', value: '' };
  private frozenSolarStamp = { key: '', visibility: '', bounce: '' };
  private readonly boundaryCache = new RiverBoundaryWorkerCache();
  private boundaryVersion = -1;
  private boundaryRevision = 0;
  private boundaryDirty = true;
  private boundarySourceKey = '';
  private boundaryBounds = new THREE.Box3();
  private boundarySunDirection = new THREE.Vector3();
  private boundaryShading: RiverWaterUniforms | null = null;
  private opaqueRoots: readonly THREE.Object3D[] = [];
  private opaqueRevision: string | number = 'cliff-only';
  private opaqueSampler?: BoundarySurfaceSampler;
  private readonly volume = createWaterfallVolumeUniforms();
  private readonly filmFlux = uniform(0.15);
  private readonly filmExit = uniform(0.21);
  private secondaryMode:'none'|'crosswise'='none';
  private baselineBodyGeometry:THREE.BufferGeometry|null=null;
  private secondaryBodyGeometry:THREE.BufferGeometry|null=null;
  private secondaryReceipt={mode:'none',rows:FALL_ROWS,ring:FALL_RING,maximumRowStepM:0,updateMs:0,fallback:''};
  private readonly filmOpening = uniform(0.7);
  private readonly fallTop = uniform(78);
  private readonly fallPool = uniform(8);
  private sourceFlow: ReturnType<typeof createRiverFlowTextures> | null = null;
  private sourceMap: RiverFlowMap | null = null;
  constructor(private readonly seed: number, shape: RiverShape, private readonly mirror: RiverSurfaceMirror) {
    this.shape = shape;
    const random = mulberry32(seed + 401);
    for (let i = 0; i < 2400; i += 1) this.seeds.push(random());
    const water = new THREE.MeshPhysicalMaterial({ color: 0x859b94, roughness: 0.08, metalness: 0, ior: 1.333, transparent: true, opacity: 0.6, depthWrite: false });
    const instancedGeometry = (base: THREE.BufferGeometry): THREE.InstancedBufferGeometry => {
      const own = new THREE.InstancedBufferGeometry(); own.setIndex(base.index);
      for (const [name, attribute] of Object.entries(base.attributes)) own.setAttribute(name, attribute);
      return own;
    };
    const parcelGeometry = instancedGeometry(new THREE.SphereGeometry(1, 7, 5));
    this.parcels = new THREE.InstancedMesh(parcelGeometry, water, 2400);
    this.parcels.frustumCulled = false;
    const sprayGeometry = instancedGeometry(new THREE.PlaneGeometry(1, 1));
    // THE MIST BUDGET (2026-10-11): 160 puffs drew a faint haze. A plunge of
    // 12 m^3/s over 46 m is 5.4 MW of impact; by the budget law that is about
    // 220 parcels a second, and with a 6 s life about 1,300 in the air. The
    // capacity holds the biggest flood the panel allows.
    sprayGeometry.setAttribute('mistLife', new THREE.InstancedBufferAttribute(new Float32Array(MIST_CAP), 1));
    this.spray = new THREE.InstancedMesh(sprayGeometry, new THREE.MeshBasicMaterial({ color: 0xc7dbd8, transparent: true, opacity: 0.12, depthWrite: false }), MIST_CAP);
    this.spray.frustumCulled = false;
    const geo = createWaterfallBodyGeometry(FALL_ROWS,FALL_RING);
    const film = new THREE.MeshPhysicalMaterial({ color: 0x79958b, roughness: 0.06, ior: 1.333, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide });
    // Reuse the river's breakup texture for airborne white water, rather
    // than adding a separate painted waterfall texture or an opaque curtain.
    film.alphaMap = getRiverFoamTexture();
    this.strands = new THREE.Mesh(geo, film); this.strands.frustumCulled = false;
    const apron = new THREE.PlaneGeometry(1, 1, 24, 40); apron.rotateX(-Math.PI / 2);
    this.approach = new THREE.Mesh(apron, film.clone()); this.approach.frustumCulled = false;
    this.group.add(this.parcels, this.spray, this.strands, this.approach);
    this.buildCliff();
  }
  /** Actual accepted source, including zero while a dry landing is blocked. */
  /** Constant interior scattering isolates bounds from turbulent appearance. */
  /** Proof-only prescribed morphology; the shipped profile remains legacy.
   * Switching replaces density snapshots, preserving section mass and optics.
   * The next ordinary update installs the selected profile's texture depth.
   * Formation captures one explicit frozen time; call this setter again with
   * a new time for a proof refresh. Flood always uses its resident legacy atlas. */
  setVolumeDensityProfile(profile: WaterfallDensityProfile, frozenTime?:number): void {
    if (profile !== 'legacy' && profile !== 'packets' && profile !== 'folds' && profile !== 'formation') throw new Error('Unknown waterfall density profile');
    if(frozenTime!==undefined&&!Number.isFinite(frozenTime))throw new Error('Frozen density time must be finite');
    if(profile===this.densityProfile&&(profile!=='formation'||frozenTime===undefined||frozenTime===this.formationFrozenTime))return;
    this.formationFrozenTime=profile==='formation'?(frozenTime??null):null;
    this.setFrozenVolumeSource(null); this.densityProfile = profile; this.atlasVersion = -1;
  }
  getVolumeDensityReceipt() {
    const a = this.activeAtlas;
    return { requestedProfile: this.densityProfile, activeProfile: a?.profile ?? null,
      ready: a?.profile === this.densityProfile && (this.densityProfile!=='formation'||a?.frozenTime===this.opticalTime), config: a?.config ?? null,
      frozenTime:a?.frozenTime??null,frozenTimeMatchesFrame:this.densityProfile!=='formation'||a?.frozenTime===this.opticalTime,
      initializationMs: a?.initializationMs ?? null, lastUpdateMs: a?.lastUpdateMs ?? null,
      textureBytes: a?.textureBytes ?? 0, supportExpansions: a?.supportExpansions ?? 0,
      fullSectionFallbacks: a?.fullSectionFallbacks ?? 0, maximumFallbackAge: a?.maximumFallbackAge ?? null,
      intendedUse: this.densityProfile === 'folds'||this.densityProfile==='formation' ? 'frozen diagnostic; live update cost not accepted' : 'existing comparison profile',
      approximation: 'prescribed emission/development sheets; sampled whole-section mass, not resolved turbulence' };
  }
  /** Default-off shared liquid-interface proof, independently of old density
   * profiles/lighting. Selecting before the first frame hides the old volume. */
  setVolumeMaterialSurface(mode:'legacy'|'coherent-sheet'|'aerated-sheet'|'billow-volume'|'reconstructed-fluid'):void{
    if(mode!=='legacy'&&mode!=='coherent-sheet'&&mode!=='aerated-sheet'&&mode!=='billow-volume'&&mode!=='reconstructed-fluid')throw new Error('Unknown material surface mode');
    this.materialSurfaceMode=mode;this.strands.visible=mode==='legacy';if(this.materialSheetMesh)this.materialSheetMesh.visible=mode!=='legacy'&&mode!=='reconstructed-fluid';if(this.aeratedMesh)this.aeratedMesh.visible=mode==='aerated-sheet';if(this.billowMesh)this.billowMesh.visible=mode==='billow-volume'&&this.billowReceipt.ready;
  }
  /** Fog-only attribution, independent of transfer or brightness repair. Raw
   * channels describe shader-linear values; a screen capture may still pass
   * through the native output/exposure pipeline. Uniform fog claims no mass. The actual-density fog-only control
   * removes the clear core to expose depth/intersection cuts without changing fog. */
  /** Default-off native surface reconstruction. No targets are allocated by
   * legacy frames. Time seeks regenerate birth labels rather than integrating
   * a frame-dependent particle simulation. This preserves released shutdown
   * water only in the candidate; the original renderer retains its semantics. */
  getVolumeReconstructedFluidReceipt(){return {...this.fluidReceipt,history:this.fluidHistory.receipt(),diagnostic:this.fluidDiagnostic,requestedMode:this.materialSurfaceMode,render:this.reconstructedFluid?.receipt??null,
    approximation:'Captured source openings; prescribed relative motion and ballistic gravity; nearest-depth bilateral reconstruction, additive overlap thickness; no solved pressure or terrain collision',
    historyContract:'Ordinary edits sampled at their first rendered frame; rewind removes future edits. Analytic flood birth history uses native flight delay.'};}
  resetReconstructedFluidHistory():void{this.fluidHistory.reset();this.fluidReceipt.ready=false;this.fluidReceipt.reason='History explicitly reset; next update seeds current source';}
  setReconstructedFluidDiagnostic(mode:'shaded'|'raw-depth'|'smoothed-depth'|'thickness'|'age'):void{
    if(!['shaded','raw-depth','smoothed-depth','thickness','age'].includes(mode))throw Error('Unknown fluid diagnostic');
    this.fluidDiagnostic=mode;this.reconstructedFluid?.setDiagnostic(mode);
  }
  renderReconstructedFluid(renderer:THREE.WebGPURenderer,camera:THREE.PerspectiveCamera,target:THREE.RenderTarget,width:number,height:number):void{
    if(this.materialSurfaceMode==='reconstructed-fluid'&&this.fluidReceipt.ready)this.reconstructedFluid?.render(renderer,camera,target,width,height);
  }
  private updateReconstructedFluid(t:number,pulse:RiverFloodPulseDescriptor|null,Q:number):boolean{
    const started=performance.now(),time=pulse?this.floodSimulationTime:t;
    const opening={...this.shape,dischargeM3S:Math.max(0,Q)};
    const initial=waterfallHydraulics(opening),landing=waterfallLanding(this.crest,initial);
    const measured=this.mirror.sheetAt(landing.x,landing.z);
    const pool=this.landingState?.poolLevel??(Number.isFinite(measured)?measured:WATERFALL.poolLevel);
    const h=waterfallHydraulics(opening,pool);
    const current:FluidBirth={q:Math.max(0,Q),speed:h.speed,width:h.width,depth:h.depth,top:h.top,ageScale:1};
    this.fluidHistory.record(time,current);
    // Use the accepted pulse's historical release time, not the present crest
    // Q applied to an entire falling body. Gravity age follows native delay.
    const ageScale=pulse?pulse.flightDelayS/h.flightS:1;
    const historyS=Math.max(h.flightS*ageScale+.2,4.2);
    const sourceAt=(birth:number):FluidBirth=>this.sourceHistory && this.sourceHistory.changes.length > 1 ? {...current,q:riverSourceAt(this.sourceHistory,this.emissionPulse,birth),speed:riverSourceAt(this.sourceHistory,this.emissionPulse,birth)/(h.width*h.depth),ageScale}:pulse?{...current,q:Math.max(0,riverFloodSourceAt(pulse,birth)),speed:Math.max(0,riverFloodSourceAt(pulse,birth))/(h.width*h.depth),ageScale}:this.fluidHistory.at(birth);
    if(!this.boundaryShading){this.fluidReceipt={...this.fluidReceipt,ready:false,reason:'Native river shading is unavailable'};this.strands.visible=Q>0;return false;}
    try{
      const result=buildFluidParticles(time,pool,historyS,sourceAt);
      this.reconstructedFluid??=new WaterfallReconstructedFluid(this.boundaryShading);
      this.reconstructedFluid.setDiagnostic(this.fluidDiagnostic);
      this.reconstructedFluid.update(result.particles,this.crest);
      this.fluidReceipt={...this.fluidReceipt,emittedVolume:result.emittedVolume,airborneVolume:result.airborneVolume,landedVolume:result.landedVolume,budgetError:result.budgetError,sourceTime:time,historyS,ready:true,reason:'',synthesisMs:performance.now()-started};
    }catch(error){
      this.fluidReceipt={...this.fluidReceipt,ready:false,reason:error instanceof Error?error.message:String(error),synthesisMs:performance.now()-started};
      this.strands.visible=Q>0;return false;
    }
    this.strands.visible=false;if(this.materialSheetMesh)this.materialSheetMesh.visible=false;if(this.aeratedMesh)this.aeratedMesh.visible=false;if(this.billowMesh)this.billowMesh.visible=false;
    (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount=0;
    (this.spray.geometry as THREE.InstancedBufferGeometry).instanceCount=0;
    this.approach.visible=(this.sourceDischarge??Q)>0;
    this.fallTop.value=h.top;this.fallPool.value=pool;
    // Preserve the native approach and its upstream course. Only airborne
    // water is reconstructed; the receiving river's shader/maps stay shared.
    const position=this.approach.geometry.getAttribute('position')as THREE.BufferAttribute,uvs=this.approach.geometry.getAttribute('uv')as THREE.BufferAttribute;
    for(let row=0;row<=40;row++)for(let col=0;col<=24;col++){
      const forward=-40+row,lateral=(col/24-.5)*h.width,c=this.course.at(WATERFALL.crestS+forward),i=row*25+col;
      const wave=Math.sin(forward*1.7-time*h.speed*1.7+lateral*1.2)*Math.min(.035,h.depth*.12)*Math.min(1,Math.max(0,-forward/2));
      position.setXYZ(i,c.x+c.tz*lateral,h.top+wave,c.z-c.tx*lateral);uvs.setXY(i,col/24,row/12-time*h.speed*.05);
    }
    position.needsUpdate=true;uvs.needsUpdate=true;this.approach.geometry.computeVertexNormals();
    return true;
  }
  setVolumeAeratedDiagnostic(mode:'off'|'transfer'|'liquid-fraction'|'uniform-fog'|'fog-only'):void{
    const index=['off','transfer','liquid-fraction','uniform-fog','fog-only'].indexOf(mode);if(index<0)throw Error('Unknown aerated diagnostic');
    this.aeratedDiagnostic.value=index;if(this.materialSheetMesh)this.materialSheetMesh.visible=index===0&&this.materialSurfaceMode!=='legacy';
  }
  getVolumeAeratedDiagnosticReceipt(){return {mode:['off','transfer','liquid-fraction','uniform-fog','fog-only'][this.aeratedDiagnostic.value],fogOnly:this.aeratedDiagnostic.value!==0,uniformPhi:.01,rawTransfer:'RGB = transfer fraction, alpha = 1, no discard',rawPhi:'RGB = liquid volume fraction, alpha = 1, no discard',rawSpace:'Shader-linear before native output/exposure',uniformMassClaim:false};}
  setVolumeBillowSampling(options:{cameraSamples?:12|24|48;lightSamples?:8|16|32;eventSamples?:2|4}):void{
    if(options.cameraSamples!==undefined){if(![12,24,48].includes(options.cameraSamples))throw Error('Invalid billow camera samples');this.billowState.cameraSamples.value=options.cameraSamples;}
    if(options.lightSamples!==undefined){if(![8,16,32].includes(options.lightSamples))throw Error('Invalid billow light samples');this.billowState.lightSamples.value=options.lightSamples;}
    if(options.eventSamples!==undefined){if(![2,4].includes(options.eventSamples))throw Error('Invalid billow event samples');this.billowState.eventSamples.value=options.eventSamples;}
  }
  setVolumeBillowDiagnostic(mode:'off'|'optical-depth'|'light-transmission'|'gradient-confidence'|'unattenuated-light'|'integration-work'):void{
    const index=['off','optical-depth','light-transmission','gradient-confidence','unattenuated-light','integration-work'].indexOf(mode);if(index<0)throw Error('Unknown billow diagnostic');this.billowState.diagnostic.value=index;
  }
  getVolumeBillowReceipt(){return {...this.billowReceipt,dimensions:this.billowField?.dimensions??null,spacing:this.billowField?.spacing??null,bounds:this.billowField?.bounds??null,cameraSamples:this.billowState.cameraSamples.value,lightSamples:this.billowState.lightSamples.value,lightDirections:5,eventSamples:this.billowState.eventSamples.value,integration:BILLOW_TRANSPORT,workDisplay:'Shader-linear RGB=camera intervals/64, source calls/16, light 3D texture reads/1024. May exceed1; native tone-map screenshots are not calibrated counts. Camera polynomial reads4 per interval; source gradient reads7 per source call; LUT reads separate',budgetFailureDisplay:'Opaque magenta means unsupported camera/light interval or optical inverse cap; result is not accepted',maximumLightQueries:BILLOW_TRANSPORT.maximumIntervals*this.billowState.eventSamples.value*5*BILLOW_TRANSPORT.maximumIntervals*4,diagnostic:['off','optical-depth','light-transmission','gradient-confidence','unattenuated-light','integration-work'][this.billowState.diagnostic.value],opticalDepthDisplay:'RGB=tau/(1+tau)',lightDisplay:'R=sun T, G=upper sky T, B=gradient confidence; contribution-weighted',representation:'Individual formation events own oblique curved material supports and exact nodal debit shares; fixed voxel grid filters finer edges. Localized finite emission/across deformation events drive shared clear debit and compact 3D deposits; local cap expansion; voxel budgets, not exact swept-fluid union',emissionStepS:BILLOW_VOLUME.emissionStepS,sourceSampling:'Texel-center cubic density intervals; positive Gauss-CDF actual cumulative-density source events, shared max-channel extinction importance with full RGB weights; 2→4 event refinement required',coefficients:{radiusM:this.volume.interfaceRadius.value,scatteringScale:this.volume.scatteringScale.value,absorptionScale:this.volume.absorptionScale.value},closure:'Cubic-integrated full-extinction camera/light rays (ideal trilinear arithmetic; floating-point center crossing guard). Uniform-fog attribution uses support-indicator interpolation approximation; no mass claim; approximate diffuse whitewater closure; no nonlocal transport or terrain light occlusion',rawModes:'Transfer is density-weighted camera-path mean; phi is camera-path mean. Native output may tone-map both',proxy:'Front-side external-camera box, no depth writes; opaque native depth clips ray. All occupied intervals integrated',background:'Scalar alpha uses mean RGB transmission; absorption differences in the scattering-dominant fog are approximated',bytes:(this.billowField?.data.byteLength??0)+(this.billowUpload?.byteLength??0)};}
  getVolumeMaterialSurfaceReceipt(){return {...this.materialSurfaceReceipt,reconstructed:this.getVolumeReconstructedFluidReceipt(),requestedMode:this.materialSurfaceMode,billow:this.getVolumeBillowReceipt(),receiptCurrent:this.materialSurfaceReceipt.mode===this.materialSurfaceMode,coherentOnly:this.materialSurfaceMode==='coherent-sheet',aeration:this.materialSurfaceMode==='aerated-sheet'||this.materialSurfaceMode==='billow-volume'?'Relative-deformation proxy, partitioned meshed fog':'Not modeled',cellAuditPerformed:this.materialSurfaceReceipt.mode==='coherent-sheet',cellAudit:this.materialSurfaceReceipt.mode==='aerated-sheet'||this.materialSurfaceReceipt.mode==='billow-volume'?'Not run: negativeCells=-1; signed band audit remains per update':this.materialSurfaceReceipt.mode==='coherent-sheet'?'Full signed cell audit of the recorded coherent frame':'No current material-cell audit; retained geometry values are not fallback measurements',secondary:{...this.aeratedReceipt,receiptCurrent:this.materialSurfaceReceipt.mode==='aerated-sheet',accounting:'Normal-section liquid area only, not a measured swept or union volume',optics:'Local rounded meshed-fog extinction/Lambert closure; nonlocal transport and cliff visibility omitted'},coreLiquidFraction:1,
    optics:'Core only: nearest entry via depth writing, dielectric reflection/shared absorption; finite local section-prism chord and native screen-space refraction, not exact folded mesh traversal',
    volumeClaim:'Local vertical extrusion determinant includes historical forward derivative. Independent signed bands/cells and emitted Q dt are reported; sums are not a proven union volume. No global mass scaling',
    intersectionClaim:'Band orientation checked; global self-intersection/opaque cliff clearance not proven; axial cap chord ignores distance to end plane',diagnosticOnly:true};}
  setVolumeDiagnostic(enabled: boolean): void { this.volume.diagnostic.value = enabled ? 1 : 0; }
  /** Scratch proof harnesses can isolate transport coefficients and sampling
   * while the prescribed liquid field, landing, and downstream shader stay fixed. */
  setVolumeOptics(options: { radiusM?: number; scatteringScale?: number; absorptionScale?: number; cameraSamples?: 12 | 24 | 48; exitBisections?: 6 | 10 | 12; transport?: 'single' | 'two-stream' }): void {
    if (options.radiusM !== undefined && Number.isFinite(options.radiusM)) this.volume.interfaceRadius.value = Math.max(WATERFALL_OPTICS.minRadiusM, Math.min(WATERFALL_OPTICS.maxRadiusM, options.radiusM));
    if (options.scatteringScale !== undefined && Number.isFinite(options.scatteringScale)) this.volume.scatteringScale.value = Math.max(0, Math.min(1, options.scatteringScale));
    if (options.absorptionScale !== undefined && Number.isFinite(options.absorptionScale)) this.volume.absorptionScale.value = Math.max(0, Math.min(1, options.absorptionScale));
    if (options.cameraSamples !== undefined && [12, 24, 48].includes(options.cameraSamples)) this.volume.cameraSamples.value = options.cameraSamples;
    if (options.exitBisections !== undefined && [6, 10, 12].includes(options.exitBisections)) this.volume.exitBisections.value = options.exitBisections;
    if (options.transport !== undefined) this.volume.transportMode.value = options.transport === 'single' ? 0 : 1;
  }
  /** Cliff-boundary proof controls. Black blocked sky is diagnostic only;
   * production uses sampled rock reflection. Unsupported extra meshes retain
   * the environment and are counted instead of being silently painted black. */
  setBoundaryLightingMode(mode: 'off' | 'radiance' | 'black-visibility'): void { this.volume.boundaryMode.value = { off: 0, radiance: 1, 'black-visibility': 2 }[mode]; }
  setOpaqueScene(roots: readonly THREE.Object3D[], revision: string | number, sampler?: BoundarySurfaceSampler): void {
    this.opaqueRoots = [...roots]; this.opaqueRevision = revision; this.opaqueSampler = sampler; this.boundaryDirty = true; this.volume.boundaryReady.value = 0;
  }
  invalidateOpaqueScene(revision: string | number): void { this.opaqueRevision = revision; this.boundaryDirty = true; this.volume.boundaryReady.value = 0; }
  getBoundaryLightingReceipt() { return { ...this.boundaryCache.receipt(), cliffGeometryRevision: this.boundaryRevision, opaqueRevision: this.opaqueRevision, albedoReadbackMs: waterfallBoundaryReadback.milliseconds, albedoReadbackBytes: waterfallBoundaryReadback.bytes, exitBisections: this.volume.exitBisections.value }; }
  /** Read-only proof of opacity, RGB light transmission, or mean liquid density.
   * Values are literal [0,1] quantities with opaque output, so the background
   * cannot change their interpretation. Colored transmission is retained. */
  setVolumeOpticalDiagnostic(mode: 'none' | 'opacity' | 'sun-transmission' | 'sky-transmission' | 'density' | 'interface-normal' | 'interface-confidence' | 'event-density'): void {
    this.volume.opticalDiagnostic.value = { none: 0, opacity: 1, 'sun-transmission': 2, 'sky-transmission': 3, density: 4, 'interface-normal':5, 'interface-confidence':6, 'event-density':7 }[mode];
    this.selectVolumeProgram();
  }
  /** Default-off proof of a local density interface. It changes only the slab
   * source orientation, never the coherent reflection or camera extinction. */
  /** Proof-only connected deformation; source, atlas and optical settings stay
   * unchanged. The baseline retains its original129 rows and48 ring vertices. */
  setVolumeSecondaryDeformation(mode:'none'|'crosswise'):void {
    if(mode!=='none'&&mode!=='crosswise')throw new Error('Unknown secondary waterfall deformation');
    if(mode===this.secondaryMode)return;
    this.setFrozenVolumeSource(null);this.secondaryMode=mode;
    this.baselineBodyGeometry??=this.strands.geometry;
    if(mode==='crosswise')this.secondaryBodyGeometry??=createWaterfallBodyGeometry(WATERFALL_SECONDARY.rows,FALL_RING*WATERFALL_SECONDARY.slotsPerEdge);
    this.strands.geometry=mode==='crosswise'?this.secondaryBodyGeometry!:this.baselineBodyGeometry;
    this.volume.secondaryDeformation.value=mode==='crosswise'?1:0;
  }
  getVolumeSecondaryDeformationReceipt(){const g=this.strands.geometry;return {...this.secondaryReceipt,
    rowSchedule:'flight * pow(row/(rows-1),1.45)',diagnosticOnly:true,triangles:(g.index?.count??0)/3,vertexCount:g.getAttribute('position').count,
    // Interleaved fields share one array; count that storage once.
    geometryBytes:g.getAttribute('position').array.byteLength+g.getAttribute('normal').array.byteLength+g.getAttribute('uv').array.byteLength+(g.getAttribute('liquidDepth') as THREE.InterleavedBufferAttribute).data.array.byteLength+(g.index?.array.byteLength??0),
    resolvedRowSpacing:this.secondaryReceipt.maximumRowStepM<=WATERFALL_SECONDARY.axialCellM/6,
    approximation:'Section area exact; swept panels/3D volume and first connected ray interval require separate proof'};}
  /** Proof-only sun or combined sky/sun integration. It REPLACES the all-order slab
   * source; no extra solar term is added. Density, geometry and camera beam
   * remain unchanged. Off retains the original renderer and its defaults. */
  setVolumeSegmentLighting(mode:'off'|'sun-only'|'combined',sunSamples:4|8|16=4):void {
    if(mode!=='off'&&mode!=='sun-only'&&mode!=='combined')throw new Error('Unknown segment lighting mode');
    if(![4,8,16].includes(sunSamples))throw new Error('Segment sun samples must be4,8 or16');
    this.setFrozenVolumeSource(null);this.volume.segmentLightMode.value=mode==='combined'?2:mode==='sun-only'?1:0;
    this.volume.segmentSunSamples.value=sunSamples;this.selectVolumeProgram();
  }
  /** Midpoint is an attribution control, not a density fallback or repair.
   * Only source position changes; camera coefficients and weights stay fixed. */
  setVolumeSegmentSourcePosition(mode:'conditional'|'midpoint'):void {
    if(mode!=='conditional'&&mode!=='midpoint')throw new Error('Unknown segment source position');
    this.setFrozenVolumeSource(null);this.volume.segmentSourcePosition.value=mode==='midpoint'?1:0;
  }
  /** Attribution only: move each sky sample within its own integration cell.
   * The midpoint default retains the previous quadrature. Solar paths and
   * all camera coefficients/weights keep their original sample positions. */
  setVolumeSegmentSkyOffset(offset:.25|.5|.75):void {
    if(![.25,.5,.75].includes(offset))throw new Error('Segment sky offset must be.25,.5 or.75');
    this.volume.segmentSkyOffset.value=offset;
  }
  setVolumeSegmentSkySamples(samples:2|4|8):void {
    if(![2,4,8].includes(samples))throw new Error('Segment sky samples must be2,4 or8');
    this.volume.segmentSkySamples.value=samples;
  }
  /** Use the same body geometry and camera in a linear FloatType target.
   * This isolated material bypasses tone mapping and blending. Read RGB floats,
   * not display PNG values; its uniforms track the current frozen field. */
  getVolumeEventDensityProbe(quantity:'summary'|'near-empty-numerator'|'weight'|'density-ratio-numerator'|'fallback-numerator'|'zero-numerator'|'low-density-numerator'|'effective-near-empty-numerator'|'scattering-ratio-numerator'='summary'){
    if(!this.boundaryShading)throw new Error('Waterfall material not initialized');
    const quantities=['summary','near-empty-numerator','weight','density-ratio-numerator','fallback-numerator','zero-numerator','low-density-numerator','effective-near-empty-numerator','scattering-ratio-numerator'];
    const q=quantities.indexOf(quantity);if(q<0)throw new Error('Unknown event density probe quantity');
    const state={...this.volume,opticalDiagnostic:uniform(7),eventProbeQuantity:uniform(q)};
    const material=sweptVolumeMaterial(this.boundaryShading,state,true);
    material.toneMapped=false;material.transparent=false;material.blending=THREE.NoBlending;
    const mesh=new THREE.Mesh(this.strands.geometry,material);
    this.strands.updateWorldMatrix(true,false);mesh.matrixAutoUpdate=false;mesh.matrix.copy(this.strands.matrixWorld);mesh.matrixWorld.copy(this.strands.matrixWorld);
    return {material,mesh,quantity,rawRGB:quantity!=='summary',
      setQuantity:(next:typeof quantity)=>{const index=quantities.indexOf(next);if(index<0)throw new Error('Unknown event density probe quantity');state.eventProbeQuantity.value=index;},
      normalization:'Raw RGB channels retain separate collision-weight numerator/denominator. Sum body pixel numerators and corresponding weight before dividing; alpha1 identifies rendered body, cleared background alpha0.',
      channels:{summary:'R near-empty weighted fraction;G weighted clamped density ratio;B1 when contribution exists, otherwise0',raw:'R/G/B are independent extinction-channel weighted sums'},threshold:.01,sensitivity:[0,.1],range:[0,1],rawLinear:true,
      scope:'Isolated body only, no scene occluders; current geometry/world transform borrowed, camera supplied by caller; no sun/sky/slab/frozen source graph in this probe',
      dispose:()=>material.dispose()};
  }
  getVolumeSegmentLightingReceipt(){const v=this.volume;return {
    mode:v.segmentLightMode.value>1?'combined':v.segmentLightMode.value>0?'sun-only':'off',cameraSamples:v.cameraSamples.value,sunSamples:v.segmentSunSamples.value,
    sourcePosition:v.segmentSourcePosition.value>0?'midpoint':'conditional',skySamples:v.segmentSkySamples.value,skyOffset:v.segmentSkyOffset.value,skyAbscissa:'(cellIndex+skyOffset)*exitDistance/skySamples; equal cell weights and count unchanged, solar offset fixed.5',eventDensityDiagnostic:'Raw conditional points before envelope fallback/control; opticalDiagnostic7 or linear body probe',
    exitBisections:v.exitBisections.value,RGBEvents:'Separate conditional event per extinction channel; one shared point only when allRGB extinction is exactly equal',
    maximumSunDensityQueries:v.cameraSamples.value*3*v.segmentSunSamples.value,
    maximumSkyDensityQueries:v.segmentLightMode.value>1?v.cameraSamples.value*3*3*v.segmentSkySamples.value:0,
    maximumSkyOccupancyQueries:v.segmentLightMode.value>1?v.cameraSamples.value*3*3*v.exitBisections.value:0,
    skyQuadrature:'Original three phase-integrated directions, independent2/4/8 samples per path at skyOffset, original sky moments/gain; no hemisphere renormalization',
    maximumSunOccupancyQueries:v.cameraSamples.value*3*(v.exitBisections.value+1),
    approximation:'Conditional-mean source quadrature in midpoint-homogeneous camera segments; first connected light interval and midpoint sun quadrature',
    opaqueBoundary:'Excluded as in old selected-single solar source; this isolates internalwater estimator',
    diagnosticOnly:true,defaultMode:'off'};}
  /** Default-on camera occlusion. The proof switch changes only how far the
   * live camera integrates water, without rebuilding material or simulation. */
  setCameraDepthClip(enabled: boolean): void { this.volume.cameraDepthClip.value = enabled ? 1 : 0; }
  getCameraDepthClip(): boolean { return this.volume.cameraDepthClip.value > 0; }
  setVolumeInterfaceNormal(mode:'envelope'|'density'):void {this.volume.interfaceNormalMode.value=mode==='density'?1:0;this.selectVolumeProgram();}
  private volumeFieldSignature(): string {
    const v = this.volume, key = [this.atlasVersion, v.atlasFirst.version, v.atlasSecond.version].join('/');
    if (this.frozenAtlasStamp.key !== key) this.frozenAtlasStamp = { key, value: waterfallHalfFingerprint(v.atlasFirst.image.data as Uint16Array) + '/' + waterfallHalfFingerprint(v.atlasSecond.image.data as Uint16Array) };
    return JSON.stringify([this.frozenAtlasStamp.value, ...(['sourceHistoryEnabled', 'secondaryDeformation', 'floodEnabled', 'floodTime', 'floodStart', 'floodDuration', 'floodBase', 'floodExtra', 'floodCancel', 'floodCancelExtra', 'floodCancelDuration', 'floodAgeScale', 'top', 'pool', 'flux', 'width', 'speed', 'depth', 'flight', 'atlasBlend', 'atlasAges', 'diagnostic', 'interfaceRadius', 'scatteringScale', 'absorptionScale'] as const).map(k => v[k].value),
      ...(['crest', 'forward', 'across', 'boundsMin', 'boundsMax'] as const).map(k => v[k].value.toArray()), this.boundaryShading?.uAbsorbClear.value.toArray(), WATERFALL_OPTICS.g]);
  }
  private volumeLightingSignature(): string {
    const v = this.volume, U = this.boundaryShading;
    const key = [this.boundaryVersion, v.boundaryH.version, v.boundaryZ.version].join('/');
    if (this.frozenBoundaryStamp.key !== key) this.frozenBoundaryStamp = { key, value: waterfallHalfFingerprint(v.boundaryH.image.data as Uint16Array) + '/' + waterfallHalfFingerprint(v.boundaryZ.image.data as Uint16Array) };
    // Sun is excluded from this diffuse-only experiment. The actual H/Z
    // content is fingerprinted, so a different rock bake cannot reuse a
    // solved source merely because a fresh browser restarted version at one.
    return JSON.stringify([this.frozenBoundaryStamp.value, U?.uSkyHorizon.value.toArray(), U?.uSkyZenith.value.toArray(), U?.uSkyGain.value, v.boundaryMin.value.toArray(), v.boundaryMax.value.toArray(), v.boundaryReady.value, v.boundaryMode.value, this.boundaryRevision, this.opaqueRevision]);
  }
  /** Signed native solar state for the optional frozen proof only. A stale,
   * incomplete or unsupported boundary bake cannot authorize direct sunlight. */
  private nativeFrozenSolarState(): FrozenWaterfallSolarState | undefined {
    const U = this.boundaryShading, v = this.volume, receipt = this.boundaryCache.receipt();
    if (!U || this.boundaryDirty || !receipt.ready || receipt.error || receipt.unsupportedMeshes !== 0 || v.boundaryReady.value !== 1 || v.boundaryMode.value !== 1 || this.boundaryVersion !== this.boundaryCache.version) return undefined;
    const toward = U.uSunDir.value, irradiance = U.uSunColor.value.toArray() as [number, number, number];
    if (![...toward.toArray(), ...irradiance].every(Number.isFinite) || Math.abs(toward.length() - 1) > 1e-8 || irradiance.some(value => value < 0) || !toward.equals(this.boundarySunDirection)) return undefined;
    const pixels = v.boundarySun.image.data as Uint16Array;
    const expected = BOUNDARY_LIGHT.x * BOUNDARY_LIGHT.y * BOUNDARY_LIGHT.z * BOUNDARY_LIGHT.directions * 4;
    if (!(pixels instanceof Uint16Array) || pixels.length !== expected) return undefined;
    const key = [this.boundaryVersion, v.boundarySun.version].join('/');
    if (this.frozenSolarStamp.key !== key) {
      const visibility = new Uint16Array(pixels.length / 4), bounce = new Uint16Array(pixels.length / 4 * 3);
      for (let cell = 0; cell < visibility.length; cell++) {
        const alpha = THREE.DataUtils.fromHalfFloat(pixels[cell * 4 + 3]);
        if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return undefined;
        visibility[cell] = pixels[cell * 4 + 3];
        for (let channel = 0; channel < 3; channel++) {
          const value = THREE.DataUtils.fromHalfFloat(pixels[cell * 4 + channel]);
          if (!Number.isFinite(value) || value < 0) return undefined;
          bounce[cell * 3 + channel] = pixels[cell * 4 + channel];
        }
      }
      this.frozenSolarStamp = { key, visibility: waterfallHalfFingerprint(visibility), bounce: waterfallHalfFingerprint(bounce) };
    }
    const scope = JSON.stringify([receipt.revision, this.boundaryRevision, this.opaqueRevision, v.boundaryMin.value.toArray(), v.boundaryMax.value.toArray(), v.boundaryMode.value, receipt.scope]);
    const propagationDirection = toward.clone().negate().toArray() as [number, number, number];
    const visibilitySignature = scope + '/SUN.a/' + this.frozenSolarStamp.visibility;
    const bounceSignature = scope + '/SUN.rgb/' + this.frozenSolarStamp.bounce;
    return { propagationDirection, irradiance, visibilitySignature, bounceSignature, signature: JSON.stringify([propagationDirection, irradiance, visibilitySignature, bounceSignature]) };
  }
  /** Exact represented static-triangle overlap after a conservative broad phase.
   * Entry-face visibility cannot remove beam power at an embedded opaque
   * surface. A triangle touching this box blocks the entry-only diagnostic.
   * This checks represented surfaces, not whether an unrepresented solid
   * encloses the entire box; the native cache scope remains explicit. */
  getFrozenSolarIntegrationReceipt(boundsMin: readonly [number, number, number], boundsMax: readonly [number, number, number]) {
    if ([...boundsMin, ...boundsMax].some(value => !Number.isFinite(value)) || boundsMax.some((value, axis) => value <= boundsMin[axis])) throw new Error('Solar integration needs finite positive RTE bounds');
    const box = new THREE.Box3(new THREE.Vector3(...boundsMin), new THREE.Vector3(...boundsMax));
    const cache = new THREE.Box3(this.volume.boundaryMin.value, this.volume.boundaryMax.value);
    const intersections: { uuid: string; name: string; triangle: number; vertices: number[][] }[] = [], unsupportedKinds: string[] = [], seen = new Set<THREE.Mesh>();
    let triangleChecks = 0, intersectionCount = 0;
    for (const root of this.cliff ? [this.cliff, ...this.opaqueRoots] : this.opaqueRoots) root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || seen.has(object)) return;
      seen.add(object); let parent: THREE.Object3D | null = object;
      while (parent) { if (!parent.visible) return; parent = parent.parent; }
      if (!Array.isArray(object.material) && object.material.transparent) return;
      object.updateWorldMatrix(true, false);
      const bound = new THREE.Box3().setFromObject(object, true);
      if (!bound.intersectsBox(box)) return;
      if (object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh || object.morphTargetInfluences?.some(value => value !== 0)) { unsupportedKinds.push(object.uuid); return; }
      const geometry = object.geometry, position = geometry.getAttribute('position'), index = geometry.index;
      if (!position) { unsupportedKinds.push(object.uuid); return; }
      const count = index ? index.count : position.count, start = Math.max(0, geometry.drawRange.start), end = Math.min(count, start + geometry.drawRange.count);
      if (start % 3 !== 0 || !Number.isInteger(start)) { unsupportedKinds.push(object.uuid); return; }
      const triangle = new THREE.Triangle();
      for (let offset = start; offset + 2 < end; offset += 3) {
        for (const [vertex, slot] of [[triangle.a, 0], [triangle.b, 1], [triangle.c, 2]] as const) vertex.fromBufferAttribute(position, index ? index.getX(offset + slot) : offset + slot).applyMatrix4(object.matrixWorld);
        triangleChecks++;
        if (![...triangle.a.toArray(), ...triangle.b.toArray(), ...triangle.c.toArray()].every(Number.isFinite)) { unsupportedKinds.push(object.uuid); break; }
        if (box.intersectsTriangle(triangle)) { intersectionCount++; if (intersections.length < 8) intersections.push({ uuid: object.uuid, name: object.name, triangle: offset / 3, vertices: [triangle.a.toArray(), triangle.b.toArray(), triangle.c.toArray()] }); }
      }
    });
    const state = this.nativeFrozenSolarState(), cacheContainsGrid = cache.containsBox(box);
    return { eligible: !!state && cacheContainsGrid && intersectionCount === 0 && unsupportedKinds.length === 0, state, cacheContainsGrid, intersectionCount, triangleChecks, intersections, unsupportedKinds,
      representedOpaqueScope: this.boundaryCache.receipt().scope, opaqueCheck: 'actual indexed/draw-range static triangles against world box; touching counts as intersection; instanced/skinned/morphed overlap unsupported',
      visibilityApproximation: 'native cache trilinear interpolation at actual grid faces; no interior opaque sink; no out-of-domain clamping',
      reason: !state ? 'Native solar cache is stale, incomplete, invalid or unsupported' : !cacheContainsGrid ? 'RTE faces exceed native visibility cache bounds' : unsupportedKinds.length ? 'Opaque overlap audit requires represented static triangle geometry' : intersectionCount ? 'Actual represented opaque triangles intersect RTE box; entry-face-only beam cannot be activated' : 'Entry-face beam eligible; angular/spatial and camera refinement remain unproven' };
  }
  private frozenCurrentState() {
    return { time: this.opticalTime, camera: this.opticalCamera.toArray() as [number, number, number], fieldSignature: this.volumeFieldSignature(), lightingSignature: this.volumeLightingSignature(), sunZero: !!this.boundaryShading && this.boundaryShading.uSunColor.value.r === 0 && this.boundaryShading.uSunColor.value.g === 0 && this.boundaryShading.uSunColor.value.b === 0, solar: this.nativeFrozenSolarState() };
  }
  /** Optional frozen proof, never a live-water default. Clearing restores the
   * ordinary source and changes no camera, background, time or shared light.
   * Half-float J and cell means are approximations; camera extinction keeps
   * the production density, so grid power balance is not full-render proof. */
  setFrozenVolumeSource(proof: FrozenWaterfallSource | null): void {
    this.volume.frozenReady.value = 0; this.frozenSource = null; this.frozenReason = 'Frozen source cleared';
    if (!proof) {this.selectVolumeProgram();return;}
    validateFrozenWaterfallSource(proof, this.frozenCurrentState());
    const sourceBounds = new THREE.Box3(new THREE.Vector3(...proof.boundsMin), new THREE.Vector3(...proof.boundsMax));
    if (!sourceBounds.containsBox(new THREE.Box3(this.volume.boundsMin.value, this.volume.boundsMax.value))) throw new Error('Frozen source must cover the production volume bounds');
    if (proof.solar) { const integration = this.getFrozenSolarIntegrationReceipt(proof.boundsMin, proof.boundsMax); if (!integration.eligible) throw new Error(integration.reason); }
    const data = new Uint16Array(proof.size.reduce((a, b) => a * b, 4));
    for (let k = 0; k < proof.sourceRGB.length / 3; k++) { for (let c = 0; c < 3; c++) data[k * 4 + c] = THREE.DataUtils.toHalfFloat(proof.sourceRGB[k * 3 + c]); data[k * 4 + 3] = THREE.DataUtils.toHalfFloat(1); }
    const texture = this.volume.frozenSource;
    texture.dispose(); texture.image = { data, width: proof.size[0], height: proof.size[1], depth: proof.size[2] }; texture.needsUpdate = true;
    this.volume.frozenMin.value.fromArray(proof.boundsMin); this.volume.frozenMax.value.fromArray(proof.boundsMax);
    this.frozenSource = { ...proof, sourceRGB: proof.sourceRGB.slice(), camera: [...proof.camera], size: [...proof.size], boundsMin: [...proof.boundsMin], boundsMax: [...proof.boundsMax], receipt: { ...proof.receipt }, solar: proof.solar ? { ...proof.solar, propagationDirection: [...proof.solar.propagationDirection], irradiance: [...proof.solar.irradiance], incoming: [...proof.solar.incoming], outgoing: [...proof.solar.outgoing], absorbed: [...proof.solar.absorbed], scattered: [...proof.solar.scattered] } : undefined };
    this.frozenReason = proof.solar ? 'Frozen solar + diffuse source active; spatial and angular convergence unproven' : 'Frozen diffuse source active; spatial and angular convergence unproven'; this.volume.frozenReady.value = 1;this.selectVolumeProgram();
  }
  getFrozenVolumeSourceReceipt() { return { active: !!this.frozenSource && this.volume.frozenReady.value > 0, reason: this.frozenReason, frozenTime: this.frozenSource?.frozenTime, camera: this.frozenSource?.camera, sourceTextureBytes: this.volume.frozenSource.image.data?.byteLength ?? 0, solar: this.frozenSource?.solar, approximation: this.frozenSource?.solar ? 'frozen cell-mean J; analytic first solar phase; nearest-bin secondary phase; half-float spatial interpolation; production camera extinction; entry-face-only opaque beam' : 'frozen cell-mean J, nearest outgoing angular bin, half-float spatial interpolation; exact production camera extinction' }; }
  /** Frozen coefficient export for the scratch angular-transport proof.
   * RGBA stores sigma_s and RGB sigma_a in inverse meters, before lighting or
   * tone mapping. Snapshot textures and uniforms prevent live atlas updates
   * from changing a readback midway through its frozen field. This does not
   * bind a new source or alter the production scattering approximation. */
  getVolumeCoefficientProbe(size: readonly [number, number, number], padding = 1, options: { solar?: boolean } = {}) {
    if (size.length !== 3 || !size.every(value => Number.isInteger(value) && value > 0) || !Number.isFinite(padding) || padding < 0) throw new Error('Coefficient probe needs positive integer dimensions and finite nonnegative padding');
    if (!this.boundaryShading) throw new Error('Coefficient probe needs initialized river shading');
    const boundsMin = this.volume.boundsMin.value.clone().addScalar(-padding);
    const boundsMax = this.volume.boundsMax.value.clone().addScalar(padding);
    const extent = boundsMax.clone().sub(boundsMin);
    if (![...boundsMin.toArray(), ...boundsMax.toArray()].every(Number.isFinite) || !extent.toArray().every(value => value > 0)) throw new Error('Coefficient probe needs an updated nonempty fall');
    const spacing = extent.clone().divide(new THREE.Vector3(...size));
    const cloneAtlas = (source: THREE.Data3DTexture) => {
      const copy = source.clone();
      // Texture.clone shares its Source. Give the frozen proof its own image
      // and storage, without detaching the authoritative production atlas.
      const data = source.image.data as Uint16Array;
      copy.source = new THREE.Source({ ...source.image, data: data.slice() }); copy.needsUpdate = true; return copy;
    };
    const state = { ...this.volume };
    for (const key of ['sourceHistoryEnabled', 'secondaryDeformation', 'floodEnabled', 'floodTime', 'floodStart', 'floodDuration', 'floodBase', 'floodExtra', 'floodCancel', 'floodCancelExtra', 'floodCancelDuration', 'floodAgeScale', 'top', 'pool', 'flux', 'width', 'speed', 'depth', 'flight', 'atlasBlend', 'atlasAges', 'diagnostic', 'interfaceRadius', 'scatteringScale', 'absorptionScale'] as const) state[key] = uniform(this.volume[key].value);
    for (const key of ['crest', 'forward', 'across', 'boundsMin', 'boundsMax'] as const) state[key] = uniform(this.volume[key].value.clone());
    state.sourceRates = this.volume.sourceRates.clone(); state.sourceRates.image = { ...this.volume.sourceRates.image, data: (this.volume.sourceRates.image.data as Float32Array).slice() }; state.sourceRates.needsUpdate = true;
    state.atlasFirst = cloneAtlas(this.volume.atlasFirst); state.atlasSecond = cloneAtlas(this.volume.atlasSecond);
    const frozenTime = this.boundaryShading.uTime.value;
    const U = { ...this.boundaryShading, uTime: uniform(frozenTime), uAbsorbClear: uniform(this.boundaryShading.uAbsorbClear.value.clone()) };
    const { densityFn } = createWaterfallDensityFunctions(U, state);
    const minimum = uniform(boundsMin); const cellSpacing = uniform(spacing);
    const material = new THREE.NodeMaterial();
    material.transparent = true; material.blending = THREE.NoBlending; material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
    material.fragmentNode = Fn(() => {
      // Standard fullscreen plane UV: top row has v near one. WebGPU
      // top-origin readback row iy + ny*iz stores the lowest world-y cell.
      const column = floor(uv().x.mul(size[0]));
      const row = floor(float(1).sub(uv().y).mul(size[1] * size[2]));
      const layer = floor(row.div(size[1]));
      const index = vec3(column, row.sub(layer.mul(size[1])), layer);
      const world = minimum.add(index.add(.5).mul(cellSpacing));
      const coefficients = densityFn(world).toVar();
      const absorption = max(U.uAbsorbClear, vec3(0)).mul(state.absorptionScale).mul(coefficients.x);
      // The production camera stops at these bounds. Padding belongs to
      // the transport experiment and must remain vacuum, including the
      // impact-tail taper that the shared density function extends below it.
      const inside = world.x.greaterThanEqual(state.boundsMin.x).and(world.x.lessThanEqual(state.boundsMax.x))
        .and(world.y.greaterThanEqual(state.boundsMin.y)).and(world.y.lessThanEqual(state.boundsMax.y))
        .and(world.z.greaterThanEqual(state.boundsMin.z)).and(world.z.lessThanEqual(state.boundsMax.z));
      return vec4(coefficients.y, absorption).mul(float(inside));
    })();
    return { material, width: size[0], height: size[1] * size[2], size: [...size] as [number, number, number],
      productionBoundsMin: state.boundsMin.value.toArray(), productionBoundsMax: state.boundsMax.value.toArray(),
      boundsMin: boundsMin.toArray() as [number, number, number], boundsMax: boundsMax.toArray() as [number, number, number], spacing: spacing.toArray() as [number, number, number], frozenTime,
      optics: { g: WATERFALL_OPTICS.g, radiusM: state.interfaceRadius.value, scatteringScale: state.scatteringScale.value, absorptionScale: state.absorptionScale.value, absorptionPerLiquidMeter: U.uAbsorbClear.value.toArray(), atlasBlend: state.atlasBlend.value, acceptedQ: state.flux.value * state.width.value, densityDiagnostic: state.diagnostic.value, atlasVersion: this.atlasVersion, fieldSignature: this.volumeFieldSignature() },
      solarNative: options.solar ? { state: this.nativeFrozenSolarState(), integration: this.getFrozenSolarIntegrationReceipt(boundsMin.toArray() as [number, number, number], boundsMax.toArray() as [number, number, number]), dimensions: [BOUNDARY_LIGHT.x, BOUNDARY_LIGHT.y, BOUNDARY_LIGHT.z, BOUNDARY_LIGHT.directions] as const, packedSun: (this.volume.boundarySun.image.data as Uint16Array).slice(), format: 'RGBA16F', layout: '(((direction*nz+z)*ny+y)*nx+x)*4; point-to-source angular directions', boundsMin: this.volume.boundaryMin.value.toArray(), boundsMax: this.volume.boundaryMax.value.toArray() } : undefined,
      lighting: { signature: this.volumeLightingSignature(), sunTowardSource: this.boundaryShading.uSunDir.value.toArray(), sunIrradiance: this.boundaryShading.uSunColor.value.toArray(), skyHorizon: this.boundaryShading.uSkyHorizon.value.toArray(), skyZenith: this.boundaryShading.uSkyZenith.value.toArray(), skyGain: this.boundaryShading.uSkyGain.value, boundaryBoundsMin: this.volume.boundaryMin.value.toArray(), boundaryBoundsMax: this.volume.boundaryMax.value.toArray(), boundaryReady: this.volume.boundaryReady.value, boundaryMode: this.volume.boundaryMode.value, cliffRevision: this.boundaryRevision },
      dispose: () => { material.dispose(); state.sourceRates.dispose(); state.atlasFirst.dispose(); state.atlasSecond.dispose(); } };
  }
  /** Return the actual compiled shaders for proof without changing water state. */
  async getCompiledVolumeShader(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<{ vertexShader: string; fragmentShader: string }> {
    // Inspect the selected prototype when diagnosing it. Reading the legacy
    // fall here would hide failures in the shader actually being evaluated.
    const mesh = this.materialSurfaceMode === 'billow-volume' && this.billowMesh ? this.billowMesh : this.strands;
    const shaders = await renderer.debug.getShaderAsync(scene, camera, mesh);
    if (!shaders.vertexShader || !shaders.fragmentShader) throw new Error('Waterfall shader compilation did not produce both stages');
    return { vertexShader: shaders.vertexShader, fragmentShader: shaders.fragmentShader };
  }
  setSourceDischarge(q: number): void {
    if (this.sourceDischarge === q) return;
    this.sourceDischarge = q;
    // The source texture still follows current emission, but does not re-pack
    // all three maps for every accepted landing snapshot during a pulse.
    if (!waterfallFloodActive(this.floodPulse,this.floodSimulationTime)) this.updateSourceMap();
  }
  /** Draw the same accepted trajectory that supplies pool mass and foam. */
  setLanding(state: WaterfallLandingState | null): void {
    const previous = this.landingState; this.landingState = state;
    if (state && (!previous || state.width !== previous.width || state.depth !== previous.depth || state.top !== previous.top)) this.updateSourceMap();
  }
  setShape(shape: RiverShape): void {
    // A downstream terrain dab carries the same source shape. Rebuilding
    // its detailed finite cliff froze the page for over two seconds per
    // patch. Preserve the existing geometry, light boundary and source maps
    // when all shape values are unchanged; real shape edits still rebuild.
    if (this.shape.widthScale === shape.widthScale && this.shape.depthScale === shape.depthScale
      && this.shape.dischargeM3S === shape.dischargeM3S) return;
    this.shape = shape; this.updateSourceMap(); this.buildCliff();
  }
  /** The prescribed approach waterline, for the shared reflection camera.
   * The receiving solver deliberately has no water seventy meters up here. */
  surfaceAt(x: number, z: number): number | null {
    const projected = this.course.project(x, z);
    const h = waterfallHydraulics(this.shape);
    return projected.s >= WATERFALL.crestS - 40 && projected.s <= WATERFALL.crestS && Math.abs(projected.n) <= h.width * 0.5 ? h.top : null;
  }
  useRiverShading(uniforms: RiverWaterUniforms): void {
    this.setFrozenVolumeSource(null);
    this.boundaryShading = uniforms; this.boundaryDirty = true; this.volume.boundaryReady.value = 0;
    (this.parcels.material as THREE.Material).dispose(); (this.approach.material as THREE.Material).dispose();
    const oldPrograms=new Set<THREE.Material>([this.strands.material as THREE.Material,...this.volumePrograms.values()]);
    for(const program of oldPrograms)program.dispose();this.volumePrograms.clear();
    (this.spray.material as THREE.Material).dispose();
    const mist = new THREE.NodeMaterial(); mist.transparent = true; mist.depthWrite = false; mist.side = THREE.DoubleSide;
    const mistNoise = texture(getRiverNoiseTexture());
    mist.fragmentNode = Fn(() => {
      const p = uv().sub(0.5).mul(2);
      const edge = pow(max(0, float(1).sub(dot(p, p))), 2);
      const cloud = mistNoise.sample(uv().mul(0.18).add(uniforms.uTime.mul(0.013))).b;
      // Soft, irregular fine mist follows impact energy. These translucent
      // puffs are secondary dispersed spray, never the bulk falling water.
      // Fifteen times the puffs of before (the budget law), so each one
      // carries less: the plume reads as many thin veils, never one disc.
      return vec4(uniforms.uSkyHorizon.mul(vec3(0.84, 0.87, 0.86)).mul(uniforms.uSkyGain), edge.mul(smoothstep(0.2, 0.8, cloud)).mul(attribute('mistLife', 'float')).mul(0.045));
    })();
    this.spray.material = mist;
    this.parcels.material = airborneMaterial(uniforms, this.fallTop, this.fallPool, this.filmFlux, this.filmExit, this.filmOpening, true); this.selectVolumeProgram();
    // The approach uses the actual river shader: depth absorption, advected
    // detail normals and reflected scene content. Its prescribed upstream
    // opening has a local flow map; it is not a second fluid simulation.
    const grid = { x0: this.crest.x - 64, z0: this.crest.z - 64, dx: 1, nx: 128, nz: 128 };
    const n = grid.nx * grid.nz;
    this.sourceMap = { grid, t0: new Float32Array(n * 4), t1: new Float32Array(n * 4), t2: new Float32Array(n * 4), surface: new Float32Array(n), stats: { wetCells: n, eddyCells: 0, maxWhite: 0, maxStreak: 0, meanSpeedWet: 0 } };
    this.updateSourceMap();
    this.sourceFlow = createRiverFlowTextures(this.sourceMap);
    const { uFlow2, uFlow2Texel, uFlow2Cell, uGridOrigin, uGridSize, uMainRapidsOptics, uMainRapidsMask, uPoolImpactFrame, uPoolImpactEnergy, uPoolImpactLevel, ...shared } = uniforms;
    // Only the local map/grid differ. All optical parameters and frame targets
    // remain the same nodes the receiving river reads.
    this.approach.material = createRiverWaterMaterial(this.sourceMap, this.sourceFlow, shared).material;
    // Refraction reads the opaque scene first, just as the receiving river
    // does. Drawing the fall in that opaque scene would sample itself.
    this.group.remove(this.parcels, this.strands, this.spray, this.approach);
    this.waterGroup.add(this.approach, this.strands, this.parcels, this.spray);
    if(this.billowMesh){(this.billowMesh.material as THREE.Material).dispose();this.billowMesh.material=billowVolumeMaterial(uniforms,this.fallPool,this.billowState,this.aeratedDiagnostic,this.volume);this.waterGroup.add(this.billowMesh);}
    if(this.aeratedMesh){(this.aeratedMesh.material as THREE.Material).dispose();this.aeratedMesh.material=aeratedSheetMaterial(uniforms,this.fallPool,this.aeratedDiagnostic);this.waterGroup.add(this.aeratedMesh);}
    if(this.materialSheetMesh){(this.materialSheetMesh.material as THREE.Material).dispose();this.materialSheetMesh.material=materialSheetMaterial(uniforms,this.fallPool,this.volume.width,this.volume.across);this.waterGroup.add(this.materialSheetMesh);this.materialSheetMesh.renderOrder=10;}
    this.strands.renderOrder = 10; this.parcels.renderOrder = 11; this.spray.renderOrder = 12;
  }
  private point(forward: number, lateral: number, height: number): THREE.Vector3 {
    const p = this.crest;
    return new THREE.Vector3(p.x + p.tx * forward + p.tz * lateral, height, p.z + p.tz * forward - p.tx * lateral);
  }
  private updateSourceMap(): void {
    if (!this.sourceMap) return;
    const h = waterfallHydraulics({ ...this.shape, dischargeM3S: waterfallFloodActive(this.floodPulse,this.floodSimulationTime)
      ? riverFloodSourceAt(this.floodPulse!,this.floodSimulationTime) : this.sourceDischarge ?? this.shape.dischargeM3S });
    // Flood rate and depth stay live. Grid/course coordinates are unchanged
    // between edits, so retain their exact double-precision projection.
    const projection = riverSourceMapProjection(this, this.course, this.sourceMap.grid, this.crest);
    for (let c = 0; c < this.sourceMap.surface.length; c += 1) {
      const offset = c * 5;
      const pr = { s: projection[offset], n: projection[offset + 1] };
      const p = { tx: projection[offset + 2], tz: projection[offset + 3] };
      const crestForward = projection[offset + 4];
      const rock = waterfallSourceRockHeight(pr.n, h.width, crestForward);
      const shelf = waterfallSourceShelfHeight(pr.s - WATERFALL.crestS, pr.n, h.width);
      const depth = Math.max(0, h.top - rock - shelf);
      this.sourceMap.t0.set([depth > 0 ? p.tx * h.speed : 0, depth > 0 ? p.tz * h.speed : 0, depth, h.top], c * 4);
      this.sourceMap.t1[c * 4 + 3] = 0.05;
      this.sourceMap.surface[c] = h.top;
    }
    if (this.sourceFlow) {
      // Texture data is packed as half floats. Refill the existing bindings so
      // live shape changes do not rebuild or retune the downstream material.
      const next = createRiverFlowTextures(this.sourceMap);
      for (const key of ['flow0', 'flow1', 'flow2'] as const) {
        this.sourceFlow[key].image.data = next[key].image.data; this.sourceFlow[key].needsUpdate = true; next[key].dispose();
      }
    }
  }
  private buildCliff(): void {
    if (this.cliff) {
      this.group.remove(this.cliff); disposeWaterfallCliff(this.cliff);
    }
    this.cliff = buildWaterfallCliff({ seed: this.seed, shape: this.shape, course: this.course });
    this.group.add(this.cliff); this.boundaryRevision++; this.boundaryDirty = true; this.volume.boundaryReady.value = 0;
  }
  private updateBoundaryLight(): void {
    if (!this.boundaryShading) return;
    const sun = this.boundaryShading.uSunDir.value;
    // Geometry/light revisions invalidate exact cached rays. Q and landing
    // drift inside these world bounds do not change outside radiance; color
    // and gain uniforms stay live through the three transfer bases.
    const sourceKey = String(waterfallRockDiagnostics.albedoWeight.value);
    const bounds = new THREE.Box3(this.volume.boundsMin.value.clone(), this.volume.boundsMax.value.clone());
    if (waterfallFloodActive(this.floodPulse,this.floodSimulationTime) && this.floodBoundaryBounds) bounds.union(this.floodBoundaryBounds);
    if (sourceKey !== this.boundarySourceKey || !sun.equals(this.boundarySunDirection) || !this.boundaryBounds.containsBox(bounds)) this.boundaryDirty = true;
    if (this.boundaryDirty) {
      // Two meters of padding absorbs moving folds without rebuilding rays
      // every frame. If the actual envelope escapes, its bounds are expanded.
      bounds.expandByScalar(2); this.boundaryBounds.copy(bounds); this.boundarySunDirection.copy(sun); this.boundarySourceKey = sourceKey;
      this.boundaryCache.configure(this.cliff ? [this.cliff, ...this.opaqueRoots] : this.opaqueRoots, this.boundaryRevision + ':' + this.opaqueRevision + ':' + sourceKey, bounds, sun, this.opaqueSampler);
      this.volume.boundaryMin.value.copy(bounds.min); this.volume.boundaryMax.value.copy(bounds.max); this.volume.boundaryReady.value = 0; this.boundaryDirty = false;
    }
    this.boundaryCache.step();
    if (this.boundaryCache.receipt().ready && this.boundaryVersion !== this.boundaryCache.version) {
      for (const [texture, data] of [[this.volume.boundaryH, this.boundaryCache.horizon], [this.volume.boundaryZ, this.boundaryCache.zenith], [this.volume.boundarySun, this.boundaryCache.sun]] as const) { texture.image.data = data; texture.needsUpdate = true; }
      this.boundaryVersion = this.boundaryCache.version; this.volume.boundaryReady.value = 1;
    }
  }
  update(t: number, camera: THREE.Camera): void {
    this.updateOriginal(t, camera);
    if (!this.thinLiveEnabled || !this.boundaryShading || this.contactMode !== 'original' || this.contactSnapshot) return;
    const q = this.sourceDischarge ?? this.shape.dischargeM3S;
    const h = waterfallHydraulics(this.shape, this.landingState?.poolLevel ?? WATERFALL.poolLevel);
    const key = [h.top,h.width,h.depth].join('/');
    if (!this.thinLive || key !== this.thinLiveShape) {
      this.thinLive?.dispose();
      this.thinLive = new WaterfallThinLiveView(this.crest, this.boundaryShading, h.top, (this.landingState?.poolLevel ?? WATERFALL.poolLevel) + 1, h.width, h.depth, h.speed);
      this.waterGroup.add(this.thinLive.mesh); this.thinLiveShape = key;
    }
    this.thinLive.update(this.floodSimulationTime, q);
    // Retain the original thick crest entrance only. Everything below the
    // detached entrance comes from advancing material vertices, not the six
    // density supports. Pool arrival timing remains the original approximation.
    const rows = Math.max(1, Math.floor(Math.pow(this.thinLive.entranceDelay / h.flightS, 1 / 1.45) * (FALL_ROWS - 1)));
    this.strands.geometry.setDrawRange(0, rows * FALL_RING * 6);
    this.parcels.visible = false; this.spray.visible = false;
  }
  private updateOriginal(t: number, camera: THREE.Camera): void {
    this.opticalTime = t; camera.getWorldPosition(this.opticalCamera);
    if (this.contactMode === 'stepped' || this.contactSnapshot) {
      this.setContactMode(this.contactMode);
      this.contactView?.present();
      this.approach.visible = (this.sourceDischarge ?? this.shape.dischargeM3S) > 0;
      this.strands.visible = false; this.parcels.visible = false; this.spray.visible = false;
      if (this.materialSheetMesh) this.materialSheetMesh.visible = false;
      if (this.aeratedMesh) this.aeratedMesh.visible = false;
      if (this.billowMesh) this.billowMesh.visible = false;
      // This return prevents density-atlas reconstruction and boundary bakes
      // for a mode that uses actual finite liquid geometry instead.
      return;
    }
    this.parcels.visible = true; this.spray.visible = true;
    const pulse = waterfallFloodActive(this.floodPulse,this.floodSimulationTime) ? this.floodPulse : null;
    const Q = pulse && this.sourceHistory && this.sourceHistory.changes.length > 1 ? Math.max(...this.sourceHistory.changes.map(change => change.q), this.emissionPulse?.baseM3S ?? 0) : pulse ? riverFloodSourceAt(pulse,this.floodSimulationTime) : this.landingState?.discharge ?? this.sourceDischarge ?? this.shape.dischargeM3S;
    if(this.materialSurfaceMode==='reconstructed-fluid'&&this.updateReconstructedFluid(t,pulse,Q))return;
    this.approach.visible = (this.sourceDischarge ?? Q) > 0;
    if (Q <= 0) {
      this.setFrozenVolumeSource(null);
      this.strands.visible = false;
      if(this.materialSheetMesh)this.materialSheetMesh.visible=false;
      if(this.aeratedMesh)this.aeratedMesh.visible=false;
      if(this.billowMesh)this.billowMesh.visible=false;
      (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount = 0;
      (this.spray.geometry as THREE.InstancedBufferGeometry).instanceCount = 0;
      return;
    }
    const opening = { ...this.shape, dischargeM3S: Q };
    let h = waterfallHydraulics(opening);
    const landing = waterfallLanding(this.crest, h);
    const impact = new THREE.Vector3(landing.x, WATERFALL.poolLevel, landing.z);
    const measured = this.mirror.sheetAt(impact.x, impact.z);
    // A dynamic pool level changes the flight duration, while the mountain
    // lip remains fixed. Falling parcels stop at the actual receiving water.
    const bottom = Number.isFinite(measured) ? measured : 8;
    h = this.landingState ? { ...this.landingState, impactS: WATERFALL.crestS + this.landingState.forward } : waterfallHydraulics(opening, bottom);
    if (pulse) h = waterfallHydraulics(opening,this.landingState?.poolLevel ?? bottom);
    const top = h.top; const flight = h.flightS;
    const bodyTime = pulse ? this.floodSimulationTime : t;
    this.floodInvalidSections=0;this.floodMinimumJacobian=Infinity;
    const sectionSource = (age: number) => pulse ? this.historicalSection(pulse,this.floodSimulationTime,age,flight,h.width,h.depth) : { q: Q, speed: h.speed, area: undefined };
    const arrivingSource = sectionSource(flight);
    this.volume.sourceHistoryEnabled.value = this.sourceHistory && this.sourceHistory.changes.length > 1 ? 1 : 0;
    if (this.volume.sourceHistoryEnabled.value) {
      const rates = this.volume.sourceRates.image.data as Float32Array;
      for (let i = 0; i < 1024; i++) {
        const source = this.historicalSection(pulse!, this.floodSimulationTime, WATERFALL_ATLAS.maxAge * i / 1023, flight, h.width, h.depth);
        rates[i * 4] = source.q; rates[i * 4 + 1] = source.speedAgeDerivative;
      }
      this.volume.sourceRates.needsUpdate = true;
    }
    const receivingLevel = this.landingState?.poolLevel ?? bottom;
    this.fallTop.value = top; this.fallPool.value = receivingLevel;
    this.filmFlux.value = Q / h.width; this.filmExit.value = h.speed; this.filmOpening.value = h.depth;
    const volumeState = this.volume;
    volumeState.top.value = top; volumeState.pool.value = receivingLevel; volumeState.flux.value = Q / h.width;
    volumeState.width.value = h.width; volumeState.speed.value = h.speed; volumeState.depth.value = h.depth; volumeState.flight.value = flight;
    volumeState.floodEnabled.value = pulse ? 1 : 0;
    if (pulse) {
      volumeState.floodTime.value = this.floodSimulationTime; volumeState.floodStart.value = pulse.startS;
      volumeState.floodDuration.value = pulse.durationS; volumeState.floodBase.value = pulse.baseM3S; volumeState.floodExtra.value = pulse.extraPeakM3S;
      volumeState.floodCancel.value = pulse.cancelS ?? 1e20; volumeState.floodCancelExtra.value = pulse.cancelExtraM3S;
      volumeState.floodCancelDuration.value = Math.max(1e-8,pulse.cancelDurationS); volumeState.floodAgeScale.value = pulse.flightDelayS / flight;
      this.transientFlight = flight;
      const boundaryKey = [pulse.startS,h.width,h.depth,pulse.extraPeakM3S,pulse.baseM3S,this.crest.x,this.crest.z,this.crest.tx,this.crest.tz].join('/');
      if (this.floodBoundaryKey !== boundaryKey) {
        this.floodBoundaryKey = boundaryKey; this.floodBoundaryBounds = new THREE.Box3();
        const peak = pulse.baseM3S + pulse.extraPeakM3S, launch = peak/(h.width*h.depth);
        // Reserve the pulse's maximum swept support once. Without this, a
        // growing front repeatedly terminates the off-thread lighting bake.
        // Its fixed probe grid becomes coarser over this larger domain.
        for(let k=0;k<=64;k++) {
          const age=WATERFALL_ATLAS.maxAge*k/64;
          const s=waterfallLiquidSection(peak,h.width,launch,age,0);
          const center=this.point(launch*age,0,top-.5*WATERFALL.gravity*age*age);
          const radius=s.width*.8+s.thickness*2.5+h.depth+2;
          this.floodBoundaryBounds.expandByPoint(center.clone().addScalar(radius));
          this.floodBoundaryBounds.expandByPoint(center.clone().subScalar(radius));
        }
      }
      const key = [pulse.startS,pulse.baseM3S,pulse.extraPeakM3S,h.width,h.depth].join('/');
      if (!this.transientAtlas || this.transientAtlasKey !== key) {
        this.transientAtlasKey = key;
        const peak = pulse.baseM3S + pulse.extraPeakM3S, width = h.width, depth = h.depth;
        // One resident legacy atlas per pulse/opening. Actual neighbouring
        // snapshots tighten the initial peak-Q caps; each section is normalized
        // to its center-plane budget, not claimed as exact airborne 3D volume.
        this.transientAtlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(peak,width,peak/(width*depth),age,0),'legacy', {
          emissionAt: (age,time) => time-age*this.floodPulse!.flightDelayS/this.transientFlight,
          sectionAtTime: (age,time) => {
            const source = this.historicalSection(this.floodPulse!,time,age,this.transientFlight,width,depth);
            return waterfallLiquidSection(source.q,width,source.speed,age,0,source.area);
          }
        });
      }
      if (this.transientAtlas.update(this.floodSimulationTime)) this.updateSourceMap();
    }
    const atlas = pulse ? this.transientAtlas! : getWaterfallAtlas(Q, h.width, h.speed, t, this.densityProfile);
    if(!pulse&&this.densityProfile==='formation')atlas.freezeAt(this.formationFrozenTime??=t);
    this.activeAtlas = atlas;
    // Only a selected profile snapshot boundary uploads the two resident textures.
    // Geometry, launch, impact and downstream water retain their own state.
    if (volumeState.atlasFirst.image.data !== atlas.first || this.atlasVersion !== atlas.version) {
      if (volumeState.atlasFirst.image.depth !== atlas.config.ages) {
        volumeState.atlasFirst.dispose(); volumeState.atlasSecond.dispose();
      }
      volumeState.atlasFirst.image = { data: atlas.first, width: atlas.config.x, height: atlas.config.y, depth: atlas.config.ages };
      volumeState.atlasSecond.image = { data: atlas.second, width: atlas.config.x, height: atlas.config.y, depth: atlas.config.ages };
      volumeState.atlasFirst.needsUpdate = true; volumeState.atlasSecond.needsUpdate = true;
      this.atlasVersion = atlas.version;
    }
    volumeState.atlasBlend.value = atlas.blend; volumeState.atlasAges.value = atlas.config.ages;
    volumeState.crest.value.set(this.crest.x, 0, this.crest.z);
    volumeState.forward.value.set(this.crest.tx, 0, this.crest.tz); volumeState.across.value.set(this.crest.tz, 0, -this.crest.tx);
    volumeState.boundsMin.value.set(Infinity, Infinity, Infinity); volumeState.boundsMax.value.set(-Infinity, -Infinity, -Infinity);
    // A connected approach surface visibly feeds the crest, with ripples
    // traveling toward the lip and the same material as the falling water.
    const apronPosition = this.approach.geometry.getAttribute('position') as THREE.BufferAttribute;
    const apronUV = this.approach.geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let row = 0; row <= 40; row += 1) {
      const forward = -40 + row;
      // Every vertex in this row follows the same current river station.
      // Reuse only within this update; terrain and source edits still rebuild it.
      const course = this.course.at(WATERFALL.crestS + forward);
      for (let col = 0; col <= 24; col += 1) {
      const lateral = (col / 24 - 0.5) * h.width;
      const wave = Math.sin(forward * 1.7 - t * h.speed * 1.7 + lateral * 1.2) * Math.min(0.035, h.depth * 0.12) * Math.min(1, Math.max(0, -forward / 2));
      // The existing upstream channel curves: follow its bed, then use the
      // final crest tangent only for airborne launch. A straight forty-meter
      // apron crossed dry banks and left a separate floating water shelf.
      const index = row * 25 + col;
      apronPosition.setXYZ(index, course.x + course.tz * lateral, top + wave, course.z - course.tx * lateral);
      apronUV.setXY(index, col / 24, row / 12 - t * h.speed * 0.05);
      }
    }
    apronPosition.needsUpdate = true; apronUV.needsUpdate = true; updateWaterGeometryNormals(this.approach.geometry);
    const rate = Math.max(8, Math.min(80, 8 * Math.pow(Q, 0.6)));
    const approachS = Math.min(4, 18 / Math.max(0.1, h.speed));
    const count = Math.min(2400, Math.ceil(rate * (flight + approachS)));
    // Three 0.172 fixes the matrix binding from the first mesh count.
    // Keep capacity stable and change the geometry count, like vegetation.
    (this.parcels.geometry as THREE.InstancedBufferGeometry).instanceCount = count;
    // Connected water carries the visible bulk at every flow. Small parcels
    // are secondary breakup, so they never define a uniform bead curtain.
    const volume = Q * 0.025 / rate;
    const radius = Math.max(0.008, Math.cbrt(volume * 3 / (4 * Math.PI)) * 0.65);
    this.strands.visible = true;
    // The main liquid now owns its resolved clusters and clear launch.
    // Overlaying stretched parcel capsules drew unrelated thin lines across
    // that volume. Keep their presentation available, but show only impact
    // spray alongside the integrated body.
    this.parcels.visible = false;
    const positions = this.strands.geometry.getAttribute('position') as THREE.BufferAttribute;
    const depths = this.strands.geometry.getAttribute('liquidDepth') as THREE.BufferAttribute;
    const uvs = this.strands.geometry.getAttribute('uv') as THREE.BufferAttribute;
    // Every envelope field is constant around one cross-section. Compare its
    // exact Float32 row before rewriting or uploading the shared GPU buffer.
    // This geometry starts zeroed and this loop is its sole envelope writer;
    // each row therefore stays uniform, including after source/terrain edits.
    const envelope = (depths as unknown as THREE.InterleavedBufferAttribute).data;
    const envelopeRow = new Float32Array(14);
    let envelopeChanged = false;
    const secondary=this.secondaryMode==='crosswise';
    const bodyRows=secondary?WATERFALL_SECONDARY.rows:FALL_ROWS;
    const bodyRing=secondary?FALL_RING*WATERFALL_SECONDARY.slotsPerEdge:FALL_RING;
    const secondaryStart=performance.now();let maximumRowStepM=0;let priorCenter:THREE.Vector3|null=null;
    // Short flood histories can bend more sharply than the diagnostic mesh
    // can resolve. Keep the original map rather than undersampling new detail.
    const secondaryRows: {section:ReturnType<typeof waterfallLiquidSection>;center:ReturnType<typeof waterfallLiquidPoint>}[]=[];
    if(secondary)for(let j=0;j<bodyRows;j++){
      const a=flight*Math.pow(j/(bodyRows-1),1.45),source=sectionSource(a);
      const sectionTime=pulse?bodyTime+a*(1-pulse.flightDelayS/flight):bodyTime;
      const section=waterfallLiquidSection(source.q,h.width,source.speed,a,sectionTime,pulse?source.area:undefined);
      const center=waterfallLiquidPoint(section,source.q,h.width,source.speed,h.depth,top,a,bodyTime);
      secondaryRows.push({section,center});
      const c=this.point(center.forward,center.lateral,center.y);
      if(priorCenter)maximumRowStepM=Math.max(maximumRowStepM,c.distanceTo(priorCenter));priorCenter=c;
    }
    const secondaryResolved=secondary&&maximumRowStepM<=WATERFALL_SECONDARY.axialCellM/6;
    volumeState.secondaryDeformation.value=secondaryResolved?1:0;
    const secondaryFallback=secondary&&!secondaryResolved?'Physical row spacing exceeds feature/6':'';
    priorCenter=null;
    const bodyPoint = new THREE.Vector3();
    for (let j = 0; j < bodyRows; j += 1) {
      // Dense early rings resolve the actual Q/A-to-gravity rollover.
      const age = flight * Math.pow(j / (bodyRows - 1), 1.45);
      const source = sectionSource(age);
      if(pulse) { const s=waterfallFloodSection(pulse,this.floodSimulationTime,age,flight,h.width,h.depth);if(!s.valid)this.floodInvalidSections++;this.floodMinimumJacobian=Math.min(this.floodMinimumJacobian,s.planeJacobian); }
      const sectionTime = pulse ? bodyTime+age*(1-pulse.flightDelayS/flight) : bodyTime;
      const section = secondaryRows[j]?.section ?? waterfallLiquidSection(source.q, h.width, source.speed, age, sectionTime, pulse ? source.area : undefined);
      const center = secondaryRows[j]?.center ?? waterfallLiquidPoint(section, source.q, h.width, source.speed, h.depth, top, age, bodyTime);
      const worldCenter = this.point(center.forward, center.lateral, center.y);
      if(priorCenter)maximumRowStepM=Math.max(maximumRowStepM,worldCenter.distanceTo(priorCenter));priorCenter=worldCenter;
      // Dry age-zero rows have no velocity; retain a finite collapsed frame.
      const velocity = Math.max(1e-8, Math.hypot(source.speed, WATERFALL.gravity * age));
      // The section is affine in across/thickness. Its center and falling frame
      // are identical for every vertex, including the denser secondary ring.
      // Keep the scalar formula's operation order so native positions stay exact.
      const inverseVelocity = 1 / velocity;
      const forwardPerThickness = WATERFALL.gravity * age * inverseVelocity;
      const heightPerThickness = source.speed * inverseVelocity;
      // Split each original material edge at every affine-shear depth knot.
      // Collapsed slots retain their edge ownership across rows and time.
      const bodyPoints=secondary?secondarySectionRing(section.ring,secondaryResolved?waterfallSecondaryMap(section.width,section.thickness,1-section.coherence,age,sectionTime,source.speed):{scale:1,radius:section.thickness*1.5,values:[0,0,0]}):section.ring;
      envelopeRow.set([section.area / Math.max(1e-8, section.width), section.fraction,
        worldCenter.x, worldCenter.y, worldCenter.z, this.crest.tz, 0, -this.crest.tx,
        this.crest.tx * WATERFALL.gravity * age / velocity, source.speed / velocity,
        this.crest.tz * WATERFALL.gravity * age / velocity,
        section.width * 0.5, section.thickness * 0.5, section.coherence]);
      const rowOffset = j * bodyRing * 14;
      let rowChanged = false;
      for (let component = 0; component < 14; component++) {
        if (!Object.is(envelope.array[rowOffset + component], envelopeRow[component])) rowChanged = true;
      }
      if (rowChanged) {
        for (let k = 0; k < bodyRing; k++) envelope.array.set(envelopeRow, rowOffset + k * 14);
        envelopeChanged = true;
      }
      for (let k = 0; k < bodyRing; k += 1) {
        const index = j * bodyRing + k;
        const [across, thick] = bodyPoints[k];
        const forward = center.forward + forwardPerThickness * thick;
        const lateral = center.lateral + across;
        const p = bodyPoint.set(this.crest.x + this.crest.tx * forward + this.crest.tz * lateral,
          center.y + heightPerThickness * thick,
          this.crest.z + this.crest.tz * forward - this.crest.tx * lateral);
        if (pulse) p.y = Math.max(receivingLevel,p.y);
        positions.setXYZ(index, p.x, p.y, p.z);
        volumeState.boundsMin.value.min(p); volumeState.boundsMax.value.max(p);
        uvs.setXY(index, across, age - t);
      }
    }
    positions.needsUpdate = true; uvs.needsUpdate = true;
    if (envelopeChanged) envelope.needsUpdate = true;
    updateWaterGeometryNormals(this.strands.geometry);
    this.secondaryReceipt={mode:this.secondaryMode,rows:bodyRows,ring:bodyRing,maximumRowStepM,updateMs:performance.now()-secondaryStart,fallback:secondaryFallback};
    if(this.aeratedMesh)this.aeratedMesh.visible=false;
    if(this.billowMesh)this.billowMesh.visible=false;
    if(this.materialSurfaceMode!=='legacy'&&this.materialSurfaceMode!=='reconstructed-fluid'&&this.boundaryShading){
      const started=performance.now(),rows=this.materialSurfaceMode==='billow-volume'?BILLOW_VOLUME.coreRows:MATERIAL_SHEET.rows,columns=this.materialSurfaceMode==='billow-volume'?BILLOW_VOLUME.coreColumns:MATERIAL_SHEET.columns,ring=columns*2;
      if(this.materialSheetMesh&&this.materialSheetMesh.geometry.getAttribute('position').count!==rows*ring){this.materialSheetMesh.geometry.dispose();(this.materialSheetMesh.material as THREE.Material).dispose();this.materialSheetMesh.removeFromParent();this.materialSheetMesh=null;}
      if(!this.materialSheetMesh){
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(rows*ring*3),3));
        geo.setAttribute('materialPlane',new THREE.BufferAttribute(new Float32Array(rows*ring*3),3));
        geo.setAttribute('materialThickness',new THREE.BufferAttribute(new Float32Array(rows*ring),1));
        geo.setAttribute('materialCoordinate',new THREE.BufferAttribute(new Float32Array(rows*ring*2),2));
        geo.setAttribute('materialWidth',new THREE.BufferAttribute(new Float32Array(rows*ring),1));
        geo.setAttribute('materialDepthGradient',new THREE.BufferAttribute(new Float32Array(rows*ring*3),3));
        geo.setAttribute('materialThicknessGradient',new THREE.BufferAttribute(new Float32Array(rows*ring*3),3));
        geo.setIndex(new THREE.BufferAttribute(materialSheetIndices(rows,columns),1));
        this.materialSheetMesh=new THREE.Mesh(geo,materialSheetMaterial(this.boundaryShading,this.fallPool,this.volume.width,this.volume.across));this.materialSheetMesh.frustumCulled=false;this.materialSheetMesh.renderOrder=10;this.waterGroup.add(this.materialSheetMesh);
      }
      const historyScale=pulse?pulse.flightDelayS/flight:1;
      const labels=Array.from({length:rows},(_,j)=>{
        const age=flight*Math.pow(j/(rows-1),1.45),source=sectionSource(age);
        const derivative=pulse?waterfallFloodSection(pulse,this.floodSimulationTime,age,flight,h.width,h.depth).speedAgeDerivative:0;
        const curve=materialSheetTrajectory(age,flight,h.depth,top,source.speed,derivative);
        const emission=bodyTime-age*historyScale;
        const transfer=this.materialSurfaceMode==='aerated-sheet'?aeratedTransfer(age,emission,h.width):null;
        return {age,source,curve,emission,transfer,aerated:0};
      });
      // Characteristic crossing is not fixed with abs(J) or a density cap.
      // This candidate cannot represent that history; show the native path.
      const invalid=labels.filter(r=>!r.curve.valid).length;
      if(invalid){
        this.materialSheetMesh.visible=false;this.strands.visible=true;
        this.materialSurfaceReceipt={...this.materialSurfaceReceipt,mode:'legacy',invalidCoordinates:invalid,fallback:'Historical forward mapping crosses or kinematic crest transition rises',updateMs:performance.now()-started};
      }else{
        const geo=this.materialSheetMesh.geometry,position=geo.getAttribute('position')as THREE.BufferAttribute,plane=geo.getAttribute('materialPlane')as THREE.BufferAttribute,thickness=geo.getAttribute('materialThickness')as THREE.BufferAttribute,coordinate=geo.getAttribute('materialCoordinate')as THREE.BufferAttribute,widthAttribute=geo.getAttribute('materialWidth')as THREE.BufferAttribute,depthGradient=geo.getAttribute('materialDepthGradient')as THREE.BufferAttribute,thicknessGradient=geo.getAttribute('materialThicknessGradient')as THREE.BufferAttribute;
        let sectionError=0,maxStep=0,previous:THREE.Vector3|null=null,clipped=0,drySectionAreaResidue=0;
        const deposits:{section:ReturnType<typeof materialSheetSection>;removed:Float64Array}[]=[];
        for(let j=0;j<rows;j++){
          const {age,source,curve,emission}=labels[j];
          // With fixed vertical layers, exact continuous J is forward'(age)
          // times transverse material area. Across/vertical deformation age
          // derivatives cancel; normal thickness still contracts with descent.
          const area=source.q*historyScale/curve.forwardDerivative;
          const eventPartition=this.materialSurfaceMode==='billow-volume'?billowMaterialSection(area,h.width,age,emission,source.speed,columns):null;
          const sheet=eventPartition?.section??materialSheetSection(area,h.width,age,emission,columns),actualWidth=sheet.across[columns-1]-sheet.across[0],origin=(sheet.across[columns-1]+sheet.across[0])*.5;
          if(eventPartition){labels[j].aerated=area>0?eventPartition.debit.removedArea/area:0;}
          // Local source columns keep their own transfer and clear thickness.
          // The core debit and fog deposit share this same represented liquid.
          if(labels[j].transfer){const debit=aeratedDebit(sheet,labels[j].transfer!);labels[j].aerated=area>0?debit.removedArea/area:0;deposits.push({section:sheet,removed:debit.removed});}
          const expectedArea=area*(1-labels[j].aerated);
          if(expectedArea>1e-12)sectionError=Math.max(sectionError,Math.abs(sheet.measuredArea/expectedArea-1));else drySectionAreaResidue=Math.max(drySectionAreaResidue,Math.abs(sheet.measuredArea));
          const worldCenter=this.point(curve.forward,origin,curve.y);
          if(previous)maxStep=Math.max(maxStep,worldCenter.distanceTo(previous));previous=worldCenter;
          for(let k=0;k<ring;k++){
            const col=k<columns?k:ring-1-k,sign=k<columns?1:-1,index=j*ring+k;
            const world=this.point(curve.forward,sheet.across[col],curve.y+sheet.center[col]+sign*sheet.thickness[col]*.5);
            if(pulse&&world.y<receivingLevel){world.y=receivingLevel;clipped++;}
            position.setXYZ(index,world.x,world.y,world.z);plane.setXYZ(index,0,1,0);thickness.setX(index,sheet.thickness[col]);coordinate.setXY(index,sheet.across[col]-origin,sign*sheet.thickness[col]*.5);widthAttribute.setX(index,actualWidth);
          }
        }
        // Pool clipping changes the actual represented local depth. Optical
        // thickness must follow those boundaries rather than the unclipped
        // emission budget; the independent volume audit reports the loss.
        if(pulse)for(let j=0;j<rows;j++)for(let col=0;col<columns;col++){
          const upper=j*ring+col,lower=j*ring+ring-1-col,actual=position.getY(upper)-position.getY(lower);
          thickness.setX(upper,actual);thickness.setX(lower,actual);coordinate.setY(upper,actual*.5);coordinate.setY(lower,-actual*.5);
        }
        // Finite derivatives of the represented center surface, including
        // moving-width/edge labels. The covector is intentionally unnormalized:
        // vertical coordinate thickness must contract into true normal depth.
        const centerY=(row:number,col:number)=>(position.getY(row*ring+col)+position.getY(row*ring+ring-1-col))*.5;
        const centerAcross=(row:number,col:number)=>position.getX(row*ring+col)*this.crest.tz-position.getZ(row*ring+col)*this.crest.tx;
        for(let j=0;j<rows;j++)for(let col=0;col<columns;col++){
          const lo=Math.max(0,j-1),hi=Math.min(rows-1,j+1),left=Math.max(0,col-1),right=Math.min(columns-1,col+1);
          const transverse=centerAcross(j,right)-centerAcross(j,left),slopeAcross=(centerY(j,right)-centerY(j,left))/Math.max(transverse,1e-8);
          const df=labels[hi].curve.forward-labels[lo].curve.forward;
          const slopeForward=(centerY(hi,col)-centerY(lo,col)-slopeAcross*(centerAcross(hi,col)-centerAcross(lo,col)))/Math.max(df,1e-8);
          const gx=-slopeForward*this.crest.tx-slopeAcross*this.crest.tz,gz=-slopeForward*this.crest.tz+slopeAcross*this.crest.tx;
          depthGradient.setXYZ(j*ring+col,gx,1,gz);depthGradient.setXYZ(j*ring+ring-1-col,gx,1,gz);
          const thicknessAcross=(thickness.getX(j*ring+right)-thickness.getX(j*ring+left))/Math.max(transverse,1e-8);
          const thicknessForward=(thickness.getX(hi*ring+col)-thickness.getX(lo*ring+col)-thicknessAcross*(centerAcross(hi,col)-centerAcross(lo,col)))/Math.max(df,1e-8);
          const tx=thicknessForward*this.crest.tx+thicknessAcross*this.crest.tz,tz=thicknessForward*this.crest.tz-thicknessAcross*this.crest.tx;
          thicknessGradient.setXYZ(j*ring+col,tx,0,tz);thicknessGradient.setXYZ(j*ring+ring-1-col,tx,0,tz);
        }
        for(const a of [position,plane,thickness,coordinate,widthAttribute,depthGradient,thicknessGradient])a.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
        const geometryMs=performance.now()-started,auditStarted=performance.now();
        let meshVolume=0,signedMeshVolume=0,emittedVolume=0,maxBandError=0,negativeBands=0,negativeCells=this.materialSurfaceMode==='coherent-sheet'?0:-1,orientation=0,dryBandVolumeResidue=0;
        for(let j=0;j<rows-1;j++){
          const signed=materialSheetBandVolume(position.array as Float32Array,j,columns),volume=Math.abs(signed),expected=(labels[j].source.q*(1-labels[j].aerated)+labels[j+1].source.q*(1-labels[j+1].aerated))*.5*(labels[j+1].age-labels[j].age)*historyScale;
          if(orientation===0&&Math.abs(signed)>1e-12)orientation=Math.sign(signed);if(signed*orientation<0)negativeBands++;
          // Aerated proof retains signed band accounting but avoids the
          // expensive full cell audit on every moving frame. The receipt
          // reports those cells as unmeasured, never as zero inversions.
          if(this.materialSurfaceMode==='coherent-sheet')for(let k=0;k<columns-1;k++)if(materialSheetCellVolume(position.array as Float32Array,j,k,columns)*orientation< -1e-12)negativeCells++;
          meshVolume+=volume;signedMeshVolume+=signed;emittedVolume+=expected;
          if(expected>1e-12)maxBandError=Math.max(maxBandError,Math.abs(volume/expected-1));else dryBandVolumeResidue=Math.max(dryBandVolumeResidue,volume);
        }

        const coreAuditMs=performance.now()-auditStarted;
        if(this.materialSurfaceMode==='aerated-sheet'){
          const fogStart=performance.now(),fogRows=AERATED_SHEET.rows,fogRing=AERATED_SHEET.ring;
          if(!this.aeratedMesh){
            const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(fogRows*fogRing*3),3));
            g.setAttribute('aeratedTransfer',new THREE.BufferAttribute(new Float32Array(fogRows*fogRing),1));g.setAttribute('aeratedFraction',new THREE.BufferAttribute(new Float32Array(fogRows*fogRing),1));g.setAttribute('aeratedRadius',new THREE.BufferAttribute(new Float32Array(fogRows*fogRing),1));g.setAttribute('aeratedLabel',new THREE.BufferAttribute(new Float32Array(fogRows*fogRing*2),2));
            const ix:number[]=[];for(let j=0;j<fogRows-1;j++)for(let k=0;k<fogRing;k++){const a=j*fogRing+k,b=(j+1)*fogRing+k,c=j*fogRing+(k+1)%fogRing,d=(j+1)*fogRing+(k+1)%fogRing;ix.push(a,c,b,c,d,b);}g.setIndex(ix);
            this.aeratedMesh=new THREE.Mesh(g,aeratedSheetMaterial(this.boundaryShading,this.fallPool,this.aeratedDiagnostic));this.aeratedMesh.renderOrder=11;this.aeratedMesh.frustumCulled=false;this.waterGroup.add(this.aeratedMesh);
          }
          const g=this.aeratedMesh.geometry,p=g.getAttribute('position')as THREE.BufferAttribute,f=g.getAttribute('aeratedFraction')as THREE.BufferAttribute,transfer=g.getAttribute('aeratedTransfer')as THREE.BufferAttribute,r=g.getAttribute('aeratedRadius')as THREE.BufferAttribute,l=g.getAttribute('aeratedLabel')as THREE.BufferAttribute;
          let maxPhi=0,volume=0,error=0;let lastQ=0,lastAge=0;
          for(let j=0;j<fogRows;j++){
            const row=labels[j*2],{age,source,curve,emission,aerated}=row;
            const deposit=deposits[j*2];
            const section=aeratedLocalSection(deposit.section,deposit.removed,row.transfer!,curve.forwardDerivative/curve.arcSpeed,h.width,age,emission);
            maxPhi=Math.max(maxPhi,section.maximumFraction);error=Math.max(error,Math.abs(section.accountedArea-section.liquidArea));
            if(j)volume+=(lastQ+source.q*aerated)*.5*(age-lastAge)*historyScale;lastQ=source.q*aerated;lastAge=age;
            for(let k=0;k<fogRing;k++){
              // The normal-plane displacement has a real outward/forward
              // component on a steep fall, unlike world-Y-only sheet detail.
              const n=section.normal[k],forward=curve.forward-curve.yDerivative/curve.arcSpeed*n;
              const y=curve.y+curve.forwardDerivative/curve.arcSpeed*n;
              const world=this.point(forward,section.across[k],pulse?Math.max(receivingLevel,y):y),index=j*fogRing+k;
              p.setXYZ(index,world.x,world.y,world.z);f.setX(index,section.phi[k]);transfer.setX(index,section.transfer[k]);r.setX(index,section.radiusB);l.setXY(index,section.across[k],emission);
            }
          }
          for(const a of [p,f,transfer,r,l])a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();this.aeratedMesh.visible=true;
          this.aeratedReceipt={updateMs:performance.now()-fogStart,rows:fogRows,ring:fogRing,maximumLiquidFraction:maxPhi,secondaryLiquidVolume:volume,sectionBudgetError:error};
        }
        if(this.materialSurfaceMode==='billow-volume'){
          const fieldStart=performance.now();
          const maxSpeed=pulse?(pulse.baseM3S+pulse.extraPeakM3S)/(h.width*h.depth):h.speed;
          const maxForward=Math.ceil((maxSpeed*Math.max(flight,pulse?.flightDelayS??flight)+3)/2)*2;
          const bounds={min:[-3,Math.floor(receivingLevel/2)*2-1,-Math.ceil(h.width*.65+1)]as const,max:[maxForward,Math.ceil(top+1),Math.ceil(h.width*.65+1)]as const};
          const nx=Math.max(24,Math.ceil((bounds.max[0]-bounds.min[0])/.6));
          const gridKey=JSON.stringify([bounds,nx,this.crest]);
          const frameKey=JSON.stringify([bodyTime,flight,Q,h.width,h.depth,receivingLevel,pulse,gridKey]);
          if(nx>96){this.billowReceipt={...this.billowReceipt,ready:false,reason:'Reserved historical trajectory exceeds bounded field resolution; native fallback',fieldTime:bodyTime};}
          else{
            if(gridKey!==this.billowGridKey){
              this.billowField=new BillowDensityField(bounds,[nx,128,32]);this.billowUpload=new Uint16Array(this.billowField.data.length);this.billowGridKey=gridKey;this.billowFrameKey='';
              const state=this.billowState;state.min.value.set(...bounds.min);state.max.value.set(...bounds.max);state.spacing.value.set(...this.billowField.spacing);state.origin.value.set(this.crest.x,0,this.crest.z);state.forward.value.set(this.crest.tx,0,this.crest.tz);state.across.value.set(this.crest.tz,0,-this.crest.tx);
              if(this.billowMesh){this.billowMesh.geometry.dispose();(this.billowMesh.material as THREE.Material).dispose();this.billowMesh.removeFromParent();}
              const dimensions=bounds.max.map((v,k)=>v-bounds.min[k]),g=new THREE.BoxGeometry(...dimensions as [number,number,number]);
              this.billowMesh=new THREE.Mesh(g,billowVolumeMaterial(this.boundaryShading,this.fallPool,state,this.aeratedDiagnostic,this.volume));this.billowMesh.position.copy(this.point((bounds.min[0]+bounds.max[0])*.5,0,(bounds.min[1]+bounds.max[1])*.5));this.billowMesh.rotation.y=-Math.atan2(this.crest.tz,this.crest.tx);this.billowMesh.renderOrder=11;this.billowMesh.frustumCulled=false;this.waterGroup.add(this.billowMesh);
              state.texture.image={data:this.billowUpload,width:nx,height:128,depth:32};
            }
            if(frameKey!==this.billowFrameKey){
              const {lobes,invalidBirths,expectedVolume:sourceBudgetVolume,eventCount,maximumNodePartitionError,eventPartitionResidual,eventCapacityExceeded}=buildBillowLobes({time:bodyTime,flight,historyScale,width:h.width,depth:h.depth,top,
                sectionAt:(age:number)=>({...sectionSource(age),speedAgeDerivative:pulse?this.historicalSection(pulse,this.floodSimulationTime,age,flight,h.width,h.depth).speedAgeDerivative:0})});
              const field=this.billowField!,receipt=field.fill(lobes),uploadStarted=performance.now();let quantizedVolume=0;
              for(let i=0;i<field.data.length;i+=4){this.billowUpload![i]=THREE.DataUtils.toHalfFloat(field.data[i]);this.billowUpload![i+1]=THREE.DataUtils.toHalfFloat(field.data[i+1]);quantizedVolume+=THREE.DataUtils.fromHalfFloat(this.billowUpload![i])*field.voxelVolume;}
              this.billowState.texture.needsUpdate=true;this.billowFrameKey=frameKey;
              const ready=invalidBirths===0&&receipt.residualVolume<=Math.max(1e-7,receipt.expectedVolume*1e-5);
              this.billowReceipt={...receipt,eventCount,maximumNodePartitionError,eventPartitionResidual,eventCapacityExceeded,sourceBudgetVolume:eventCapacityExceeded?null:sourceBudgetVolume,ready,reason:ready?'':eventCapacityExceeded?'Event or patch capacity exceeded; native fallback, no omitted budget accepted':invalidBirths?'Historical birth trajectory crosses; native fallback':'Local field capacity residual; native fallback, no missing clear debit accepted',fieldTime:bodyTime,updateMs:performance.now()-fieldStart,uploadMs:performance.now()-uploadStarted,quantizedVolume,quantizedVolumeError:receipt.expectedVolume>0?quantizedVolume/receipt.expectedVolume-1:0};
            }
            this.billowMesh!.visible=this.billowReceipt.ready;
          }
        }

        const materialReady=this.materialSurfaceMode!=='billow-volume'||this.billowReceipt.ready;
        this.materialSheetMesh.visible=materialReady&&this.aeratedDiagnostic.value===0;this.strands.visible=!materialReady;
        this.materialSurfaceReceipt={mode:materialReady?this.materialSurfaceMode:'legacy',updateMs:performance.now()-started,geometryMs,auditMs:coreAuditMs,rows,columns,meshVolume,signedMeshVolume,emittedVolume,relativeVolumeError:emittedVolume>1e-12?meshVolume/emittedVolume-1:0,maximumBandVolumeError:maxBandError,negativeBands,negativeCells,maximumRowStepM:maxStep,maximumSectionAreaError:sectionError,clippedVertices:clipped,drySectionAreaResidue,dryBandVolumeResidue,invalidCoordinates:0,fallback:materialReady?'':this.billowReceipt.reason};
      }
    }else if(this.materialSheetMesh)this.materialSheetMesh.visible=false;
    this.updateBoundaryLight();
    if (this.frozenSource) { const mismatch = frozenWaterfallMismatch(this.frozenSource, this.frozenCurrentState()); if (mismatch) { this.setFrozenVolumeSource(null); this.frozenReason = mismatch; } }
    // These legacy droplet transforms are presentation only, sampled from the
    // current source/time. Hidden droplets neither own nor advance water.
    // Keep the path available, but build it only when it can actually be drawn;
    // the visible body, impact mist and all physical accounting still update.
    if (this.parcels.visible) {
      for (let i = 0; i < count; i += 1) {
        const phase = this.seeds[i]; const total = flight + approachS;
        const age = ((t + phase * total) % total + total) % total - approachS;
        let n = (this.seeds[(i + 731) % 2400] - 0.5) * h.width;
        let forward: number; let y: number; let vy: number;
        const historical = age < 0 ? { q: this.sourceDischarge ?? Q, speed: h.speed, area: undefined } : sectionSource(age);
        if (historical.q === 0) {
          this.matrix.makeScale(0, 0, 0); this.parcels.setMatrixAt(i, this.matrix); continue;
        }
        if (age < 0) { forward = h.speed * age; y = top + Math.sin(t * 2 + phase * 80) * 0.02; vy = 0; }
        else {
          const section = waterfallLiquidSection(historical.q, h.width, historical.speed, age, t, historical.area);
          const [across, thick] = waterfallEnvelopeSample(section, this.seeds[(i + 731) % 2400], phase);
          const liquid = waterfallLiquidPoint(section, historical.q, h.width, historical.speed, h.depth, top, age, t, across, thick);
          forward = liquid.forward; y = liquid.y; n = liquid.lateral; vy = -WATERFALL.gravity * age;
        }
        const direction = new THREE.Vector3(this.crest.tx * historical.speed, vy, this.crest.tz * historical.speed);
        this.rotation.setFromUnitVectors(this.up, direction.normalize());
        const stretch = age < 0 ? radius : Math.max(radius, Math.abs(vy) * 0.025);
        const spread = age > 0 ? Math.sin(phase * 99 + age * 3) * age * 0.035 : 0;
        // Stretching a falling parcel also narrows it: keep its represented
        // volume instead of inflating droplets as they accelerate.
        const crossRadius = radius * Math.sqrt(radius / stretch);
        this.matrix.compose(this.point(forward, n + spread, y), this.rotation, new THREE.Vector3(crossRadius, stretch, crossRadius));
        this.parcels.setMatrixAt(i, this.matrix);
      }
      this.parcels.instanceMatrix.needsUpdate = true;
    }
    const impactSpeed = Math.hypot(arrivingSource.speed, WATERFALL.gravity * flight);
    const powerScale = Math.sqrt(arrivingSource.q / 1.5);
    // THE PLUME BY LAW (2026-10-11). The mist budget follows the impact power
    // (rho g Q h; one puff per 25 kW, a 6 s life), the plume rises to 0.3 of
    // the drop, and its parcels leave at a share of the impact speed and slow
    // as they spread. Before: 160 puffs at most, 6 m/s at most, a 4 s life,
    // which drew a haze at the foot where the clip shows a cloud a third of
    // the fall's height.
    const dropM = Math.max(1, top - receivingLevel);
    const mistLifeS = 6;
    const sprayCount = Math.min(MIST_CAP, Math.ceil(mistRatePerS(arrivingSource.q, dropM) * mistLifeS));
    const plumeTopM = mistHeightM(dropM);
    (this.spray.geometry as THREE.InstancedBufferGeometry).instanceCount = sprayCount;
    const mistLife = this.spray.geometry.getAttribute('mistLife') as THREE.InstancedBufferAttribute;
    // All impact puffs share a canonical cross-section. Only their emission
    // time changes its deformation; evaluate the four sampled vertices lazily.
    const arriving = waterfallLiquidSection(arrivingSource.q, h.width, arrivingSource.speed, flight, bodyTime, pulse ? arrivingSource.area : undefined);
    const arrivingStrength = Math.sqrt(Math.max(0, Math.min(1, arrivingSource.q / Math.max(1e-8, h.width * 0.8))));
    const arrivingDeveloped = 1 - Math.exp(-flight * flight * (2.5 - arrivingStrength * 1.2));
    for (let i = 0; i < sprayCount; i += 1) {
      // Independent seeds avoid synchronized rings. Dense coarse splash is
      // visible at contact; longer-lived fine mist rises gently and fades.
      const phase = this.seeds[i % 2400]; const direction = this.seeds[(i + 431) % 2400];
      const sizeSeed = this.seeds[(i + 877) % 2400]; const liftSeed = this.seeds[(i + 1573) % 2400];
      const coarse = i % 3 === 0; const lifetime = coarse ? 0.8 + liftSeed * 0.8 : mistLifeS * (0.7 + liftSeed * 0.6);
      const age = (t + phase * lifetime) % lifetime; const life = age / lifetime;
      const angle = direction * Math.PI * 2;
      const outward = (1.4 + sizeSeed * 3.6) * (0.7 + powerScale * 0.3);
      // the fine mist's rise: it must reach the plume's top within its life
      // and no higher, so the launch speed is the one that gets it there
      const upward = coarse ? Math.min(6, impactSpeed * 0.13) * (0.6 + liftSeed * 0.7) : (2 * plumeTopM / lifetime) * (0.5 + liftSeed * 0.8);
      const arrivingMorph = waterfallSectionMorph(0, arriving.width, arriving.thickness, arrivingDeveloped, flight, bodyTime - age, arrivingSource.speed);
      const arrivingTravel = (bodyTime - age - flight) * 6;
      const [across, thick] = waterfallEnvelopeSample(arriving, this.seeds[(i + 2011) % 2400], sizeSeed,
        index => deformWaterfallSectionPoint([...arriving.canonicalRing[index]], arriving.width, arriving.thickness, arrivingDeveloped, arrivingMorph, arrivingTravel),
        [arrivingMorph.shiftAcross, arrivingMorph.shiftDepth + arrivingMorph.shear]);
      const contact = waterfallLiquidPoint(arriving, arrivingSource.q, h.width, arrivingSource.speed, h.depth, top, flight, bodyTime - age, across, thick);
      // Coarse impact spray travels out and settles into the receiving
      // surface; longer-lived fine mist remains secondary dispersed water.
      // The fine impact plume follows forward momentum and fades into the
      // receiving reach, rather than forming a stationary circular patch.
      // This adds no solver source: it is the dispersed part of the same
      // accepted impact energy, with low spray distinct from surface foam.
      const downstreamDrift = Math.min(2.4, impactSpeed * 0.035) * (coarse ? 0.25 : 1);
      const pos = this.point(contact.forward + Math.cos(angle) * outward * age + downstreamDrift * age, contact.lateral + Math.sin(angle) * outward * age,
        receivingLevel + 0.08 + Math.max(0, upward * age - (coarse ? 4.905 : 0.35) * age * age));
      // a fine parcel grows as it spreads: a veil 0.5 m across at birth is 4 to 5 m across at the end of its life
      const size = (0.45 + sizeSeed * 0.85) * (0.7 + powerScale * 0.3) * (1 + life * (coarse ? 0.3 : 3.2));
      mistLife.setX(i, Math.pow(1 - life, coarse ? 1.4 : 2.2));
      if (i % 5 === 0) {
        // The outer fringe contains sparse fine spray emitted throughout
        // the descent. Its center and velocity still come from the shared
        // ballistic section, so particles never replace the main volume.
        const fallAge = flight * 0.25 + ((t + phase * flight * 0.75) % (flight * 0.75));
        const source = sectionSource(fallAge);
        const sectionTime = pulse ? bodyTime+fallAge*(1-pulse.flightDelayS/flight) : t;
        const side = direction < 0.5 ? -1 : 1;
        const section = waterfallLiquidEdge(source.q, h.width, source.speed, fallAge, sectionTime, side, pulse ? source.area : undefined);
        const edge = section.edge;
        const liquid = waterfallLiquidPoint(section, source.q, h.width, source.speed, h.depth, top, fallAge, sectionTime, edge[0], edge[1]);
        const fringe = this.point(liquid.forward + (sizeSeed - 0.5) * section.thickness,
          liquid.lateral + side * (0.15 + liftSeed * 0.65) * fallAge / flight, liquid.y);
        const tiny = (0.10 + sizeSeed * 0.22) * (0.5 + Math.min(1.5, powerScale) * 0.5);
        mistLife.setX(i, (1 - section.coherence) * (0.25 + sizeSeed * 0.4));
        this.matrix.compose(fringe, camera.quaternion, new THREE.Vector3(tiny, tiny * 2, tiny));
      } else {
        this.matrix.compose(pos, camera.quaternion, new THREE.Vector3(size * (coarse ? 1 : 1.4), size * (coarse ? 1 : 0.6), size));
      }
      this.spray.setMatrixAt(i, this.matrix);
    }
    mistLife.needsUpdate = true;
    this.spray.instanceMatrix.needsUpdate = true;
  }
  /** Proof can await the real scan assets without treating a partially
   * loaded scene as completed rock evidence. The ordinary UI still opens
   * while the recoverable asset request runs. */
  async waitForCliff(): Promise<void> {
    const cliff = this.cliff;
    if (!cliff) return;
    await cliff.userData.outcropReady;
    if (cliff.userData.outcropLoadError) throw new Error(String(cliff.userData.outcropLoadError));
    if (!cliff.userData.outcropLoaded) throw new Error('Waterfall cliff scan assets are not loaded');
  }
  dispose(): void {
    this.thinLive?.dispose(); this.thinLive = null;
    this.contactView?.dispose(); this.contactView = null;
    this.reconstructedFluid?.dispose();this.reconstructedFluid=null;
    if(this.billowMesh){this.billowMesh.geometry.dispose();(this.billowMesh.material as THREE.Material).dispose();this.billowMesh.removeFromParent();this.billowMesh=null;}this.billowState.texture.dispose();
    if(this.aeratedMesh){this.aeratedMesh.geometry.dispose();(this.aeratedMesh.material as THREE.Material).dispose();this.aeratedMesh.removeFromParent();this.aeratedMesh=null;}
    if(this.materialSheetMesh){this.materialSheetMesh.geometry.dispose();(this.materialSheetMesh.material as THREE.Material).dispose();this.materialSheetMesh.removeFromParent();this.materialSheetMesh=null;}
    if(this.baselineBodyGeometry&&this.baselineBodyGeometry!==this.strands.geometry)this.baselineBodyGeometry.dispose();
    if(this.secondaryBodyGeometry&&this.secondaryBodyGeometry!==this.strands.geometry)this.secondaryBodyGeometry.dispose();
    // Mark the async cliff owner disposed before traversing the other
    // meshes, so a late scan response cannot reattach resources to it.
    if (this.cliff) {
      this.group.remove(this.cliff); disposeWaterfallCliff(this.cliff); this.cliff = null;
    }
    if (this.sourceFlow) for (const texture of Object.values(this.sourceFlow)) texture.dispose();
    this.volume.sourceRates.dispose(); this.volume.atlasFirst.dispose(); this.volume.atlasSecond.dispose(); this.volume.frozenSource.dispose();
    this.boundaryCache.dispose();
    this.volume.boundaryH.dispose(); this.volume.boundaryZ.dispose(); this.volume.boundarySun.dispose();
    const materials = new Set<THREE.Material>(this.volumePrograms.values());this.volumePrograms.clear();
    for (const group of [this.group, this.waterGroup]) group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); }
    });
    for (const m of materials) m.dispose();
  }
}
