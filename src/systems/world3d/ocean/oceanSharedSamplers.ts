/**
 * oceanSharedSamplers.ts — one sampler per sampler state, ONLY in a fragment
 * stage that would pass the device's sampler limit (build-time round 1,
 * GG-388; see docs/architecture/domains/world3d-ocean.md "## Build time").
 *
 * WHY. three r172 gives every filtered texture of a fragment stage its own
 * sampler binding. WebGPU on this machine allows 16 samplers a stage
 * (`maxSamplersPerShaderStage`; the adapter cannot raise it). The surface
 * with foam, rocks and the river mouth reads 21 filtered textures in its
 * fragment stage (foam 4 + 4 + 3, the normal atlas, the far atlas, the sky,
 * the seabed's caustics and the river's fields), so its pipeline was invalid,
 * the command buffer was invalid and the page drew nothing (measured
 * 2026-10-09: "The number of samplers (21) in the Fragment stage exceeds the
 * maximum per-stage limit (16)"). The 21 textures use 3 sampler states
 * (clamp/clamp, repeat/clamp and repeat/repeat, all linear).
 *
 * WHAT IT DOES. When a material's fragment stage holds more samplers than
 * the limit, the textures that have the same sampler state (address modes,
 * filters, anisotropy, compare) use the first one's sampler: the other
 * sampler bindings leave the bind group and the WGSL, the later binding
 * numbers move down, and the sample calls name the kept sampler. A sampler
 * is a fixed state, so two textures with the same state sample the same with
 * either sampler: the image does not change.
 *
 * WHAT IS KEPT. A stage at or under the limit is not touched, so every
 * pipeline that compiled before compiles from byte-identical WGSL (the doc's
 * comparison). The vertex and compute stages are not touched.
 *
 * WHAT IS OPEN. It patches three's WGSL node builder (its `buildCode` and
 * `getUniforms`), found from the first builder that runs; a three release
 * that shares samplers itself makes it a no-op. A texture whose filters or
 * wrap change after the build keeps the sampler of the build.
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

interface SamplerBinding { isSampler?: boolean; name: string; texture?: TextureLike | null }
interface TextureLike {
  wrapS?: number; wrapT?: number; wrapR?: number; magFilter?: number; minFilter?: number;
  anisotropy?: number; isDepthTexture?: boolean; compareFunction?: number | null;
}
interface BuilderLike {
  material: unknown;
  bindings: Record<string, Record<string, SamplerBinding[]>>;
  bindGroups: unknown;
  bindingsIndexes: Record<string, { binding: number; group: number }>;
  fragmentShader: string;
  renderer?: { backend?: { device?: { limits?: { maxSamplersPerShaderStage?: number } } } };
  getUniforms: (stage: string) => string;
}

/** The sampler state a texture asks for (WebGPUTextureUtils.createSampler's inputs). */
export function samplerKey(t: TextureLike | null | undefined): string {
  if (!t) return 'none';
  const cmp = t.isDepthTexture === true && t.compareFunction !== null && t.compareFunction !== undefined ? t.compareFunction : 'none';
  return [t.wrapS, t.wrapT, t.wrapR, t.magFilter, t.minFilter, t.anisotropy, cmp].join(',');
}

/**
 * The plan for one fragment stage: per group, the sampler names to drop and
 * the kept name each one maps to. Null when the stage is at or under `limit`.
 */
export function planSharedSamplers(
  groups: Record<string, SamplerBinding[]>, limit: number,
): Map<string, Map<string, string>> | null {
  let n = 0;
  for (const arr of Object.values(groups)) for (const b of arr) if (b.isSampler === true) n += 1;
  if (n <= limit) return null;
  const plan = new Map<string, Map<string, string>>();
  for (const [g, arr] of Object.entries(groups)) {
    const kept = new Map<string, string>();
    const drop = new Map<string, string>();
    for (const b of arr) {
      if (b.isSampler !== true) continue;
      const k = samplerKey(b.texture);
      const first = kept.get(k);
      if (first === undefined) kept.set(k, b.name);
      else drop.set(b.name, first);
    }
    if (drop.size > 0) plan.set(g, drop);
  }
  return plan;
}

