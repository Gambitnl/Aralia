/**
 * THE RIVER'S WATER LAYER (2026-10-26): the water's own parts, apart from the
 * page that shows it. ADR 0009 step 6 puts the live river's water into the
 * game's 3D world; the river page (`RiverReachView`) and, later, the world's
 * water pass both draw this one layer: one water system.
 *
 * Slice 2 (this file's first form) moves OWNERSHIP only: the flow textures
 * (the current and the previous live picture), the main-rapids optics mask
 * and its course key, the optics uniforms the banks share, the CPU surface
 * sampler (`RiverSurfaceMirror`), the water material and the water mesh.
 * `RiverReachView` builds them in the same order as before and reads them
 * through forwarding getters, so the river page draws the same pixels.
 * The mirror pass, the water draw and the snapshot path move in later slices
 * (see docs/architecture/domains/world3d-river-water.md, "the water layer").
 */
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { RiverFlowMap } from '@/systems/world3d/river/riverFlowField';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import { createRiverFlowTextures, createRiverWaterMaterial, riverTexture, type RiverWaterMaterial } from './riverWaterMaterial';
import { RiverSurfaceMirror } from './riverSurfaceMirror';
import type { RiverMirror } from './riverMirrorCamera';
import { copyRiverFlowTexture, updateRiverFlowTexture, updateRiverFlowTexturePatch } from './riverFlowTextureUpload';
import { riverCoarseLevelTexture, writeRiverCoarseLevel, type RiverCoarseLevelTexture } from './riverCoarseLevelTexture';
import type { LiveFlowSnapshot } from '@/systems/world3d/river/riverLive';
import { WATERFALL } from '@/systems/world3d/river/riverHeadwaters';

export type RiverFlowTextures = { flow0: THREE.DataTexture; flow1: THREE.DataTexture; flow2: THREE.DataTexture };

/** One frame's inputs to the water pass (the host's opaque pass and its target). */
export interface RiverWaterFrame {
  /** The opaque pass's color and depth (the water refracts and fogs through them). */
  sceneColor: THREE.Texture;
  sceneDepth: THREE.Texture | null;
  /** The frame's size in pixels: the depth is read per pixel (uv x size). */
  width: number;
  height: number;
  /** Where the water draws (the host copies its opaque pass in first). */
  target: THREE.RenderTarget;
  /** The water plane over an underwater camera, or null above water. */
  underwaterPlane: number | null;
  /** Did the mirror pass run this frame? */
  reflectionOn: boolean;
}

/** What the water pass's host does for it (the river page, or the game world). */
export interface RiverWaterHost {
  /** Copy the opaque color and depth into `target`, cleared first. */
  copyOpaque(target: THREE.RenderTarget): void;
  /** Draw the water scene (the host may wrap the draw, e.g. for its GPU heatmap). */
  drawScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
}

