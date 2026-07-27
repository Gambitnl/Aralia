/**
 * @file scarecrowGeometry.ts — owned, seeded scarecrow geometry.
 *
 * Replaces the barrel reuse for `scarecrow` (beautification wave,
 * owned-generators slice): a leaning pole + crossbar, a sacking head, a
 * canvas "coat" block with ragged hem, straw tufts at the wrists and a hat on
 * most seeds. Silhouette is the whole job here — the T-pose reads instantly
 * in a field.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
export declare function createScarecrowGeometry(seed: number): THREE.BufferGeometry;
