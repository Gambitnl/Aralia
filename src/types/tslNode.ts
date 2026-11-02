/**
 * @file The one shared alias for a three.js TSL node expression.
 *
 * three 0.172 does not export `ShaderNodeObject` from `three/tsl`, and the
 * concrete node classes differ per expression: `vec2(a, b)` is a JoinNode,
 * while `vec2(a, b).add(c)` is an OperatorNode. A helper signature that names
 * one of them rejects the other. This alias states that the shape is not
 * expressible with the types this version ships.
 *
 * Added 2026-11-02 (GG-588). Before, each GPU node, ocean and river module
 * declared its own `any` alias with its own eslint-disable comment. The
 * production debt ratchet counts each copy, so new node modules grew the debt.
 * Import this alias instead, and keep the `any` in this one place until a three
 * upgrade ships a usable node type.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 02/11/2026, 23:06:19
 * Dependents: components/World3D/gpu/grassWindNode.ts, components/World3D/gpu/instanceNodes.ts, components/World3D/gpu/riverFootprintCut.ts, components/World3D/gpu/roadSurfaceNode.ts, components/World3D/gpu/substanceGroundNode.ts, components/World3D/gpu/terrainSurfaceNoiseNode.ts, components/World3D/gpu/treeTintNode.ts, components/World3D/gpu/waterSurfaceNode.ts, components/World3D/gpu/worldGpuSky.ts, components/World3D/water/riverWorldSite.ts, systems/world3d/ocean/oceanBeachTypes.ts, systems/world3d/ocean/oceanFoamReaderTypes.ts, systems/world3d/ocean/oceanMouth.ts, systems/world3d/ocean/oceanRocksMaterial.ts, systems/world3d/ocean/oceanSurfaceNodeTypes.ts, systems/world3d/ocean/oceanWakeReaderTypes.ts, systems/worldforge/terrain/flipConvexContact.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TSL node chains have no expressible type in three 0.172.
export type TslNode = any;