/** The light and fog the water shades with (set once, as the page did). */
export interface RiverWaterLighting {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  skyZenith: THREE.Color;
  skyHorizon: THREE.Color;
  skyGain: number;
  fogColor: THREE.Color;
  fogDensity: number;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const turnQ = new THREE.Quaternion();

/**
 * Copy `from` into `to`, moved by `sign * offset` and, with a `yaw`, turned
 * about +y (the projection, including an oblique clip, is copied as it is: a
 * rigid move does not change it). `yaw` is the bearing of river-local +x in
 * the host's xz plane (`riverWorldBed.ts`): sign -1 takes a host camera into
 * river space (move, then turn by -yaw), sign +1 takes a river camera back
 * (turn by +yaw, then move). With yaw 0 the turn is skipped, so the page's
 * cameras are exactly as before.
 */
export function moveCamera(from: THREE.PerspectiveCamera, to: THREE.PerspectiveCamera, sign: 1 | -1, offset: THREE.Vector3, yaw = 0): THREE.PerspectiveCamera {
  to.copy(from, false);
  to.coordinateSystem = from.coordinateSystem;
  // From the world matrix, so a camera under a parent moves right too.
  from.updateMatrixWorld();
  from.matrixWorld.decompose(to.position, to.quaternion, to.scale);
  if (yaw !== 0 && sign > 0) turnCamera(to, yaw);
  to.position.addScaledVector(offset, sign);
  if (yaw !== 0 && sign < 0) turnCamera(to, -yaw);
  to.updateMatrixWorld(true);
  to.projectionMatrix.copy(from.projectionMatrix);
  to.projectionMatrixInverse.copy(from.projectionMatrixInverse);
  to.layers.mask = from.layers.mask;
  return to;
}

/**
 * Turn a camera's position and orientation about +y so that a point at
 * bearing 0 goes to bearing `yaw` (x' = x cos - z sin, z' = x sin + z cos,
 * the river frame's convention). three's rotation about +y by an angle a
 * maps x' = x cos a + z sin a, so the angle here is -yaw.
 */
function turnCamera(cam: THREE.PerspectiveCamera, yaw: number): void {
  turnQ.setFromAxisAngle(Y_AXIS, -yaw);
  cam.position.applyQuaternion(turnQ);
  cam.quaternion.premultiply(turnQ);
}

/** Banks and water share the same optical ownership and live impact nodes. */
function sharedOpticsFor(mask: THREE.DataTexture | null, flow: RiverFlowTextures) {
  return {
    uMainRapidsMask: riverTexture(mask ?? flow.flow0),
    uMainRapidsOptics: uniform(mask ? 1 : 0),
    uPoolImpactFrame: uniform(new THREE.Vector4()),
    uPoolImpactEnergy: uniform(new THREE.Vector4()),
    uPoolImpactLevel: uniform(0),
  };
}

export class RiverWaterLayer {
  /** The flow textures the water and the banks read (the live river replaces their data). */
  readonly flowTex: RiverFlowTextures;
  /** The last live picture's textures, for the blend between pictures (2026-10-21). */
  readonly flowPrev: RiverFlowTextures;
  /**
   * THE FAR LEVEL (2026-10-27, GG-430): the live map leaves the level of
   * cells far from the water as RIVER_FAR_LEVEL; the banks read this coarse
   * level texture there instead (createRiverBankMaterial).
   */
  readonly coarseLevel: RiverCoarseLevelTexture;
  /** The main rapids' optics mask (headwaters course only), and the course it was built for. */
  mainOpticsMask: THREE.DataTexture | null;
  mainOpticsPathKey: string;
  /** Banks and water share the same optical ownership and live impact nodes. */
  readonly sharedOptics: ReturnType<typeof sharedOpticsFor>;
  private surfaceSampler: RiverSurfaceMirror | null = null;
  private material: RiverWaterMaterial | null = null;
  private mesh: THREE.Mesh | null = null;
  private depthTest = true;

  /**
   * Build the flow textures and the optics. `opticsMask` and `opticsPathKey`
   * come from the page (it owns the course edit that builds them).
   */
  /**
   * `reflection`: the mirror the water reads (camera, read matrix, plane,
   * targets; slice 3). Its host draws the scene into it each frame.
   */
  constructor(private readonly flowMap: RiverFlowMap, opticsMask: THREE.DataTexture | null, opticsPathKey: string, readonly reflection: RiverMirror,
    /** The water scene: the water mesh and what draws with it (the page adds its own water objects). */
    readonly scene: THREE.Scene = new THREE.Scene()) {
    const flow = createRiverFlowTextures(flowMap);
    this.flowTex = flow;
    this.flowPrev = createRiverFlowTextures(flowMap);
    this.coarseLevel = riverCoarseLevelTexture(flowMap.grid);
    this.mainOpticsMask = opticsMask;
    this.mainOpticsPathKey = opticsPathKey;
    this.sharedOptics = sharedOpticsFor(this.mainOpticsMask, flow);
  }

  /** The CPU surface sampler, read from the same half texels as the shader. */
  createSurface(data: RiverReachData): RiverSurfaceMirror {
    const f = this.flowTex;
    this.surfaceSampler = new RiverSurfaceMirror(data, [f.flow0.image.data as Uint16Array,
      f.flow1.image.data as Uint16Array, f.flow2.image.data as Uint16Array]);
    return this.surfaceSampler;
  }

