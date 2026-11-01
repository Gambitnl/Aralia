/** @file Shared original TSL expression alias for ocean surface source modules. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 04:16:12
 * Dependents: systems/world3d/ocean/oceanSurface.ts, systems/world3d/ocean/oceanSurfaceShade.ts, systems/world3d/ocean/oceanSurfaceShadeParams.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * A TSL node expression.
 *
 * three 0.172 does not export `ShaderNodeObject` from `three/tsl`, and the
 * concrete node classes differ per expression — `vec2(a, b)` is a JoinNode
 * while `vec2(a, b).add(c)` is an OperatorNode. Naming one of them in a helper
 * signature rejects the other. This alias is the honest statement that the
 * shape is not expressible with the types this version ships.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TslNode = any;
