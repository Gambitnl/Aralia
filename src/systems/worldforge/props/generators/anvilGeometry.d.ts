/**
 * @file anvilGeometry.ts — owned, seeded smithy-street furniture: anvil on a
 * stump, and a foot-treadle grindstone.
 *
 * Replaces the crate reuse for `anvil` and the boulder reuse for `grindstone`
 * (beautification wave, owned-generators slice).
 *  - anvil: oak stump + iron body with a stepped waist, flat face and a
 *    tapered horn — the horn is the read at walking scale.
 *  - grindstone: A-frame wooden trestle + big stone wheel on an axle +
 *    treadle board.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
export type SmithyKind = 'anvil' | 'grindstone';
export declare function createAnvilGeometry(seed: number, kind?: SmithyKind): THREE.BufferGeometry;
