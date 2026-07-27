/**
 * @file statueGeometry.ts — owned, seeded monument geometry: statue / plinth,
 * milestone / waymarker, wayside shrine.
 *
 * Replaces the boulder reuse for `statue`, `milestone` and `wayside-shrine`
 * (beautification wave, owned-generators slice).
 *  - statue: stepped plinth + abstract weathered figure (torso, head, one
 *    raised arm) — reads "worn saint" at walking distance without needing a
 *    sculpt.
 *  - milestone: short rounded-top stone stump, slightly sunk and leaning.
 *  - shrine: small stone niche box on a post, tiny gable, offering ledge.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
export type MonumentKind = 'statue' | 'milestone' | 'shrine';
export declare function createStatueGeometry(seed: number, kind?: MonumentKind): THREE.BufferGeometry;
