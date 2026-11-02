/**
 * @file grassWindNode.ts — ADR 0009 step 4: the grass wind sway as a TSL node
 * material, for the game world on WebGPURenderer (`?gpu=1`).
 *
 * The WebGL grass (`vegetation/GrassLayer.tsx`) injects the sway through
 * `onBeforeCompile` after `begin_vertex`, so it runs in BLADE-LOCAL space and
 * the instance matrix then scales and turns the displaced blade:
 *
 *   phase = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27
 *   hw    = clamp(position.y, 0, 1)^2
 *   w     = uWind + phase ; amp = 0.18 * hw
 *   transformed.x += sin(w) * amp
 *   transformed.z += cos(w * 0.8 + phase) * amp * 0.6
 *
 * Under WebGPU the hook is ignored and the meadow stands still. A plain
 * `positionNode` cannot reproduce this: the node path applies the instance
 * transform BEFORE `positionNode`, so a sway written there would move the blade
 * in world units, unscaled and unturned. This material therefore overrides
 * `setupPosition`: it builds the instance matrix node first (instanceNodes.ts),
 * writes the local sway into `positionLocal`, and only then appends the stock
 * instance node, which multiplies the displaced position by the instance
 * matrix. That is the GLSL order, with the GLSL numbers.
 *
 * The wind clock is the same `{ value }` object the WebGL material reads
 * (`GRASS_WIND`), sampled once per frame through a uniform.
 */
import { DoubleSide } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  clamp,
  cos,
  instancedMesh,
  positionGeometry,
  positionLocal,
  sin,
  uniform,
  vec3,
} from 'three/tsl';
import { adoptInstanceNodes, makeInstanceMatrixNode } from './instanceNodes';
import type { TslNode } from '@/types/tslNode';

type N = TslNode; // Shared TSL alias (GG-588): see src/types/tslNode.ts.

class GrassWindNodeMaterial extends MeshStandardNodeMaterial {
  /** The shared clock object; `copy()` carries it, so `clone()` keeps swaying. */
  wind: { value: number };
  private readonly windNode: N;

  constructor(wind: { value: number } = { value: 0 }) {
    super();
    this.wind = wind;
    // Sampled once per frame from the shared clock object, so every grass
    // layer sways in step exactly as on WebGL. Read through `this.wind`, so a
    // clone (three's `clone()` calls the constructor with no arguments, then
    // `copy()`) follows the same clock instead of throwing every frame.
    this.windNode = uniform(0).onFrameUpdate(() => this.wind.value);
  }

  copy(source: this): this {
    super.copy(source);
    this.wind = source.wind;
    return this;
  }

  setupPosition(builder: N): N {
    const object = builder.object;
    const instanced =
      object?.isInstancedMesh === true &&
      object.instanceMatrix &&
      object.instanceMatrix.isInstancedBufferAttribute === true;
    if (!instanced) return super.setupPosition(builder);

    const matrix = makeInstanceMatrixNode(object);
    const im: N = matrix.node.toVar('araliaGrassInstanceMatrix');
    const translation: N = im.element(3);

    // begin_vertex: transformed = position, then the sway in blade-local space.
    const phase: N = translation.x.mul(0.35).add(translation.z.mul(0.27));
    const hw0: N = clamp((positionGeometry as N).y, 0.0, 1.0);
    const hw: N = hw0.mul(hw0);
    const w: N = this.windNode.add(phase);
    const amp: N = hw.mul(0.18);
    const swayed: N = vec3(
      (positionGeometry as N).x.add(sin(w).mul(amp)),
      (positionGeometry as N).y,
      (positionGeometry as N).z.add(cos(w.mul(0.8).add(phase)).mul(amp).mul(0.6)),
    );
    (positionLocal as N).assign(swayed);

    // Then the stock instancing (position AND normal), on the swayed position,
    // reading the matrix node built above.
    const inst: N = instancedMesh(object);
    adoptInstanceNodes(inst, { node: im, buffer: matrix.buffer }, null);
    inst.append();

    if (this.positionNode !== null) {
      (positionLocal as N).assign((this.positionNode as N).context({ isPositionNodeInput: true }));
    }
    return positionLocal;
  }
}

/** The grass material for the WebGPU world; `wind` is the shared clock object. */
export function makeGrassWindNodeMaterial(wind: { value: number }): MeshStandardNodeMaterial {
  const m = new GrassWindNodeMaterial(wind);
  m.color.set('#ffffff');
  m.side = DoubleSide;
  m.roughness = 1;
  m.vertexColors = true;
  return m;
}
