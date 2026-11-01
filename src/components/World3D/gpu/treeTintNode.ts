/**
 * @file treeTintNode.ts — ADR 0009 step 4: the tree field's foliage-only
 * instance tint as a TSL node material, for the game world on WebGPURenderer
 * (`?gpu=1`).
 *
 * The WebGL tree material (`vegetation/VegetationTreeField.tsx`) replaces the
 * `color_vertex` chunk so the batch's instance color (a FOLIAGE albedo) reaches
 * leaves in full and bark only as a quarter of its hue at unit luminance:
 *
 *   foliageMask = step(0.6, color.g)
 *   tint        = instanceColor
 *   tintLuma    = max(dot(tint, (0.2126, 0.7152, 0.0722)), 1e-4)
 *   barkTint    = mix(1, tint / tintLuma, BARK_TINT_BLEND)
 *   vColor      = color * mix(barkTint, tint, foliageMask)
 *
 * Under WebGPU the chunk replacement is ignored and three multiplies the
 * instance color into every vertex, which turns bark green-black (the "flat
 * black column" fault the GLSL fixed). This material overrides
 * `setupDiffuseColor` so the diffuse color is `materialColor * vColor` with the
 * vColor above, computed in the VERTEX stage (a `varying`) exactly where the
 * GLSL computes it, and the stock instance-color multiply does not run. The
 * instance color node is built before the instancing (instanceNodes.ts) so the
 * vertex-stage graph can read it.
 *
 * Trees that carry no instance color (a batch without `color`) take the plain
 * vertex color, as the GLSL's `#ifdef USE_INSTANCING_COLOR` leaves them.
 */
import { DoubleSide, NormalBlending } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  attribute,
  diffuseColor,
  dot,
  float,
  instancedMesh,
  materialAlphaTest,
  materialColor,
  materialOpacity,
  max as tslMax,
  mix,
  positionLocal,
  step,
  varying,
  vec3,
  vec4,
} from 'three/tsl';
import { adoptInstanceNodes, makeInstanceColorNode } from './instanceNodes';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

class TreeTintNodeMaterial extends MeshStandardNodeMaterial {
  /** How much of the biome hue the bark takes; `copy()` carries it for `clone()`. */
  barkTintBlend: number;
  /** The instance color node of the object being built, set by setupPosition. */
  private instanceColorNode: N = null;

  constructor(barkTintBlend = 0.25) {
    super();
    this.barkTintBlend = barkTintBlend;
  }

  copy(source: this): this {
    super.copy(source);
    this.barkTintBlend = source.barkTintBlend;
    return this;
  }

  setupPosition(builder: N): N {
    const object = builder.object;
    this.instanceColorNode = null;
    const instanced =
      object?.isInstancedMesh === true &&
      object.instanceMatrix &&
      object.instanceMatrix.isInstancedBufferAttribute === true;
    if (!instanced || !object.instanceColor) return super.setupPosition(builder);

    const color = makeInstanceColorNode(object);
    this.instanceColorNode = color ? color.node : null;
    const inst: N = instancedMesh(object);
    adoptInstanceNodes(inst, null, color);
    inst.append();

    if (this.positionNode !== null) {
      (positionLocal as N).assign((this.positionNode as N).context({ isPositionNodeInput: true }));
    }
    return positionLocal;
  }

  setupDiffuseColor(builder: N): void {
    const { geometry } = builder;
    let colorNode: N = this.colorNode ? vec4(this.colorNode) : vec4(materialColor);

    // The color_vertex port, in the vertex stage.
    let vColor: N = vec3(1.0);
    if (this.vertexColors === true && geometry.hasAttribute('color')) {
      const color: N = attribute('color', 'vec3');
      vColor = vColor.mul(color);
      if (this.instanceColorNode !== null) {
        const foliageMask: N = step(0.6, color.g);
        const tint: N = this.instanceColorNode;
        const tintLuma: N = tslMax(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
        const barkTint: N = mix(vec3(1.0), tint.div(tintLuma), float(this.barkTintBlend));
        vColor = vColor.mul(mix(barkTint, tint, foliageMask));
      }
    }
    const interpolated: N = varying(vColor, 'vAraliaTreeColor');
    colorNode = vec4(colorNode.xyz.mul(interpolated), colorNode.a);

    // The rest of NodeMaterial.setupDiffuseColor (r172), without the stock
    // instance-color multiply this material replaces.
    (diffuseColor as N).assign(colorNode);
    const opacityNode: N = this.opacityNode ? float(this.opacityNode) : materialOpacity;
    (diffuseColor as N).a.assign((diffuseColor as N).a.mul(opacityNode));
    if (this.alphaTestNode !== null || this.alphaTest > 0) {
      const alphaTestNode: N = this.alphaTestNode !== null ? float(this.alphaTestNode) : materialAlphaTest;
      (diffuseColor as N).a.lessThanEqual(alphaTestNode).discard();
    }
    if (this.alphaHash === true) {
      throw new Error('[world3d-webgpu] TreeTintNodeMaterial does not implement alphaHash');
    }
    if (this.transparent === false && this.blending === NormalBlending && this.alphaToCoverage === false) {
      (diffuseColor as N).a.assign(1.0);
    }
  }
}

/** The tree material for the WebGPU world. `barkTintBlend` is the WebGL file's BARK_TINT_BLEND. */
export function makeTreeTintNodeMaterial(barkTintBlend: number): MeshStandardNodeMaterial {
  const m = new TreeTintNodeMaterial(barkTintBlend);
  m.color.set('#ffffff');
  m.vertexColors = true;
  m.side = DoubleSide;
  m.roughness = 0.95;
  return m;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
