/**
 * React package facade for the entity renderer. The implementation lives with
 * components; keeping this entry preserves WP-REACT and future @entity/react
 * exports without moving React or frame lifecycle work into the engine core.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 24/10/2026, 20:48:19
 * Dependents: react/index.ts, systems/entities3d/three/Entity3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type { Entity3DProps } from '@/components/entities3d/Entity3D';
export { Entity3D } from '@/components/entities3d/Entity3D';