  get surface(): RiverSurfaceMirror {
    if (!this.surfaceSampler) throw new Error('[river] The water layer has no surface sampler yet (createSurface).');
    return this.surfaceSampler;
  }

  /** The water material (its light and fog follow in `setLighting`). */
  createMaterial(): RiverWaterMaterial {
    const m = createRiverWaterMaterial(this.flowMap, this.flowTex, this.sharedOptics, undefined, this.flowPrev);
    this.material = m;
    this.depthTest = m.material.depthTest;
    return m;
  }

  /** The light and fog the water shades with. */
  setLighting(lighting: RiverWaterLighting): void {
    const wu = this.waterMat.uniforms;
    wu.uSunDir.value = lighting.sunDir;
    wu.uSunColor.value = lighting.sunColor;
    wu.uSkyZenith.value = lighting.skyZenith;
    wu.uSkyHorizon.value = lighting.skyHorizon;
    wu.uSkyGain.value = lighting.skyGain;
    wu.uFogColor.value = lighting.fogColor;
    wu.uFogDensity.value = lighting.fogDensity;
  }

  get waterMat(): RiverWaterMaterial {
    if (!this.material) throw new Error('[river] The water layer has no material yet (createMaterial).');
    return this.material;
  }

  /** The material's own depth test (the page switches it for some views and restores this). */
  get normalWaterDepthTest(): boolean { return this.depthTest; }

