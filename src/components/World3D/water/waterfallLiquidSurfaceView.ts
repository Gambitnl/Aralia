/**
 * Draws an optional water surface reconstructed from moving liquid samples.
 * Its visible boundary, normals and optical thickness all use the same mesh.
 * This avoids shading the rim of each numerical particle as a water feature.
 *
 * The isolated gauntlet calls this view; the native river does not select it.
 * It reuses clear-water absorption and lighting inputs. It does not implement
 * air, foam, breakup, or reflection from the native river's scene probes.
 * Ordered surface crossings sum liquid thickness through separate closed parts,
 * but only the nearest interface supplies reflection/refraction. This is not
 * full multilayer dielectric transport. The current camera must be outside.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 06/10/2026, 08:21:43
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import {
  Fn, If, Discard, abs, cameraPosition, clamp, dot, exp, float, frontFacing,
  ivec2, max, min, mix, normalize, normalWorld, perspectiveDepthToViewZ,
  positionGeometry, positionView, pow, reflect, screenCoordinate, screenUV,
  select, texture, uniform, vec2, vec3, vec4, viewZToPerspectiveDepth,
} from 'three/tsl';
import type { RiverWaterUniforms } from './riverWaterMaterial';

export interface LiquidSurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export class WaterfallLiquidSurfaceView {
  private geometry = new THREE.BufferGeometry();
  private readonly frontScene = new THREE.Scene();
  private readonly chordScene = new THREE.Scene();
  private readonly outputScene = new THREE.Scene();
  private readonly outputCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly frontMesh: THREE.Mesh;
  private readonly peelScenes: THREE.Scene[] = [];
  private readonly peelMeshes: THREE.Mesh[] = [];
  private readonly peelTargets: THREE.RenderTarget[] = [];
  private readonly chordQuad: THREE.Mesh;
  private readonly quad: THREE.Mesh;
  private readonly frontRT = new THREE.RenderTarget(1, 1, {
    type: THREE.FloatType, depthBuffer: true,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  });
  private readonly chordRT = new THREE.RenderTarget(1, 1, {
    type: THREE.FloatType, depthBuffer: false,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  });
  private readonly frontInput = texture(this.frontRT.texture);
  private readonly chordInput = texture(this.chordRT.texture);
  private readonly near = uniform(.1);
  private readonly far = uniform(1000);
  private readonly inverseProjection = uniform(new THREE.Matrix4());
  private readonly cameraWorld = uniform(new THREE.Matrix4());
  private readonly worldToView = uniform(new THREE.Matrix4());
  private readonly diagnostic = uniform(0);
  private triangles = 0;
  receipt = { triangles: 0, updateMs: 0, passCpuMs: 0, passes: 0,
    representation: 'World-space surface; mesh normals; Float32 paired liquid chord; four intervals with overflow guard' };

  constructor(U: RiverWaterUniforms) {
    const opaqueDepth = () => perspectiveDepthToViewZ(
      U.uSceneDepth.sample(ivec2(screenCoordinate.xy)).setSampler(false), this.near, this.far,
    ).negate();
    const frontMaterial = new THREE.NodeMaterial();
    frontMaterial.side = THREE.FrontSide;
    frontMaterial.fragmentNode = Fn(() => {
      const depth = positionView.z.negate().toVar();
      If(depth.greaterThan(opaqueDepth()), () => { Discard(); });
      return vec4(depth, normalize(normalWorld));
    })();
    this.frontMesh = new THREE.Mesh(this.geometry, frontMaterial);
    this.frontMesh.frustumCulled = false;
    this.frontScene.add(this.frontMesh);

    // Float32 crossings retain thin layers far apart. Half-float additive
    // entry/exit blending lost 22% in the two 1 cm layers / 20 m gap control.
    // Eight crossings cover four liquid intervals; a ninth is an explicit
    // overflow guard. This bounded prototype shows invalid pixels in magenta
    // instead of silently discarding deeper water. The camera stays outside.
    const inputs = [this.frontInput];
    for (let i = 0; i < 8; i++) {
      const previous = inputs[i];
      const target = new THREE.RenderTarget(1, 1, {
        type: THREE.FloatType, depthBuffer: true,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      });
      const peelMaterial = new THREE.NodeMaterial();
      peelMaterial.side = THREE.DoubleSide;
      peelMaterial.fragmentNode = Fn(() => {
        const prior = previous.sample(screenUV).x.toVar();
        const depth = positionView.z.negate().toVar();
        If(prior.lessThanEqual(0).or(depth.lessThanEqual(prior)).or(depth.greaterThan(opaqueDepth())), () => { Discard(); });
        return vec4(depth, select(frontFacing, 1, -1), 0, 1);
      })();
      const mesh = new THREE.Mesh(this.geometry, peelMaterial);
      mesh.frustumCulled = false;
      const scene = new THREE.Scene(); scene.add(mesh);
      this.peelTargets.push(target); this.peelScenes.push(scene); this.peelMeshes.push(mesh);
      inputs.push(texture(target.texture));
    }
    const chordMaterial = new THREE.NodeMaterial();
    chordMaterial.depthTest = false; chordMaterial.depthWrite = false;
    chordMaterial.vertexNode = vec4(positionGeometry.xy, 0, 1);
    chordMaterial.fragmentNode = Fn(() => {
      const first = this.frontInput.sample(screenUV).x.toVar();
      If(first.lessThanEqual(0), () => { Discard(); });
      const chord = float(0).toVar(), invalid = float(0).toVar();
      for (let i = 0; i < 8; i += 2) {
        const entry = inputs[i].sample(screenUV).x.toVar();
        const exit = inputs[i + 1].sample(screenUV).x.toVar();
        If(entry.greaterThan(0), () => {
          // An opaque surface can end an interval before its back interface.
          chord.addAssign(max(0, select(exit.greaterThan(0), exit, opaqueDepth()).sub(entry)));
          if (i > 0) If(inputs[i].sample(screenUV).y.lessThan(0), () => { invalid.assign(1); });
          If(exit.greaterThan(0).and(inputs[i + 1].sample(screenUV).y.greaterThan(0)), () => { invalid.assign(1); });
        });
      }
      If(inputs[8].sample(screenUV).x.greaterThan(0), () => { invalid.assign(1); });
      const ray = this.inverseProjection.mul(vec4(screenUV.x.mul(2).sub(1), float(1).sub(screenUV.y.mul(2)), 1, 1)).xyz;
      return vec4(chord.div(max(.00001, abs(normalize(ray).z))), invalid, 0, 1);
    })();
    this.chordQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), chordMaterial);
    this.chordQuad.frustumCulled = false;
    this.chordScene.add(this.chordQuad);

    const material = new THREE.NodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.vertexNode = vec4(positionGeometry.xy, 0, 1);
    material.fragmentNode = Fn(() => {
      const front = this.frontInput.sample(screenUV).toVar();
      If(front.x.lessThanEqual(0), () => { Discard(); });
      const N = normalize(front.yzw).toVar();
      const ray = this.inverseProjection.mul(vec4(screenUV.x.mul(2).sub(1),
        float(1).sub(screenUV.y.mul(2)), 1, 1)).xyz.toVar();
      const V = normalize(this.cameraWorld.mul(vec4(ray.negate(), 0)).xyz).toVar();
      const nView = normalize(this.worldToView.mul(vec4(N, 0)).xyz).toVar();
      const chord = clamp(this.chordInput.sample(screenUV).x, 0, 8).toVar();
      const facing = max(abs(dot(N, V)), .02);
      const fresnel = float(.02).add(pow(float(1).sub(facing), 5).mul(.98));
      const R = reflect(V.negate(), N).toVar();
      const sky = mix(U.uSkyHorizon, U.uSkyZenith, pow(max(R.y, 0), .5)).mul(U.uSkyGain).toVar();
      const offset = nView.xy.mul(min(chord, .5)).mul(.015);
      const background = U.uSceneColor.sample(clamp(screenUV.add(offset), vec2(.001), vec2(.999))).rgb;
      const transmission = exp(U.uAbsorbClear.negate().mul(chord)).toVar();
      const body = background.mul(transmission).add(U.uScatterClear.mul(sky).mul(vec3(1).sub(transmission)));
      const color = mix(body, sky, fresnel).toVar();
      If(this.diagnostic.equal(1), () => { color.assign(N.mul(.5).add(.5)); });
      If(this.diagnostic.equal(2), () => { color.assign(vec3(chord)); });
      If(this.chordInput.sample(screenUV).y.greaterThan(0), () => { color.assign(vec3(1, 0, 1)); });
      return vec4(color, 1);
    })();
    material.depthNode = viewZToPerspectiveDepth(this.frontInput.sample(screenUV).x.negate(), this.near, this.far);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.quad.frustumCulled = false;
    this.outputScene.add(this.quad);
  }

  update(surface: LiquidSurfaceMesh) {
    const start = performance.now();
    if (surface.positions.length !== surface.normals.length || surface.indices.length % 3)
      throw new Error('Invalid liquid surface buffers');
    const geometry = new THREE.BufferGeometry();
    const positions = surface.positions.slice(), normals = surface.normals.slice(), indices = surface.indices.slice();
    // Crest coordinates use across-stream +z; the existing river view maps it
    // to world -z. The reflection reverses winding, so reverse each triangle.
    for (let i = 2; i < positions.length; i += 3) { positions[i] *= -1; normals[i] *= -1; }
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const previous = this.geometry;
    this.geometry = geometry;
    this.frontMesh.geometry = geometry;
    for (const mesh of this.peelMeshes) mesh.geometry = geometry;
    previous.dispose();
    this.triangles = indices.length / 3;
    this.receipt.triangles = this.triangles;
    this.receipt.updateMs = performance.now() - start;
  }

  setDiagnostic(mode: 'shaded' | 'normals' | 'thickness') {
    this.diagnostic.value = ['shaded', 'normals', 'thickness'].indexOf(mode);
  }

  render(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
    destination: THREE.RenderTarget, width: number, height: number) {
    if (!this.triangles) { this.receipt.passes = 0; return; }
    const start = performance.now(), target = renderer.getRenderTarget(), oldColor = new THREE.Color();
    renderer.getClearColor(oldColor as unknown as Parameters<typeof renderer.getClearColor>[0]);
    const oldAlpha = renderer.getClearAlpha(), oldAuto = renderer.autoClear;
    if (this.frontRT.width !== width || this.frontRT.height !== height)
      for (const rt of [this.frontRT, this.chordRT, ...this.peelTargets]) rt.setSize(width, height);
    this.near.value = camera.near; this.far.value = camera.far;
    this.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.cameraWorld.value.copy(camera.matrixWorld);
    this.worldToView.value.copy(camera.matrixWorldInverse);
    renderer.setClearColor(0, 0); renderer.autoClear = false;
    try {
      renderer.setRenderTarget(this.frontRT); renderer.clear(); renderer.render(this.frontScene, camera);
      for (let i = 0; i < this.peelTargets.length; i++) {
        renderer.setRenderTarget(this.peelTargets[i]); renderer.clear(); renderer.render(this.peelScenes[i], camera);
      }
      renderer.setRenderTarget(this.chordRT); renderer.clear(); renderer.render(this.chordScene, this.outputCamera);
      renderer.setRenderTarget(destination); renderer.render(this.outputScene, camera);
      this.receipt.passes = 11;
    } finally { renderer.setClearColor(oldColor, oldAlpha); renderer.setRenderTarget(target); renderer.autoClear = oldAuto; }
    this.receipt.passCpuMs = performance.now() - start;
  }

  dispose() {
    this.geometry.dispose(); (this.frontMesh.material as THREE.Material).dispose();
    for (const mesh of this.peelMeshes) (mesh.material as THREE.Material).dispose();
    for (const rt of this.peelTargets) rt.dispose();
    this.chordQuad.geometry.dispose(); (this.chordQuad.material as THREE.Material).dispose();
    this.quad.geometry.dispose(); (this.quad.material as THREE.Material).dispose();
    this.frontRT.dispose(); this.chordRT.dispose();
  }
}
