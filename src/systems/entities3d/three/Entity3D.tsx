/**
 * @file Entity3D.tsx — compatibility re-export.
 *
 * The React Three Fiber wrapper moved to src/react/Entity3D.tsx (T15 /
 * WP-REACT) so that src/systems/entities3d — the portable engine — contains no
 * React import and depends on three only.
 *
 * @preservation This shim stays so every existing deep import of
 * '@/systems/entities3d/three/Entity3D' keeps resolving unchanged. Prefer
 * importing from '@/react' in new code.
 */
export type { Entity3DProps } from '@/react/Entity3D';
export { Entity3D } from '@/react/Entity3D';
