/**
 * @file instanceNodes.ts — the instance matrix and instance color of an
 * `InstancedMesh`, as TSL nodes the material can read BEFORE three applies the
 * instancing.
 *
 * WHY. three r172's `InstanceNode` builds its matrix and color nodes inside
 * its own `setup()`, after the material has no way to reach them. Two looks
 * in the game world need them earlier:
 * - the grass sway displaces each blade in BLADE-LOCAL space and reads its
 *   phase from the instance translation (`instanceMatrix[3]`), then the
 *   instance transform scales and turns the displaced blade;
 * - the tree tint applies the instance color to foliage only, in the vertex
 *   stage, before the per-vertex color is interpolated.
 *
 * `InstanceNode` reads `instanceMatrixNode` / `instanceColorNode` when they are
 * already set (its own fields), so a material can build them here, hand them
 * to the node, and read the same nodes itself. The two builders below are the
 * node's own two branches: a uniform buffer of mat4 for up to 1,000 instances
 * (the 64 KB UBO limit), an interleaved instanced attribute above that. The
 * backing buffers are handed over too (`buffer`, `bufferColor`), so the node's
 * version sync keeps working when `instanceMatrix.needsUpdate` is set later.
 *
 * KNOWN r172 FAULT (memory three-r172-webgpu-render-faults): the matrix read
 * is fixed by `count` at first build. The grass and tree meshes never change
 * their count after mount (a new field remounts the mesh), so it holds here.
 */
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedInterleavedBuffer,
  type InstancedMesh,
} from 'three';
import {
  buffer,
  instanceIndex,
  instancedBufferAttribute,
  instancedDynamicBufferAttribute,
  mat4,
  vec3,
} from 'three/tsl';
import type { TslNode } from '@/types/tslNode';

type N = TslNode; // Shared TSL alias (GG-588): see src/types/tslNode.ts.

export interface InstanceMatrixNodes {
  /** The instance's mat4 for the current `instanceIndex`. */
  node: N;
  /** The interleaved buffer behind the attribute path, null on the UBO path. */
  buffer: InstancedInterleavedBuffer | null;
}

/** The instance matrix node, the way `InstanceNode.setup` would build it. */
export function makeInstanceMatrixNode(mesh: InstancedMesh): InstanceMatrixNodes {
  const { count, instanceMatrix } = mesh;
  if (count <= 1000) {
    return {
      node: buffer(instanceMatrix.array, 'mat4', Math.max(count, 1)).element(instanceIndex),
      buffer: null,
    };
  }
  const interleaved = new InstancedInterleavedBuffer(instanceMatrix.array as Float32Array, 16, 1);
  const bufferFn =
    instanceMatrix.usage === DynamicDrawUsage ? instancedDynamicBufferAttribute : instancedBufferAttribute;
  const node = mat4(
    bufferFn(interleaved as N, 'vec4', 16, 0),
    bufferFn(interleaved as N, 'vec4', 16, 4),
    bufferFn(interleaved as N, 'vec4', 16, 8),
    bufferFn(interleaved as N, 'vec4', 16, 12),
  );
  return { node, buffer: interleaved };
}

export interface InstanceColorNodes {
  node: N;
  buffer: InstancedBufferAttribute;
}

/** The instance color node, the way `InstanceNode.setup` would build it. Null without instance colors. */
export function makeInstanceColorNode(mesh: InstancedMesh): InstanceColorNodes | null {
  const { instanceColor } = mesh;
  if (!instanceColor) return null;
  const attr = new InstancedBufferAttribute(instanceColor.array as Float32Array, 3);
  const bufferFn =
    instanceColor.usage === DynamicDrawUsage ? instancedDynamicBufferAttribute : instancedBufferAttribute;
  return { node: vec3(bufferFn(attr as N, 'vec3', 3, 0)), buffer: attr };
}

/**
 * Hand pre-built nodes to a stock `InstancedMeshNode` so it reuses them instead
 * of building its own copies (two uploads of the same array otherwise).
 */
export function adoptInstanceNodes(
  instanceNode: N,
  matrix: InstanceMatrixNodes | null,
  color: InstanceColorNodes | null,
): void {
  if (matrix) {
    instanceNode.instanceMatrixNode = matrix.node;
    instanceNode.buffer = matrix.buffer;
  }
  if (color) {
    instanceNode.instanceColorNode = color.node;
    instanceNode.bufferColor = color.buffer;
  }
}
