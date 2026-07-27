import * as THREE from 'three';
/**
 * Patch every MeshStandardMaterial under `groupRef` with a fresnel rim.
 * `deps` should change whenever the model's mesh tree is rebuilt (body plan /
 * character identity) so newly created materials get patched too.
 */
export declare function useFresnelRim(groupRef: React.RefObject<THREE.Group | null>, deps: ReadonlyArray<unknown>): void;
