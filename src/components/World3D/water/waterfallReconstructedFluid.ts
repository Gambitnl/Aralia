/** Optional native WebGPU waterfall reconstruction.
 * Moving liquid ellipsoids provide nearest depth and summed liquid thickness.
 * Two depth-aware filters remove small sample scallops, then normals come from
 * the filtered depth. The final surface reads the river's own opaque color,
 * depth, absorption, sun and sky. Legacy mode allocates none of these targets.
 * DEBT: This bounded bilateral approximation is not curvature-flow smoothing
 * or a solved fluid. Only the nearest surface has a normal; overlapping layers
 * contribute thickness. Separate spray keeps the bulk surface from becoming fog.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 15:32:25
 * Dependents: components/World3D/water/riverReachScene.ts, components/World3D/water/riverWaterfallView.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { Fn, If, Discard, abs, attribute, cameraPosition, clamp, cross, dot, exp,
  float, ivec2, max, mix, normalize, positionView, positionWorld, pow, reflect, screenCoordinate,
  sqrt, storage, instanceIndex, varying, texture, uniform, screenUV, positionGeometry, normalWorld, vec2, vec3, vec4, perspectiveDepthToViewZ, viewZToPerspectiveDepth } from 'three/tsl';
import type { RiverWaterUniforms } from './riverWaterMaterial';
import { FLUID_EMISSION, type FluidParticle } from './waterfallFluidEmission';

/** A published completed GPU epoch. xyz is world position; w is the exact
 * equal-volume sphere radius. The surface remains an unqualified filter,
 * never an assertion that the liquid really consists of spherical droplets. */
export interface CompletedFluidGpuEpoch { centers: THREE.StorageBufferAttribute; capacity: number }

export class WaterfallReconstructedFluid {
  private readonly depthScene = new THREE.Scene();
  private readonly thicknessScene = new THREE.Scene();
  private readonly sprayScene = new THREE.Scene();
  private readonly sprayMesh: THREE.InstancedMesh;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly particleData: THREE.InstancedInterleavedBuffer;
  private readonly depthMesh: THREE.Mesh;
  private readonly thicknessMesh: THREE.Mesh;
  private readonly resolution = uniform(new THREE.Vector2(1, 1));
  private readonly inverseProjection = uniform(new THREE.Matrix4());
  private readonly cameraWorld = uniform(new THREE.Matrix4());
  private readonly near = uniform(.1);
  private readonly far = uniform(1000);
  private readonly diagnostic = uniform(0);
  private readonly filterInput = texture(new THREE.Texture());
  private readonly depthInput = texture(new THREE.Texture());
  private readonly thicknessInput = texture(new THREE.Texture());
  private readonly filterMaterial: THREE.NodeMaterial;
  private readonly compositeMaterial: THREE.NodeMaterial;
  private readonly depthRT: THREE.RenderTarget;
  private readonly thicknessRT: THREE.RenderTarget;
  private readonly filterRT: THREE.RenderTarget[];
  private count = 0;
  receipt = { particles: 0, airborneVolume: 0, updateMs: 0, passCpuMs: 0, width: 0, height: 0,
    passes: 0, representation: 'Nearest moving liquid surface; depth-aware 5x5 filter twice; summed liquid chord; selective local breakup' };

