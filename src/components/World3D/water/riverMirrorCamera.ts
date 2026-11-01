/**
 * THE RIVER'S MIRROR CAMERA AND TARGETS (2026-10-26): the reflection math and
 * the mirror's render targets, moved out of `RiverReachView` unchanged.
 *
 * This is slice 1 of the water layer (ADR 0009 step 6: the live river's water
 * inside the game world). The river page and, later, the world's water pass
 * share one copy of the mirror: one water system. The code is the river
 * view's own, line for line; the river page's pixels do not change.
 */
import * as THREE from 'three/webgpu';

/**
 * Mirror `cam` in the plane y = `planeY` (the three.js Reflector's method)
 * into `reflCam`, write the water's projective read matrix into `reflMatrix`,
 * and set an oblique near plane at the water plane (Lengyel 2005).
 *
 * `underside` is true when the camera is under the water: the mirrored camera
 * is then above it, and the clip keeps the submerged half-space instead.
 */
export function mirrorCameraInPlane(
  cam: THREE.PerspectiveCamera,
  reflCam: THREE.PerspectiveCamera,
  reflMatrix: THREE.Matrix4,
  planeY: number,
  underside: boolean,
): void {
  const normal = new THREE.Vector3(0, 1, 0);
  const planePoint = new THREE.Vector3(cam.position.x, planeY, cam.position.z);
  const view = new THREE.Vector3().subVectors(planePoint, cam.position);
  view.reflect(normal).negate().add(planePoint);
  const rot = new THREE.Matrix4().extractRotation(cam.matrixWorld);
  const lookAt = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cam.position);
  const target = new THREE.Vector3().subVectors(planePoint, lookAt);
  target.reflect(normal).negate().add(planePoint);
  const rc = reflCam;
  rc.position.copy(view);
  rc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
  rc.lookAt(target);
  rc.far = cam.far;
  rc.near = cam.near;
  rc.updateMatrixWorld();
  rc.projectionMatrix.copy(cam.projectionMatrix);
  rc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  reflMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  reflMatrix.multiply(rc.projectionMatrix);
  reflMatrix.multiply(rc.matrixWorldInverse);
  // Oblique near plane at the water plane (Lengyel 2005), so the bed and
  // anything else under the water stays out for above-water cameras.
  // Below water the opposite half-space supplies the submerged bed.
  // WEBGPU'S DEPTH RUNS 0..1 (2026-09-30). In WebGL's clip space the near
  // plane is z = -w, so the third row was 2 C / (C . q) + (0, 0, 1, 0). In
  // WebGPU's it is z = 0, so the plane C itself is the near plane: the third
  // row is C / (C . q), with no + 1 (three's ReflectorNode does the same).
  // q is the far corner in view space: (1 + P[10]) / P[14] is 1 / far in
  // both conventions. The WebGL build's bias of 0.003 on its 2 / (C . q)
  // scale kept a slack of 0.0015 |z| below the plane; 0.0015 on this scale
  // keeps the same slack.
  // The mirrored camera is above the water when the player is below it.
  // That reflection must retain submerged ground and exclude the trees.
  // Keep the original air-side clipping plane unchanged above the surface.
  const clipNormal = underside ? normal.clone().negate() : normal;
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(clipNormal, planePoint);
  plane.applyMatrix4(rc.matrixWorldInverse);
  const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const pm = rc.projectionMatrix;
  const q = new THREE.Vector4(
    (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
    (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
    -1,
    (1 + pm.elements[10]) / pm.elements[14],
  );
  clip.multiplyScalar(1 / clip.dot(q));
  pm.elements[2] = clip.x;
  pm.elements[6] = clip.y;
  pm.elements[10] = clip.z - 0.0015;
  pm.elements[14] = clip.w;
}

/**
 * The mirror's render target: `scale` of the frame (half as shipped), with
 * depth and `samples` MSAA. (The mip chain is the copy's: see
 * `createMirrorMipTarget`.)
 */
export function createMirrorTarget(w: number, h: number, scale: number, samples: number): THREE.RenderTarget {
  const rt = new THREE.RenderTarget(Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale)), {
    type: THREE.HalfFloatType, depthBuffer: true, samples,
  });
  rt.texture.generateMipmaps = false;
  rt.texture.minFilter = THREE.LinearFilter;
  return rt;
}

/**
 * The mirror's copy with a mip chain, at the same size: the water reads it at
 * a level set by its roughness (a glossy reflection), so the chain is built
 * every frame.
 */
export function createMirrorMipTarget(w: number, h: number, scale: number): THREE.RenderTarget {
  const rt = new THREE.RenderTarget(Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale)), {
    type: THREE.HalfFloatType, depthBuffer: false,
  });
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  return rt;
}

