/**
 * @file gravestoneGeometry.ts — owned, seeded graveyard monument geometry.
 *
 * Replaces the boulder reuse for `gravestone`, `tomb` and `stone-cross` in
 * GroundProps (beautification wave, owned-generators slice). Three kinds:
 *  - headstone: a thin slab (rounded-top or square per seed) with a small
 *    plinth, tilted a few degrees so rows read weathered, not machine-set.
 *  - tomb: a low sarcophagus box with a stepped lid.
 *  - cross: a stone cross on a two-step base.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed
 * (unit-tested in __tests__/townPropGeometry.test.ts).
 */
import * as THREE from 'three';
export type GravestoneKind = 'headstone' | 'tomb' | 'cross';
export declare function createGravestoneGeometry(seed: number, kind?: GravestoneKind): THREE.BufferGeometry;