  constructor(private readonly U: RiverWaterUniforms, private readonly gpu?: CompletedFluidGpuEpoch) {
    const capacity = gpu?.capacity ?? FLUID_EMISSION.maximumParticles;
    const base = new THREE.SphereGeometry(1, 10, 6);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setIndex(base.index);
    for (const [name, value] of Object.entries(base.attributes)) this.geometry.setAttribute(name, value);
    // WebGPU guarantees only eight vertex buffers. Separate material fields
    // exceeded that limit when the thickness pipeline also needed position,
    // normal and instance matrices. One shared instance record preserves every
    // field and its meaning while reducing seven buffers to one.
    this.particleData = new THREE.InstancedInterleavedBuffer(new Float32Array(gpu ? 18 : capacity * 18), 18);
    for (const [name, size, offset] of [
      ['fluidCenter', 3, 0], ['fluidTangent', 3, 3], ['fluidNormal', 3, 6],
      ['fluidAcross', 3, 9], ['fluidRadii', 3, 12], ['fluidOptics', 2, 15], ['fluidAge', 1, 17],
    ] as const) this.geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(this.particleData, size, offset));
    const published = gpu ? storage(gpu.centers, 'vec4', capacity).element(instanceIndex) : null;
    const field = (name: string, type: 'vec3'|'vec2'|'float'): THREE.Node => {
      if (!published) return attribute(name, type);
      if (name === 'fluidCenter') return varying(published.xyz);
      if (name === 'fluidRadii') return varying(vec3(published.w));
      if (name === 'fluidTangent') return vec3(1, 0, 0);
      if (name === 'fluidNormal') return vec3(0, 1, 0);
      if (name === 'fluidAcross') return vec3(0, 0, 1);
      if (name === 'fluidOptics') return vec2(1, 0);
      return float(0);
    };
    const occupied = () => {
      const opaque = U.uSceneDepth.sample(ivec2(screenCoordinate.xy)).setSampler(false);
      const limit = perspectiveDepthToViewZ(opaque, this.near, this.far).negate();
      If(positionView.z.negate().greaterThan(limit), () => Discard());
    };
    const depthMaterial = new THREE.NodeMaterial();
    depthMaterial.fragmentNode = Fn(() => { occupied(); return vec4(positionView.z.negate(), field('fluidOptics', 'vec2').y, field('fluidAge', 'float'), 1); })();
    depthMaterial.side = THREE.FrontSide;
    const thicknessMaterial = new THREE.NodeMaterial();
    thicknessMaterial.fragmentNode = Fn(() => {
      occupied();
      const radius = field('fluidRadii', 'vec3');
      const axes = [field('fluidTangent', 'vec3'), field('fluidNormal', 'vec3'), field('fluidAcross', 'vec3')];
      const offset = positionWorld.sub(field('fluidCenter', 'vec3')), ray = normalize(positionWorld.sub(cameraPosition));
      const p = vec3(dot(offset, axes[0]), dot(offset, axes[1]), dot(offset, axes[2])).div(radius);
      const d = vec3(dot(ray, axes[0]), dot(ray, axes[1]), dot(ray, axes[2])).div(radius);
      const a = max(dot(d, d), .000001), b = dot(p, d), c = dot(p, p).sub(1);
      const chord = max(0, b.negate().add(sqrt(max(0, b.mul(b).sub(a.mul(c))))).div(a));
      // A cliff that intersects an ellipsoid clips its represented chord at
      // the opaque surface, not only at the ellipsoid's entry interface.
      const opaque = U.uSceneDepth.sample(ivec2(screenCoordinate.xy)).setSampler(false);
      const limit = perspectiveDepthToViewZ(opaque, this.near, this.far).negate();
      const rayView = normalize(positionView), remaining = max(0, limit.sub(positionView.z.negate())).div(max(.00001, rayView.z.negate()));
      const optics = field('fluidOptics', 'vec2'), liquid = clamp(chord, 0, remaining).mul(optics.x);
      return vec4(liquid, liquid.mul(optics.y), 0, 1);
    })();
    thicknessMaterial.transparent = true; thicknessMaterial.depthWrite = false; thicknessMaterial.depthTest = false;
    thicknessMaterial.side = THREE.FrontSide; thicknessMaterial.blending = THREE.CustomBlending;
    thicknessMaterial.blendSrc = THREE.OneFactor; thicknessMaterial.blendDst = THREE.OneFactor;
    if (published) {
      // Geometry reads the immutable completed epoch, never the working step.
      depthMaterial.positionNode = published.xyz.add(positionGeometry.mul(published.w));
      thicknessMaterial.positionNode = depthMaterial.positionNode;
      this.depthMesh = new THREE.Mesh(this.geometry, depthMaterial);
      this.thicknessMesh = new THREE.Mesh(this.geometry, thicknessMaterial);
      this.geometry.instanceCount = 0;
    } else {
      const depth = new THREE.InstancedMesh(this.geometry, depthMaterial, capacity);
      const thickness = new THREE.InstancedMesh(this.geometry, thicknessMaterial, capacity);
      thickness.instanceMatrix = depth.instanceMatrix;
      this.depthMesh = depth; this.thicknessMesh = thickness;
    }
    this.depthMesh.frustumCulled = false; this.thicknessMesh.frustumCulled = false;
    this.depthScene.add(this.depthMesh); this.thicknessScene.add(this.thicknessMesh);
    const sprayGeometry = new THREE.InstancedBufferGeometry(); sprayGeometry.setIndex(base.index);
    for (const [name, value] of Object.entries(base.attributes)) sprayGeometry.setAttribute(name, value);
    const sprayMaterial = new THREE.NodeMaterial();
    sprayMaterial.fragmentNode = Fn(() => {
      const light = U.uSkyHorizon.mul(U.uSkyGain).mul(.18).add(U.uSunColor.mul(max(dot(normalWorld, U.uSunDir), 0)).mul(.45));
      return vec4(light.mul(vec3(.82, .86, .85)), .24);
    })();
    sprayMaterial.transparent = true; sprayMaterial.depthWrite = false; sprayMaterial.side = THREE.FrontSide;
    this.sprayMesh = new THREE.InstancedMesh(sprayGeometry, sprayMaterial, FLUID_EMISSION.maximumParticles);
    this.sprayMesh.frustumCulled = false; this.sprayScene.add(this.sprayMesh);
    const target = (depth: boolean) => new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType,
      depthBuffer: depth, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.depthRT = target(true); this.thicknessRT = target(false); this.filterRT = [target(false), target(false)];