/** What the mirror's host draws into it (the river page, or the game world). */
export interface RiverMirrorHost {
  /** Draw the sky with the mirror camera (true projection, sun disk off). */
  drawSky(mirrorCamera: THREE.PerspectiveCamera): void;
  /** Draw the scene with the mirror camera (oblique clip at the water plane). */
  drawScene(mirrorCamera: THREE.PerspectiveCamera): void;
  /** Copy `source` into `target` (a full-frame quad: the mip chain's copy). */
  blit(source: THREE.Texture, target: THREE.RenderTarget): void;
}

/**
 * THE RIVER'S MIRROR (2026-10-26, the water layer's slice 3): the mirror
 * camera, the water's read matrix, the plane, and the two targets (MSAA, and
 * the mip-chain copy the water reads), with the pass that fills them. Moved
 * out of `RiverReachView` unchanged; the page is its first host.
 */
export class RiverMirror {
  /** The mirror camera (WebGPU clip space). */
  readonly camera = new THREE.PerspectiveCamera();
  /** The water's projective read of the mirror render. */
  readonly matrix = new THREE.Matrix4();
  /** The mirror plane's height, m (eased toward the water the camera looks at). */
  planeY = 1.3;
  /** The mirror's size as a share of the frame (0.5 as shipped; a measurement switch). */
  scale = 0.5;
  /** The mirror's MSAA samples (4 as shipped; WebGPU allows 1 or 4). */
  samples = 4;
  /** The MSAA render target. */
  target: THREE.RenderTarget;
  /**
   * The mirror with its mip chain (WebGPU, 2026-09-30): an MSAA texture has
   * one mip level only, so the mirror renders into `target` (MSAA) and a copy
   * pass fills this one, whose mips are built after each copy. The water
   * reads this one. (WebGL resolved the MSAA mirror into a mipmapped texture
   * and built the chain in one target.)
   */
  mipTarget: THREE.RenderTarget;
  private width = 1;
  private height = 1;

  constructor() {
    this.camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
    this.target = createMirrorTarget(1, 1, this.scale, this.samples);
    this.mipTarget = createMirrorMipTarget(1, 1, this.scale);
  }

  /** New targets for a new frame size. */
  setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.target.dispose();
    this.mipTarget.dispose();
    this.target = createMirrorTarget(w, h, this.scale, this.samples);
    this.mipTarget = createMirrorMipTarget(w, h, this.scale);
  }

  setSamples(n: number): void {
    this.samples = n;
    this.target.dispose();
    this.target = createMirrorTarget(this.width, this.height, this.scale, this.samples);
  }

  setScale(s: number): void {
    this.scale = Math.max(0.1, Math.min(1, s));
    this.target.dispose();
    this.mipTarget.dispose();
    this.target = createMirrorTarget(this.width, this.height, this.scale, this.samples);
    this.mipTarget = createMirrorMipTarget(this.width, this.height, this.scale);
  }

  /** Mirror `cam` in the plane (or, under water, in `underwaterPlane`). */
  update(cam: THREE.PerspectiveCamera, underwaterPlane: number | null): void {
    mirrorCameraInPlane(cam, this.camera, this.matrix, underwaterPlane ?? this.planeY, underwaterPlane !== null);
  }

  /**
   * The mirror pass: the sky with the camera's own projection, then the scene
   * with the oblique clip, then the copy into the mip-chain target. Under
   * water (`underwaterPlane` set) the target clears to transparent black and
   * no sky draws: the material supplies water radiance where no submerged
   * object draws.
   */
  draw(r: THREE.WebGPURenderer, cam: THREE.PerspectiveCamera, underwaterPlane: number | null, host: RiverMirrorHost): void {
    this.update(cam, underwaterPlane);
    const oblique = this.camera.projectionMatrix.clone();
    this.camera.projectionMatrix.copy(cam.projectionMatrix);
    r.setRenderTarget(this.target);
    const undersideMirror = underwaterPlane !== null;
    // Three r172 copies into a Color; its declaration asks for internal Color4.
    const mirrorClearColor = undersideMirror ? r.getClearColor(new THREE.Color() as unknown as Parameters<typeof r.getClearColor>[0]) : null;
    const mirrorClearAlpha = undersideMirror ? r.getClearAlpha() : 1;
    if (undersideMirror) r.setClearColor(0x000000, 0);
    r.clear();
    if (mirrorClearColor) r.setClearColor(mirrorClearColor, mirrorClearAlpha);
    if (!undersideMirror) host.drawSky(this.camera);
    this.camera.projectionMatrix.copy(oblique);
    host.drawScene(this.camera);
    host.blit(this.target.texture, this.mipTarget);
  }

  dispose(): void {
    this.target.dispose();
    this.mipTarget.dispose();
  }
}