/**
 * Removes the dropped sampler declarations from one stage's uniform block and
 * moves the later binding numbers of each group down. Returns the new block
 * and the count removed per group index.
 */
export function stripSamplerDeclarations(
  block: string, dropped: Set<string>, groupIndex: Map<string, number>,
): { block: string; removed: Map<number, number[]> } {
  const removed = new Map<number, number[]>();
  const decl = /@binding\( (\d+) \) @group\( (\d+) \) var (\w+) : sampler(?:_comparison)?;\n?/g;
  let out = block.replace(decl, (m, bi: string, gi: string, name: string) => {
    if (!dropped.has(name)) return m;
    const g = Number(gi);
    const list = removed.get(g) ?? [];
    list.push(Number(bi));
    removed.set(g, list);
    return '';
  });
  out = out.replace(/@binding\( (\d+) \) @group\( (\d+) \)/g, (m, bi: string, gi: string) => {
    const list = removed.get(Number(gi));
    if (!list) return m;
    const b = Number(bi);
    const shift = list.filter((x) => x < b).length;
    return shift === 0 ? m : `@binding( ${b - shift} ) @group( ${gi} )`;
  });
  void groupIndex;
  return { block: out, removed };
}

const PATCHED = Symbol.for('aralia.ocean.sharedSamplers');

function patchBuilderClass(proto: Record<PropertyKey, unknown>): void {
  if (Object.prototype.hasOwnProperty.call(proto, PATCHED)) return;
  proto[PATCHED] = true;
  const origBuildCode = proto.buildCode as (this: BuilderLike) => void;
  proto.buildCode = function (this: BuilderLike): void {
    const frag = this.material !== null && this.material !== undefined ? this.bindings?.fragment : undefined;
    const limit = this.renderer?.backend?.device?.limits?.maxSamplersPerShaderStage ?? 16;
    const plan = frag ? planSharedSamplers(frag, limit) : null;
    if (plan === null || frag === undefined) { origBuildCode.call(this); return; }
    const dropped = new Map<string, string>();
    for (const [g, drop] of plan) {
      frag[g] = frag[g].filter((b) => !(b.isSampler === true && drop.has(b.name)));
      for (const [d, k] of drop) dropped.set(d, k);
    }
    // The bind groups are made from the arrays in sortBindingGroups (buildCode's first step).
    this.bindGroups = null;
    const origGetUniforms = this.getUniforms;
    // An arrow function keeps this builder as `this` (no alias), as `self` did.
    this.getUniforms = (stage: string): string => {
      const block = origGetUniforms.call(this, stage);
      if (stage !== 'fragment') return block;
      const r = stripSamplerDeclarations(block, new Set(dropped.keys()), new Map());
      // The next stage's bindings continue after the fragment's, as many lower.
      for (const [gi, list] of r.removed) {
        for (const idx of Object.values(this.bindingsIndexes)) if (idx.group === gi) idx.binding -= list.length;
      }
      return r.block;
    };
    try {
      origBuildCode.call(this);
    } finally {
      delete (this as unknown as Record<string, unknown>).getUniforms;
    }
    let code = this.fragmentShader;
    for (const [d, k] of dropped) code = code.replace(new RegExp(`\\b${d}\\b`, 'g'), k);
    this.fragmentShader = code;
  };
}

/**
 * Installs the patch: on the first node build, on the builder's own class
 * (three does not export WGSLNodeBuilder). Returns false when already set.
 */
export function installSharedSamplers(NodeBuilderClass: { prototype: Record<PropertyKey, unknown> }): boolean {
  const base = NodeBuilderClass.prototype;
  if (Object.prototype.hasOwnProperty.call(base, PATCHED)) return false;
  base[PATCHED] = true;
  const origBuild = base.build as (this: object, ...a: unknown[]) => unknown;
  base.build = function (this: object, ...a: unknown[]): unknown {
    const proto = Object.getPrototypeOf(this) as Record<PropertyKey, unknown>;
    if (proto !== base && Object.prototype.hasOwnProperty.call(proto, 'buildCode')) patchBuilderClass(proto);
    return origBuild.apply(this, a);
  };
  return true;
}

export const OCEAN_SHARED_SAMPLERS = installSharedSamplers(THREE.NodeBuilder as unknown as { prototype: Record<PropertyKey, unknown> });