    // Dry pixels remain dry. Neighbors behind a depth discontinuity never
    // pull the nearest foreground surface toward a separate background layer.
    this.filterMaterial = new THREE.NodeMaterial();
    this.filterMaterial.fragmentNode = Fn(() => {
      const center = this.filterInput.sample(screenUV).toVar();
      const sum = vec2(0).toVar(), weight = float(0).toVar();
      If(center.x.greaterThan(0), () => {
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
          const sample = this.filterInput.sample(clamp(screenUV.add(vec2(x, y).div(this.resolution)), vec2(0), vec2(1)));
          const delta = abs(sample.x.sub(center.x));
          // Meter-space gate is deliberately narrow: this smooths sample edges,
          // never broad sheets separated by meters of empty space.
          If(sample.x.greaterThan(0).and(delta.lessThan(.45)), () => {
            const w = exp(delta.mul(delta).mul(-32)).mul(Math.exp(-(x * x + y * y) / 5));
            sum.addAssign(sample.xy.mul(w)); weight.addAssign(w);
          });
        }
        center.xy.assign(sum.div(max(weight, .000001)));
      });
      return center;
    })();
    this.filterMaterial.depthTest = false; this.filterMaterial.depthWrite = false;
    this.filterMaterial.vertexNode = vec4(positionGeometry.xy, 0, 1);
    const viewPoint = (coord: THREE.Node, depth: THREE.Node) => {
      const ray = this.inverseProjection.mul(vec4(vec2(coord.x.mul(2).sub(1), float(1).sub(coord.y.mul(2))), 1, 1));
      return ray.xyz.mul(depth.div(max(.000001, ray.z.negate())));
    };
    this.compositeMaterial = new THREE.NodeMaterial();
    this.compositeMaterial.fragmentNode = Fn(() => {
      const coord = screenUV, center = this.depthInput.sample(coord).toVar();
      If(center.x.lessThanEqual(0), () => Discard());
      const point = viewPoint(coord, center.x), dx = vec2(1, 0).div(this.resolution), dy = vec2(0, 1).div(this.resolution);
      const neighbor = (offset: THREE.Node) => {
        const d = this.depthInput.sample(clamp(coord.add(offset), vec2(0), vec2(1))).x;
        return viewPoint(coord.add(offset), mix(center.x, d, float(d.greaterThan(0).and(abs(d.sub(center.x)).lessThan(.45)))));
      };
      const nView = normalize(cross(neighbor(dx).sub(neighbor(dx.negate())), neighbor(dy).sub(neighbor(dy.negate()))));
      const N = normalize(this.cameraWorld.mul(vec4(nView, 0)).xyz), V = normalize(this.cameraWorld.mul(vec4(point.negate(), 0)).xyz);
      const facing = max(abs(dot(N, V)), .02), fresnel = float(.02).add(pow(float(1).sub(facing), 5).mul(.98));
      const R = reflect(V.negate(), N), sky = mix(U.uSkyHorizon, U.uSkyZenith, pow(max(R.y, 0), .5)).mul(U.uSkyGain);
      const thickness = this.thicknessInput.sample(coord).xy;
      const chord = minNode(thickness.x, 8), foam = clamp(thickness.y.div(max(thickness.x, .000001)), 0, .7);
      const offset = vec2(nView.x, nView.y).mul(minNode(chord, .5)).mul(.015);
      const background = U.uSceneColor.sample(clamp(coord.add(offset), vec2(.001), vec2(.999))).rgb;
      const transmission = exp(U.uAbsorbClear.negate().mul(chord));
      const body = background.mul(transmission).add(U.uScatterClear.mul(sky).mul(vec3(1).sub(transmission)));
      const sunFacing = max(abs(dot(N, U.uSunDir)), 0);
      const whiteLight = mix(U.uSkyHorizon, U.uSkyZenith, .5).mul(U.uSkyGain).mul(.18)
        .add(U.uSunColor.mul(sunFacing).mul(.5));
      // Breakup follows relative carried deformation, not height alone. Its
      // finite chord progressively scatters light, retaining clear crest water.
      const air = float(1).sub(exp(chord.mul(foam).mul(-16)));
      const color = mix(mix(body, sky, fresnel), whiteLight.mul(vec3(.82, .86, .85)), air);
      const proofColor = color.toVar();
      If(this.diagnostic.equal(1).or(this.diagnostic.equal(2)), () => { proofColor.assign(vec3(center.x.div(this.far))); });
      If(this.diagnostic.equal(3), () => { proofColor.assign(vec3(thickness.x.div(thickness.x.add(1)))); });
      If(this.diagnostic.equal(4), () => { proofColor.assign(vec3(center.z.div(4), float(1).sub(center.z.div(4)), 0)); });
      return vec4(proofColor, 1);
    })();
    this.compositeMaterial.depthNode = viewZToPerspectiveDepth(this.depthInput.sample(screenUV).x.negate(), this.near, this.far);
    this.compositeMaterial.depthTest = true; this.compositeMaterial.depthWrite = true;
    this.compositeMaterial.vertexNode = vec4(positionGeometry.xy, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.filterMaterial);
    this.quadScene.add(this.quad);
  }

  /** Publish only after the copy dispatch completes; rejected partial steps stay hidden. */
  publishGpuEpoch(count: number): void {
    if (!this.gpu || count < 0 || count > this.gpu.capacity) throw Error('Invalid completed GPU epoch');
    this.count = count; this.geometry.instanceCount = count;
    this.sprayMesh.count = 0;
    (this.sprayMesh.geometry as THREE.InstancedBufferGeometry).instanceCount = 0;
    this.receipt.particles = count;
  }

  update(particles: readonly FluidParticle[], crest: { x: number; z: number; tx: number; tz: number }) {
    const started = performance.now(), matrix = new THREE.Matrix4();
    const forward = new THREE.Vector3(crest.tx, 0, crest.tz), across = new THREE.Vector3(crest.tz, 0, -crest.tx);
    const position = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
    let volume = 0;
    let index = 0, sprayIndex = 0;
    particles.forEach((p) => {
      position.set(crest.x + crest.tx * p.center[0] + crest.tz * p.center[2], p.center[1], crest.z + crest.tz * p.center[0] - crest.tx * p.center[2]);
      tangent.copy(forward).multiplyScalar(p.tangent[0]); tangent.y = p.tangent[1];
      normal.crossVectors(across, tangent).normalize();
      matrix.makeBasis(tangent, normal, across); matrix.scale(new THREE.Vector3(...p.radii)); matrix.setPosition(position);
      volume += p.volume;
      if (p.spray) { this.sprayMesh.setMatrixAt(sprayIndex++, matrix); return; }
      (this.depthMesh as THREE.InstancedMesh).setMatrixAt(index, matrix);
      for (const [name, value] of [['fluidCenter', position], ['fluidTangent', tangent], ['fluidNormal', normal], ['fluidAcross', across]] as const)
        (this.geometry.getAttribute(name) as THREE.InterleavedBufferAttribute).setXYZ(index, value.x, value.y, value.z);
      (this.geometry.getAttribute('fluidRadii') as THREE.InterleavedBufferAttribute).setXYZ(index, ...p.radii);
      (this.geometry.getAttribute('fluidOptics') as THREE.InterleavedBufferAttribute).setXY(index, p.liquidFraction, p.foam);
      (this.geometry.getAttribute('fluidAge') as THREE.InterleavedBufferAttribute).setX(index, p.age);
      index++;
    });
    this.particleData.needsUpdate = true;
    (this.depthMesh as THREE.InstancedMesh).instanceMatrix.needsUpdate = true; this.geometry.instanceCount = index; this.count = index;
    this.sprayMesh.instanceMatrix.needsUpdate = true; (this.sprayMesh.geometry as THREE.InstancedBufferGeometry).instanceCount = sprayIndex;
    this.receipt.particles = particles.length; this.receipt.airborneVolume = volume; this.receipt.updateMs = performance.now() - started;
  }

  /** Called between the native water and output passes. Targets clear every
   * frame, so source-off cannot leave a previous waterfall image resident. */
  render(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera, destination: THREE.RenderTarget, width: number, height: number) {
    if (!this.count) { this.receipt.passes = 0; return; }
    const start = performance.now(), oldTarget = renderer.getRenderTarget(), oldColor = new THREE.Color();
    // r172 copies into Color at runtime; its declaration asks for the private
    // Color4 type. Match the existing native scene's compatibility boundary.
    renderer.getClearColor(oldColor as unknown as Parameters<typeof renderer.getClearColor>[0]); const oldAlpha = renderer.getClearAlpha();
    if (this.depthRT.width !== width || this.depthRT.height !== height) {
      for (const rt of [this.depthRT, this.thicknessRT, ...this.filterRT]) rt.setSize(width, height);
    }
    this.resolution.value.set(width, height); this.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.cameraWorld.value.copy(camera.matrixWorld); this.near.value = camera.near; this.far.value = camera.far;
    renderer.setClearColor(0, 0);
    try {
      renderer.setRenderTarget(this.depthRT); renderer.clear(); renderer.render(this.depthScene, camera);
      renderer.setRenderTarget(this.thicknessRT); renderer.clear(); renderer.render(this.thicknessScene, camera);
      this.quad.material = this.filterMaterial;
      this.filterInput.value = this.depthRT.texture;
      for (const rt of this.filterRT) { renderer.setRenderTarget(rt); renderer.clear(); renderer.render(this.quadScene, this.quadCamera); this.filterInput.value = rt.texture; }
      this.depthInput.value = this.diagnostic.value === 1 ? this.depthRT.texture : this.filterRT[1].texture; this.thicknessInput.value = this.thicknessRT.texture;
      this.quad.material = this.compositeMaterial; renderer.setRenderTarget(destination); renderer.render(this.quadScene, this.quadCamera);
      if (this.diagnostic.value === 0 && !this.gpu) renderer.render(this.sprayScene, camera);
      this.receipt.passes = this.diagnostic.value === 0 && !this.gpu ? 6 : 5; this.receipt.width = width; this.receipt.height = height;
    } finally { renderer.setClearColor(oldColor, oldAlpha); renderer.setRenderTarget(oldTarget); }
    this.receipt.passCpuMs = performance.now() - start;
  }
  dispose() {
    this.geometry.dispose(); (this.depthMesh.material as THREE.Material).dispose(); (this.thicknessMesh.material as THREE.Material).dispose();
    this.sprayMesh.geometry.dispose(); (this.sprayMesh.material as THREE.Material).dispose();
    this.quad.geometry.dispose(); this.filterMaterial.dispose(); this.compositeMaterial.dispose();
    for (const rt of [this.depthRT, this.thicknessRT, ...this.filterRT]) rt.dispose();
  }
  setDiagnostic(mode: 'shaded'|'raw-depth'|'smoothed-depth'|'thickness'|'age') {
    this.diagnostic.value = ['shaded','raw-depth','smoothed-depth','thickness','age'].indexOf(mode);
  }
}

// Keep TSL's bounded node minimum explicit without shadowing JavaScript Math.
function minNode(a: THREE.Node, b: number) { return clamp(a, 0, b); }
