/**
 * @file index.ts — the React entry point for the entity engine.
 *
 * Everything that needs React (or @react-three/fiber) lives behind this door,
 * keeping the engine tree under src/systems/entities3d framework-free. This is
 * the source entry a future '@entity/react' package export would point at.
 *
 * Called by: R3F scene hosts
 * Depends on: src/react modules only
 */

export type { Entity3DProps } from './Entity3D';
export { Entity3D } from './Entity3D';
