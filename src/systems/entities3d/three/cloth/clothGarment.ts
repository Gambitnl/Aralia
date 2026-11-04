/**
 * @file clothGarment.ts — one simulated garment on one figure: its cut, its
 * pins and colliders on that figure's skeleton, and the mesh that draws it.
 *
 * Character cloth+armor campaign, slice 1c (2026-11-04). The garment is the
 * ClothSource the GPU system (clothSystem.ts) steps. Its mesh draws straight
 * from the system's position texture: the vertex shader fetches each point's
 * world position and builds the normal from the four grid neighbors, so no
 * vertex data ever goes back to the CPU.
 *
 * WORLD SPACE. The cloth simulates in world space (that is what makes a cape
 * swing when the figure turns), so the mesh keeps an IDENTITY world matrix
 * even though it is parented under the figure's group for lifetime and
 * visibility. `matrixWorldAutoUpdate = false` stops the parent from writing
 * its transform into it.
 *
 * LOOK (target lineup, settled 2026-11-04): the outer face takes the garment
 * color, the inner face a darker lining, both through the entity toon ramp
 * with smooth (not flat) normals so folds read as soft cloth.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  Vector4,
  type SkinnedMesh,
  type WebGLRenderer,
} from 'three';
import { CLOTH_COLLIDER_STRIDE, colliderClearanceOf, poseClothColliders, type ClothCollider } from './bodyColliders';
import type { ClothPanel } from './garmentPanels';
import { clothSystemFor, type ClothSource, type ClothSystem } from './clothSystem';
import { toonMaterial } from '../toon';

/** What measureClearance reports: the aggregate plus the trapping collider. */
export interface ClothClearance {
  points: number;
  /** points deeper than 1 mm inside the body */
  inside: number;
  /** meters; negative = inside */
  minClearance: number;
  hemY: number;
  /** inside count per collider id */
  insideBy: Record<string, number>;
  /** points deeper than the collider's cloth margin: through the DRAWN SKIN.
   * A point inside the margin only is cloth pressed flat on the body (a hand
   * or an arm that pinches it), not a cut-through. */
  throughSkin: number;
  /** meters past the skin for the deepest point (0 when none is through) */
  worstSkinDepth: number;
  /** the deepest point, or null when every point is clear */
  worst: { row: number; col: number; collider: string; depthM: number } | null;
}

export interface ClothGarmentOptions {
  colorHex: string;
  liningHex: string;
}

export class ClothGarment implements ClothSource {
  readonly mesh: Mesh;
  readonly bones: SkinnedMesh['skeleton']['bones'];
  readonly boneInverses: SkinnedMesh['skeleton']['boneInverses'];
  readonly colliders: readonly ClothCollider[];
  readonly pinBone: Int32Array;
  private system: ClothSystem | null = null;
  private readonly uniforms = {
    uClothPos: { value: null as unknown },
    uClothRegion: { value: new Vector4() },
    uLining: { value: new Color() },
  };
  private readonly chestIndex: number;