  /** The water mesh on a receiving geometry the page prepared. */
  createMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.waterMat.material);
    mesh.frustumCulled = false;
    this.mesh = mesh;
    return mesh;
  }

  get water(): THREE.Mesh {
    if (!this.mesh) throw new Error('[river] The water layer has no mesh yet (createMesh).');
    return this.mesh;
  }

  /**
   * PLACEMENT (slice 5, 2026-10-26): where the river's local origin sits in
   * the host's world, a move only (no turn, no scale). The y part is the
   * height datum: river-local y = world y - placement.y, so the water's
   * half-float levels keep their precision at any world altitude.
   *
   * The layer draws in river-local space. The water material reads world
   * position in many places (the grid, the noise, the mirror plane, the
   * pool's impact frame), so the layer does not move its meshes; the host's
   * camera moves into river space instead (`localCamera`). A move of both
   * the camera and the scene keeps every view-space position, so the host's
   * opaque depth still lines up with the water. The river page's placement
   * is zero, and the page's camera is used as it is.
   */
  readonly placement = new THREE.Vector3();
  /**
   * THE TURN (slice 10, 2026-10-26): the bearing of river-local +x in the
   * host's xz plane, radians (`riverWorldBed.ts` RiverWorldFrame.yaw). The
   * world's river runs at any bearing, and the solver's course runs along
   * local +x, so the host's camera turns into river space as well as moves.
   * Zero on the river page (and in the slice 7 test site).
   */
  yaw = 0;
  private readonly localCam = new THREE.PerspectiveCamera();
  private readonly worldCam = new THREE.PerspectiveCamera();

  /** The host's camera in river-local space (the camera itself at zero placement and turn). */
  localCamera(cam: THREE.PerspectiveCamera): THREE.PerspectiveCamera {
    if (this.placement.lengthSq() === 0 && this.yaw === 0) return cam;
    return moveCamera(cam, this.localCam, -1, this.placement, this.yaw);
  }

  /**
   * A river-local camera (the mirror's) moved back into the host's world, for
   * the host to draw its own scene with (the camera itself at zero placement and turn).
   */
  hostCamera(localCamera: THREE.PerspectiveCamera): THREE.PerspectiveCamera {
    if (this.placement.lengthSq() === 0 && this.yaw === 0) return localCamera;
    return moveCamera(localCamera, this.worldCam, 1, this.placement, this.yaw);
  }

  /**
   * A NEW LIVE PICTURE'S FLOW TEXTURES (slice 4, 2026-10-26): the current
   * textures are copied into the previous ones on the GPU (the drawn water
   * blends from the last picture to this one), then the new half floats are
   * uploaded, as deltas when `useDeltas`. Returns false when the GPU copy is
   * not possible (the first pictures): this picture then draws at once.
   */
  updateFlowTextures(renderer: THREE.WebGPURenderer, s: Pick<LiveFlowSnapshot, 't0h' | 't1h' | 't2h' | 'flowDelta' | 'patch' | 'coarse'>, useDeltas: boolean): boolean {
    const blended = (['flow0', 'flow1', 'flow2'] as const).every(k => copyRiverFlowTexture(renderer, this.flowTex[k], this.flowPrev[k]));
    // A patch picture (GG-430) changed the kept arrays in place: upload its rows.
    if (s.patch) {
      updateRiverFlowTexturePatch(renderer, this.flowTex.flow0, s.t0h, s.patch.rows);
      updateRiverFlowTexturePatch(renderer, this.flowTex.flow1, s.t1h, s.patch.rows);
      updateRiverFlowTexturePatch(renderer, this.flowTex.flow2, s.t2h, s.patch.rows);
    } else {
      updateRiverFlowTexture(renderer, this.flowTex.flow0, s.t0h, useDeltas ? s.flowDelta : undefined, 0);
      updateRiverFlowTexture(renderer, this.flowTex.flow1, s.t1h, useDeltas ? s.flowDelta : undefined, 1);
      updateRiverFlowTexture(renderer, this.flowTex.flow2, s.t2h, useDeltas ? s.flowDelta : undefined, 2);
    }
    if (s.coarse) writeRiverCoarseLevel(this.coarseLevel, s.coarse);
    return blended;
  }

  /**
   * THE FALL'S LANDING (slice 4): the accepted landing, not the requested
   * inlet discharge, drives the receiving pool's unresolved vertical-energy
   * waves. Default and source material flags stay zero. `impact` is null
   * off the headwaters course.
   */
  setPoolImpact(impact: LiveFlowSnapshot['waterfallLanding'] | null): void {
    const u = this.waterMat.uniforms;
    const energy = u.uPoolImpactEnergy.value as THREE.Vector4;
    u.uPoolRefractionEdge.value = impact ? 1 : 0;
    if (impact) {
      u.uPoolImpactFrame.value.set(impact.x, impact.z, impact.tx, impact.tz);
      u.uPoolImpactLevel.value = impact.poolLevel;
    }
    if (impact && impact.discharge > 0) {
      const depth = Math.max(0, this.surface.depth(impact.x, impact.z));
      energy.set(impact.discharge, impact.width, WATERFALL.gravity * impact.flightS, depth);
      this.surface.setPoolImpact({ ...impact, verticalSpeed: WATERFALL.gravity * impact.flightS, depth });
    } else {
      energy.set(0, 0, 0, 0); this.surface.setPoolImpact(null);
    }
  }

  /**
   * THE WATER PASS (slice 4, 2026-10-26): the host copies its opaque color
   * and depth into the target, the frame's uniforms are set, and the water
   * scene draws over the copy. Moved from `RiverReachView.drawRiverFrame`
   * unchanged.
   */
  drawWater(camera: THREE.PerspectiveCamera, frame: RiverWaterFrame, host: RiverWaterHost): void {
    host.copyOpaque(frame.target);
    const wu = this.waterMat.uniforms;
    wu.uSceneColor.value = frame.sceneColor;
    wu.uSceneDepth.value = frame.sceneDepth;
    wu.uUnderReflectionValid.value = frame.reflectionOn && frame.underwaterPlane !== null ? 1 : 0;
    wu.uReflection.value = this.reflection.mipTarget.texture;
    wu.uReflMatrix.value.copy(this.reflection.matrix);
    wu.uReflPlaneY.value = frame.underwaterPlane ?? this.reflection.planeY;
    wu.uResolution.value.set(frame.width, frame.height);
    wu.uNear.value = camera.near;
    wu.uFar.value = camera.far;
    host.drawScene(this.scene, camera);
  }
}
