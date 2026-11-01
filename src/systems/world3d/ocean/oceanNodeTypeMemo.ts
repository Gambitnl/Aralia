/**
 * oceanNodeTypeMemo.ts — the shader build's type memo (build-time round 1,
 * GG-388; see docs/architecture/domains/world3d-ocean.md "## Build time").
 *
 * WHAT IT DOES. During the GENERATE stage of a three r172 node build, it keeps
 * the result of each node's `getNodeType` per (node cache, shader stage,
 * output type), so the same node in the same build returns its type once
 * found. It does not change a type: a hit returns the value the same call
 * returned before. The WGSL that the page compiles is byte-identical with and
 * without the memo (all modules of every extras set compared; see the doc).
 *
 * WHY. In three r172, `getNodeType` is not cached. An operator, math, var,
 * convert, split or Fn-call node asks each input for its type, and that input
 * asks its inputs, down to the leaves, on EVERY call. The generate stage calls
 * it many times a node (the output type, the input type, each operand). The
 * ocean's graphs share nodes deeply (the footprint, the fades, the band sums,
 * the readers' samples), so the number of paths to the leaves grows as a
 * product with the depth. A `.toVar()` does not stop it: VarNode.getNodeType
 * asks its node. Measured on 2026-10-09 (headless Chrome, D3D11, this machine):
 * the surface alone took 41 s to ready, the surface with foam 264 to 290 s,
 * with foam and rocks 450 s to never; the main thread was 85 to 95 percent of
 * that time in `getNodeType` (V8 profile, build/p0-surf). With the memo: 13.5 s
 * and 22 s, with the same WGSL.
 *
 * WHAT IS KEPT. The setup and analyze stages are not touched (their own
 * per-node caches hold already, and a type asked during setup can change while
 * a stack is still being built). Each class keeps its own memo, so a subclass
 * that calls `super.getNodeType` gets the parent's own answer and not its own.
 * The memo lives in WeakMaps keyed by the builder's node cache, so it goes
 * with the build.
 *
 * WHAT IS OPEN. It is a patch on three's prototypes, installed once when an
 * ocean module loads, so it reaches every node build on the page, not only
 * the ocean's. A three release that caches node types itself makes it a
 * no-op; remove it then (the WGSL comparison in the doc is the check).
 * Classes three does not export (ShaderCallNodeInternal) are not wrapped;
 * their inputs are.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 04:22:12
 * Dependents: systems/world3d/ocean/oceanSurface.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';

type TypeFn = (this: object, builder: unknown, output?: string | null) => string;
interface BuilderLike {
  buildStage?: string | null;
  shaderStage?: string | null;
  getCache?: () => object;
}

const INSTALLED = Symbol.for('aralia.ocean.nodeTypeMemo');

/**
 * Wraps `getNodeType` on every class in `registry` that defines its own.
 * Returns the number of classes wrapped (0 when already installed).
 * Exported with a registry argument so a test can install it on stand-ins.
 */
export function installNodeTypeMemo(registry: Record<string, unknown>): number {
  let wrapped = 0;
  for (const C of Object.values(registry)) {
    if (typeof C !== 'function') continue;
    const proto = (C as { prototype?: Record<PropertyKey, unknown> }).prototype;
    if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'getNodeType')) continue;
    if (Object.prototype.hasOwnProperty.call(proto, INSTALLED)) continue;
    const orig = proto.getNodeType as TypeFn;
    // Node cache -> "stage|output" -> node -> type.
    const memo = new WeakMap<object, Map<string, Map<object, string>>>();
    const wrappedFn: TypeFn = function (this: object, builder: unknown, output?: string | null): string {
      const b = builder as BuilderLike | undefined;
      if (!b || b.buildStage !== 'generate') return orig.call(this, builder, output);
      const cache = (typeof b.getCache === 'function' ? b.getCache() : null) ?? (b as object);
      let byKey = memo.get(cache);
      if (byKey === undefined) { byKey = new Map(); memo.set(cache, byKey); }
      const key = `${b.shaderStage ?? ''}|${output ?? ''}`;
      let byNode = byKey.get(key);
      if (byNode === undefined) { byNode = new Map(); byKey.set(key, byNode); }
      const hit = byNode.get(this);
      if (hit !== undefined) return hit;
      const type = orig.call(this, builder, output);
      byNode.set(this, type);
      return type;
    };
    proto.getNodeType = wrappedFn;
    proto[INSTALLED] = true;
    wrapped += 1;
  }
  return wrapped;
}

/** The number of three/webgpu classes wrapped when this module loaded. */
export const OCEAN_NODE_TYPE_MEMO_CLASSES = installNodeTypeMemo(THREE as unknown as Record<string, unknown>);