  constructor(
    readonly panel: ClothPanel,
    body: SkinnedMesh,
    /** Every body collider of the figure; the panel picks its own subset. */
    allColliders: readonly ClothCollider[],
    /** The figure's root group: its world height is the floor. */
    private readonly ground: { matrixWorld: Matrix4 },
    options: ClothGarmentOptions,
  ) {
    this.bones = body.skeleton.bones;
    this.boneInverses = body.skeleton.boneInverses;
    const byName = new Map(this.bones.map((b, i) => [b.name, i]));
    const indexOf = (name: string): number => {
      const i = byName.get(name);
      if (i === undefined) throw new Error(`clothGarment: the skeleton has no "${name}" bone`);
      return i;
    };
    // order does not matter: the solver averages every collider's push
    // (clothShaders.ts overlap rule, weights from clothSystem.ts pushWeight)
    this.colliders = panel.colliders.map((id) => {
      const c = allColliders.find((k) => k.id === id);
      if (!c) throw new Error(`clothGarment: the figure has no "${id}" collider`);
      return c;
    });
    this.pinBone = Int32Array.from(panel.pins.map((p) => indexOf(p.bone)));
    this.chestIndex = indexOf('chest');

    // Geometry: one vertex per cloth point, carrying only its grid cell. The
    // position attribute is a placeholder three needs for the draw count.
    const n = panel.rows * panel.cols;
    const cells = new Float32Array(n * 2);
    for (let r = 0; r < panel.rows; r++) for (let c = 0; c < panel.cols; c++) cells.set([c, r], (r * panel.cols + c) * 2);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('clothCell', new BufferAttribute(cells, 2));
    const index: number[] = [];
    const cEnd = panel.wrap ? panel.cols : panel.cols - 1;
    const at = (r: number, c: number): number => r * panel.cols + (c % panel.cols);
    for (let r = 0; r + 1 < panel.rows; r++) {
      for (let c = 0; c < cEnd; c++) {
        const a = at(r, c), b = at(r, c + 1), d = at(r + 1, c), e = at(r + 1, c + 1);
        // wound so the OUTER face (away from the body) is the front face
        index.push(a, b, d, b, e, d);
      }
    }
    geo.setIndex(index);

    // default surface, not 'soft': the soft tint shifts toward skin tone, and
    // the first ranger cloak rendered pale olive next to its dark green kit
    const material = toonMaterial(options.colorHex);
    (material as unknown as { flatShading: boolean }).flatShading = false;
    material.side = DoubleSide;
    this.uniforms.uLining.value.set(options.liningHex);
    const base = material.onBeforeCompile;
    const u = this.uniforms;
    material.onBeforeCompile = (shader, renderer) => {
      base.call(material, shader, renderer);
      shader.uniforms.uClothPos = u.uClothPos;
      shader.uniforms.uClothRegion = u.uClothRegion;
      shader.uniforms.uLining = u.uLining;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform highp sampler2D uClothPos;
uniform vec4 uClothRegion;
attribute vec2 clothCell;
vec3 clothAt(vec2 cell) { return texelFetch(uClothPos, ivec2(uClothRegion.xy + cell), 0).xyz; }`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `float _cols = abs(uClothRegion.z);
bool _wrap = uClothRegion.z < 0.0;
vec2 _c = clothCell;
// two cells each way: a one-cell stencil turned small ripples into toon-ramp
// blotches in the first renders (2026-11-04); two cells read as soft cloth
vec2 _l = vec2(_wrap ? mod(_c.x - 2.0 + _cols, _cols) : max(_c.x - 2.0, 0.0), _c.y);
vec2 _r = vec2(_wrap ? mod(_c.x + 2.0, _cols) : min(_c.x + 2.0, _cols - 1.0), _c.y);
vec2 _u = vec2(_c.x, max(_c.y - 2.0, 0.0));
vec2 _d = vec2(_c.x, min(_c.y + 2.0, uClothRegion.w - 1.0));
vec3 _cp = clothAt(_c);
// across × down: outward for a cape and for a tube alike (clothGarment.ts)
vec3 objectNormal = normalize(cross(clothAt(_r) - clothAt(_l), clothAt(_d) - clothAt(_u)));`,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = _cp;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uLining;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = uLining;');
    };
    material.customProgramCacheKey = () => 'entity-cloth-v1';

    const mesh = new Mesh(geo, material);
    mesh.name = `cloth:${panel.kind}`;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.matrixWorld.identity();
    mesh.onBeforeRender = (renderer) => this.beforeRender(renderer as WebGLRenderer);
    // capture rigs find the garment by walking the scene (measureClearance)
    mesh.userData.clothGarment = this;
    this.mesh = mesh;
  }

  private beforeRender(renderer: WebGLRenderer): void {
    if (!this.system) {
      this.system = clothSystemFor(renderer);
      const region = this.system.register(this);
      this.uniforms.uClothRegion.value.set(region.x, region.y, this.panel.wrap ? -this.panel.cols : this.panel.cols, this.panel.rows);
    }
    this.system.stepFrame();
    this.uniforms.uClothPos.value = this.system.positionTexture();
  }

  floorY(): number {
    return this.ground.matrixWorld.elements[13];
  }

  initMatrix(out: Matrix4): Matrix4 {
    const i = this.chestIndex;
    return out.multiplyMatrices(this.bones[i].matrixWorld, this.boneInverses[i]);
  }

  /** Live world positions (debug and test readback only). */
  readPositions(): Float32Array | null {
    return this.system ? this.system.readPositions(this) : null;
  }

  /**
   * The "does not cut through the body" measure, for tests and captures:
   * read every live point back and measure its clearance from this frame's
   * posed body colliders. `inside` counts points deeper than 1 mm inside the
   * body; `minClearance` is the worst point (meters, negative = inside).
   * Synchronous GPU read — never on a hot path.
   */
  measureClearance(): ClothClearance | null {
    const p = this.readPositions();
    if (!p) return null;
    const caps = new Float32Array(this.colliders.length * CLOTH_COLLIDER_STRIDE);
    poseClothColliders(this.colliders, this.bones, this.boneInverses, caps);
    let inside = 0;
    let minClearance = Infinity;
    const insideBy: Record<string, number> = {};
    let worst: ClothClearance['worst'] = null;
    let throughSkin = 0;
    let worstSkinDepth = 0;
    const n = p.length / 3;
    for (let i = 0; i < n; i++) {
      // per collider, so a rig can name the piece that traps the cloth
      // (the 2026-11-04 walk-circle failures were arm-against-back pinches)
      let d = Infinity;
      let by = '';
      let margin = 0;
      for (let k = 0; k < this.colliders.length; k++) {
        const dk = colliderClearanceOf(caps, k, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        if (dk < d) { d = dk; by = this.colliders[k].id; margin = this.colliders[k].margin; }
      }
      if (d < -0.001) {
        inside++;
        insideBy[by] = (insideBy[by] ?? 0) + 1;
        const skinDepth = -d - margin;
        if (skinDepth > 0.001) throughSkin++;
        if (skinDepth > worstSkinDepth) worstSkinDepth = skinDepth;
      }
      if (d < minClearance) {
        minClearance = d;
        worst = { row: Math.floor(i / this.panel.cols), col: i % this.panel.cols, collider: by, depthM: -d };
      }
    }
    const hemRow = (this.panel.rows - 1) * this.panel.cols;
    let hemY = 0;
    for (let c = 0; c < this.panel.cols; c++) hemY += p[(hemRow + c) * 3 + 1] / this.panel.cols;
    return { points: n, inside, minClearance, hemY, insideBy, worst, throughSkin, worstSkinDepth };
  }

  dispose(): void {
    this.system?.unregister(this);
    this.system = null;
    this.mesh.geometry.dispose();
    (this.mesh.material as { dispose(): void }).dispose();
  }
}
